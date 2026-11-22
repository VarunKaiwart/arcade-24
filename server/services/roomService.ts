import type { GameType, RoomInfo } from '../../shared/types.ts';
import type { AppConfig } from '../config/env.ts';
import type { DuelZoneDatabase } from '../repositories/database.ts';
import { generateId, generateRoomCode } from '../utils/crypto.ts';
import { AppError } from '../utils/errors.ts';
import type { MatchService } from './matchService.ts';

interface RoomRow {
  id: string;
  code: string;
  game_type: GameType;
  host_user_id: string;
  guest_user_id: string | null;
  match_id: string | null;
  status: 'WAITING' | 'JOINED' | 'CANCELLED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  host_username?: string;
  host_avatar?: string;
}

function mapRoomRow(row: RoomRow): RoomInfo {
  return {
    id: row.id,
    code: row.code,
    gameType: row.game_type,
    hostUserId: row.host_user_id,
    hostUsername: row.host_username ?? 'Host',
    hostAvatar: row.host_avatar ?? 'cyber-hex',
    guestUserId: row.guest_user_id,
    matchId: row.match_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class RoomService {
  private readonly database: DuelZoneDatabase;
  private readonly config: AppConfig;
  private readonly matchService: MatchService;

  constructor(database: DuelZoneDatabase, config: AppConfig, matchService: MatchService) {
    this.database = database;
    this.config = config;
    this.matchService = matchService;
  }

  public expireStaleRooms(): void {
    const now = new Date().toISOString();
    this.database.db
      .prepare("UPDATE rooms SET status = 'EXPIRED' WHERE status = 'WAITING' AND expires_at <= ?")
      .run(now);
  }

  public getWaitingRoomForUser(userId: string): RoomInfo | null {
    this.expireStaleRooms();
    const row = this.database.db
      .prepare(
        `SELECT r.*, u.username AS host_username, u.avatar AS host_avatar
         FROM rooms r
         JOIN users u ON u.id = r.host_user_id
         WHERE r.host_user_id = ? AND r.status = 'WAITING'
         ORDER BY r.created_at DESC
         LIMIT 1`
      )
      .get(userId) as RoomRow | undefined;
    return row ? mapRoomRow(row) : null;
  }

  public createRoom(params: {
    hostUserId: string;
    hostUsername: string;
    hostAvatar: string;
    gameType: GameType;
  }): RoomInfo {
    this.expireStaleRooms();

    const activeMatch = this.matchService.getActiveMatchForUser(params.hostUserId);
    if (activeMatch) {
      throw new AppError(
        409,
        'ACTIVE_MATCH_EXISTS',
        'You already have an active match. Finish or forfeit it before creating a room.'
      );
    }

    // Cancel any previous waiting room by this host so a user only hosts one waiting room at a time
    this.database.db
      .prepare("UPDATE rooms SET status = 'CANCELLED' WHERE host_user_id = ? AND status = 'WAITING'")
      .run(params.hostUserId);

    const id = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.roomTtlMinutes * 60 * 1000).toISOString();

    let code = '';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateRoomCode(6);
      const exists = this.database.db
        .prepare('SELECT id FROM rooms WHERE code = ?')
        .get(candidate);
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new AppError(500, 'ROOM_CODE_GENERATION_FAILED', 'Unable to generate unique room code.');
    }

    this.database.db
      .prepare(
        `INSERT INTO rooms (id, code, game_type, host_user_id, guest_user_id, match_id, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, NULL, NULL, 'WAITING', ?, ?)`
      )
      .run(id, code, params.gameType, params.hostUserId, expiresAt, now.toISOString());

    return {
      id,
      code,
      gameType: params.gameType,
      hostUserId: params.hostUserId,
      hostUsername: params.hostUsername,
      hostAvatar: params.hostAvatar,
      guestUserId: null,
      matchId: null,
      status: 'WAITING',
      expiresAt,
      createdAt: now.toISOString(),
    };
  }

  /**
   * Atomically validates and joins a private room inside a SQLite transaction (FR-ROOM-04..09).
   * Prevents race conditions when two guests attempt to join simultaneously.
   */
  public joinRoom(params: {
    code: string;
    guestUserId: string;
    guestUsername: string;
    guestAvatar: string;
  }): { room: RoomInfo; matchId: string; hostUserId: string } {
    const normalizedCode = params.code.trim().toUpperCase();

    return this.database.transaction(() => {
      const nowIso = new Date().toISOString();
      const row = this.database.db
        .prepare(
          `SELECT r.*, u.username AS host_username, u.avatar AS host_avatar
           FROM rooms r
           JOIN users u ON u.id = r.host_user_id
           WHERE r.code = ?`
        )
        .get(normalizedCode) as RoomRow | undefined;

      if (!row) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Room code not found. Double-check the code and try again.');
      }

      if (row.status === 'WAITING' && row.expires_at <= nowIso) {
        this.database.db
          .prepare("UPDATE rooms SET status = 'EXPIRED' WHERE id = ?")
          .run(row.id);
        throw new AppError(410, 'ROOM_EXPIRED', 'This private room has expired.');
      }

      if (row.status === 'EXPIRED') {
        throw new AppError(410, 'ROOM_EXPIRED', 'This private room has expired.');
      }

      if (row.status === 'CANCELLED') {
        throw new AppError(410, 'ROOM_CANCELLED', 'This private room was cancelled by the host.');
      }

      if (row.status === 'JOINED' || row.guest_user_id) {
        throw new AppError(409, 'ROOM_FULL', 'This private room is already full.');
      }

      if (row.host_user_id === params.guestUserId) {
        throw new AppError(400, 'CANNOT_JOIN_OWN_ROOM', 'You cannot join your own private room.');
      }

      const guestActive = this.matchService.getActiveMatchForUser(params.guestUserId);
      if (guestActive) {
        throw new AppError(
          409,
          'ACTIVE_MATCH_EXISTS',
          'You already have an active match. Finish it before joining a room.'
        );
      }

      const hostActive = this.matchService.getActiveMatchForUser(row.host_user_id);
      if (hostActive) {
        throw new AppError(409, 'HOST_BUSY', 'The room host is currently in another active match.');
      }

      // Cancel any waiting room the guest might have hosted
      this.database.db
        .prepare("UPDATE rooms SET status = 'CANCELLED' WHERE host_user_id = ? AND status = 'WAITING'")
        .run(params.guestUserId);

      // Atomically claim the room slot
      const claim = this.database.db
        .prepare(
          `UPDATE rooms
           SET guest_user_id = ?, status = 'JOINED'
           WHERE id = ? AND status = 'WAITING' AND guest_user_id IS NULL`
        )
        .run(params.guestUserId, row.id);

      if (Number(claim.changes) === 0) {
        throw new AppError(409, 'ROOM_FULL', 'This private room was just claimed by another player.');
      }

      const match = this.matchService.createMatch({
        gameType: row.game_type,
        mode: 'PRIVATE',
        player1: {
          userId: row.host_user_id,
          username: row.host_username || 'Host',
          avatar: row.host_avatar || 'cyber-hex',
        },
        player2: {
          userId: params.guestUserId,
          username: params.guestUsername,
          avatar: params.guestAvatar,
        },
      });

      this.database.db
        .prepare('UPDATE rooms SET match_id = ? WHERE id = ?')
        .run(match.id, row.id);

      const updatedRoom: RoomInfo = {
        ...mapRoomRow(row),
        guestUserId: params.guestUserId,
        matchId: match.id,
        status: 'JOINED',
      };

      return {
        room: updatedRoom,
        matchId: match.id,
        hostUserId: row.host_user_id,
      };
    });
  }

  public cancelRoom(params: { userId: string; code?: string; roomId?: string }): RoomInfo {
    this.expireStaleRooms();

    const row = params.code
      ? (this.database.db
          .prepare(
            `SELECT r.*, u.username AS host_username, u.avatar AS host_avatar
             FROM rooms r JOIN users u ON u.id = r.host_user_id
             WHERE r.code = ?`
          )
          .get(params.code.trim().toUpperCase()) as RoomRow | undefined)
      : params.roomId
        ? (this.database.db
            .prepare(
              `SELECT r.*, u.username AS host_username, u.avatar AS host_avatar
               FROM rooms r JOIN users u ON u.id = r.host_user_id
               WHERE r.id = ?`
            )
            .get(params.roomId) as RoomRow | undefined)
        : (this.database.db
            .prepare(
              `SELECT r.*, u.username AS host_username, u.avatar AS host_avatar
               FROM rooms r JOIN users u ON u.id = r.host_user_id
               WHERE r.host_user_id = ? AND r.status = 'WAITING'
               ORDER BY r.created_at DESC LIMIT 1`
            )
            .get(params.userId) as RoomRow | undefined);

    if (!row) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Waiting room not found.');
    }
    if (row.host_user_id !== params.userId) {
      throw new AppError(403, 'FORBIDDEN_ROOM', 'Only the room host can cancel this room.');
    }
    if (row.status !== 'WAITING') {
      throw new AppError(409, 'ROOM_NOT_WAITING', 'This room can no longer be cancelled.');
    }

    this.database.db
      .prepare("UPDATE rooms SET status = 'CANCELLED' WHERE id = ? AND status = 'WAITING'")
      .run(row.id);

    return {
      ...mapRoomRow(row),
      status: 'CANCELLED',
    };
  }
}
