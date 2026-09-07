import type { APIRoute } from 'astro';
import { unsubscribe } from '../../../lib/newsletter/subscriptions';
export const prerender = false;
export const GET: APIRoute = async ({ url }) => { await unsubscribe(url.searchParams.get('token') ?? ''); return new Response('You have been unsubscribed.', { headers: { 'content-type': 'text/plain; charset=utf-8' } }); };
export const POST: APIRoute = async ({ request, url }) => { const form = await request.formData(); await unsubscribe(String(form.get('token') ?? url.searchParams.get('token') ?? '')); return new Response(null, { status: 204 }); };
