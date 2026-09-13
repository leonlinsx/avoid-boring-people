import type { MiddlewareHandler } from 'astro';
import { hasUntrustedPathOverride, requiresOriginRejection } from './lib/newsletter/request-origin.ts';

export const onRequest: MiddlewareHandler = (context, next) => {
  if (hasUntrustedPathOverride(context.request)) {
    return new Response('Path overrides are not supported', { status: 403 });
  }
  if (requiresOriginRejection(context.request, context.isPrerendered)) {
    return new Response(`Cross-site ${context.request.method} form submissions are forbidden`, { status: 403 });
  }
  return next();
};
