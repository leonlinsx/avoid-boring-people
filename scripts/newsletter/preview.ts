import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNewsletterArticle, renderNewsletterEmail } from '../../src/lib/newsletter/render.ts';

function frontmatterValue(markdown: string, key: string): string | null {
  const match = markdown.match(new RegExp(`^${key}:\\s*['\"]?(.+?)['\"]?\\s*$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

const [articleId, output = 'newsletter-preview.html'] = process.argv.slice(2);
if (!articleId) {
  throw new Error('Usage: npm run newsletter:preview -- <article-id> [output-file]');
}

const markdown = readNewsletterArticle(articleId);
const title = frontmatterValue(markdown, 'title');
const postalAddress = process.env.NEWSLETTER_POSTAL_ADDRESS;
const privacyUrl = process.env.NEWSLETTER_PRIVACY_URL;
const unsubscribeUrl = process.env.NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL;
if (!title || !postalAddress || !privacyUrl || !unsubscribeUrl) {
  throw new Error('Preview requires article title plus NEWSLETTER_POSTAL_ADDRESS, NEWSLETTER_PRIVACY_URL, and NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL.');
}

const rendered = renderNewsletterEmail({ articleId, title, markdown, postalAddress, privacyUrl, unsubscribeUrl });
const destination = resolve(output);
writeFileSync(destination, rendered.html, 'utf8');
console.log(`Newsletter preview written to ${destination}`);
