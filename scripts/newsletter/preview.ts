import { newsletterPresentation } from '../../src/lib/newsletter/presentation.ts';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  readNewsletterArticle,
  renderNewsletterEmail,
} from '../../src/lib/newsletter/render.ts';
import {
  campaignContentHash,
  newsletterTitle,
} from '../../src/lib/newsletter/campaign.ts';
import { NEWSLETTER_PRIVACY_URL } from '../../src/lib/newsletter/email.ts';

const [articleId, output = 'newsletter-preview.html'] = process.argv.slice(2);
if (!articleId) {
  throw new Error(
    'Usage: npm run newsletter:preview -- <article-id> [output-file]',
  );
}

const markdown = readNewsletterArticle(articleId);
const title = newsletterTitle(markdown);
const privacyUrl = process.env.NEWSLETTER_PRIVACY_URL ?? NEWSLETTER_PRIVACY_URL;
const unsubscribeUrl = process.env.NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL;
if (!title || !unsubscribeUrl) {
  throw new Error(
    'Preview requires an article title and NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL.',
  );
}

const presentation = newsletterPresentation(process.env);
const contentHash = campaignContentHash(
  articleId,
  title,
  markdown,
  privacyUrl,
  presentation,
);
const rendered = renderNewsletterEmail({
  ...presentation,
  articleId,
  title,
  markdown,
  privacyUrl,
  unsubscribeUrl,
});
const destination = resolve(output);
writeFileSync(destination, rendered.html, 'utf8');
console.log(`Newsletter preview written to ${destination}`);

console.log(`Approved content SHA-256: ${contentHash}`);
