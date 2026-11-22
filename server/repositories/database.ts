import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class DuelZoneDatabase {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA busy_timeout = 5000;');
    }

    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_normalized TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        email_normalized TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        avatar TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS player_stats (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        total_xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        rank TEXT NOT NULL DEFAULT 'Bronze',
        total_matches INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        ttt_matches INTEGER NOT NULL DEFAULT 0,
        ttt_wins INTEGER NOT NULL DEFAULT 0,
        ttt_losses INTEGER NOT NULL DEFAULT 0,
        ttt_draws INTEGER NOT NULL DEFAULT 0,
        rps_matches INTEGER NOT NULL DEFAULT 0,
        rps_wins INTEGER NOT NULL DEFAULT 0,
        rps_losses INTEGER NOT NULL DEFAULT 0,
        rps_draws INTEGER NOT NULL DEFAULT 0,
        c4_matches INTEGER NOT NULL DEFAULT 0,
        c4_wins INTEGER NOT NULL DEFAULT 0,
        c4_losses INTEGER NOT NULL DEFAULT 0,
        c4_draws INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_stats_leaderboard
        ON player_stats(total_xp DESC, wins DESC, user_id ASC);

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        game_type TEXT NOT NULL,
        host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        guest_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        match_id TEXT,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rooms_host_status ON rooms(host_user_id, status);
      CREATE INDEX IF NOT EXISTS idx_rooms_status_exp ON rooms(status, expires_at);

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        game_type TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        player1_user_id TEXT NOT NULL REFERENCES users(id),
        player2_user_id TEXT NOT NULL REFERENCES users(id),
        player1_name_snapshot TEXT NOT NULL,
        player2_name_snapshot TEXT NOT NULL,
        player1_avatar_snapshot TEXT NOT NULL,
        player2_avatar_snapshot TEXT NOT NULL,
        state_json TEXT NOT NULL,
        current_turn_user_id TEXT,
        winner_user_id TEXT,
        result TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_matches_p1_completed ON matches(player1_user_id, completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_matches_p2_completed ON matches(player2_user_id, completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_matches_gametype ON matches(game_type, created_at DESC);

      CREATE TABLE IF NOT EXISTS xp_ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, match_id)
      );

      CREATE INDEX IF NOT EXISTS idx_xp_ledger_match ON xp_ledger(match_id);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_username TEXT NOT NULL,
        sender_avatar TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_match_created ON chat_messages(match_id, created_at ASC);
    `);
  }

  /**
   * Executes a synchronous callback inside an atomic SQLite IMMEDIATE transaction.
   */
  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  public healthCheck(): boolean {
    try {
      const row = this.db.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined;
      return row?.ok === 1;
    } catch {
      return false;
    }
  }

  public close(): void {
    this.db.close();
  }
}
