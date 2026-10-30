import type { APIRoute } from 'astro';

export const prerender = false;

// Retired after the owned signup cutover. Never read or forward the request.
export const ALL: APIRoute = () =>
  Response.json(
    {
      ok: false,
      message:
        'This signup endpoint has been retired. Visit https://leonlins.com/#subscribe to subscribe.',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
