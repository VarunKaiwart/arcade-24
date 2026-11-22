type LogLevel = 'info' | 'warn' | 'error';

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'authorization',
  'cookie',
  'jwtSecret',
  'secret',
  'message',
]);

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(key.toLowerCase()) || REDACTED_KEYS.has(key)) {
      clean[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      clean[key] = { name: value.name, message: value.message };
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function writeLog(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'test' && level === 'info') {
    return;
  }
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => writeLog('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => writeLog('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => writeLog('error', event, meta),
};
