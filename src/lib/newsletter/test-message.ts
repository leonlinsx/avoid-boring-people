import {
  assertPublishedNewsletterPage,
  newsletterPresentation,
} from './presentation.ts';
import { assertPublicNewsletterImages } from './public-images.ts';
import { renderNewsletterEmail } from './render.ts';
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
  hosted?: boolean;
  request?: typeof fetch;
  resolveAddresses?: (host: string) => Promise<string[]>;
}): Promise<SendEmailCommandInput> {
  const recipient = assertAllowedTestRecipient(
    input.recipient,
    input.env.NEWSLETTER_TEST_RECIPIENTS,
  );
  if (!input.env.SES_CONFIGURATION_SET || !input.env.AWS_REGION)
    throw new Error(
      'Test send requires SES_CONFIGURATION_SET and AWS_REGION. No email was sent.',
    );
  const articleTitle = newsletterTitle(input.markdown);
  const presentation = newsletterPresentation(input.env, input.hosted === true);
  const title = input.hosted ? articleTitle : `[TEST] ${articleTitle}`;
  const renderInput = {
    ...presentation,
    articleId: input.articleId,
    markdown: input.markdown,
    title,
    privacyUrl: NEWSLETTER_PRIVACY_URL,
    unsubscribeUrl: TEST_UNSUBSCRIBE_URL,
  };
  const privateRendered = input.hosted
    ? undefined
    : await renderPrivateNewsletter(renderInput);
  const rendered = privateRendered ?? renderNewsletterEmail(renderInput);
  if (input.hosted) {
    await assertPublishedNewsletterPage(
      input.articleId,
      input.markdown,
      input.request,
    );
    await assertPublicNewsletterImages(
      rendered.html,
      input.request,
      input.resolveAddresses,
    );
  }
  // Avoid reusing the same test Subject for Gmail's repeated-message heuristics.
  // The production-format body retains the exact article title and footer.
  const subject = input.hosted
    ? `[TEST] ${articleTitle} — preview ${new Date().toISOString()}`
    : title;
  return {
    FromEmailAddress: NEWSLETTER_FROM,
    ReplyToAddresses: [NEWSLETTER_REPLY_TO],
    Destination: { ToAddresses: [recipient] },
    ConfigurationSetName: input.env.SES_CONFIGURATION_SET,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: rendered.html, Charset: 'UTF-8' },
          Text: { Data: rendered.text, Charset: 'UTF-8' },
        },
        Headers: Object.entries(rendered.headers).map(([Name, Value]) => ({
          Name,
          Value,
        })),
        ...(privateRendered
          ? { Attachments: privateRendered.attachments }
          : {}),
      },
    },
  };
}
