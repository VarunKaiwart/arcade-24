import { Router } from 'express';
import type { AppConfig } from '../config/env.ts';
import {
  clearSessionCookie,
  createAuthMiddleware,
  setSessionCookie,
} from '../middleware/auth.ts';
import type { DuelZoneDatabase } from '../repositories/database.ts';
import type { AuthService } from '../services/authService.ts';
import type { ChatService } from '../services/chatService.ts';
import type { MatchService } from '../services/matchService.ts';
import type { MatchmakingService } from '../services/matchmakingService.ts';
import type { PresenceService } from '../services/presenceService.ts';
import type { ProgressionService } from '../services/progressionService.ts';
import type { RoomService } from '../services/roomService.ts';
import type { SocketGateway } from '../sockets/gateway.ts';
import { AppError, sendSuccess } from '../utils/errors.ts';
import {
  SlidingWindowLimiter,
  createHttpRateLimitMiddleware,
} from '../utils/rateLimiter.ts';
import {
  changePasswordSchema,
  createRoomSchema,
  joinRoomSchema,
  loginSchema,
  paginationQuerySchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/schemas.ts';

export function createApiRouter(deps: {
  config: AppConfig;
  database: DuelZoneDatabase;
  authService: AuthService;
  progressionService: ProgressionService;
  roomService: RoomService;
  matchService: MatchService;
  matchmakingService: MatchmakingService;
  chatService: ChatService;
  presenceService: PresenceService;
  getGateway: () => SocketGateway | null;
}): Router {
  const router = Router();
  const { optionalAuth, requireAuth } = createAuthMiddleware(deps.authService);

  const authRateLimiter = new SlidingWindowLimiter(
    deps.config.nodeEnv === 'test' ? 500 : 20,
    60_000
  );
  const roomRateLimiter = new SlidingWindowLimiter(
    deps.config.nodeEnv === 'test' ? 500 : 20,
    60_000
  );

  const limitAuth = createHttpRateLimitMiddleware(
    authRateLimiter,
    (req) => `auth:${req.ip || 'unknown'}`,
    'Too many authentication attempts. Please wait a minute and try again.'
  );

  const limitRooms = createHttpRateLimitMiddleware(
    roomRateLimiter,
    (req) => `rooms:${req.authUser?.id || req.ip || 'unknown'}`,
    'Too many room requests. Please wait a moment.'
  );

  // --- Health Check ---
  router.get('/health', (_req, res) => {
    const dbOk = deps.database.healthCheck();
    sendSuccess(
      res,
      {
        status: dbOk ? 'ok' : 'degraded',
        database: dbOk ? 'connected' : 'error',
        onlinePlayers: deps.presenceService.getOnlineCount(),
        queues: deps.matchmakingService.getQueueSizes(),
        timestamp: new Date().toISOString(),
      },
      'Service healthy',
      dbOk ? 200 : 503
    );
  });

  // --- Authentication (Section 7.1) ---
  router.post('/auth/register', limitAuth, async (req, res, next) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await deps.authService.register(parsed);
      const stats = deps.progressionService.getPlayerStats(result.user.id);

      setSessionCookie(req, res, result.token, deps.config);
      sendSuccess(
        res,
        {
          user: result.user,
          stats,
          token: result.token,
        },
        'Account created successfully',
        201
      );
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login', limitAuth, async (req, res, next) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await deps.authService.login(parsed);
      const stats = deps.progressionService.getPlayerStats(result.user.id);
      const activeMatch = deps.matchService.getActiveMatchForUser(result.user.id);
      const waitingRoom = deps.roomService.getWaitingRoomForUser(result.user.id);

      setSessionCookie(req, res, result.token, deps.config);
      sendSuccess(
        res,
        {
          user: result.user,
          stats,
          token: result.token,
          activeMatchId: activeMatch?.id ?? null,
          waitingRoom,
        },
        'Signed in successfully'
      );
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', optionalAuth, (req, res) => {
    if (req.sessionId) {
      deps.authService.logout(req.sessionId);
      deps.getGateway()?.disconnectSession(req.sessionId);
    }
    if (req.authUser) {
      deps.matchmakingService.cancel(req.authUser.id);
    }
    clearSessionCookie(req, res, deps.config);
    sendSuccess(res, { loggedOut: true }, 'Signed out successfully');
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    const user = req.authUser!;
    const stats = deps.progressionService.getPlayerStats(user.id);
    const activeMatch = deps.matchService.getActiveMatchForUser(user.id);
    const waitingRoom = deps.roomService.getWaitingRoomForUser(user.id);
    const queuedGame = deps.matchmakingService.getUserQueue(user.id);

    sendSuccess(res, {
      user,
      stats,
      token: req.sessionToken,
      activeMatchId: activeMatch?.id ?? null,
      waitingRoom,
      queuedGame,
    });
  });

  router.post('/auth/change-password', requireAuth, async (req, res, next) => {
    try {
      const parsed = changePasswordSchema.parse(req.body);
      await deps.authService.changePassword(
        req.authUser!.id,
        parsed.currentPassword,
        parsed.newPassword,
        req.sessionId
      );
      sendSuccess(res, { changed: true }, 'Password updated successfully');
    } catch (err) {
      next(err);
    }
  });

  // --- Users & Profiles (Section 7.2) ---
  router.get('/users/me', requireAuth, (req, res) => {
    const stats = deps.progressionService.getPlayerStats(req.authUser!.id);
    sendSuccess(res, { user: req.authUser!, stats });
  });

  router.patch('/users/me', requireAuth, (req, res, next) => {
    try {
      const parsed = updateProfileSchema.parse(req.body);
      const updatedUser = deps.authService.updateProfile(req.authUser!.id, parsed);
      const stats = deps.progressionService.getPlayerStats(updatedUser.id);
      sendSuccess(res, { user: updatedUser, stats }, 'Profile updated');
    } catch (err) {
      next(err);
    }
  });

  router.get('/users/:username', optionalAuth, (req, res, next) => {
    try {
      const username = String(req.params.username || '');
      const profile = deps.authService.getPublicProfileByUsername(username);
      if (!profile) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Player profile not found.');
      }
      const stats = deps.progressionService.getPlayerStats(profile.id);
      const recentHistory = deps.progressionService.getUserMatchHistory({
        userId: profile.id,
        page: 1,
        limit: 8,
      });
      sendSuccess(res, {
        profile,
        stats,
        recentMatches: recentHistory.items,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/users/:username/stats', optionalAuth, (req, res, next) => {
    try {
      const username = String(req.params.username || '');
      const profile = deps.authService.getPublicProfileByUsername(username);
      if (!profile) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Player not found.');
      }
      const stats = deps.progressionService.getPlayerStats(profile.id);
      sendSuccess(res, { stats });
    } catch (err) {
      next(err);
    }
  });

  // --- Private Rooms (Section 7.3) ---
  router.post('/rooms', requireAuth, limitRooms, (req, res, next) => {
    try {
      const parsed = createRoomSchema.parse(req.body);
      deps.matchmakingService.cancel(req.authUser!.id);
      const room = deps.roomService.createRoom({
        hostUserId: req.authUser!.id,
        hostUsername: req.authUser!.username,
        hostAvatar: req.authUser!.avatar,
        gameType: parsed.gameType,
      });
      sendSuccess(res, { room }, 'Private room created', 201);
    } catch (err) {
      next(err);
    }
  });

  router.get('/rooms/active', requireAuth, (req, res) => {
    const room = deps.roomService.getWaitingRoomForUser(req.authUser!.id);
    sendSuccess(res, { room });
  });

  router.post('/rooms/join', requireAuth, limitRooms, (req, res, next) => {
    try {
      const parsed = joinRoomSchema.parse(req.body);
      deps.matchmakingService.cancel(req.authUser!.id);
      const joined = deps.roomService.joinRoom({
        code: parsed.code,
        guestUserId: req.authUser!.id,
        guestUsername: req.authUser!.username,
        guestAvatar: req.authUser!.avatar,
      });
      deps.matchmakingService.cancel(joined.hostUserId);
      deps.getGateway()?.notifyMatchReady(joined.matchId, 'room:joined');
      sendSuccess(res, { matchId: joined.matchId, room: joined.room }, 'Joined private room');
    } catch (err) {
      next(err);
    }
  });

  router.delete('/rooms/:code', requireAuth, (req, res, next) => {
    try {
      const code = String(req.params.code || '').trim().toUpperCase();
      const cancelled = deps.roomService.cancelRoom({
        userId: req.authUser!.id,
        code,
      });
      sendSuccess(res, { room: cancelled }, 'Private room cancelled');
    } catch (err) {
      next(err);
    }
  });

  // --- Matches (Section 7.3) ---
  router.get('/matches/history', requireAuth, (req, res, next) => {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const history = deps.progressionService.getUserMatchHistory({
        userId: req.authUser!.id,
        page: query.page,
        limit: query.limit,
        gameType: query.gameType,
        outcome: query.outcome,
      });
      sendSuccess(res, history);
    } catch (err) {
      next(err);
    }
  });

  router.get('/matches/active', requireAuth, (req, res) => {
    const active = deps.matchService.getActiveMatchForUser(req.authUser!.id);
    if (!active) {
      sendSuccess(res, { match: null });
      return;
    }
    const snapshot = deps.matchService.buildSnapshot(active, req.authUser!.id);
    sendSuccess(res, { match: snapshot });
  });

  router.get('/matches/:matchId', requireAuth, (req, res, next) => {
    try {
      const matchId = String(req.params.matchId || '');
      const snapshot = deps.matchService.getSnapshotForUser(matchId, req.authUser!.id);
      const messages = deps.chatService.getMatchMessages(matchId, req.authUser!.id);
      sendSuccess(res, { match: snapshot, messages });
    } catch (err) {
      next(err);
    }
  });

  router.get('/matches/:matchId/result', requireAuth, (req, res, next) => {
    try {
      const matchId = String(req.params.matchId || '');
      const snapshot = deps.matchService.getSnapshotForUser(matchId, req.authUser!.id);
      if (snapshot.status !== 'COMPLETED' && snapshot.status !== 'ABANDONED') {
        throw new AppError(409, 'MATCH_IN_PROGRESS', 'This match has not finished yet.');
      }
      sendSuccess(res, {
        matchId: snapshot.id,
        gameType: snapshot.gameType,
        status: snapshot.status,
        result: snapshot.result,
        winnerUserId: snapshot.winnerUserId,
        players: snapshot.players,
        xpAwards: snapshot.xpAwards ?? [],
        completedAt: snapshot.completedAt,
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Leaderboard & Stats (Section 7.4) ---
  router.get('/leaderboard', optionalAuth, (req, res, next) => {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const board = deps.progressionService.getLeaderboard({
        page: query.page,
        limit: query.limit,
        currentUserId: req.authUser?.id,
      });
      sendSuccess(res, board);
    } catch (err) {
      next(err);
    }
  });

  router.get('/stats/me', requireAuth, (req, res) => {
    const stats = deps.progressionService.getPlayerStats(req.authUser!.id);
    sendSuccess(res, { stats });
  });

  router.get('/stats/me/games', requireAuth, (req, res) => {
    const stats = deps.progressionService.getPlayerStats(req.authUser!.id);
    sendSuccess(res, { perGame: stats?.perGame ?? null });
  });

  return router;
}
