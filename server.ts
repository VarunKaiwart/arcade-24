import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createDuelZoneServer } from './server/app.ts';
import { logger } from './server/utils/logger.ts';

async function startServer(): Promise<void> {
  const instance = createDuelZoneServer();
  const { app, httpServer, config } = instance;

  if (!config.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');

    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false }));
      app.get('*', (_req, res) => {
        res.sendFile(indexHtmlPath);
      });
    } else {
      logger.warn('dist_missing_in_production', { distDir });
    }
  }

  httpServer.listen(config.port, '0.0.0.0', () => {
    logger.info('duelzone_server_started', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      databasePath: config.databasePath,
    });
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info('duelzone_server_shutdown', { signal });
    await instance.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
}

startServer().catch((err) => {
  logger.error('duelzone_server_fatal', {
    error: err instanceof Error ? err : new Error(String(err)),
  });
  process.exit(1);
});
