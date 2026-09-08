// Preserve Astro 5's origin-check behavior for every route except the signed SNS POST.
// SNS sends text/plain without Origin. Its route authenticates the body before acting.
export function requiresOriginRejection(request: Request, isPrerendered: boolean): boolean {
  if (isPrerendered || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/api/newsletter/ses-events') return false;
  if (request.headers.get('origin') === url.origin) return false;
  const contentType = request.headers.get('content-type');
  return contentType === null || ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']
    .some((type) => contentType.toLowerCase().includes(type));
}
