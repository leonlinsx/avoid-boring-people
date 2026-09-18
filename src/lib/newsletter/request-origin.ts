import { canonicalSiteOrigin } from '../site-origin.ts';

// `@astrojs/vercel` rewrites the internal request path from the client-supplied
// `x-astro-path` header or `x_astro_path` query parameter with no authentication
// (GHSA-mr6q-rp88-fx84), which lets any caller reach any route under any URL.
// The header survives into middleware, so the guard below rejects it. The query
// parameter is consumed by the adapter before middleware runs, so that half can
// only be fixed by upgrading the adapter. There is no ISR route, no `vercel.json`
// rewrite, and no generated edge middleware here, so no legitimate request
// carries either value; remove this guard once the adapter gates the override
// behind its build-time middleware secret.
export function hasUntrustedPathOverride(request: Request): boolean {
  return (
    request.headers.has('x-astro-path') ||
    new URL(request.url).searchParams.has('x_astro_path')
  );
}

// Preserve Astro 5's origin-check behavior except for the machine-to-machine
// POSTs whose bodies carry their own authorization. SNS authenticates a signature;
// RFC one-click unsubscribe authenticates the high-entropy token in the URL/body;
// the Instagram media upload authenticates a bearer secret held only by CI.
export function requiresOriginRejection(
  request: Request,
  isPrerendered: boolean,
): boolean {
  if (isPrerendered || ['GET', 'HEAD', 'OPTIONS'].includes(request.method))
    return false;
  const url = new URL(request.url);
  if (
    request.method === 'POST' &&
    [
      '/api/newsletter/ses-events',
      '/api/newsletter/unsubscribe',
      '/api/social/instagram-media',
    ].includes(url.pathname)
  )
    return false;
  if (request.headers.get('origin') === canonicalSiteOrigin()) return false;
  const contentType = request.headers.get('content-type');
  return (
    contentType === null ||
    [
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
    ].some((type) => contentType.toLowerCase().includes(type))
  );
}
