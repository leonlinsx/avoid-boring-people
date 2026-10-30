import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { readNewsletterArticle } from '../../src/lib/newsletter/render.ts';
import { buildTestEmail } from '../../src/lib/newsletter/test-message.ts';

const [articleId, recipient, ...flags] = process.argv.slice(2);
if (
  !articleId ||
  !recipient ||
  !flags.includes('--confirm-test') ||
  new Set(flags).size !== flags.length ||
  flags.some((flag) => !['--confirm-test', '--hosted'].includes(flag))
) {
  throw new Error(
    'Usage: npm run newsletter:test -- <article-id> <allowlisted-recipient> [--hosted] --confirm-test',
  );
}

const markdown = readNewsletterArticle(articleId);
const message = await buildTestEmail({
  articleId,
  markdown,
  recipient,
  env: process.env,
  hosted: flags.includes('--hosted'),
});

const result = await new SESv2Client({ region: process.env.AWS_REGION }).send(
  new SendEmailCommand(message),
);

console.log(
  `Test email accepted by SES for ${message.Destination!.ToAddresses![0]}; message id: ${result.MessageId ?? 'unavailable'}`,
);
