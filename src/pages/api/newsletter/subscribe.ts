import type { APIRoute } from 'astro';
import { requestSubscription } from '../../../lib/newsletter/subscriptions';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return Response.json(await requestSubscription({ email: String(data.email ?? ''), source: typeof data.source === 'string' ? data.source : undefined, honeypot: typeof data.website === 'string' ? data.website : undefined, ip: forwarded ?? 'unknown' }));
  } catch (error) {
  console.error('newsletter_subscription_failed', {
    name: error instanceof Error ? error.name : 'unknown',
    message: error instanceof Error ? error.message : 'unknown',
  });

  return Response.json({
    ok: true,
    message: 'If this address can receive this newsletter, check your inbox.',
  });
  }
};