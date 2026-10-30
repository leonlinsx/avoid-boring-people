import {
  readNewsletterArticle,
  renderNewsletterEmail,
} from '../../src/lib/newsletter/render.ts';
import { assertPublishedArticle } from '../../src/utils/publication.ts';
import {
  newsletterTitle,
  CAMPAIGN_UNSUBSCRIBE_PLACEHOLDER,
} from '../../src/lib/newsletter/campaign.ts';
import { NEWSLETTER_PRIVACY_URL } from '../../src/lib/newsletter/email.ts';
import { assertPublicNewsletterImages } from '../../src/lib/newsletter/public-images.ts';
const [articleId, ...extra] = process.argv.slice(2);
if (!articleId || extra.length)
  throw new Error('Usage: npm run newsletter:images:check -- <article-id>');
const markdown = readNewsletterArticle(articleId);
assertPublishedArticle(markdown);
const rendered = renderNewsletterEmail({
  articleId,
  markdown,
  title: newsletterTitle(markdown),
  privacyUrl: NEWSLETTER_PRIVACY_URL,
  unsubscribeUrl: CAMPAIGN_UNSUBSCRIBE_PLACEHOLDER,
});
const count = await assertPublicNewsletterImages(rendered.html);
console.log(
  `Verified ${count} public newsletter image URLs. No database access or email.`,
);
