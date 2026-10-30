import { newsletterPresentation } from '../../src/lib/newsletter/presentation.ts';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNewsletterArticle } from '../../src/lib/newsletter/render.ts';
import { newsletterTitle } from '../../src/lib/newsletter/campaign.ts';
import { NEWSLETTER_PRIVACY_URL } from '../../src/lib/newsletter/email.ts';
import {
  renderPrivateNewsletter,
  embeddedPreviewHtml,
  TEST_UNSUBSCRIBE_URL,
} from '../../src/lib/newsletter/private-preview.ts';

const [articleId, output = '/tmp/abp-newsletter-preview.html', ...extra] =
  process.argv.slice(2);
if (!articleId || extra.length)
  throw new Error(
    'Usage: npm run newsletter:preview:local -- <article-id> [output-file]',
  );
const markdown = readNewsletterArticle(articleId);
const rendered = await renderPrivateNewsletter({
  ...newsletterPresentation(process.env),
  articleId,
  markdown,
  title: newsletterTitle(markdown),
  privacyUrl: NEWSLETTER_PRIVACY_URL,
  unsubscribeUrl: TEST_UNSUBSCRIBE_URL,
});
const destination = resolve(output);
writeFileSync(destination, embeddedPreviewHtml(rendered), {
  encoding: 'utf8',
  mode: 0o600,
});
console.log(`Open locally in your browser: ${destination}`);
console.log(
  'Local images embedded. No database, deployment or email. This is not a production content approval.',
);
