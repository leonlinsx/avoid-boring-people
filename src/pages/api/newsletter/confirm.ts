import type { APIRoute } from 'astro';
import { buildConfirmInvalidPage, buildConfirmSuccessPage } from '../../../lib/newsletter/confirm-pages';
import { confirmSubscription } from '../../../lib/newsletter/subscriptions';
export const prerender = false;
export const GET: APIRoute = async ({ url }) => new Response(await confirmSubscription(url.searchParams.get('token') ?? '') ? buildConfirmSuccessPage() : buildConfirmInvalidPage(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
