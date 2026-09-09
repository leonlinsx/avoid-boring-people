import type { APIRoute } from 'astro';
import { unsubscribe } from '../../../lib/newsletter/subscriptions.ts';
export const prerender = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

export const GET: APIRoute = async ({ url }) => {
  // GET is intentionally non-mutating so mailbox link scanners cannot unsubscribe people.
  const token = escapeHtml(url.searchParams.get('token') ?? '');
  const html = `<!doctype html><html><head><meta name="robots" content="noindex"><title>Unsubscribe</title></head><body><main><h1>Unsubscribe</h1><p>Stop receiving Avoid Boring People emails?</p><form method="post" action="/api/newsletter/unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form></main></body></html>`;
  return new Response(html, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
      'referrer-policy': 'no-referrer',
    },
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  let token = url.searchParams.get('token') ?? '';
  try {
    const form = await request.formData();
    token = String(form.get('token') ?? token);
  } catch {
    // A malformed request remains a generic idempotent no-op.
  }
  await unsubscribe(token);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
