import { SITE_URL } from '../consts.ts';

// The trusted origin is the canonical origin this site is built for, never the
// request URL: `Host`, `x-forwarded-host`, and `x-forwarded-proto` are supplied
// by the caller or by the proxy in front of us, so deriving the origin from the
// request would let a forwarded header decide whether a POST looks same-origin.
export function canonicalSiteOrigin(): string {
  return new URL(SITE_URL).origin;
}

// Second, explicit same-origin gate for state-changing endpoints, on top of the
// middleware behavior in src/middleware.ts. A missing `Origin` is allowed
// because the ownership cookie is SameSite=Strict: a cross-site submission
// cannot carry it, and a browser that omits `Origin` for a same-origin
// `fetch` still cannot be tricked into posting for another site.
export function isSameSiteRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin === null || origin === canonicalSiteOrigin();
}
