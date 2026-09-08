import type { MiddlewareHandler } from 'astro';
import { requiresOriginRejection } from './lib/newsletter/request-origin.ts';

export const onRequest: MiddlewareHandler = (context, next) => {
  if (requiresOriginRejection(context.request, context.isPrerendered)) {
    return new Response(`Cross-site ${context.request.method} form submissions are forbidden`, { status: 403 });
  }
  return next();
};
