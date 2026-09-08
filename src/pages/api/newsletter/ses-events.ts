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
    if (envelope.Type === 'SubscriptionConfirmation') {
      console.info('Newsletter SNS subscription confirmation signature verified.');
      await confirmSnsSubscription(envelope, expectedTopicArn);
      console.info('Newsletter SNS subscription confirmation completed.');
    }
    else if (envelope.Type === 'Notification') await recordSesEvent(envelope);
    return new Response(null, { status: 204 });
  } catch (error) {
    // Do not disclose endpoint configuration or trust decisions to an unauthenticated sender.
    // Retain only the reason in server logs; never log the signed SNS body or its token.
    console.error('Newsletter SNS event rejected:', error instanceof Error ? error.message : 'unknown error');
    return new Response(null, { status: 400 });
  }
};
