import type { Response } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function sendSuccess<T>(res: Response, data: T, message = 'Request completed', statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
