import type { APIRoute } from 'astro';
import {
  buildConfirmInvalidPage,
  buildConfirmPromptPage,
  buildConfirmSuccessPage,
} from '../../../lib/newsletter/confirm-pages';
import { confirmSubscription } from '../../../lib/newsletter/subscriptions';

export const prerender = false;

// Confirming is a state change, so GET only renders the button page and the
// POST finishes the job. Mailbox scanners and link prefetchers issue GETs, and
// a plain link must not be able to confirm — or to reactivate a resubscription —
// on the reader's behalf.
const resultHeaders = {
  'cache-control': 'no-store',
  'content-type': 'text/html; charset=utf-8',
  'referrer-policy': 'no-referrer',
};

export const GET: APIRoute = async ({ url }) =>
  new Response(buildConfirmPromptPage(url.searchParams.get('token') ?? ''), {
    status: 200,
    headers: resultHeaders,
  });

export const POST: APIRoute = async ({ request, url }) => {
  let token = url.searchParams.get('token') ?? '';
  try {
    const form = await request.formData();
    token = String(form.get('token') ?? token);
  } catch {
    // A malformed body falls back to the query parameter above, which is the
    // token the rendered form always sends.
  }
  return new Response(
    (await confirmSubscription(token))
      ? buildConfirmSuccessPage()
      : buildConfirmInvalidPage(),
    { status: 200, headers: resultHeaders },
  );
};
