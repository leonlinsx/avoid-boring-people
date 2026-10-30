import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { readNewsletterArticle } from '../../src/lib/newsletter/render.ts';
import { buildTestEmail } from '../../src/lib/newsletter/test-message.ts';

const [articleId, recipient, confirmation, ...extra] = process.argv.slice(2);
if (
  !articleId ||
  !recipient ||
  confirmation !== '--confirm-test' ||
  extra.length > 0
) {
  throw new Error(
    'Usage: npm run newsletter:test -- <article-id> <allowlisted-recipient> --confirm-test',
  );
}

const markdown = readNewsletterArticle(articleId);
const message = await buildTestEmail({
  articleId,
  markdown,
  recipient,
  env: process.env,
});

const result = await new SESv2Client({ region: process.env.AWS_REGION }).send(
  new SendEmailCommand(message),
);

console.log(
  `Test email accepted by SES for ${message.Destination!.ToAddresses![0]}; message id: ${result.MessageId ?? 'unavailable'}`,
);
