import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { AuthenticatedUser, XpAwardSummary } from '../../shared/types.ts';
import type { AppConfig } from '../config/env.ts';
import { SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import type { AuthService } from '../services/authService.ts';
import type { ChatService } from '../services/chatService.ts';
import type { MatchService } from '../services/matchService.ts';
import type { MatchmakingService } from '../services/matchmakingService.ts';
import type { PresenceService } from '../services/presenceService.ts';
import type { RoomService } from '../services/roomService.ts';
import { AppError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { SlidingWindowLimiter } from '../utils/rateLimiter.ts';
import {
  cancelRoomSchema,
  createChatSendSchema,
  createRoomSchema,
  forfeitMatchSchema,
  formatZodError,
  gameActionPayloadSchema,
  joinRoomSchema,
  matchmakingCancelSchema,
  matchmakingJoinSchema,
  reconnectMatchSchema,
  rematchRequestSchema,
} from '../validators/schemas.ts';

interface SocketAuthData {
  user: AuthenticatedUser;
  sessionId: string;
}

type AckFn = (response: { success: boolean; data?: unknown; error?: { code: string; message: string } }) => void;

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export class SocketGateway {
  public readonly io: SocketIOServer;
  private readonly config: AppConfig;
  private readonly authService: AuthService;
  private readonly presenceService: PresenceService;
  private readonly matchService: MatchService;
  private readonly roomService: RoomService;
  private readonly matchmakingService: MatchmakingService;
  private readonly chatService: ChatService;

  private readonly actionLimiter = new SlidingWindowLimiter(25, 10_000);
  private readonly roomLimiter = new SlidingWindowLimiter(15, 60_000);
  private readonly matchmakingLimiter = new SlidingWindowLimiter(15, 60_000);

  constructor(params: {
    httpServer: HttpServer;
    config: AppConfig;
    authService: AuthService;
    presenceService: PresenceService;
    matchService: MatchService;
    roomService: RoomService;
    matchmakingService: MatchmakingService;
    chatService: ChatService;
    allowedOrigins: string[];
  }) {
    this.config = params.config;
    this.authService = params.authService;
    this.presenceService = params.presenceService;
    this.matchService = params.matchService;
    this.roomService = params.roomService;
    this.matchmakingService = params.matchmakingService;
    this.chatService = params.chatService;

    this.io = new SocketIOServer(params.httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (params.allowedOrigins.includes(origin)) return callback(null, true);
          // Allow same-host origins (e.g. AI Studio preview domain)
          try {
            const url = new URL(origin);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.run.app')) {
              return callback(null, true);
            }
          } catch {
            // reject invalid origin
          }
          return callback(new Error('Origin not allowed'));
        },
        credentials: true,
      },
      pingTimeout: 20_000,
      pingInterval: 10_000,
    });

    this.wireServiceCallbacks();
    this.setupAuthMiddleware();
    this.setupConnectionHandlers();
  }

  private userChannel(userId: string): string {
    return `user:${userId}`;
  }

  private matchChannel(matchId: string): string {
    return `match:${matchId}`;
  }

  /**
   * Disconnects all sockets bound to a revoked session (e.g. on logout).
   */
  public disconnectSession(sessionId: string): void {
    for (const socket of this.io.sockets.sockets.values()) {
      const data = socket.data as Partial<SocketAuthData>;
      if (data.sessionId === sessionId) {
        socket.disconnect(true);
      }
    }
  }

  /**
   * Joins all active sockets of both players into `match:<matchId>` and emits `match:ready`
   * with per-viewer sanitized initial snapshots.
   */
  public notifyMatchReady(matchId: string, extraEvent?: 'room:joined' | 'matchmaking:found'): void {
    const row = this.matchService.getMatchRow(matchId);
    if (!row) return;

    const participantIds = [row.player1_user_id, row.player2_user_id];
    const matchRoom = this.matchChannel(matchId);

    for (const uid of participantIds) {
      for (const sid of this.presenceService.getSocketIds(uid)) {
        const s = this.io.sockets.sockets.get(sid);
        if (s) {
          s.join(matchRoom);
        }
      }
    }

    for (const uid of participantIds) {
      const snapshot = this.matchService.buildSnapshot(row, uid);
      const opponent = snapshot.players.find((p) => p.userId !== uid) ?? null;

      if (extraEvent === 'room:joined') {
        this.io.to(this.userChannel(uid)).emit('room:joined', {
          matchId: snapshot.id,
          players: snapshot.players,
        });
      } else if (extraEvent === 'matchmaking:found') {
        this.io.to(this.userChannel(uid)).emit('matchmaking:found', {
          matchId: snapshot.id,
          opponent,
          gameType: snapshot.gameType,
        });
      }

      this.io.to(this.userChannel(uid)).emit('match:ready', {
        matchId: snapshot.id,
        gameType: snapshot.gameType,
        players: snapshot.players,
        state: snapshot.state,
        snapshot,
      });
    }
  }

  /**
   * Broadcasts viewer-sanitized authoritative state to each participant (protects hidden RPS picks).
   */
  public broadcastMatchState(matchId: string): void {
    const row = this.matchService.getMatchRow(matchId);
    if (!row) return;
    for (const uid of [row.player1_user_id, row.player2_user_id]) {
      const snapshot = this.matchService.buildSnapshot(row, uid);
      this.io.to(this.userChannel(uid)).emit('game:state', {
        matchId: snapshot.id,
        version: snapshot.version,
        state: snapshot.state,
        snapshot,
      });
    }
  }

  public broadcastMatchCompleted(matchId: string, awards: XpAwardSummary[]): void {
    const row = this.matchService.getMatchRow(matchId);
    if (!row) return;
    for (const uid of [row.player1_user_id, row.player2_user_id]) {
      const snapshot = this.matchService.buildSnapshot(row, uid);
      this.io.to(this.userChannel(uid)).emit('match:completed', {
        matchId: snapshot.id,
        outcome: {
          result: snapshot.result,
          winnerUserId: snapshot.winnerUserId,
        },
        xpAwards: awards,
        snapshot,
      });
    }
  }

  private wireServiceCallbacks(): void {
    this.matchService.setCallbacks({
      onStateUpdated: (matchId) => this.broadcastMatchState(matchId),
      onMatchCompleted: (matchId, awards) => this.broadcastMatchCompleted(matchId, awards),
      onOpponentDisconnected: (matchId, userId, gracePeriodEndsAt) => {
        const row = this.matchService.getMatchRow(matchId);
        if (!row) return;
        const otherId = row.player1_user_id === userId ? row.player2_user_id : row.player1_user_id;
        this.io.to(this.userChannel(otherId)).emit('match:opponent-disconnected', {
          matchId,
          userId,
          gracePeriodEndsAt,
        });
        this.broadcastMatchState(matchId);
      },
      onOpponentReconnected: (matchId, userId) => {
        const row = this.matchService.getMatchRow(matchId);
        if (!row) return;
        const otherId = row.player1_user_id === userId ? row.player2_user_id : row.player1_user_id;
        this.io.to(this.userChannel(otherId)).emit('match:opponent-reconnected', {
          matchId,
          userId,
        });
        this.broadcastMatchState(matchId);
      },
      onRematchCreated: (_oldMatchId, newMatchId) => {
        this.notifyMatchReady(newMatchId);
      },
    });

    this.matchmakingService.setCallbacks({
      onMatchFound: ({ matchId }) => {
        this.notifyMatchReady(matchId, 'matchmaking:found');
      },
      onQueueTimeout: (userId, gameType) => {
        this.io.to(this.userChannel(userId)).emit('matchmaking:timeout', {
          gameType,
          message: 'No opponent was found in time. Returned to lobby.',
        });
      },
    });
  }

  private setupAuthMiddleware(): void {
    this.io.use((socket, next) => {
      const authToken =
        typeof socket.handshake.auth?.token === 'string'
          ? socket.handshake.auth.token.trim()
          : '';
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
      const token = authToken || cookieToken;

      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }

      const verified = this.authService.verifyToken(token);
      if (!verified) {
        return next(new Error('UNAUTHORIZED'));
      }

      const data = socket.data as SocketAuthData;
      data.user = verified.user;
      data.sessionId = verified.sessionId;
      return next();
    });
  }

  private replyError(socket: Socket, event: 'game:error' | 'server:error', err: unknown, ack?: AckFn): void {
    const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
    const message =
      err instanceof AppError ? err.message : 'Unable to complete that action. Please try again.';
    socket.emit(event, { code, message });
    if (typeof ack === 'function') {
      ack({ success: false, error: { code, message } });
    }
  }

  private setupConnectionHandlers(): void {
    const chatSendSchema = createChatSendSchema(this.config.chatMaxLength);

    this.io.on('connection', (socket) => {
      const { user } = socket.data as SocketAuthData;
      socket.join(this.userChannel(user.id));

      const reg = this.presenceService.registerSocket(user.id, socket.id);
      if (reg.isFirstConnection) {
        const restoredMatch = this.matchService.handleUserReconnected(user.id);
        if (restoredMatch) {
          socket.join(this.matchChannel(restoredMatch.id));
        }
      } else {
        const activeMatch = this.matchService.getActiveMatchForUser(user.id);
        if (activeMatch) {
          socket.join(this.matchChannel(activeMatch.id));
        }
      }

      logger.info('socket_connected', { userId: user.id, socketId: socket.id });

      // --- Matchmaking ---
      socket.on('matchmaking:join', (payload: unknown, ack?: AckFn) => {
        try {
          if (!this.matchmakingLimiter.consume(user.id).allowed) {
            throw new AppError(429, 'RATE_LIMITED', 'Slow down before queuing again.');
          }
          const parsed = matchmakingJoinSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }

          const freshUser = this.authService.getUserById(user.id) ?? user;
          const result = this.matchmakingService.enqueue({
            userId: freshUser.id,
            username: freshUser.username,
            avatar: freshUser.avatar,
            gameType: parsed.data.gameType,
            requireOnline: true,
          });

          if (result.status === 'QUEUED') {
            socket.emit('matchmaking:queued', {
              gameType: result.gameType,
              position: result.position,
            });
          }

          if (typeof ack === 'function') {
            ack({ success: true, data: result });
          }
        } catch (err) {
          this.replyError(socket, 'server:error', err, ack);
        }
      });

      socket.on('matchmaking:cancel', (payload: unknown, ack?: AckFn) => {
        try {
          const parsed = matchmakingCancelSchema.safeParse(payload ?? {});
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }
          const cancelledGame = this.matchmakingService.cancel(user.id);
          if (cancelledGame) {
            this.io.to(this.userChannel(user.id)).emit('matchmaking:cancelled', {
              gameType: cancelledGame,
            });
          }
          if (typeof ack === 'function') {
            ack({ success: true, data: { cancelledGame } });
          }
        } catch (err) {
          this.replyError(socket, 'server:error', err, ack);
        }
      });

      // --- Private Rooms ---
      socket.on('room:create', (payload: unknown, ack?: AckFn) => {
        try {
          if (!this.roomLimiter.consume(user.id).allowed) {
            throw new AppError(429, 'RATE_LIMITED', 'Too many rooms created recently. Please wait.');
          }
          const parsed = createRoomSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }

          // Leave matchmaking queue if currently queued
          this.matchmakingService.cancel(user.id);

          const freshUser = this.authService.getUserById(user.id) ?? user;
          const room = this.roomService.createRoom({
            hostUserId: freshUser.id,
            hostUsername: freshUser.username,
            hostAvatar: freshUser.avatar,
            gameType: parsed.data.gameType,
          });

          socket.emit('room:created', {
            code: room.code,
            roomId: room.id,
            expiresAt: room.expiresAt,
            room,
          });

          if (typeof ack === 'function') {
            ack({ success: true, data: room });
          }
        } catch (err) {
          this.replyError(socket, 'server:error', err, ack);
        }
      });

      socket.on('room:join', (payload: unknown, ack?: AckFn) => {
        try {
          if (!this.roomLimiter.consume(`join:${user.id}`).allowed) {
            throw new AppError(429, 'RATE_LIMITED', 'Too many room join attempts. Please wait.');
          }
          const parsed = joinRoomSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }

          this.matchmakingService.cancel(user.id);

          const freshUser = this.authService.getUserById(user.id) ?? user;
          const joined = this.roomService.joinRoom({
            code: parsed.data.code,
            guestUserId: freshUser.id,
            guestUsername: freshUser.username,
            guestAvatar: freshUser.avatar,
          });

          // Cancel host's matchmaking queue if any
          this.matchmakingService.cancel(joined.hostUserId);

          this.notifyMatchReady(joined.matchId, 'room:joined');

          if (typeof ack === 'function') {
            ack({ success: true, data: { matchId: joined.matchId, room: joined.room } });
          }
        } catch (err) {
          this.replyError(socket, 'server:error', err, ack);
        }
      });

      socket.on('room:cancel', (payload: unknown, ack?: AckFn) => {
        try {
          const parsed = cancelRoomSchema.safeParse(payload ?? {});
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }
          const cancelled = this.roomService.cancelRoom({
            userId: user.id,
            roomId: parsed.data.roomId,
            code: parsed.data.code,
          });
          socket.emit('room:cancelled', { roomId: cancelled.id, code: cancelled.code });
          if (typeof ack === 'function') {
            ack({ success: true, data: cancelled });
          }
        } catch (err) {
          this.replyError(socket, 'server:error', err, ack);
        }
      });

      // --- Authoritative Game Actions ---
      socket.on('game:action', (payload: unknown, ack?: AckFn) => {
        try {
          if (!this.actionLimiter.consume(user.id).allowed) {
            throw new AppError(429, 'RATE_LIMITED', 'Too many game actions sent too quickly.');
          }
          const parsed = gameActionPayloadSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }

          const res = this.matchService.submitAction({
            matchId: parsed.data.matchId,
            userId: user.id,
            actionId: parsed.data.actionId,
            action: parsed.data.action,
          });

          if (!res.duplicate) {
            this.broadcastMatchState(res.match.id);
            if (res.completed) {
              this.broadcastMatchCompleted(res.match.id, res.awards);
            }
          }

          const viewerSnapshot = this.matchService.buildSnapshot(res.match, user.id);
          if (typeof ack === 'function') {
            ack({ success: true, data: { snapshot: viewerSnapshot, duplicate: res.duplicate } });
          }
        } catch (err) {
          this.replyError(socket, 'game:error', err, ack);
        }
      });

      // --- Forfeit ---
      socket.on('match:forfeit', (payload: unknown, ack?: AckFn) => {
        try {
          const parsed = forfeitMatchSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }
          const res = this.matchService.forfeitMatch(parsed.data.matchId, user.id);
          if (typeof ack === 'function') {
            ack({ success: true, data: { matchId: res.match.id } });
          }
        } catch (err) {
          this.replyError(socket, 'game:error', err, ack);
        }
      });

      // --- Rematch ---
      socket.on('match:rematch-request', (payload: unknown, ack?: AckFn) => {
        try {
          const parsed = rematchRequestSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }
          const res = this.matchService.requestRematch(parsed.data.matchId, user.id);

          if (!res.newMatch) {
            const matchRow = this.matchService.getMatchRow(parsed.data.matchId);
            if (matchRow) {
              for (const uid of [matchRow.player1_user_id, matchRow.player2_user_id]) {
                this.io.to(this.userChannel(uid)).emit('match:rematch-requested', {
                  matchId: parsed.data.matchId,
                  userId: user.id,
                  requestedBy: res.requestedBy,
                });
              }
            }
          }

          if (typeof ack === 'function') {
            ack({
              success: true,
              data: {
                requestedBy: res.requestedBy,
                newMatchId: res.newMatch?.id ?? null,
              },
            });
          }
        } catch (err) {
          this.replyError(socket, 'game:error', err, ack);
        }
      });

      // --- Reconnect State Sync ---
      socket.on('match:reconnect', (payload: unknown, ack?: AckFn) => {
        try {
          const parsed = reconnectMatchSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }

          const snapshot = this.matchService.getSnapshotForUser(parsed.data.matchId, user.id);
          socket.join(this.matchChannel(snapshot.id));
          this.matchService.handleUserReconnected(user.id);
          const freshSnapshot = this.matchService.getSnapshotForUser(parsed.data.matchId, user.id);
          const messages = this.chatService.getMatchMessages(snapshot.id, user.id);

          socket.emit('game:state', {
            matchId: freshSnapshot.id,
            version: freshSnapshot.version,
            state: freshSnapshot.state,
            snapshot: freshSnapshot,
          });

          if (typeof ack === 'function') {
            ack({ success: true, data: { snapshot: freshSnapshot, messages } });
          }
        } catch (err) {
          this.replyError(socket, 'game:error', err, ack);
        }
      });

      // --- Authorized Match Chat ---
      socket.on('chat:send', (payload: unknown, ack?: AckFn) => {
        try {
          const parsed = chatSendSchema.safeParse(payload);
          if (!parsed.success) {
            throw new AppError(400, 'VALIDATION_ERROR', formatZodError(parsed.error));
          }

          const freshUser = this.authService.getUserById(user.id) ?? user;
          const chatMessage = this.chatService.sendMessage({
            matchId: parsed.data.matchId,
            senderId: freshUser.id,
            senderUsername: freshUser.username,
            senderAvatar: freshUser.avatar,
            message: parsed.data.message,
          });

          const matchRow = this.matchService.getMatchRow(parsed.data.matchId);
          if (matchRow) {
            const payloadOut = {
              messageId: chatMessage.id,
              matchId: chatMessage.matchId,
              sender: {
                id: chatMessage.senderId,
                username: chatMessage.senderUsername,
                avatar: chatMessage.senderAvatar,
              },
              message: chatMessage.message,
              createdAt: chatMessage.createdAt,
              chatMessage,
            };

            // Deliver ONLY to the two authorized match participants
            for (const uid of [matchRow.player1_user_id, matchRow.player2_user_id]) {
              this.io.to(this.userChannel(uid)).emit('chat:message', payloadOut);
            }
          }

          if (typeof ack === 'function') {
            ack({ success: true, data: chatMessage });
          }
        } catch (err) {
          this.replyError(socket, 'server:error', err, ack);
        }
      });

      // --- Disconnect ---
      socket.on('disconnect', () => {
        const unreg = this.presenceService.unregisterSocket(user.id, socket.id);
        logger.info('socket_disconnected', {
          userId: user.id,
          socketId: socket.id,
          remainingSockets: unreg.count,
        });

        if (unreg.isLastConnection) {
          // Remove from matchmaking queue if disconnected before match begins (FR-MM-08)
          this.matchmakingService.cancel(user.id);
          // Start reconnect grace period if currently in an active match
          this.matchService.handleUserDisconnected(user.id);
        }
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => resolve());
    });
  }
}
