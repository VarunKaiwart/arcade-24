import type {
  GameType,
  LeaderboardEntry,
  MatchHistoryItem,
  MatchMode,
  MatchResultType,
  MatchStatus,
  PlayerStats,
  ProgressionRank,
  XpAwardSummary,
} from '../../shared/types.ts';
import {
  XP_REWARDS,
  calculateLevelProgress,
  calculateRank,
  calculateWinRate,
} from '../../shared/progression.ts';
import type { DuelZoneDatabase } from '../repositories/database.ts';
import { generateId } from '../utils/crypto.ts';

interface PlayerStatsRow {
  user_id: string;
  total_xp: number;
  level: number;
  rank: string;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  ttt_matches: number;
  ttt_wins: number;
  ttt_losses: number;
  ttt_draws: number;
  rps_matches: number;
  rps_wins: number;
  rps_losses: number;
  rps_draws: number;
  c4_matches: number;
  c4_wins: number;
  c4_losses: number;
  c4_draws: number;
  updated_at: string;
}

function mapStatsRow(row: PlayerStatsRow): PlayerStats {
  const progress = calculateLevelProgress(row.total_xp);
  const rank = calculateRank(row.total_xp);
  return {
    userId: row.user_id,
    totalXp: row.total_xp,
    level: progress.level,
    rank,
    currentLevelXp: progress.currentLevelXp,
    nextLevelXp: progress.nextLevelXp,
    totalMatches: row.total_matches,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: calculateWinRate(row.wins, row.total_matches),
    perGame: {
      TICTACTOE: {
        matches: row.ttt_matches,
        wins: row.ttt_wins,
        losses: row.ttt_losses,
        draws: row.ttt_draws,
      },
      RPS: {
        matches: row.rps_matches,
        wins: row.rps_wins,
        losses: row.rps_losses,
        draws: row.rps_draws,
      },
      CONNECT_FOUR: {
        matches: row.c4_matches,
        wins: row.c4_wins,
        losses: row.c4_losses,
        draws: row.c4_draws,
      },
    },
    updatedAt: row.updated_at,
  };
}

export class ProgressionService {
  private readonly database: DuelZoneDatabase;

  constructor(database: DuelZoneDatabase) {
    this.database = database;
  }

  public getPlayerStats(userId: string): PlayerStats | null {
    const row = this.database.db
      .prepare('SELECT * FROM player_stats WHERE user_id = ?')
      .get(userId) as PlayerStatsRow | undefined;
    return row ? mapStatsRow(row) : null;
  }

  /**
   * Idempotently awards XP and updates player_stats inside an already-open or standalone transaction.
   * Because xp_ledger enforces UNIQUE(user_id, match_id), calling this twice for the same match
   * cannot double-award XP (FR-MATCH-07, NFR-08).
   */
  public awardMatchProgressionInTx(params: {
    matchId: string;
    gameType: GameType;
    player1UserId: string;
    player2UserId: string;
    winnerUserId: string | null;
    result: MatchResultType;
  }): XpAwardSummary[] {
    if (params.result === 'ABANDONED') {
      return [];
    }

    const now = new Date().toISOString();
    const participants: Array<{ userId: string; reason: 'WIN' | 'LOSS' | 'DRAW' }> = [];

    if (params.result === 'DRAW' || !params.winnerUserId) {
      participants.push({ userId: params.player1UserId, reason: 'DRAW' });
      participants.push({ userId: params.player2UserId, reason: 'DRAW' });
    } else {
      const winnerId = params.winnerUserId;
      const loserId =
        winnerId === params.player1UserId ? params.player2UserId : params.player1UserId;
      participants.push({ userId: winnerId, reason: 'WIN' });
      participants.push({ userId: loserId, reason: 'LOSS' });
    }

    const awards: XpAwardSummary[] = [];

    for (const p of participants) {
      const amount = XP_REWARDS[p.reason];
      // INSERT OR IGNORE respects UNIQUE(user_id, match_id) idempotency key
      const ledgerInsert = this.database.db
        .prepare(
          `INSERT OR IGNORE INTO xp_ledger (id, user_id, match_id, amount, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(generateId(), p.userId, params.matchId, amount, p.reason, now);

      if (Number(ledgerInsert.changes) === 0) {
        // Already awarded for this (userId, matchId) — skip safely
        continue;
      }

      const currentStats = this.database.db
        .prepare('SELECT * FROM player_stats WHERE user_id = ?')
        .get(p.userId) as PlayerStatsRow | undefined;

      const prevXp = currentStats?.total_xp ?? 0;
      const prevLevel = calculateLevelProgress(prevXp).level;
      const prevRank = calculateRank(prevXp);

      const nextXp = prevXp + amount;
      const nextLevel = calculateLevelProgress(nextXp).level;
      const nextRank: ProgressionRank = calculateRank(nextXp);

      const winInc = p.reason === 'WIN' ? 1 : 0;
      const lossInc = p.reason === 'LOSS' ? 1 : 0;
      const drawInc = p.reason === 'DRAW' ? 1 : 0;

      const tttMatch = params.gameType === 'TICTACTOE' ? 1 : 0;
      const rpsMatch = params.gameType === 'RPS' ? 1 : 0;
      const c4Match = params.gameType === 'CONNECT_FOUR' ? 1 : 0;

      this.database.db
        .prepare(
          `UPDATE player_stats
           SET total_xp = ?,
               level = ?,
               rank = ?,
               total_matches = total_matches + 1,
               wins = wins + ?,
               losses = losses + ?,
               draws = draws + ?,
               ttt_matches = ttt_matches + ?,
               ttt_wins = ttt_wins + ?,
               ttt_losses = ttt_losses + ?,
               ttt_draws = ttt_draws + ?,
               rps_matches = rps_matches + ?,
               rps_wins = rps_wins + ?,
               rps_losses = rps_losses + ?,
               rps_draws = rps_draws + ?,
               c4_matches = c4_matches + ?,
               c4_wins = c4_wins + ?,
               c4_losses = c4_losses + ?,
               c4_draws = c4_draws + ?,
               updated_at = ?
           WHERE user_id = ?`
        )
        .run(
          nextXp,
          nextLevel,
          nextRank,
          winInc,
          lossInc,
          drawInc,
          tttMatch,
          tttMatch ? winInc : 0,
          tttMatch ? lossInc : 0,
          tttMatch ? drawInc : 0,
          rpsMatch,
          rpsMatch ? winInc : 0,
          rpsMatch ? lossInc : 0,
          rpsMatch ? drawInc : 0,
          c4Match,
          c4Match ? winInc : 0,
          c4Match ? lossInc : 0,
          c4Match ? drawInc : 0,
          now,
          p.userId
        );

      awards.push({
        userId: p.userId,
        amount,
        reason: p.reason,
        totalXp: nextXp,
        level: nextLevel,
        rank: nextRank,
        leveledUp: nextLevel > prevLevel,
        rankedUp: nextRank !== prevRank,
      });
    }

    return awards;
  }

  public getAwardsForMatch(matchId: string): XpAwardSummary[] {
    const rows = this.database.db
      .prepare(
        `SELECT xl.user_id, xl.amount, xl.reason, ps.total_xp, ps.level, ps.rank
         FROM xp_ledger xl
         JOIN player_stats ps ON ps.user_id = xl.user_id
         WHERE xl.match_id = ?`
      )
      .all(matchId) as Array<{
      user_id: string;
      amount: number;
      reason: 'WIN' | 'LOSS' | 'DRAW';
      total_xp: number;
      level: number;
      rank: ProgressionRank;
    }>;

    return rows.map((row) => ({
      userId: row.user_id,
      amount: row.amount,
      reason: row.reason,
      totalXp: row.total_xp,
      level: row.level,
      rank: row.rank,
      leveledUp: false,
      rankedUp: false,
    }));
  }

  public getLeaderboard(params: {
    page: number;
    limit: number;
    currentUserId?: string;
  }): {
    entries: LeaderboardEntry[];
    currentUserEntry: LeaderboardEntry | null;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } {
    const totalRow = this.database.db
      .prepare('SELECT COUNT(*) AS count FROM player_stats')
      .get() as { count: number };
    const total = Number(totalRow?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / params.limit));
    const offset = (params.page - 1) * params.limit;

    const rows = this.database.db
      .prepare(
        `SELECT
           u.id AS user_id,
           u.username,
           u.avatar,
           u.created_at,
           ps.total_xp,
           ps.level,
           ps.rank,
           ps.wins,
           ps.losses,
           ps.draws,
           ps.total_matches
         FROM player_stats ps
         JOIN users u ON u.id = ps.user_id
         ORDER BY ps.total_xp DESC, ps.wins DESC, u.created_at ASC, u.id ASC
         LIMIT ? OFFSET ?`
      )
      .all(params.limit, offset) as Array<{
      user_id: string;
      username: string;
      avatar: string;
      total_xp: number;
      level: number;
      rank: ProgressionRank;
      wins: number;
      losses: number;
      draws: number;
      total_matches: number;
    }>;

    const entries: LeaderboardEntry[] = rows.map((r, idx) => ({
      position: offset + idx + 1,
      userId: r.user_id,
      username: r.username,
      avatar: r.avatar,
      totalXp: r.total_xp,
      level: r.level,
      rank: calculateRank(r.total_xp),
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      totalMatches: r.total_matches,
      winRate: calculateWinRate(r.wins, r.total_matches),
    }));

    let currentUserEntry: LeaderboardEntry | null = null;
    if (params.currentUserId) {
      const existing = entries.find((e) => e.userId === params.currentUserId);
      if (existing) {
        currentUserEntry = existing;
      } else {
        const me = this.database.db
          .prepare(
            `SELECT
               u.id AS user_id,
               u.username,
               u.avatar,
               u.created_at,
               ps.total_xp,
               ps.level,
               ps.rank,
               ps.wins,
               ps.losses,
               ps.draws,
               ps.total_matches
             FROM player_stats ps
             JOIN users u ON u.id = ps.user_id
             WHERE u.id = ?`
          )
          .get(params.currentUserId) as
          | {
              user_id: string;
              username: string;
              avatar: string;
              created_at: string;
              total_xp: number;
              level: number;
              rank: ProgressionRank;
              wins: number;
              losses: number;
              draws: number;
              total_matches: number;
            }
          | undefined;

        if (me) {
          const aheadRow = this.database.db
            .prepare(
              `SELECT COUNT(*) AS ahead
               FROM player_stats ps
               JOIN users u ON u.id = ps.user_id
               WHERE (ps.total_xp > ?)
                  OR (ps.total_xp = ? AND ps.wins > ?)
                  OR (ps.total_xp = ? AND ps.wins = ? AND u.created_at < ?)
                  OR (ps.total_xp = ? AND ps.wins = ? AND u.created_at = ? AND u.id < ?)`
            )
            .get(
              me.total_xp,
              me.total_xp,
              me.wins,
              me.total_xp,
              me.wins,
              me.created_at,
              me.total_xp,
              me.wins,
              me.created_at,
              me.user_id
            ) as { ahead: number };

          currentUserEntry = {
            position: Number(aheadRow?.ahead ?? 0) + 1,
            userId: me.user_id,
            username: me.username,
            avatar: me.avatar,
            totalXp: me.total_xp,
            level: me.level,
            rank: calculateRank(me.total_xp),
            wins: me.wins,
            losses: me.losses,
            draws: me.draws,
            totalMatches: me.total_matches,
            winRate: calculateWinRate(me.wins, me.total_matches),
          };
        }
      }
    }

    return {
      entries,
      currentUserEntry,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
      },
    };
  }

  public getUserMatchHistory(params: {
    userId: string;
    page: number;
    limit: number;
    gameType?: 'ALL' | GameType;
    outcome?: 'ALL' | 'WIN' | 'LOSS' | 'DRAW';
  }): {
    items: MatchHistoryItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } {
    const conditions: string[] = [
      '(m.player1_user_id = ? OR m.player2_user_id = ?)',
      "m.status IN ('COMPLETED', 'ABANDONED')",
    ];
    const args: Array<string | number> = [params.userId, params.userId];

    if (params.gameType && params.gameType !== 'ALL') {
      conditions.push('m.game_type = ?');
      args.push(params.gameType);
    }

    if (params.outcome && params.outcome !== 'ALL') {
      if (params.outcome === 'WIN') {
        conditions.push('m.winner_user_id = ?');
        args.push(params.userId);
      } else if (params.outcome === 'LOSS') {
        conditions.push('m.winner_user_id IS NOT NULL AND m.winner_user_id != ?');
        args.push(params.userId);
      } else if (params.outcome === 'DRAW') {
        conditions.push("m.result = 'DRAW'");
      }
    }

    const whereSql = conditions.join(' AND ');
    const countRow = this.database.db
      .prepare(`SELECT COUNT(*) AS count FROM matches m WHERE ${whereSql}`)
      .get(...args) as { count: number };

    const total = Number(countRow?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / params.limit));
    const offset = (params.page - 1) * params.limit;

    const rows = this.database.db
      .prepare(
        `SELECT
           m.id,
           m.game_type,
           m.mode,
           m.status,
           m.result,
           m.player1_user_id,
           m.player2_user_id,
           m.player1_name_snapshot,
           m.player2_name_snapshot,
           m.player1_avatar_snapshot,
           m.player2_avatar_snapshot,
           m.winner_user_id,
           m.started_at,
           m.completed_at,
           m.created_at,
           COALESCE(xl.amount, 0) AS xp_earned
         FROM matches m
         LEFT JOIN xp_ledger xl ON xl.match_id = m.id AND xl.user_id = ?
         WHERE ${whereSql}
         ORDER BY COALESCE(m.completed_at, m.created_at) DESC
         LIMIT ? OFFSET ?`
      )
      .all(params.userId, ...args, params.limit, offset) as Array<{
      id: string;
      game_type: GameType;
      mode: MatchMode;
      status: MatchStatus;
      result: MatchResultType | null;
      player1_user_id: string;
      player2_user_id: string;
      player1_name_snapshot: string;
      player2_name_snapshot: string;
      player1_avatar_snapshot: string;
      player2_avatar_snapshot: string;
      winner_user_id: string | null;
      started_at: string | null;
      completed_at: string | null;
      created_at: string;
      xp_earned: number;
    }>;

    const items: MatchHistoryItem[] = rows.map((row) => {
      const isPlayer1 = row.player1_user_id === params.userId;
      const opponent = isPlayer1
        ? {
            userId: row.player2_user_id,
            username: row.player2_name_snapshot,
            avatar: row.player2_avatar_snapshot,
          }
        : {
            userId: row.player1_user_id,
            username: row.player1_name_snapshot,
            avatar: row.player1_avatar_snapshot,
          };

      let outcomeForUser: 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED' = 'DRAW';
      if (row.result === 'ABANDONED' || row.status === 'ABANDONED') {
        outcomeForUser = 'ABANDONED';
      } else if (row.result === 'DRAW' || !row.winner_user_id) {
        outcomeForUser = 'DRAW';
      } else if (row.winner_user_id === params.userId) {
        outcomeForUser = 'WIN';
      } else {
        outcomeForUser = 'LOSS';
      }

      return {
        id: row.id,
        gameType: row.game_type,
        mode: row.mode,
        status: row.status,
        result: row.result,
        outcomeForUser,
        opponent,
        xpEarned: Number(row.xp_earned ?? 0),
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      };
    });

    return {
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
      },
    };
  }
}
