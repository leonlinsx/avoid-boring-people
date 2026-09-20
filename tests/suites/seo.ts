// Coverage for JSON-LD, sitemaps, legacy redirects, robots, and 404 metadata.

import assert from 'node:assert/strict';
import { SITE_URL, SITE_AUTHOR_SAME_AS } from '../../src/consts.ts';
import { normalizePathname } from '../../src/utils/slug-helpers.ts';

import {
  hasUntrustedPathOverride,
  requiresOriginRejection,
} from '../../src/lib/newsletter/request-origin.ts';
import { serializeJsonLd } from '../../src/utils/jsonld.ts';
import { canonicalSiteOrigin } from '../../src/lib/site-origin.ts';
import {
  BLOG_CONTENT_DIR,
  LEGACY_ARTICLE_ALIASES,
  STATIC_LASTMOD,
  buildBlogLastmodMap,
  buildLegacyArticleRedirects,
  readArticleRoutes,
  resolveLastmod,
  serializeSitemapItem,
} from '../../src/utils/article-routes.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../helpers/harness.ts';

export function testJsonLdSerialization() {
  const payload = '</script><script>alert(1)</script>';
  const serialized = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: payload,
    datePublished: new Date('2026-01-01T00:00:00.000Z'),
    nested: { description: `Tail --> ${payload}` },
  });

  assert.ok(
    !serialized.includes('<'),
    'serialized JSON-LD must not contain a raw <',
  );
  assert.ok(
    !/<!--/.test(serialized),
    'serialized JSON-LD must not open an HTML comment',
  );
  assert.ok(
    serialized.includes('\\u003c/script>'),
    'the closing script tag must be escaped into data',
  );

  const parsed = JSON.parse(serialized);
  assert.equal(parsed.headline, payload);
  assert.equal(parsed.nested.description, `Tail --> ${payload}`);
  assert.equal(parsed.datePublished, '2026-01-01T00:00:00.000Z');

  // Embedded in the element the components emit, the payload cannot close it.
  const html = `<script type="application/ld+json">${serialized}</script>`;
  assert.equal(
    html.split('</script>').length,
    2,
    'only the tag the template wrote may close the script element',
  );
  assert.equal(
    JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>')))
      .headline,
    payload,
  );

  assert.equal(serializeJsonLd(undefined), 'null');
  assert.equal(serializeJsonLd({ ratio: Number.NaN, ok: true }), '{"ok":true}');
}

export function testOriginTrust() {
  const form = { 'content-type': 'application/x-www-form-urlencoded' };
  const post = (url: string, headers: Record<string, string>) =>
    new Request(url, { method: 'POST', headers: { ...form, ...headers } });

  // The configured canonical origin is trusted, whatever URL the request arrived on.
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://leonlins.com',
      }),
      false,
    ),
    false,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://internal-deployment.vercel.app/api/subscribe', {
        origin: 'https://leonlins.com',
      }),
      false,
    ),
    false,
  );

  // Foreign or absent origins are still rejected.
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://evil.example',
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {}),
      false,
    ),
    true,
  );

  // A caller that controls the forwarded headers makes the request URL look like
  // its own origin; the trusted origin must not move with it.
  assert.equal(
    requiresOriginRejection(
      post('https://evil.example/api/subscribe', {
        origin: 'https://evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://evil.example',
        'x-forwarded-host': 'leonlins.com',
        'x-forwarded-proto': 'https',
      }),
      false,
    ),
    true,
  );
  assert.equal(
    requiresOriginRejection(
      post('https://leonlins.com/api/subscribe', {
        origin: 'https://leonlins.com',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'http',
      }),
      false,
    ),
    false,
  );

  // Machine callers keep their exemptions.
  assert.equal(
    requiresOriginRejection(
      new Request('https://evil.example/api/newsletter/ses-events', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          origin: 'https://evil.example',
        },
      }),
      false,
    ),
    false,
  );

  // The trusted origin is the canonical site origin from `src/consts.ts`, so a
  // deployment URL, a `Host` header, or a forwarded header cannot move it.
  assert.equal(canonicalSiteOrigin(), 'https://leonlins.com');
  assert.equal(canonicalSiteOrigin(), new URL(SITE_URL).origin);
  process.env.SITE_URL = 'https://preview.example/';
  try {
    assert.equal(canonicalSiteOrigin(), 'https://leonlins.com');
    assert.equal(
      requiresOriginRejection(
        post('https://preview.example/api/subscribe', {
          origin: 'https://preview.example',
        }),
        false,
      ),
      true,
    );
    assert.equal(
      requiresOriginRejection(
        post('https://leonlins.com/api/subscribe', {
          origin: 'https://preview.example',
        }),
        false,
      ),
      true,
    );
  } finally {
    delete process.env.SITE_URL;
  }
}

export function testPathOverrideGuard() {
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/_image?href=/a.png&f=png'),
    ),
    false,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/api/newsletter/unsubscribe?token=x'),
    ),
    false,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request(
        'https://leonlins.com/_image?x_astro_path=/api/newsletter/unsubscribe',
      ),
    ),
    true,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/anything', {
        headers: { 'x-astro-path': '/api/social/instagram-media' },
      }),
    ),
    true,
  );
  assert.equal(
    hasUntrustedPathOverride(
      new Request('https://leonlins.com/anything', {
        headers: { 'x-astro-path': '' },
      }),
    ),
    true,
  );
}
export const ROBOTS_PATH = path.join(REPO_ROOT, 'public/robots.txt');

export function testArticleSitemapLastmod() {
  const lastmod = buildBlogLastmodMap();
  const routes = readArticleRoutes();

  assert.ok(
    routes.length > 50,
    `expected the whole blog corpus, read ${routes.length} articles`,
  );
  assert.ok(
    Object.keys(lastmod).length > 50,
    `expected the whole blog corpus, mapped ${Object.keys(lastmod).length} dates`,
  );

  // The bug this guards: map keys were built as `/writing/<slug>/` while the
  // sitemap looked up `/writing/<slug>`, so every article silently fell back to
  // STATIC_LASTMOD. Keys must be normalized, and every article must be found.
  for (const key of Object.keys(lastmod)) {
    assert.equal(key, normalizePathname(key), `un-normalized key: ${key}`);
    assert.equal(key.includes('//'), false, `malformed key: ${key}`);
  }
  for (const route of routes) {
    assert.notEqual(
      resolveLastmod(route.pathname, lastmod),
      STATIC_LASTMOD,
      `${route.pathname} must not fall back to the static lastmod`,
    );
    assert.equal(
      resolveLastmod(route.pathname, lastmod),
      route.lastmod,
      `${route.pathname} must use the article's own date`,
    );
    // A trailing slash must resolve to the same date, not to the fallback.
    assert.equal(resolveLastmod(`${route.pathname}/`, lastmod), route.lastmod);
  }

  assert.equal(
    resolveLastmod('/writing/ergodicity', lastmod),
    '2021-04-03T00:00:00.000Z',
  );
  assert.equal(
    resolveLastmod('/writing/ergodicity/', lastmod),
    '2021-04-03T00:00:00.000Z',
  );

  // Non-article pages keep the stable static fallback.
  for (const staticPath of ['/', '/about/', '/about', '/writing/search/']) {
    assert.equal(resolveLastmod(staticPath, lastmod), STATIC_LASTMOD);
  }
}

export function testSitemapSerializationUsesArticleDates() {
  const lastmod = buildBlogLastmodMap();

  const article = serializeSitemapItem(
    { url: 'https://leonlins.com/writing/ergodicity/' },
    lastmod,
  );
  assert.equal(article.url, 'https://leonlins.com/writing/ergodicity');
  assert.equal(article.lastmod, '2021-04-03T00:00:00.000Z');

  const slashless = serializeSitemapItem(
    { url: 'https://leonlins.com/writing/ergodicity' },
    lastmod,
  );
  assert.equal(slashless.lastmod, '2021-04-03T00:00:00.000Z');

  const staticPage = serializeSitemapItem(
    { url: 'https://leonlins.com/about/' },
    lastmod,
  );
  assert.equal(staticPage.url, 'https://leonlins.com/about');
  assert.equal(staticPage.lastmod, STATIC_LASTMOD);

  const root = serializeSitemapItem({ url: 'https://leonlins.com/' }, lastmod);
  assert.equal(root.url, 'https://leonlins.com/');
  assert.equal(root.lastmod, STATIC_LASTMOD);

  // Unrelated item fields survive serialization.
  const extended = serializeSitemapItem(
    { url: 'https://leonlins.com/writing/kelly/', changefreq: 'weekly' },
    lastmod,
  );
  assert.equal(extended.changefreq, 'weekly');
}

export function testArticleLastmodPrefersUpdatedDate() {
  const blogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-routes-'));

  const writeArticle = (entry: string, frontmatter: string) => {
    fs.mkdirSync(path.join(blogDir, entry));
    fs.writeFileSync(
      path.join(blogDir, entry, 'index.md'),
      `---\n${frontmatter}\n---\nBody text.\n`,
      'utf-8',
    );
  };

  try {
    writeArticle(
      '2024_01_05_both_dates',
      "title: 'Both'\npubDate: 2024-01-05\nupdatedDate: 2024-06-01",
    );
    writeArticle(
      '2024_02_06_slug_override',
      "title: 'Slug'\npubDate: 2024-02-06\nslug: 'custom-slug'",
    );
    writeArticle('2023_03_07_no_date', "title: 'No date'");

    assert.deepEqual(buildBlogLastmodMap(blogDir), {
      '/writing/both_dates': '2024-06-01T00:00:00.000Z',
      '/writing/custom-slug': '2024-02-06T00:00:00.000Z',
    });
  } finally {
    fs.rmSync(blogDir, { recursive: true, force: true });
  }
}

export function testLegacyArticleRedirects() {
  const redirects = buildLegacyArticleRedirects();
  const lastmod = buildBlogLastmodMap();

  const assertRedirect = (legacyPath: string, canonicalPath: string) => {
    assert.deepEqual(
      redirects[legacyPath],
      { destination: canonicalPath, status: 308 },
      `${legacyPath} must permanently redirect to ${canonicalPath}`,
    );
  };

  assertRedirect('/writing/2020_12_02_kelly', '/writing/kelly');
  assertRedirect('/writing/2021_04_03_ergodicity', '/writing/ergodicity');
  assertRedirect('/writing/2019_03_24_time', '/writing/time_illusion');
  assertRedirect('/writing/2020_11_04_ib', '/writing/ib_value');
  assertRedirect('/writing/2020_11_11_capital', '/writing/company_value');

  const legacyRouteCount = readArticleRoutes().filter(
    (route) => route.legacyPathname,
  ).length;
  assert.equal(
    Object.keys(redirects).length,
    legacyRouteCount + Object.keys(LEGACY_ARTICLE_ALIASES).length,
    'every legacy path should be listed exactly once',
  );

  for (const key of Object.keys(redirects)) {
    const redirect = redirects[key];
    assert.equal(redirect.status, 308);
    assert.equal(
      key,
      normalizePathname(key),
      'a trailing slash in a redirect key is dropped by Astro and collides with the slashless key',
    );
    assert.notEqual(normalizePathname(key), redirect.destination);
    // Destinations must be real article routes, not another redirect stub.
    assert.ok(
      lastmod[redirect.destination],
      `${redirect.destination} must resolve to a built article`,
    );
  }
}

/**
 * The legacy redirect keys can only match slashless requests, so the deployed
 * router has to normalize the trailing-slash form onto them for the old
 * inbound URLs (which were almost always linked with a trailing slash) to work.
 */
export async function testLegacyRedirectsReachTrailingSlashRequests() {
  const { default: config } = await import('../../astro.config.mjs');

  assert.equal(
    (config as { trailingSlash?: string }).trailingSlash,
    'never',
    'trailing slash normalization is what makes /writing/2020_12_02_kelly/ reach the redirect',
  );

  const redirects = (config as { redirects: Record<string, unknown> })
    .redirects;
  assert.deepEqual(redirects['/writing/2020_12_02_kelly'], {
    destination: '/writing/kelly',
    status: 308,
  });
  assert.equal(
    redirects['/writing/2020_12_02_kelly/'],
    undefined,
    'slash variants must not be added: Astro reports them as route collisions',
  );
}

export function testContentHasNoLegacyArticleLinks() {
  const legacyPattern =
    /(?:leonlins\.com)?\/writing\/\d{4}_\d{2}_\d{2}_[A-Za-z0-9_.-]+/;
  const knownSlugs = new Set(readArticleRoutes().map((route) => route.slug));
  const ignoredSegments = new Set(['category']);
  const brokenLinks: string[] = [];
  const legacyLinks: string[] = [];

  for (const entry of fs.readdirSync(BLOG_CONTENT_DIR)) {
    const articlePath = path.join(BLOG_CONTENT_DIR, entry, 'index.md');
    if (!fs.existsSync(articlePath)) continue;
    const content = fs.readFileSync(articlePath, 'utf-8');

    if (legacyPattern.test(content)) {
      legacyLinks.push(entry);
    }

    for (const match of content.matchAll(/\]\((\/writing\/[^)\s'"]*)/g)) {
      const slug = normalizePathname(match[1]).replace('/writing/', '');
      const [segment] = slug.split('/');
      if (ignoredSegments.has(segment) || /^\d+$/.test(segment)) continue;
      if (!knownSlugs.has(slug)) {
        brokenLinks.push(`${entry}: ${match[1]}`);
      }
    }
  }

  assert.deepEqual(
    legacyLinks,
    [],
    'date-prefixed article links must be repaired to canonical URLs',
  );
  assert.deepEqual(
    brokenLinks,
    [],
    'internal article links must point at routes that are actually built',
  );
}

export function testAuthorIdentityGraph() {
  const threads = 'https://www.threads.net/@leon.lin.s';

  assert.equal(
    SITE_AUTHOR_SAME_AS.filter((url) => url === threads).length,
    1,
    'Threads must appear exactly once in the Person sameAs graph',
  );
  assert.equal(
    SITE_AUTHOR_SAME_AS.length,
    new Set(SITE_AUTHOR_SAME_AS).size,
    'sameAs entries must be unique',
  );
  assert.deepEqual(SITE_AUTHOR_SAME_AS, [
    'https://twitter.com/leonlinsx',
    'https://github.com/leonlinsx',
    'https://avoidboringpeople.substack.com',
    threads,
  ]);
  assert.equal(
    SITE_AUTHOR_SAME_AS.some((url) => url.toLowerCase().includes('linkedin')),
    false,
    'LinkedIn is intentionally not part of the identity graph',
  );
}

/** One rule group per user agent; consecutive user-agent lines share a group. */
export function parseRobotsGroups(text: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  let agents: string[] = [];
  let lastLineWasUserAgent = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!value) continue;

    if (directive === 'user-agent') {
      if (!lastLineWasUserAgent) agents = [];
      lastLineWasUserAgent = true;
      agents.push(value);
      for (const agent of agents) {
        if (!groups.has(agent)) groups.set(agent, []);
      }
      continue;
    }

    if (directive === 'sitemap') continue;
    lastLineWasUserAgent = false;
    for (const agent of agents) {
      groups.get(agent)?.push(`${directive} ${value}`);
    }
  }

  return groups;
}

export function testRobotsCrawlerPolicy() {
  const groups = parseRobotsGroups(fs.readFileSync(ROBOTS_PATH, 'utf-8'));
  const allowedAgents = [
    'OAI-SearchBot',
    'PerplexityBot',
    'Claude-SearchBot',
    'Claude-User',
  ];
  const blockedAgents = ['GPTBot', 'Google-Extended', 'ClaudeBot'];

  for (const agent of allowedAgents) {
    const rules = groups.get(agent);
    assert.ok(rules, `${agent} must have a rule group`);
    assert.ok(
      rules.includes('allow /'),
      `${agent} performs search/retrieval and must be allowed`,
    );
    assert.equal(
      rules.includes('disallow /'),
      false,
      `${agent} must not be blocked`,
    );
  }

  for (const agent of blockedAgents) {
    const rules = groups.get(agent);
    assert.ok(rules, `${agent} must have a rule group`);
    assert.ok(
      rules.includes('disallow /'),
      `${agent} trains models and must be blocked site-wide`,
    );
    assert.equal(
      rules.includes('allow /'),
      false,
      `${agent} must not be allowed back in`,
    );
  }

  const wildcard = groups.get('*');
  assert.ok(wildcard, 'a default rule group is needed');
  assert.ok(wildcard.includes('allow /'), 'ordinary crawlers stay allowed');
  for (const privatePath of ['/api/', '/admin/', '/private/']) {
    assert.ok(
      wildcard.includes(`disallow ${privatePath}`),
      `${privatePath} must stay excluded`,
    );
  }

  for (const searchEngine of ['Googlebot', 'Bingbot']) {
    assert.ok(groups.get(searchEngine)?.includes('allow /'));
  }

  const robots = fs.readFileSync(ROBOTS_PATH, 'utf-8');
  assert.match(
    robots,
    /^Sitemap: https:\/\/leonlins\.com\/sitemap-index\.xml$/m,
  );
}

/**
 * The 404 handler used to inherit an auto-derived canonical URL, so 404.html
 * advertised `https://leonlins.com/404` (og:url and twitter:url too) on a page
 * that is served for arbitrary unknown paths: the advertised URL itself 404s.
 */
export function testNotFoundPageHasNoCanonical() {
  const page = fs.readFileSync(
    path.join(REPO_ROOT, 'src/pages/404.astro'),
    'utf-8',
  );
  assert.match(page, /noindex=\{true\}/, 'the 404 page must not be indexed');
  assert.match(
    page,
    /canonical=\{null\}/,
    'the 404 page has no canonical URL to advertise',
  );

  const head = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/BaseHead.astro'),
    'utf-8',
  );
  for (const tag of [
    '<link rel="canonical"',
    '<meta property="og:url"',
    '<meta name="twitter:url"',
  ]) {
    const line = head.split('\n').find((candidate) => candidate.includes(tag));
    assert.ok(line, `${tag} should still be emitted for normal pages`);
    assert.match(
      line,
      /canonicalURL &&/,
      `${tag} must be omitted when a page has no canonical URL`,
    );
  }
}

export async function runSeoMetaTests() {
  await testJsonLdSerialization();
  await testOriginTrust();
  await testPathOverrideGuard();
  await testArticleSitemapLastmod();
  await testSitemapSerializationUsesArticleDates();
  await testArticleLastmodPrefersUpdatedDate();
  await testLegacyArticleRedirects();
  await testLegacyRedirectsReachTrailingSlashRequests();
  await testContentHasNoLegacyArticleLinks();
  await testAuthorIdentityGraph();
  await testRobotsCrawlerPolicy();
  await testNotFoundPageHasNoCanonical();
}
