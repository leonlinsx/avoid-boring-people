import type { APIRoute } from 'astro';
import { requestSubscription } from '../../../lib/newsletter/subscriptions';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    return Response.json(await requestSubscription({ email: String(data.email ?? ''), source: typeof data.source === 'string' ? data.source : undefined, honeypot: typeof data.website === 'string' ? data.website : undefined }));
  } catch { return Response.json({ ok: true, message: 'If this address can receive this newsletter, check your inbox.' }); }
};
