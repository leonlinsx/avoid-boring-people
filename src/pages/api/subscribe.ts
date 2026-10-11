import type { APIRoute } from 'astro';
import {
  EMAIL_ATTEMPTS_PER_HOUR,
  IP_ATTEMPTS_PER_HOUR,
  takeRateLimit,
} from '../../lib/newsletter/rate-limit.ts';

import { normalizeEmail } from '../../lib/newsletter/domain.ts';
import { readJsonBody, isHoneypotFilled } from '../../lib/request-body.ts';
import {
  boundedSignupString,
  MAX_SIGNUP_REQUEST_BYTES,
  signupClientIp,
} from '../../lib/newsletter/signup-input.ts';

export const prerender = false;

const SUBSTACK_BASE = 'https://avoidboringpeople.substack.com';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const parsed = await readJsonBody(request, MAX_SIGNUP_REQUEST_BYTES);
    const input = parsed.ok ? parsed.value : {};
    const email = normalizeEmail(boundedSignupString(input.email, 320) ?? '');
    const first_url = boundedSignupString(input.first_url, 2048);
    const source = boundedSignupString(input.source, 100);
    if (!parsed.ok || !email) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Invalid email' }),
        { status: 400 },
      );
    }

    if (isHoneypotFilled(input.website)) return Response.json({ ok: true });
    // Preserve the legacy availability policy: store outages fail open, with
    // a redacted operational log. Owned signup still fails closed.
    try {
      const [emailAllowed, ipAllowed] = await Promise.all([
        takeRateLimit('email', email, EMAIL_ATTEMPTS_PER_HOUR),
        takeRateLimit(
          'ip',
          signupClientIp(request, clientAddress),
          IP_ATTEMPTS_PER_HOUR,
        ),
      ]);
      if (!emailAllowed || !ipAllowed)
        return Response.json(
          { ok: false, message: 'Too many attempts. Please try again later.' },
          { status: 429 },
        );
    } catch (error) {
      console.error('newsletter_subscribe_rate_limit_unavailable', {
        name: error instanceof Error ? error.name : 'unknown',
      });
    }

    // Try JSON first
    let res = await fetch(`${SUBSTACK_BASE}/api/v1/free`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, first_url, source }),
    });

    // Fallback to form-encoded if needed
    if (!res.ok) {
      const form = new URLSearchParams();
      form.set('email', email);
      if (first_url) form.set('first_url', first_url);
      if (source) form.set('source', source);

      res = await fetch(`${SUBSTACK_BASE}/api/v1/free`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
    }

    if (res.ok)
      return new Response(JSON.stringify({ ok: true }), { status: 200 });

    // Do not reflect the upstream body: log the status server-side and
    // return a generic failure instead.
    console.error('newsletter_subscribe_upstream_failure', {
      status: res.status,
    });
    await res.text().catch(() => null);
    return new Response(
      JSON.stringify({
        ok: false,
        message: 'Subscription failed. Please try again later.',
      }),
      { status: 502 },
    );
  } catch (err) {
    console.error('newsletter_subscribe_failure', {
      name: err instanceof Error ? err.name : 'unknown',
    });
    const message = 'Subscription failed. Please try again later.';
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
    });
  }
};

// ✅ Add a simple GET handler to silence warnings
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ ok: false, message: 'Use POST to subscribe.' }),
    {
      status: 405, // Method Not Allowed
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
