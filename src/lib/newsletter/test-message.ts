import type { SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import { newsletterTitle } from './campaign.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
  NEWSLETTER_PRIVACY_URL,
} from './email.ts';
import {
  renderPrivateNewsletter,
  TEST_UNSUBSCRIBE_URL,
} from './private-preview.ts';
import { assertAllowedTestRecipient } from './test-send.ts';

/** Construct only: no SES invocation, subscriber lookup or campaign creation. */
export async function buildTestEmail(input: {
  articleId: string;
  markdown: string;
  recipient: string;
  env: NodeJS.ProcessEnv;
}): Promise<SendEmailCommandInput> {
  const recipient = assertAllowedTestRecipient(
    input.recipient,
    input.env.NEWSLETTER_TEST_RECIPIENTS,
  );
  if (!input.env.SES_CONFIGURATION_SET || !input.env.AWS_REGION)
    throw new Error(
      'Test send requires SES_CONFIGURATION_SET and AWS_REGION. No email was sent.',
    );
  const title = `[TEST] ${newsletterTitle(input.markdown)}`;
  const rendered = await renderPrivateNewsletter({
    ...input,
    title,
    privacyUrl: NEWSLETTER_PRIVACY_URL,
    unsubscribeUrl: TEST_UNSUBSCRIBE_URL,
  });
  return {
    FromEmailAddress: NEWSLETTER_FROM,
    ReplyToAddresses: [NEWSLETTER_REPLY_TO],
    Destination: { ToAddresses: [recipient] },
    ConfigurationSetName: input.env.SES_CONFIGURATION_SET,
    Content: {
      Simple: {
        Subject: { Data: title, Charset: 'UTF-8' },
        Body: {
          Html: { Data: rendered.html, Charset: 'UTF-8' },
          Text: { Data: rendered.text, Charset: 'UTF-8' },
        },
        Headers: Object.entries(rendered.headers).map(([Name, Value]) => ({
          Name,
          Value,
        })),
        Attachments: rendered.attachments,
      },
    },
  };
}
