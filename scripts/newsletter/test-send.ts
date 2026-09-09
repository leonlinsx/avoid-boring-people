import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { readNewsletterArticle, renderNewsletterEmail } from '../../src/lib/newsletter/render.ts';
import { NEWSLETTER_FROM, NEWSLETTER_REPLY_TO, NEWSLETTER_PRIVACY_URL } from '../../src/lib/newsletter/email.ts';
import { assertAllowedTestRecipient } from '../../src/lib/newsletter/test-send.ts';

function frontmatterTitle(markdown: string): string | null {
  const match = markdown.match(/^title:\s*['\"]?(.+?)['\"]?\s*$/m);
  return match?.[1]?.trim() ?? null;
}

const [articleId, recipient, confirmation] = process.argv.slice(2);
if (!articleId || !recipient || confirmation !== '--confirm-test') {
  throw new Error('Usage: npm run newsletter:test -- <article-id> <allowlisted-recipient> --confirm-test');
}

const testRecipient = assertAllowedTestRecipient(recipient, process.env.NEWSLETTER_TEST_RECIPIENTS);
const configurationSet = process.env.SES_CONFIGURATION_SET;
if (!configurationSet || !process.env.AWS_REGION) {
  throw new Error('Test send requires SES_CONFIGURATION_SET and AWS_REGION. No email was sent.');
}

const markdown = readNewsletterArticle(articleId);
const title = frontmatterTitle(markdown);
if (!title) throw new Error('The selected article has no title. No email was sent.');
const unsubscribeUrl = new URL('/api/newsletter/unsubscribe?token=test-only-not-a-subscriber', NEWSLETTER_PRIVACY_URL).toString();
const rendered = renderNewsletterEmail({
  articleId,
  title: `[TEST] ${title}`,
  markdown,
  privacyUrl: NEWSLETTER_PRIVACY_URL,
  unsubscribeUrl,
});

const result = await new SESv2Client({ region: process.env.AWS_REGION }).send(new SendEmailCommand({
  FromEmailAddress: NEWSLETTER_FROM,
  ReplyToAddresses: [NEWSLETTER_REPLY_TO],
  Destination: { ToAddresses: [testRecipient] },
  ConfigurationSetName: configurationSet,
  Content: {
    Simple: {
      Subject: { Data: `[TEST] ${title}`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: rendered.html, Charset: 'UTF-8' },
        Text: { Data: rendered.text, Charset: 'UTF-8' },
      },
      Headers: Object.entries(rendered.headers).map(([Name, Value]) => ({ Name, Value })),
    },
  },
}));

console.log(`Test email accepted by SES for ${testRecipient}; message id: ${result.MessageId ?? 'unavailable'}`);
