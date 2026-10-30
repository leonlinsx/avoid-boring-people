import { parseFrontmatter } from '@astrojs/markdown-remark';
import { SITE_URL } from '../../consts.ts';
import { computeCleanSlug } from '../../utils/slug-helpers.ts';
import {
  articleIsDraft,
  assertPublishedArticle,
} from '../../utils/publication.ts';

export type NewsletterPresentation = {
  postalAddress?: string;
  preheader: boolean;
};

export function newsletterPresentation(
  env: NodeJS.ProcessEnv,
  postalRequired = false,
): NewsletterPresentation {
  const postalAddress = env.NEWSLETTER_POSTAL_ADDRESS?.trim();
  if (postalRequired && !postalAddress)
    throw new Error(
      "NEWSLETTER_POSTAL_ADDRESS must contain the operator's valid mailing address. No email was sent.",
    );
  if (
    postalAddress &&
    (postalAddress.length < 10 ||
      postalAddress.length > 500 ||
      /\p{Cc}/u.test(postalAddress.replace(/[\r\n\t]/g, '')) ||
      /^(?:https?:|[^\s]+@)|(?:your (?:postal|mailing) address|changeme|replace me|^tbd$)/i.test(
        postalAddress,
      ))
  )
    throw new Error(
      'NEWSLETTER_POSTAL_ADDRESS must be a complete mailing address, not a URL, email or placeholder. No email was sent.',
    );
  // Deliverability/validity of a physical address must be confirmed by its owner.
  return {
    postalAddress: postalAddress || undefined,
    preheader: env.NEWSLETTER_PREHEADER_ENABLED !== 'false',
  };
}

export function newsletterArticleUrl(
  articleId: string,
  markdown: string,
): string | undefined {
  if (articleIsDraft(markdown)) return undefined;
  const data = parseFrontmatter(markdown).frontmatter;
  const slug = computeCleanSlug({
    id: articleId,
    data: { slug: typeof data.slug === 'string' ? data.slug : undefined },
  });
  return new URL(`/writing/${slug}`, SITE_URL).toString();
}

export function newsletterPreheader(markdown: string): string | undefined {
  const description = parseFrontmatter(markdown).frontmatter.description;
  if (typeof description !== 'string') return undefined;
  const text = description.replace(/\s+/g, ' ').trim();
  return text
    ? text.length > 160
      ? text.slice(0, 159).trimEnd() + '…'
      : text
    : undefined;
}

/** GET-only: verify the actual canonical article, rejecting redirects/login/fallback pages. */
export async function assertPublishedNewsletterPage(
  articleId: string,
  markdown: string,
  request: typeof fetch = fetch,
): Promise<string> {
  assertPublishedArticle(markdown);
  const url = newsletterArticleUrl(articleId, markdown)!;
  try {
    const response = await request(url, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'text/html' },
    });
    if (
      response.status !== 200 ||
      !response.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('text/html') ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new Error('Article page is unavailable.');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes > 2 * 1024 * 1024)
          throw new Error('Article page exceeds preflight limit.');
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    const html = Buffer.concat(chunks).toString('utf8');
    const canonical = [...html.matchAll(/<link\b[^>]*>/gi)]
      .find(([tag]) => /\brel=["']canonical["']/i.test(tag))?.[0]
      .match(/\bhref=(["'])(.*?)\1/i)?.[2];
    if (
      !canonical ||
      new URL(canonical.replaceAll('&amp;', '&'), url)
        .toString()
        .replace(/\/$/, '') !== url.replace(/\/$/, '')
    )
      throw new Error('Article canonical URL does not match.');
  } catch {
    throw new Error(
      `Published article preflight failed: ${new URL(url).origin}${new URL(url).pathname}. No email was sent.`,
    );
  }
  return url;
}
