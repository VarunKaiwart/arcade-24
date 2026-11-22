import crypto from 'node:crypto';
import path from 'node:path';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Generate an ephemeral per-process secret if JWT_SECRET is not provided in development.
const runtimeFallbackSecret = crypto.randomBytes(32).toString('hex');

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  clientOrigin: string;
  databasePath: string;
  jwtSecret: string;
  sessionTtlSeconds: number;
  roomTtlMinutes: number;
  reconnectGraceSeconds: number;
  matchmakingTimeoutSeconds: number;
  tttTurnSeconds: number;
  rpsRoundSeconds: number;
  connectFourTurnSeconds: number;
  chatMaxLength: number;
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const envJwtSecret = process.env.JWT_SECRET?.trim();

  const defaultDbPath = path.resolve(process.cwd(), 'data', 'duelzone.sqlite');

  return {
    nodeEnv,
    isProduction,
    port: parsePositiveInt(process.env.PORT, 3000),
    clientOrigin: process.env.CLIENT_ORIGIN || process.env.APP_URL || 'http://localhost:3000',
    databasePath: process.env.DATABASE_PATH || defaultDbPath,
    jwtSecret: envJwtSecret && envJwtSecret.length >= 16 ? envJwtSecret : runtimeFallbackSecret,
    sessionTtlSeconds: parsePositiveInt(process.env.SESSION_TTL_SECONDS, 60 * 60 * 24 * 7),
    roomTtlMinutes: parsePositiveInt(process.env.ROOM_TTL_MINUTES, 15),
    reconnectGraceSeconds: parsePositiveInt(process.env.MATCH_RECONNECT_GRACE_SECONDS, 30),
    matchmakingTimeoutSeconds: parsePositiveInt(process.env.MATCHMAKING_TIMEOUT_SECONDS, 90),
    tttTurnSeconds: parsePositiveInt(process.env.TTT_TURN_SECONDS, 30),
    rpsRoundSeconds: parsePositiveInt(process.env.RPS_ROUND_SECONDS, 20),
    connectFourTurnSeconds: parsePositiveInt(process.env.CONNECT_FOUR_TURN_SECONDS, 35),
    chatMaxLength: parsePositiveInt(process.env.CHAT_MAX_LENGTH, 500),
    ...overrides,
  };
}
