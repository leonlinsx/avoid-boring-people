import { createHash, randomBytes } from 'node:crypto';

// Anonymous browser ownership. The raw token lives only in the reader's browser;
// the database stores its SHA-256 hash. The token is not signed, is not an
// account, and is never connected to newsletter identity.
export const COMMENT_TOKEN_COOKIE = 'leonlins_comment_token';
export const COMMENT_TOKEN_BYTES = 32; // 256 bits
export const COMMENT_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createCommentToken(): string {
  return randomBytes(COMMENT_TOKEN_BYTES).toString('base64url');
}

export function hashCommentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isCommentTokenShape(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

// SameSite=Strict means another site cannot make the browser attach this cookie,
// and HttpOnly keeps it away from any script on the page. It is deliberately not
// scoped to a single article: one browser keeps one pseudonymous identity.
export function commentTokenCookie(token: string): string {
  return [
    `${COMMENT_TOKEN_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${COMMENT_TOKEN_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

export function readCommentToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== COMMENT_TOKEN_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return isCommentTokenShape(value) ? value : null;
  }
  return null;
}
