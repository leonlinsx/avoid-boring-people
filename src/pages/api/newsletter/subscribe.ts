import type { APIRoute } from 'astro';
import { newsletterAlert } from '../../../lib/newsletter/alerting';
import {
  genericSubscriptionResponse,
  requestSubscription,
} from '../../../lib/newsletter/subscriptions';
import { attributionFromRequest } from '../../../lib/newsletter/attribution';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  // Reading the body is client-controlled input handling, not pipeline work: a
  // malformed request is answered neutrally and never alerted on.
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    console.warn('newsletter_subscription_body_invalid');
    return Response.json(genericSubscriptionResponse);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return Response.json(genericSubscriptionResponse);
  const input = data as Record<string, unknown>;
  try {
    const forwarded = request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim();
    return Response.json(
      await requestSubscription({
        email: String(input.email ?? ''),
        source: typeof input.source === 'string' ? input.source : undefined,
        honeypot: typeof input.website === 'string' ? input.website : undefined,
        ip: forwarded ?? 'unknown',
        attribution: attributionFromRequest(input.attribution),
      }),
    );
  } catch (error) {
    // The failure is alerted on, the response still says nothing about it. The
    // driver's message is deliberately not logged: a Postgres or fetch error can
    // quote the failing row or the connection string, and the error's name is
    // enough to route the failure.
    newsletterAlert('signup_pipeline_failure', {
      errorName: error instanceof Error ? error.name : 'unknown',
    });

    return Response.json(genericSubscriptionResponse);
  }
};
