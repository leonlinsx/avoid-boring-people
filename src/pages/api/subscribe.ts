import type { APIRoute } from 'astro';

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

    const text = await res.text();
    return new Response(
      JSON.stringify({ ok: false, status: res.status, message: text }),
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
