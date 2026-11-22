import type {
  GameAction,
  GameState,
  GameType,
  MatchMode,
  MatchPlayer,
  MatchResultType,
  MatchSnapshot,
  MatchStatus,
  RpsState,
  XpAwardSummary,
} from '../../shared/types.ts';
import type { AppConfig } from '../config/env.ts';
import { getGameEngine } from '../games/index.ts';
import { advanceRpsNextRound, resolveRpsRoundTimeout } from '../games/rock-paper-scissors/engine.ts';
import type { DuelZoneDatabase } from '../repositories/database.ts';
import { generateId } from '../utils/crypto.ts';
import { AppError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import type { PresenceService } from './presenceService.ts';
import type { ProgressionService } from './progressionService.ts';

interface MatchRow {
  id: string;
  game_type: GameType;
  mode: MatchMode;
  status: MatchStatus;
  version: number;
  player1_user_id: string;
  player2_user_id: string;
  player1_name_snapshot: string;
  player2_name_snapshot: string;
  player1_avatar_snapshot: string;
  player2_avatar_snapshot: string;
  state_json: string;
  current_turn_user_id: string | null;
  winner_user_id: string | null;
  result: MatchResultType | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchRuntimeCallbacks {
  onStateUpdated?: (matchId: string) => void;
  onMatchCompleted?: (matchId: string, awards: XpAwardSummary[]) => void;
  onOpponentDisconnected?: (matchId: string, userId: string, gracePeriodEndsAt: string) => void;
  onOpponentReconnected?: (matchId: string, userId: string) => void;
  onRematchCreated?: (oldMatchId: string, newMatchId: string) => void;
}

interface DisconnectTimerEntry {
  timer: ReturnType<typeof setTimeout>;
  gracePeriodEndsAt: string;
}

export class MatchService {
  private readonly database: DuelZoneDatabase;
  private readonly config: AppConfig;
  private readonly progression: ProgressionService;
  private readonly presence: PresenceService;
  private callbacks: MatchRuntimeCallbacks = {};

  // Processed action IDs per match for safe WebSocket retry deduplication
  private readonly processedActions = new Map<string, Set<string>>();
  // Pending rematch requests: matchId -> Set<userId>
  private readonly rematchRequests = new Map<string, Set<string>>();
  // Active turn / round timers per match
  private readonly turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // RPS reveal transition timers per match
  private readonly rpsRevealTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Disconnect grace timers: `${matchId}:${userId}` -> timer + deadline
  private readonly disconnectTimers = new Map<string, DisconnectTimerEntry>();

  constructor(
    database: DuelZoneDatabase,
    config: AppConfig,
    progression: ProgressionService,
    presence: PresenceService
  ) {
    this.database = database;
    this.config = config;
    this.progression = progression;
    this.presence = presence;
  }

  public setCallbacks(callbacks: MatchRuntimeCallbacks): void {
    this.callbacks = callbacks;
  }

  private getTurnSeconds(gameType: GameType): number {
    if (gameType === 'TICTACTOE') return this.config.tttTurnSeconds;
    if (gameType === 'RPS') return this.config.rpsRoundSeconds;
    return this.config.connectFourTurnSeconds;
  }

  public getActiveMatchForUser(userId: string): MatchRow | null {
    const row = this.database.db
      .prepare(
        `SELECT * FROM matches
         WHERE (player1_user_id = ? OR player2_user_id = ?)
           AND status IN ('READY', 'IN_PROGRESS')
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(userId, userId) as MatchRow | undefined;
    return row ?? null;
  }

  public getMatchRow(matchId: string): MatchRow | null {
    const row = this.database.db
      .prepare('SELECT * FROM matches WHERE id = ?')
      .get(matchId) as MatchRow | undefined;
    return row ?? null;
  }

  public createMatch(params: {
    gameType: GameType;
    mode: MatchMode;
    player1: { userId: string; username: string; avatar: string };
    player2: { userId: string; username: string; avatar: string };
  }): MatchRow {
    if (params.player1.userId === params.player2.userId) {
      throw new AppError(400, 'SELF_MATCH_NOT_ALLOWED', 'Cannot create a match against yourself.');
    }

    const active1 = this.getActiveMatchForUser(params.player1.userId);
    if (active1) {
      throw new AppError(409, 'USER_IN_ACTIVE_MATCH', 'Player 1 already has an active match.');
    }
    const active2 = this.getActiveMatchForUser(params.player2.userId);
    if (active2) {
      throw new AppError(409, 'OPPONENT_IN_ACTIVE_MATCH', 'Player 2 already has an active match.');
    }

    const engine = getGameEngine(params.gameType);
    const turnSeconds = this.getTurnSeconds(params.gameType);
    const initialState = engine.createInitialState(
      {
        player1UserId: params.player1.userId,
        player2UserId: params.player2.userId,
      },
      { turnSeconds }
    );

    const id = generateId();
    const now = new Date().toISOString();
    const currentTurn = engine.getNextPlayer(initialState);

    this.database.db
      .prepare(
        `INSERT INTO matches (
          id, game_type, mode, status, version,
          player1_user_id, player2_user_id,
          player1_name_snapshot, player2_name_snapshot,
          player1_avatar_snapshot, player2_avatar_snapshot,
          state_json, current_turn_user_id, winner_user_id, result,
          started_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'IN_PROGRESS', 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`
      )
      .run(
        id,
        params.gameType,
        params.mode,
        params.player1.userId,
        params.player2.userId,
        params.player1.username,
        params.player2.username,
        params.player1.avatar,
        params.player2.avatar,
        JSON.stringify(initialState),
        currentTurn,
        now,
        now,
        now
      );

    const created = this.getMatchRow(id)!;
    this.scheduleTurnTimer(created, initialState);
    logger.info('match_created', {
      matchId: id,
      gameType: params.gameType,
      mode: params.mode,
    });
    return created;
  }

  /**
   * Builds a viewer-specific authorized MatchSnapshot (ensures hidden RPS picks are never leaked).
   */
  public getSnapshotForUser(matchId: string, viewerUserId: string): MatchSnapshot {
    const row = this.getMatchRow(matchId);
    if (!row) {
      throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');
    }
    if (row.player1_user_id !== viewerUserId && row.player2_user_id !== viewerUserId) {
      throw new AppError(403, 'FORBIDDEN_MATCH', 'You are not authorized to view this match.');
    }

    return this.buildSnapshot(row, viewerUserId);
  }

  public buildSnapshot(row: MatchRow, viewerUserId: string): MatchSnapshot {
    const engine = getGameEngine(row.game_type);
    const rawState = JSON.parse(row.state_json) as GameState;
    const sanitizedState = engine.sanitizeStateForPlayer(rawState, viewerUserId);

    const disconnectedPlayers: Record<string, string> = {};
    for (const uid of [row.player1_user_id, row.player2_user_id]) {
      const entry = this.disconnectTimers.get(`${row.id}:${uid}`);
      if (entry) {
        disconnectedPlayers[uid] = entry.gracePeriodEndsAt;
      }
    }

    const players: MatchPlayer[] = [
      {
        userId: row.player1_user_id,
        slot: 1,
        username: row.player1_name_snapshot,
        avatar: row.player1_avatar_snapshot,
        connected: !disconnectedPlayers[row.player1_user_id] && this.presence.isOnline(row.player1_user_id),
      },
      {
        userId: row.player2_user_id,
        slot: 2,
        username: row.player2_name_snapshot,
        avatar: row.player2_avatar_snapshot,
        connected: !disconnectedPlayers[row.player2_user_id] && this.presence.isOnline(row.player2_user_id),
      },
    ];

    const awards =
      row.status === 'COMPLETED' ? this.progression.getAwardsForMatch(row.id) : undefined;

    const rematchSet = this.rematchRequests.get(row.id);

    return {
      id: row.id,
      gameType: row.game_type,
      mode: row.mode,
      status: row.status,
      version: row.version,
      players,
      state: sanitizedState,
      currentTurnUserId: row.current_turn_user_id,
      winnerUserId: row.winner_user_id,
      result: row.result,
      xpAwards: awards,
      rematchRequestedBy: rematchSet ? Array.from(rematchSet) : [],
      disconnectedPlayers,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Validates and applies a player game action authoritatively on the server (Section 6.5).
   */
  public submitAction(params: {
    matchId: string;
    userId: string;
    actionId: string;
    action: GameAction;
  }): {
    match: MatchRow;
    duplicate: boolean;
    completed: boolean;
    awards: XpAwardSummary[];
  } {
    const row = this.getMatchRow(params.matchId);
    if (!row) {
      throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');
    }
    if (row.player1_user_id !== params.userId && row.player2_user_id !== params.userId) {
      throw new AppError(403, 'NOT_A_PARTICIPANT', 'You are not a participant in this match.');
    }

    // Deduplicate retried actions safely by actionId
    let seen = this.processedActions.get(params.matchId);
    if (!seen) {
      seen = new Set<string>();
      this.processedActions.set(params.matchId, seen);
    }
    if (seen.has(params.actionId)) {
      return {
        match: row,
        duplicate: true,
        completed: row.status === 'COMPLETED',
        awards: row.status === 'COMPLETED' ? this.progression.getAwardsForMatch(row.id) : [],
      };
    }

    if (row.status !== 'IN_PROGRESS' && row.status !== 'READY') {
      throw new AppError(409, 'MATCH_NOT_ACTIVE', 'This match is no longer in progress.');
    }

    const engine = getGameEngine(row.game_type);
    const currentState = JSON.parse(row.state_json) as GameState;

    const validation = engine.validateAction(currentState, params.userId, params.action);
    if (!validation.valid) {
      throw new AppError(
        400,
        validation.code || 'INVALID_ACTION',
        validation.message || 'Invalid move.'
      );
    }

    const turnSeconds = this.getTurnSeconds(row.game_type);
    const nextState = engine.applyAction(currentState, params.userId, params.action, { turnSeconds });
    const outcome = engine.getOutcome(nextState);
    const nextTurnUserId = engine.getNextPlayer(nextState);
    const now = new Date().toISOString();

    seen.add(params.actionId);

    if (outcome) {
      const { updatedRow, awards, transitioned } = this.completeMatchAtomically({
        matchId: row.id,
        expectedVersion: row.version,
        nextState,
        result: outcome.result,
        winnerUserId: outcome.winnerUserId,
        now,
      });

      this.clearAllTimersForMatch(row.id);

      if (transitioned) {
        logger.info('match_completed', {
          matchId: row.id,
          gameType: row.game_type,
          result: outcome.result,
          winnerUserId: outcome.winnerUserId,
        });
      }

      return {
        match: updatedRow,
        duplicate: false,
        completed: true,
        awards,
      };
    }

    // Persist non-terminal state transition with optimistic version increment
    const updateRes = this.database.db
      .prepare(
        `UPDATE matches
         SET state_json = ?,
             current_turn_user_id = ?,
             version = version + 1,
             updated_at = ?
         WHERE id = ? AND version = ? AND status IN ('READY', 'IN_PROGRESS')`
      )
      .run(JSON.stringify(nextState), nextTurnUserId, now, row.id, row.version);

    if (Number(updateRes.changes) === 0) {
      throw new AppError(409, 'STATE_CONFLICT', 'Match state updated concurrently. Please retry.');
    }

    const updatedRow = this.getMatchRow(row.id)!;

    // Handle RPS round reveal -> automatic next round scheduling
    if (row.game_type === 'RPS' && (nextState as RpsState).phase === 'ROUND_REVEAL') {
      this.clearTurnTimer(row.id);
      this.scheduleRpsNextRound(row.id);
    } else {
      this.scheduleTurnTimer(updatedRow, nextState);
    }

    return {
      match: updatedRow,
      duplicate: false,
      completed: false,
      awards: [],
    };
  }

  /**
   * Conditional atomic transition to COMPLETED + idempotent XP ledger award (FR-MATCH-07, Section 6.6).
   */
  public completeMatchAtomically(params: {
    matchId: string;
    expectedVersion?: number;
    nextState?: GameState;
    result: MatchResultType;
    winnerUserId: string | null;
    now?: string;
  }): { updatedRow: MatchRow; awards: XpAwardSummary[]; transitioned: boolean } {
    const now = params.now ?? new Date().toISOString();

    const txResult = this.database.transaction(() => {
      const current = this.getMatchRow(params.matchId);
      if (!current) {
        throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');
      }

      if (current.status === 'COMPLETED' || current.status === 'ABANDONED') {
        return {
          updatedRow: current,
          awards: this.progression.getAwardsForMatch(current.id),
          transitioned: false,
        };
      }

      const finalStatus: MatchStatus = params.result === 'ABANDONED' ? 'ABANDONED' : 'COMPLETED';
      const stateToSave = params.nextState
        ? JSON.stringify(params.nextState)
        : current.state_json;

      const sql =
        params.expectedVersion !== undefined
          ? `UPDATE matches
             SET status = ?,
                 state_json = ?,
                 current_turn_user_id = NULL,
                 winner_user_id = ?,
                 result = ?,
                 version = version + 1,
                 completed_at = ?,
                 updated_at = ?
             WHERE id = ? AND version = ? AND status IN ('READY', 'IN_PROGRESS')`
          : `UPDATE matches
             SET status = ?,
                 state_json = ?,
                 current_turn_user_id = NULL,
                 winner_user_id = ?,
                 result = ?,
                 version = version + 1,
                 completed_at = ?,
                 updated_at = ?
             WHERE id = ? AND status IN ('READY', 'IN_PROGRESS')`;

      const res =
        params.expectedVersion !== undefined
          ? this.database.db
              .prepare(sql)
              .run(
                finalStatus,
                stateToSave,
                params.winnerUserId,
                params.result,
                now,
                now,
                current.id,
                params.expectedVersion
              )
          : this.database.db
              .prepare(sql)
              .run(
                finalStatus,
                stateToSave,
                params.winnerUserId,
                params.result,
                now,
                now,
                current.id
              );

      if (Number(res.changes) === 0) {
        const latest = this.getMatchRow(current.id)!;
        return {
          updatedRow: latest,
          awards: this.progression.getAwardsForMatch(current.id),
          transitioned: false,
        };
      }

      const awards = this.progression.awardMatchProgressionInTx({
        matchId: current.id,
        gameType: current.game_type,
        player1UserId: current.player1_user_id,
        player2UserId: current.player2_user_id,
        winnerUserId: params.winnerUserId,
        result: params.result,
      });

      const updatedRow = this.getMatchRow(current.id)!;
      return { updatedRow, awards, transitioned: true };
    });

    return txResult;
  }

  public forfeitMatch(matchId: string, forfeitingUserId: string): {
    match: MatchRow;
    awards: XpAwardSummary[];
    transitioned: boolean;
  } {
    const row = this.getMatchRow(matchId);
    if (!row) {
      throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');
    }
    if (row.player1_user_id !== forfeitingUserId && row.player2_user_id !== forfeitingUserId) {
      throw new AppError(403, 'NOT_A_PARTICIPANT', 'You are not a participant in this match.');
    }
    if (row.status !== 'IN_PROGRESS' && row.status !== 'READY') {
      throw new AppError(409, 'MATCH_NOT_ACTIVE', 'Match is already finished.');
    }

    const winnerUserId =
      row.player1_user_id === forfeitingUserId ? row.player2_user_id : row.player1_user_id;

    const rawState = JSON.parse(row.state_json) as GameState;
    const completedState: GameState = {
      ...rawState,
      status: 'COMPLETED',
      winnerUserId,
      ...(row.game_type === 'RPS' ? { phase: 'COMPLETED', deadlineAt: null } : { currentTurnUserId: null, turnDeadlineAt: null }),
    } as GameState;

    const res = this.completeMatchAtomically({
      matchId: row.id,
      nextState: completedState,
      result: 'FORFEIT',
      winnerUserId,
    });

    this.clearAllTimersForMatch(row.id);

    if (res.transitioned) {
      this.callbacks.onStateUpdated?.(row.id);
      this.callbacks.onMatchCompleted?.(row.id, res.awards);
    }

    return { match: res.updatedRow, awards: res.awards, transitioned: res.transitioned };
  }

  /**
   * Handles a player requesting a rematch after a completed match (FR-MATCH-08, FR-MATCH-09).
   * Creates a brand-new Match record when both participants agree (never overwrites previous match).
   */
  public requestRematch(
    matchId: string,
    userId: string
  ): {
    requestedBy: string[];
    newMatch: MatchRow | null;
  } {
    const row = this.getMatchRow(matchId);
    if (!row) {
      throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');
    }
    if (row.player1_user_id !== userId && row.player2_user_id !== userId) {
      throw new AppError(403, 'NOT_A_PARTICIPANT', 'You are not a participant in this match.');
    }
    if (row.status !== 'COMPLETED' && row.status !== 'ABANDONED') {
      throw new AppError(409, 'MATCH_NOT_FINISHED', 'Rematch is only available after the match ends.');
    }

    let reqSet = this.rematchRequests.get(matchId);
    if (!reqSet) {
      reqSet = new Set<string>();
      this.rematchRequests.set(matchId, reqSet);
    }
    reqSet.add(userId);

    if (reqSet.has(row.player1_user_id) && reqSet.has(row.player2_user_id)) {
      this.rematchRequests.delete(matchId);
      // Swap player slots on rematch so the second player gets first turn
      const newMatch = this.createMatch({
        gameType: row.game_type,
        mode: row.mode,
        player1: {
          userId: row.player2_user_id,
          username: row.player2_name_snapshot,
          avatar: row.player2_avatar_snapshot,
        },
        player2: {
          userId: row.player1_user_id,
          username: row.player1_name_snapshot,
          avatar: row.player1_avatar_snapshot,
        },
      });
      this.callbacks.onRematchCreated?.(matchId, newMatch.id);
      return { requestedBy: [], newMatch };
    }

    return { requestedBy: Array.from(reqSet), newMatch: null };
  }

  /**
   * Disconnect grace-period policy (Section 9.4):
   * When a user loses all sockets while in an IN_PROGRESS match, start a configurable
   * grace timer. If they reconnect in time, restore seamlessly; if not, forfeit to
   * the connected opponent (or mark ABANDONED if both are disconnected).
   */
  public handleUserDisconnected(userId: string): void {
    const activeMatch = this.getActiveMatchForUser(userId);
    if (!activeMatch) return;

    const key = `${activeMatch.id}:${userId}`;
    if (this.disconnectTimers.has(key)) return;

    const graceMs = this.config.reconnectGraceSeconds * 1000;
    const gracePeriodEndsAt = new Date(Date.now() + graceMs).toISOString();

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(key);
      this.handleGracePeriodExpired(activeMatch.id, userId);
    }, graceMs);
    timer.unref?.();

    this.disconnectTimers.set(key, { timer, gracePeriodEndsAt });
    this.callbacks.onOpponentDisconnected?.(activeMatch.id, userId, gracePeriodEndsAt);
    logger.info('match_player_disconnected', {
      matchId: activeMatch.id,
      userId,
      gracePeriodEndsAt,
    });
  }

  public handleUserReconnected(userId: string): MatchRow | null {
    const activeMatch = this.getActiveMatchForUser(userId);
    if (!activeMatch) return null;

    const key = `${activeMatch.id}:${userId}`;
    const entry = this.disconnectTimers.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      this.disconnectTimers.delete(key);
      this.callbacks.onOpponentReconnected?.(activeMatch.id, userId);
      logger.info('match_player_reconnected', {
        matchId: activeMatch.id,
        userId,
      });
    }
    return activeMatch;
  }

  private handleGracePeriodExpired(matchId: string, disconnectedUserId: string): void {
    const row = this.getMatchRow(matchId);
    if (!row || (row.status !== 'IN_PROGRESS' && row.status !== 'READY')) return;

    // Double check they didn't reconnect right before callback
    if (this.presence.isOnline(disconnectedUserId)) return;

    const opponentId =
      row.player1_user_id === disconnectedUserId ? row.player2_user_id : row.player1_user_id;
    const opponentOnline = this.presence.isOnline(opponentId);

    const rawState = JSON.parse(row.state_json) as GameState;

    if (!opponentOnline) {
      // Both players disconnected — mark ABANDONED with no XP
      const abandonedState: GameState = {
        ...rawState,
        status: 'COMPLETED',
        winnerUserId: null,
        ...(row.game_type === 'RPS' ? { phase: 'COMPLETED', deadlineAt: null } : { currentTurnUserId: null, turnDeadlineAt: null }),
      } as GameState;

      const res = this.completeMatchAtomically({
        matchId: row.id,
        nextState: abandonedState,
        result: 'ABANDONED',
        winnerUserId: null,
      });
      this.clearAllTimersForMatch(row.id);
      if (res.transitioned) {
        this.callbacks.onStateUpdated?.(row.id);
        this.callbacks.onMatchCompleted?.(row.id, []);
      }
      return;
    }

    // Connected opponent wins by forfeit
    const forfeitState: GameState = {
      ...rawState,
      status: 'COMPLETED',
      winnerUserId: opponentId,
      ...(row.game_type === 'RPS' ? { phase: 'COMPLETED', deadlineAt: null } : { currentTurnUserId: null, turnDeadlineAt: null }),
    } as GameState;

    const res = this.completeMatchAtomically({
      matchId: row.id,
      nextState: forfeitState,
      result: 'FORFEIT',
      winnerUserId: opponentId,
    });
    this.clearAllTimersForMatch(row.id);
    if (res.transitioned) {
      this.callbacks.onStateUpdated?.(row.id);
      this.callbacks.onMatchCompleted?.(row.id, res.awards);
    }
  }

  private scheduleTurnTimer(row: MatchRow, state: GameState): void {
    this.clearTurnTimer(row.id);
    if (row.status !== 'IN_PROGRESS' || state.status !== 'IN_PROGRESS') return;

    const deadlineIso =
      row.game_type === 'RPS'
        ? (state as RpsState).deadlineAt
        : 'turnDeadlineAt' in state
          ? state.turnDeadlineAt
          : null;

    if (!deadlineIso) return;
    const delayMs = Math.max(500, new Date(deadlineIso).getTime() - Date.now() + 250);

    const timer = setTimeout(() => {
      this.turnTimers.delete(row.id);
      this.handleTurnTimeout(row.id, row.version);
    }, delayMs);
    timer.unref?.();
    this.turnTimers.set(row.id, timer);
  }

  private handleTurnTimeout(matchId: string, expectedVersion: number): void {
    const row = this.getMatchRow(matchId);
    if (!row || row.status !== 'IN_PROGRESS' || row.version !== expectedVersion) return;

    const currentState = JSON.parse(row.state_json) as GameState;

    if (row.game_type === 'RPS') {
      const rpsState = currentState as RpsState;
      if (rpsState.phase !== 'WAITING_FOR_CHOICES') return;
      const resolved = resolveRpsRoundTimeout(rpsState);
      const engine = getGameEngine('RPS');
      const outcome = engine.getOutcome(resolved);

      if (outcome) {
        const res = this.completeMatchAtomically({
          matchId: row.id,
          expectedVersion: row.version,
          nextState: resolved,
          result: outcome.result,
          winnerUserId: outcome.winnerUserId,
        });
        this.clearAllTimersForMatch(row.id);
        if (res.transitioned) {
          this.callbacks.onStateUpdated?.(row.id);
          this.callbacks.onMatchCompleted?.(row.id, res.awards);
        }
      } else {
        const now = new Date().toISOString();
        const upd = this.database.db
          .prepare(
            `UPDATE matches SET state_json = ?, version = version + 1, updated_at = ?
             WHERE id = ? AND version = ? AND status = 'IN_PROGRESS'`
          )
          .run(JSON.stringify(resolved), now, row.id, row.version);
        if (Number(upd.changes) > 0) {
          this.callbacks.onStateUpdated?.(row.id);
          this.scheduleRpsNextRound(row.id);
        }
      }
      return;
    }

    // Turn-based game timeout (Tic-Tac-Toe / Connect Four): current turn player forfeits
    const timedOutUserId = row.current_turn_user_id;
    if (!timedOutUserId) return;
    const winnerUserId =
      row.player1_user_id === timedOutUserId ? row.player2_user_id : row.player1_user_id;

    const completedState = {
      ...currentState,
      currentTurnUserId: null,
      status: 'COMPLETED',
      winnerUserId,
      turnDeadlineAt: null,
    } as GameState;

    const res = this.completeMatchAtomically({
      matchId: row.id,
      expectedVersion: row.version,
      nextState: completedState,
      result: 'FORFEIT',
      winnerUserId,
    });
    this.clearAllTimersForMatch(row.id);
    if (res.transitioned) {
      this.callbacks.onStateUpdated?.(row.id);
      this.callbacks.onMatchCompleted?.(row.id, res.awards);
    }
  }

  private scheduleRpsNextRound(matchId: string): void {
    const existing = this.rpsRevealTimers.get(matchId);
    if (existing) clearTimeout(existing);

    const delayMs = this.config.nodeEnv === 'test' ? 200 : 2500;
    const timer = setTimeout(() => {
      this.rpsRevealTimers.delete(matchId);
      const row = this.getMatchRow(matchId);
      if (!row || row.status !== 'IN_PROGRESS' || row.game_type !== 'RPS') return;
      const state = JSON.parse(row.state_json) as RpsState;
      if (state.phase !== 'ROUND_REVEAL') return;

      const nextState = advanceRpsNextRound(state, { turnSeconds: this.config.rpsRoundSeconds });
      const now = new Date().toISOString();
      const upd = this.database.db
        .prepare(
          `UPDATE matches SET state_json = ?, version = version + 1, updated_at = ?
           WHERE id = ? AND version = ? AND status = 'IN_PROGRESS'`
        )
        .run(JSON.stringify(nextState), now, row.id, row.version);

      if (Number(upd.changes) > 0) {
        const refreshed = this.getMatchRow(row.id)!;
        this.scheduleTurnTimer(refreshed, nextState);
        this.callbacks.onStateUpdated?.(row.id);
      }
    }, delayMs);
    timer.unref?.();
    this.rpsRevealTimers.set(matchId, timer);
  }

  private clearTurnTimer(matchId: string): void {
    const t = this.turnTimers.get(matchId);
    if (t) {
      clearTimeout(t);
      this.turnTimers.delete(matchId);
    }
  }

  private clearAllTimersForMatch(matchId: string): void {
    this.clearTurnTimer(matchId);
    const rpsTimer = this.rpsRevealTimers.get(matchId);
    if (rpsTimer) {
      clearTimeout(rpsTimer);
      this.rpsRevealTimers.delete(matchId);
    }
    for (const [key, entry] of this.disconnectTimers.entries()) {
      if (key.startsWith(`${matchId}:`)) {
        clearTimeout(entry.timer);
        this.disconnectTimers.delete(key);
      }
    }
  }

  public shutdown(): void {
    for (const t of this.turnTimers.values()) clearTimeout(t);
    for (const t of this.rpsRevealTimers.values()) clearTimeout(t);
    for (const entry of this.disconnectTimers.values()) clearTimeout(entry.timer);
    this.turnTimers.clear();
    this.rpsRevealTimers.clear();
    this.disconnectTimers.clear();
  }
}
