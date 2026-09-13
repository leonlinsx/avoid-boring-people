// Preserve Astro 5's origin-check behavior except for the machine-to-machine
// POSTs whose bodies carry their own authorization. SNS authenticates a signature;
// RFC one-click unsubscribe authenticates the high-entropy token in the URL/body;
// the Instagram media upload authenticates a bearer secret held only by CI.
export function requiresOriginRejection(request: Request, isPrerendered: boolean): boolean {
  if (isPrerendered || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  const url = new URL(request.url);
  if (request.method === 'POST' && ['/api/newsletter/ses-events', '/api/newsletter/unsubscribe', '/api/social/instagram-media'].includes(url.pathname)) return false;
  if (request.headers.get('origin') === url.origin) return false;
  const contentType = request.headers.get('content-type');
  return contentType === null || ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']
    .some((type) => contentType.toLowerCase().includes(type));
}
