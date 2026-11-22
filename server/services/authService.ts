import type { AuthenticatedUser, PublicUser } from '../../shared/types.ts';
import { DEFAULT_AVATAR_ID } from '../../shared/avatars.ts';
import type { AppConfig } from '../config/env.ts';
import type { DuelZoneDatabase } from '../repositories/database.ts';
import {
  generateId,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../utils/crypto.ts';
import { AppError } from '../utils/errors.ts';

interface UserRow {
  id: string;
  username: string;
  username_normalized: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  avatar: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface AuthSessionResult {
  user: AuthenticatedUser;
  token: string;
  sessionId: string;
  expiresAt: string;
}

function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar: row.avatar,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

export class AuthService {
  private readonly database: DuelZoneDatabase;
  private readonly config: AppConfig;

  constructor(database: DuelZoneDatabase, config: AppConfig) {
    this.database = database;
    this.config = config;
  }

  public async register(input: {
    username: string;
    email: string;
    password: string;
    avatar?: string;
  }): Promise<AuthSessionResult> {
    const username = input.username.trim();
    const usernameNorm = username.toLowerCase();
    const email = input.email.trim().toLowerCase();
    const avatar = input.avatar || DEFAULT_AVATAR_ID;

    // Pre-check duplicates to provide safe, clear feedback (FR-AUTH-10)
    const existingUsername = this.database.db
      .prepare('SELECT id FROM users WHERE username_normalized = ?')
      .get(usernameNorm);
    if (existingUsername) {
      throw new AppError(409, 'USERNAME_TAKEN', 'That username is already in use. Please choose another.');
    }

    const existingEmail = this.database.db
      .prepare('SELECT id FROM users WHERE email_normalized = ?')
      .get(email);
    if (existingEmail) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with that email address already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date().toISOString();
    const userId = generateId();
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000).toISOString();

    try {
      this.database.transaction(() => {
        this.database.db
          .prepare(
            `INSERT INTO users (id, username, username_normalized, email, email_normalized, password_hash, avatar, bio, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
          )
          .run(userId, username, usernameNorm, email, email, passwordHash, avatar, now, now);

        this.database.db
          .prepare(
            `INSERT INTO player_stats (user_id, total_xp, level, rank, updated_at)
             VALUES (?, 0, 1, 'Bronze', ?)`
          )
          .run(userId, now);

        this.database.db
          .prepare(
            `INSERT INTO sessions (id, user_id, expires_at, revoked_at, created_at)
             VALUES (?, ?, ?, NULL, ?)`
          )
          .run(sessionId, userId, expiresAt, now);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('username_normalized')) {
        throw new AppError(409, 'USERNAME_TAKEN', 'That username is already in use.');
      }
      if (msg.includes('email_normalized')) {
        throw new AppError(409, 'EMAIL_TAKEN', 'An account with that email address already exists.');
      }
      throw err;
    }

    const token = signSessionToken(
      { sub: userId, sid: sessionId, username },
      this.config.jwtSecret,
      this.config.sessionTtlSeconds
    );

    return {
      user: {
        id: userId,
        username,
        email,
        avatar,
        bio: '',
        createdAt: now,
      },
      token,
      sessionId,
      expiresAt,
    };
  }

  public async login(input: { identifier: string; password: string }): Promise<AuthSessionResult> {
    const normalized = input.identifier.trim().toLowerCase();
    const row = this.database.db
      .prepare('SELECT * FROM users WHERE email_normalized = ? OR username_normalized = ?')
      .get(normalized, normalized) as UserRow | undefined;

    if (!row) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username/email or password.');
    }

    const valid = await verifyPassword(input.password, row.password_hash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username/email or password.');
    }

    const now = new Date().toISOString();
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000).toISOString();

    this.database.db
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, revoked_at, created_at)
         VALUES (?, ?, ?, NULL, ?)`
      )
      .run(sessionId, row.id, expiresAt, now);

    const token = signSessionToken(
      { sub: row.id, sid: sessionId, username: row.username },
      this.config.jwtSecret,
      this.config.sessionTtlSeconds
    );

    return {
      user: toAuthenticatedUser(row),
      token,
      sessionId,
      expiresAt,
    };
  }

  public logout(sessionId: string): void {
    const now = new Date().toISOString();
    this.database.db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(now, sessionId);
  }

  public verifyToken(token: string): { user: AuthenticatedUser; sessionId: string } | null {
    const payload = verifySessionToken(token, this.config.jwtSecret);
    if (!payload) return null;

    const session = this.database.db
      .prepare('SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE id = ?')
      .get(payload.sid) as SessionRow | undefined;

    if (!session || session.revoked_at !== null || session.user_id !== payload.sub) {
      return null;
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      return null;
    }

    const userRow = this.database.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(payload.sub) as UserRow | undefined;

    if (!userRow) return null;

    return {
      user: toAuthenticatedUser(userRow),
      sessionId: session.id,
    };
  }

  public getUserById(userId: string): AuthenticatedUser | null {
    const row = this.database.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow | undefined;
    return row ? toAuthenticatedUser(row) : null;
  }

  public getPublicProfileByUsername(username: string): PublicUser | null {
    const row = this.database.db
      .prepare('SELECT * FROM users WHERE username_normalized = ?')
      .get(username.trim().toLowerCase()) as UserRow | undefined;
    return row ? toPublicUser(row) : null;
  }

  public updateProfile(
    userId: string,
    updates: { username?: string; avatar?: string; bio?: string }
  ): AuthenticatedUser {
    const current = this.database.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow | undefined;

    if (!current) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
    }

    const nextUsername = updates.username !== undefined ? updates.username.trim() : current.username;
    const nextUsernameNorm = nextUsername.toLowerCase();
    const nextAvatar = updates.avatar !== undefined ? updates.avatar : current.avatar;
    const nextBio = updates.bio !== undefined ? updates.bio.trim() : current.bio;

    if (nextUsernameNorm !== current.username_normalized) {
      const conflict = this.database.db
        .prepare('SELECT id FROM users WHERE username_normalized = ? AND id != ?')
        .get(nextUsernameNorm, userId);
      if (conflict) {
        throw new AppError(409, 'USERNAME_TAKEN', 'That username is already in use.');
      }
    }

    const now = new Date().toISOString();
    this.database.db
      .prepare(
        `UPDATE users
         SET username = ?, username_normalized = ?, avatar = ?, bio = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(nextUsername, nextUsernameNorm, nextAvatar, nextBio, now, userId);

    const updated = this.database.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow;

    return toAuthenticatedUser(updated);
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepSessionId?: string
  ): Promise<void> {
    const row = this.database.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow | undefined;

    if (!row) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
    }

    const valid = await verifyPassword(currentPassword, row.password_hash);
    if (!valid) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
    }

    const nextHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    this.database.transaction(() => {
      this.database.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(nextHash, now, userId);

      // Revoke all other active sessions on password change
      if (keepSessionId) {
        this.database.db
          .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL')
          .run(now, userId, keepSessionId);
      } else {
        this.database.db
          .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
          .run(now, userId);
      }
    });
  }
}
