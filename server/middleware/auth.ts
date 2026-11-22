import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '../../shared/types.ts';
import type { AppConfig } from '../config/env.ts';
import type { AuthService } from '../services/authService.ts';
import { sendError } from '../utils/errors.ts';

export const SESSION_COOKIE_NAME = 'dz_session';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      sessionId?: string;
      sessionToken?: string;
      authMethod?: 'bearer' | 'cookie';
    }
  }
}

export function extractTokenFromRequest(req: Request): {
  token: string | null;
  method: 'bearer' | 'cookie' | null;
} {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return { token, method: 'bearer' };
  }

  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return { token: cookieToken.trim(), method: 'cookie' };
  }

  return { token: null, method: null };
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') {
    return true;
  }
  return Boolean(req.secure);
}

/**
 * Emits HttpOnly session cookie compatible with both local HTTP and cross-site HTTPS iframes
 * (HttpOnly; Secure; SameSite=None; Partitioned over HTTPS).
 */
export function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  config: AppConfig
): void {
  const secure = isHttpsRequest(req) || config.isProduction;
  const maxAge = config.sessionTtlSeconds;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response, config: AppConfig): void {
  const secure = isHttpsRequest(req) || config.isProduction;
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.append('Set-Cookie', parts.join('; '));
}

/**
 * Verifies CSRF protection for cookie-authenticated state-changing requests.
 */
function verifyCsrfIfCookieAuth(req: Request): boolean {
  if (req.authMethod !== 'cookie') return true;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) return true;

  // Custom request header set by the SPA client
  if (req.headers['x-requested-with'] === 'DuelZone') {
    return true;
  }

  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function createAuthMiddleware(authService: AuthService) {
  function attachSession(req: Request): void {
    const { token, method } = extractTokenFromRequest(req);
    if (!token || !method) return;

    const verified = authService.verifyToken(token);
    if (!verified) return;

    req.authUser = verified.user;
    req.sessionId = verified.sessionId;
    req.sessionToken = token;
    req.authMethod = method;
  }

  const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
    attachSession(req);
    next();
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    attachSession(req);
    if (!req.authUser || !req.sessionId) {
      sendError(res, 401, 'UNAUTHORIZED', 'Please sign in to access this resource.');
      return;
    }
    if (!verifyCsrfIfCookieAuth(req)) {
      sendError(res, 403, 'CSRF_REJECTED', 'Invalid request origin.');
      return;
    }
    next();
  };

  return { optionalAuth, requireAuth };
}
