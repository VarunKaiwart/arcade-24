import http from 'node:http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { type AppConfig, loadConfig } from './config/env.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { DuelZoneDatabase } from './repositories/database.ts';
import { createApiRouter } from './routes/api.ts';
import { AuthService } from './services/authService.ts';
import { ChatService } from './services/chatService.ts';
import { MatchService } from './services/matchService.ts';
import { MatchmakingService } from './services/matchmakingService.ts';
import { PresenceService } from './services/presenceService.ts';
import { ProgressionService } from './services/progressionService.ts';
import { RoomService } from './services/roomService.ts';
import { SocketGateway } from './sockets/gateway.ts';
import { sendError } from './utils/errors.ts';

export interface DuelZoneAppInstance {
  config: AppConfig;
  app: Express;
  httpServer: http.Server;
  database: DuelZoneDatabase;
  authService: AuthService;
  progressionService: ProgressionService;
  presenceService: PresenceService;
  matchService: MatchService;
  roomService: RoomService;
  matchmakingService: MatchmakingService;
  chatService: ChatService;
  gateway: SocketGateway;
  close: () => Promise<void>;
}

export function createDuelZoneServer(overrides?: Partial<AppConfig>): DuelZoneAppInstance {
  const config = loadConfig(overrides);
  const database = new DuelZoneDatabase(config.databasePath);

  const authService = new AuthService(database, config);
  const progressionService = new ProgressionService(database);
  const presenceService = new PresenceService();
  const matchService = new MatchService(database, config, progressionService, presenceService);
  const roomService = new RoomService(database, config, matchService);
  const matchmakingService = new MatchmakingService(config, matchService, presenceService);
  const chatService = new ChatService(database, config);

  const allowedOrigins = Array.from(
    new Set(
      [
        config.clientOrigin,
        process.env.APP_URL,
        `http://localhost:${config.port}`,
        `http://127.0.0.1:${config.port}`,
        'http://localhost:3000',
        'http://localhost:5173',
      ].filter((v): v is string => Boolean(v))
    )
  );

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Basic security headers (avoid X-Frame-Options so AI Studio iframe works smoothly)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        try {
          const parsed = new URL(origin);
          if (
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1' ||
            parsed.hostname.endsWith('.run.app')
          ) {
            return callback(null, true);
          }
        } catch {
          // reject malformed origin
        }
        return callback(new Error('CORS origin not allowed'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  let gatewayRef: SocketGateway | null = null;

  const apiRouter = createApiRouter({
    config,
    database,
    authService,
    progressionService,
    roomService,
    matchService,
    matchmakingService,
    chatService,
    presenceService,
    getGateway: () => gatewayRef,
  });

  app.use('/api', apiRouter);

  // Unknown /api routes return clean JSON 404
  app.use('/api', (_req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'API endpoint not found.');
  });

  app.use(errorHandler);

  const httpServer = http.createServer(app);
  const gateway = new SocketGateway({
    httpServer,
    config,
    authService,
    presenceService,
    matchService,
    roomService,
    matchmakingService,
    chatService,
    allowedOrigins,
  });
  gatewayRef = gateway;

  const close = async (): Promise<void> => {
    matchmakingService.shutdown();
    matchService.shutdown();
    await gateway.close();
    await new Promise<void>((resolve) => {
      if (!httpServer.listening) return resolve();
      httpServer.close(() => resolve());
    });
    database.close();
  };

  return {
    config,
    app,
    httpServer,
    database,
    authService,
    progressionService,
    presenceService,
    matchService,
    roomService,
    matchmakingService,
    chatService,
    gateway,
    close,
  };
}
