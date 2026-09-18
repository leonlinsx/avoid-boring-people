import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCleanSlug, normalizePathname } from './slug-helpers';

/** Content directory that owns the canonical article routes. */
export const BLOG_CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../content/blog',
);

/** Stable lastmod for pages that are not articles (site launch / last major update). */
export const STATIC_LASTMOD = '2025-01-01T00:00:00.000Z';

const frontmatterValue = (content: string, key: string): string | undefined => {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  return raw.replace(/^['"]|['"]$/g, '').trim();
};

export interface ArticleRoute {
  /** Content directory name, e.g. `2020_12_02_kelly`. */
  entry: string;
  /** Canonical slug, e.g. `kelly`. */
  slug: string;
  /** Canonical pathname, e.g. `/writing/kelly`. */
  pathname: string;
  /** Legacy date-prefixed pathname, e.g. `/writing/2020_12_02_kelly`. */
  legacyPathname?: string;
  /** Sitemap lastmod: `updatedDate` when set, otherwise `pubDate`. */
  lastmod?: string;
}

/**
 * Imported articles that linked date-prefixed slugs which do not match a
 * content directory name, so they cannot be derived from the corpus. Each key
 * was an actual link in the published corpus (see the git history of
 * src/content/blog); do not add speculative keys.
 */
export const LEGACY_ARTICLE_ALIASES: Record<string, string> = {
  '2019_03_24_time': 'time_illusion',
  '2020_11_04_ib': 'ib_value',
  '2020_11_11_capital': 'company_value',
};

/** Canonical routes for every article in the content corpus. */
export function readArticleRoutes(
  blogDir: string = BLOG_CONTENT_DIR,
): ArticleRoute[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(blogDir);
  } catch {
    return [];
  }

  const routes: ArticleRoute[] = [];
  for (const entry of entries) {
    const mdPath = path.join(blogDir, entry, 'index.md');
    if (!fs.existsSync(mdPath)) continue;

    const content = fs.readFileSync(mdPath, 'utf-8');
    const slug = computeCleanSlug({
      id: `${entry}/index.md`,
      data: { slug: frontmatterValue(content, 'slug') },
    });
    const dateStr =
      frontmatterValue(content, 'updatedDate') ??
      frontmatterValue(content, 'pubDate');

    routes.push({
      entry,
      slug,
      pathname: normalizePathname(`/writing/${slug}`),
      legacyPathname:
        entry === slug ? undefined : normalizePathname(`/writing/${entry}`),
      lastmod: dateStr ? new Date(dateStr).toISOString() : undefined,
    });
  }

  return routes;
}

/** Map of canonical article pathname → ISO lastmod. */
export function buildBlogLastmodMap(
  blogDir: string = BLOG_CONTENT_DIR,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const route of readArticleRoutes(blogDir)) {
    if (route.lastmod) {
      map[route.pathname] = route.lastmod;
    }
  }
  return map;
}

/** Lastmod for a sitemap entry, falling back for genuinely static pages. */
export function resolveLastmod(
  pathname: string,
  lastmodMap: Record<string, string>,
): string {
  return lastmodMap[normalizePathname(pathname)] ?? STATIC_LASTMOD;
}

export interface SitemapItem {
  url: string;
  [key: string]: unknown;
}

/**
 * Sitemap serializer: drop the trailing slash from the URL (existing site-wide
 * convention) and attach the lastmod for that same normalized pathname, so the
 * article lookup can never fall back because the two sides disagree.
 */
export function serializeSitemapItem<T extends SitemapItem>(
  item: T,
  lastmodMap: Record<string, string>,
): T & { lastmod: string } {
  const url = new URL(item.url);
  const pathname = normalizePathname(url.pathname);
  url.pathname = pathname;
  return {
    ...item,
    url: url.toString(),
    lastmod: resolveLastmod(pathname, lastmodMap),
  };
}

/**
 * Permanent redirects from legacy date-prefixed article paths to the canonical
 * clean paths, derived from the content directory names. Only the slashless key
 * is listed: Astro drops trailing slashes from redirect keys (so a `/path/` key
 * produces the same route as `/path`) and reports the duplicate as a route
 * collision. `trailingSlash: 'never'` in astro.config.mjs normalizes
 * `/writing/2020_12_02_kelly/` onto the slashless key.
 */
export function buildLegacyArticleRedirects(
  blogDir: string = BLOG_CONTENT_DIR,
): Record<string, { destination: string; status: 308 }> {
  const redirects: Record<string, { destination: string; status: 308 }> = {};
  const legacyPathnames = new Map<string, string>();

  for (const route of readArticleRoutes(blogDir)) {
    if (route.legacyPathname) {
      legacyPathnames.set(route.legacyPathname, route.pathname);
    }
  }
  for (const [legacySlug, canonicalSlug] of Object.entries(
    LEGACY_ARTICLE_ALIASES,
  )) {
    legacyPathnames.set(
      normalizePathname(`/writing/${legacySlug}`),
      normalizePathname(`/writing/${canonicalSlug}`),
    );
  }

  for (const [legacyPathname, destination] of [...legacyPathnames].sort()) {
    redirects[legacyPathname] = { destination, status: 308 };
  }

  return redirects;
}
