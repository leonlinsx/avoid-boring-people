import type { APIRoute } from 'astro';
import { EMAIL_ATTEMPTS_PER_HOUR, IP_ATTEMPTS_PER_HOUR, takeRateLimit } from '../../lib/newsletter/rate-limit.ts';

export const prerender = false;

const SUBSTACK_BASE = 'https://avoidboringpeople.substack.com';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, first_url, source } = await request.json();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Invalid email' }),
        { status: 400 },
      );
    }

    // Unauthenticated relay to Substack: throttle per address and per IP so
    // this endpoint cannot be used for subscription bombing. A rate-store
    // outage fails open (logged) so legitimate signups keep working.
    try {
      const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const [emailAllowed, ipAllowed] = await Promise.all([
        takeRateLimit('email', String(email).toLowerCase(), EMAIL_ATTEMPTS_PER_HOUR),
        takeRateLimit('ip', forwarded ?? 'unknown', IP_ATTEMPTS_PER_HOUR),
      ]);
      if (!emailAllowed || !ipAllowed) {
        return new Response(
          JSON.stringify({ ok: false, message: 'Too many attempts. Please try again later.' }),
          { status: 429 },
        );
      }
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
    console.error('newsletter_subscribe_upstream_failure', { status: res.status });
    await res.text().catch(() => null);
    return new Response(
      JSON.stringify({ ok: false, message: 'Subscription failed. Please try again later.' }),
      { status: 502 },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, message: err?.message || 'Request failed' }),
      { status: 500 },
    );
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
