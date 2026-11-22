import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, sendError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { formatZodError } from '../validators/schemas.ts';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', formatZodError(err), err.issues);
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
    return;
  }

  logger.error('unhandled_http_error', {
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err : new Error(String(err)),
  });

  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred. Please try again.');
}
