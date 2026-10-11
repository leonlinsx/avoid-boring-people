import type { APIRoute } from 'astro';
import { newsletterAlert } from '../../../lib/newsletter/alerting';
import {
  genericSubscriptionResponse,
  requestSubscription,
} from '../../../lib/newsletter/subscriptions';
import { attributionFromRequest } from '../../../lib/newsletter/attribution';
import { readJsonBody, isHoneypotFilled } from '../../../lib/request-body.ts';
import {
  boundedSignupString,
  MAX_SIGNUP_REQUEST_BYTES,
  signupClientIp,
} from '../../../lib/newsletter/signup-input.ts';
export const prerender = false;
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const parsed = await readJsonBody(request, MAX_SIGNUP_REQUEST_BYTES);
  if (!parsed.ok) return Response.json(genericSubscriptionResponse);
  const input = parsed.value;
  const email = boundedSignupString(input.email, 320);
  if (!email || isHoneypotFilled(input.website))
    return Response.json(genericSubscriptionResponse);
  try {
    return Response.json(
      await requestSubscription({
        email,
        source: boundedSignupString(input.source, 100),
        ip: signupClientIp(request, clientAddress),
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
