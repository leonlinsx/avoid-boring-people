import type { APIRoute } from 'astro';
import { confirmSubscription } from '../../../lib/newsletter/subscriptions';
export const prerender = false;
export const GET: APIRoute = async ({ url }) => new Response(await confirmSubscription(url.searchParams.get('token') ?? '') ? 'Subscription confirmed.' : 'This confirmation link is invalid or has already been used.', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
