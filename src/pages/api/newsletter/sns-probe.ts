import type { APIRoute } from 'astro';

export const prerender = false;

// Temporary Phase 3 transport probe. Never parse or retain the body.
export const POST: APIRoute = async ({ request }) => {
  let bodyBytes = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bodyBytes += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
  }
  const metadata = Object.fromEntries([
    'content-type', 'user-agent', 'x-amz-sns-message-type', 'x-amz-sns-topic-arn',
  ].map((name) => [name, request.headers.get(name)?.slice(0, 512) ?? null]));
  console.info('Newsletter SNS transport probe:', JSON.stringify({ ...metadata, bodyBytes }));
  return new Response(null, { status: 204 });
};
