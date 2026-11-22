import type { GameType } from '../../shared/types.ts';
import type { AppConfig } from '../config/env.ts';
import { AppError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import type { MatchService } from './matchService.ts';
import type { PresenceService } from './presenceService.ts';

export interface QueueEntry {
  userId: string;
  username: string;
  avatar: string;
  gameType: GameType;
  enqueuedAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export interface MatchmakingCallbacks {
  onMatchFound?: (params: {
    matchId: string;
    gameType: GameType;
    player1: { userId: string; username: string; avatar: string };
    player2: { userId: string; username: string; avatar: string };
  }) => void;
  onQueueTimeout?: (userId: string, gameType: GameType) => void;
}

/**
 * In-memory per-game matchmaking queue service (Section 9.1–9.2).
 * Single-instance safe via synchronous pairing execution; designed behind a clear service
 * boundary so Redis can replace the backing queues for multi-instance horizontal scaling.
 */
export class MatchmakingService {
  private readonly config: AppConfig;
  private readonly matchService: MatchService;
  private readonly presence: PresenceService;
  private callbacks: MatchmakingCallbacks = {};

  private readonly queues: Record<GameType, QueueEntry[]> = {
    TICTACTOE: [],
    RPS: [],
    CONNECT_FOUR: [],
  };

  // Tracks which game queue a user is currently in to prevent duplicate entries across all games
  private readonly queuedUsers = new Map<string, GameType>();

  constructor(config: AppConfig, matchService: MatchService, presence: PresenceService) {
    this.config = config;
    this.matchService = matchService;
    this.presence = presence;
  }

  public setCallbacks(callbacks: MatchmakingCallbacks): void {
    this.callbacks = callbacks;
  }

  public getUserQueue(userId: string): GameType | null {
    return this.queuedUsers.get(userId) ?? null;
  }

  public getQueueSizes(): Record<GameType, number> {
    return {
      TICTACTOE: this.queues.TICTACTOE.length,
      RPS: this.queues.RPS.length,
      CONNECT_FOUR: this.queues.CONNECT_FOUR.length,
    };
  }

  public enqueue(params: {
    userId: string;
    username: string;
    avatar: string;
    gameType: GameType;
    requireOnline?: boolean;
  }): {
    status: 'QUEUED' | 'MATCHED';
    gameType: GameType;
    position?: number;
    matchId?: string;
    opponent?: { userId: string; username: string; avatar: string };
  } {
    const activeMatch = this.matchService.getActiveMatchForUser(params.userId);
    if (activeMatch) {
      throw new AppError(
        409,
        'ACTIVE_MATCH_EXISTS',
        'You already have an active match. Finish it before entering matchmaking.'
      );
    }

    const existingQueue = this.queuedUsers.get(params.userId);
    if (existingQueue) {
      throw new AppError(
        409,
        'ALREADY_QUEUED',
        `You are already searching for a ${existingQueue} match. Cancel your current search first.`
      );
    }

    const queue = this.queues[params.gameType];
    const requireOnline = params.requireOnline ?? true;

    // Prune stale or ineligible entries before searching for a pair
    this.pruneQueue(params.gameType, requireOnline);

    // Find first eligible distinct opponent
    const opponentIdx = queue.findIndex((entry) => entry.userId !== params.userId);

    if (opponentIdx !== -1) {
      // Atomically remove opponent from queue and create match
      const [opponent] = queue.splice(opponentIdx, 1);
      clearTimeout(opponent.timeoutHandle);
      this.queuedUsers.delete(opponent.userId);

      const match = this.matchService.createMatch({
        gameType: params.gameType,
        mode: 'RANDOM',
        player1: {
          userId: opponent.userId,
          username: opponent.username,
          avatar: opponent.avatar,
        },
        player2: {
          userId: params.userId,
          username: params.username,
          avatar: params.avatar,
        },
      });

      logger.info('matchmaking_paired', {
        matchId: match.id,
        gameType: params.gameType,
      });

      this.callbacks.onMatchFound?.({
        matchId: match.id,
        gameType: params.gameType,
        player1: {
          userId: opponent.userId,
          username: opponent.username,
          avatar: opponent.avatar,
        },
        player2: {
          userId: params.userId,
          username: params.username,
          avatar: params.avatar,
        },
      });

      return {
        status: 'MATCHED',
        gameType: params.gameType,
        matchId: match.id,
        opponent: {
          userId: opponent.userId,
          username: opponent.username,
          avatar: opponent.avatar,
        },
      };
    }

    // No opponent waiting yet — add user to queue with configured timeout (FR-MM-09)
    const timeoutMs = this.config.matchmakingTimeoutSeconds * 1000;
    const timeoutHandle = setTimeout(() => {
      const removed = this.cancel(params.userId);
      if (removed) {
        this.callbacks.onQueueTimeout?.(params.userId, params.gameType);
      }
    }, timeoutMs);
    timeoutHandle.unref?.();

    const entry: QueueEntry = {
      userId: params.userId,
      username: params.username,
      avatar: params.avatar,
      gameType: params.gameType,
      enqueuedAt: Date.now(),
      timeoutHandle,
    };

    queue.push(entry);
    this.queuedUsers.set(params.userId, params.gameType);

    return {
      status: 'QUEUED',
      gameType: params.gameType,
      position: queue.length,
    };
  }

  public cancel(userId: string): GameType | null {
    const gameType = this.queuedUsers.get(userId);
    if (!gameType) return null;

    const queue = this.queues[gameType];
    const idx = queue.findIndex((e) => e.userId === userId);
    if (idx !== -1) {
      clearTimeout(queue[idx].timeoutHandle);
      queue.splice(idx, 1);
    }
    this.queuedUsers.delete(userId);
    return gameType;
  }

  private pruneQueue(gameType: GameType, requireOnline: boolean): void {
    const queue = this.queues[gameType];
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      const entry = queue[i];
      const isDisconnected = requireOnline && !this.presence.isOnline(entry.userId);
      const hasActiveMatch = Boolean(this.matchService.getActiveMatchForUser(entry.userId));
      if (isDisconnected || hasActiveMatch) {
        clearTimeout(entry.timeoutHandle);
        queue.splice(i, 1);
        this.queuedUsers.delete(entry.userId);
      }
    }
  }

  public shutdown(): void {
    for (const gameType of Object.keys(this.queues) as GameType[]) {
      for (const entry of this.queues[gameType]) {
        clearTimeout(entry.timeoutHandle);
      }
      this.queues[gameType] = [];
    }
    this.queuedUsers.clear();
  }
}
