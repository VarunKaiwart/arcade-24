import type { Request, Response, NextFunction } from 'express';
import { sendError } from './errors.ts';

interface RateLimitBucket {
  timestamps: number[];
}

export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private lastCleanup = Date.now();

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public consume(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    this.maybeCleanup(now);
    const cutoff = now - this.windowMs;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Drop timestamps outside sliding window
    while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
      bucket.timestamps.shift();
    }

    if (bucket.timestamps.length >= this.maxRequests) {
      const oldest = bucket.timestamps[0];
      return { allowed: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now) };
    }

    bucket.timestamps.push(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  public reset(): void {
    this.buckets.clear();
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup < 60_000) return;
    this.lastCleanup = now;
    const cutoff = now - this.windowMs;
    for (const [key, bucket] of this.buckets.entries()) {
      while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
        bucket.timestamps.shift();
      }
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }
  }
}

export function createHttpRateLimitMiddleware(
  limiter: SlidingWindowLimiter,
  keyFn: (req: Request) => string,
  message = 'Too many requests. Please wait a moment and try again.'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { allowed, retryAfterMs } = limiter.consume(keyFn(req));
    if (!allowed) {
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      sendError(res, 429, 'RATE_LIMITED', message);
      return;
    }
    next();
  };
}
