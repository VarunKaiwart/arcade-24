import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

/**
 * Hash password using Node's native crypto.scrypt with a unique random salt (FR-AUTH-03).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  })) as Buffer;
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Constant-time password verification against stored scrypt hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, nStr, rStr, pStr, salt, expectedHex] = parts;
  const N = Number.parseInt(nStr, 10);
  const r = Number.parseInt(rStr, 10);
  const p = Number.parseInt(pStr, 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
    return false;
  }
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedKey = (await scryptAsync(password, salt, expectedBuf.length, { N, r, p })) as Buffer;
  if (derivedKey.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedKey, expectedBuf);
}

export interface SessionTokenPayload {
  sub: string; // userId
  sid: string; // session id (revoked on logout)
  username: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padLen = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Create an HMAC-SHA256 signed JWT token.
 */
export function signSessionToken(
  payload: Omit<SessionTokenPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body: SessionTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

/**
 * Verify an HMAC-SHA256 JWT token in constant time and check expiration.
 */
export function verifySessionToken(token: string, secret: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedBody, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  const actualBuf = Buffer.from(encodedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string; typ?: string };
    if (header.alg !== 'HS256') return null;
    const body = JSON.parse(base64UrlDecode(encodedBody)) as SessionTokenPayload;
    if (!body || typeof body.sub !== 'string' || typeof body.sid !== 'string' || typeof body.exp !== 'number') {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (body.exp <= now) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}

/**
 * Unambiguous room code alphabet (no 0/O, 1/I/L) — 6 characters (FR-ROOM-02).
 */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function generateId(): string {
  return crypto.randomUUID();
}
