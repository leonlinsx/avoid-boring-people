import type { APIRoute } from 'astro';
import { recordSesEvent } from '../../../lib/newsletter/events.ts';
import { confirmSnsSubscription, parseSnsEnvelope, verifySnsEnvelope } from '../../../lib/newsletter/sns.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const expectedTopicArn = process.env.NEWSLETTER_SNS_TOPIC_ARN;
    if (!expectedTopicArn) throw new Error('SNS topic is not configured.');
    const envelope = parseSnsEnvelope(JSON.parse(await request.text()));
    await verifySnsEnvelope(envelope, expectedTopicArn);
    if (envelope.Type === 'SubscriptionConfirmation') await confirmSnsSubscription(envelope, expectedTopicArn);
    else if (envelope.Type === 'Notification') await recordSesEvent(envelope);
    return new Response(null, { status: 204 });
  } catch {
    // Do not disclose endpoint configuration or trust decisions to an unauthenticated sender.
    return new Response(null, { status: 400 });
  }
};
