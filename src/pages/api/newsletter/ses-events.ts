import type { APIRoute } from 'astro';
import { newsletterAlert } from '../../../lib/newsletter/alerting.ts';
import { recordSesEvent } from '../../../lib/newsletter/events.ts';
import {
  confirmSnsSubscription,
  parseSnsEnvelope,
  verifySnsEnvelope,
} from '../../../lib/newsletter/sns.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const started = performance.now();
  const deadline = AbortSignal.timeout(8_000);
  let authenticated = false;
  // Classify the failure so junk internet traffic cannot be mistaken for a real
  // ingestion problem: a rejected signature or an unreadable body is only
  // logged, while a missing topic configuration (nothing can be ingested in
  // that state) and a failure to write state after authentication are alerted
  // on. The configuration branch is reachable before authentication, so its
  // alert repeats per request; the log rule behind it must use a count or rate
  // window rather than a single matching line.
  let stage: 'configuration' | 'authentication' | 'processing' =
    'configuration';
  try {
    const expectedTopicArn = process.env.NEWSLETTER_SNS_TOPIC_ARN;
    if (!expectedTopicArn) throw new Error('SNS topic is not configured.');
    // Past this point a failure is untrusted input or a rejected signature,
    // which is ordinary exposure, not an ingestion failure.
    stage = 'authentication';
    const envelope = parseSnsEnvelope(JSON.parse(await request.text()));
    await verifySnsEnvelope(envelope, expectedTopicArn, undefined, deadline);
    authenticated = true;
    stage = 'processing';
    if (envelope.Type === 'SubscriptionConfirmation') {
      console.info(
        'Newsletter SNS subscription confirmation signature verified.',
      );
      await confirmSnsSubscription(
        envelope,
        expectedTopicArn,
        undefined,
        deadline,
      );
      console.info('Newsletter SNS subscription confirmation completed.', {
        elapsedMs: Math.round(performance.now() - started),
      });
    } else if (envelope.Type === 'Notification') await recordSesEvent(envelope);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (stage !== 'authentication')
      newsletterAlert('ses_event_ingestion_failure', {
        reason: stage,
        errorName: error instanceof Error ? error.name : 'unknown',
      });
    // Do not disclose endpoint configuration or trust decisions to an unauthenticated sender.
    // Retain only the reason in server logs; never log the signed SNS body or its token.
    console.error(
      'Newsletter SNS event rejected:',
      authenticated
        ? 'Authenticated processing failed; retry required.'
        : error instanceof Error
          ? error.message
          : 'unknown error',
    );
    // SNS retries 5xx, not ordinary 4xx. Never acknowledge a failed state update.
    return new Response(null, { status: authenticated ? 503 : 400 });
  }
};
