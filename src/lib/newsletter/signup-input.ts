import { isIP } from 'node:net';

export const MAX_SIGNUP_REQUEST_BYTES = 8 * 1024;

// Only Vercel's platform header is trusted on Vercel. Elsewhere the adapter's
// peer address is used; arbitrary forwarding headers never choose a bucket.
// https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
export function signupClientIp(
  request: Request,
  peerAddress?: string,
  vercel = process.env.VERCEL === '1',
): string {
  const ip = (
    vercel ? request.headers.get('x-vercel-forwarded-for') : peerAddress
  )?.trim();
  if (!ip || !isIP(ip)) return 'unknown';
  return isIP(ip) === 6 ? new URL(`http://[${ip}]`).hostname : ip;
}

export function boundedSignupString(
  value: unknown,
  max: number,
): string | undefined {
  return typeof value === 'string' && value.length <= max ? value : undefined;
}
