import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from '../helpers/harness.ts';

const read = (path: string) => readFileSync(path, 'utf8');

function testTagDestinationsAndPresentation() {
  const tags = read('src/components/TagList.astro');

  assert.match(tags, /<ul class="tag-list">/);
  assert.match(tags, /<li>/);
  assert.match(tags, /href={`\/tags\/\${tag\.toLowerCase\(\)}`}/);
  assert.doesNotMatch(tags, /href=["']\/tags["']/);
  assert.match(tags, /li:not\(:last-child\)::after/);
  assert.doesNotMatch(tags, /radius-pill|box-shadow/);
}

function testShareMenuAccessibilityAndBehavior() {
  const share = read('src/components/ShareButtons.astro');

  assert.match(share, /aria-haspopup="menu"/);
  assert.match(share, /aria-expanded="false"/);
  assert.match(share, /role="menu"/);
  const menuItems = share.match(/<(?:a|button)\b[^>]*role="menuitem"/g) ?? [];
  assert.equal(menuItems.length, 5);
  for (const label of [
    'Copy link',
    'Threads',
    'X/Twitter',
    'LinkedIn',
    'Email',
  ]) {
    assert.match(share, new RegExp(`>${label}<`));
  }
  assert.match(share, /navigator\.share\(/);
  assert.match(share, /navigator\.clipboard\.writeText\(shareURL\)/);
  assert.match(share, /event\.key === 'Escape'/);
  assert.match(share, /!control\.contains\(event\.target\)/);
  assert.match(share, /event\.key === 'ArrowDown'/);
  assert.match(share, /gtag\('event', 'share'/);
  assert.match(share, /event_label: platform/);
}

function testNewsletterDefaultsAndPreservedSubmission() {
  const subscribe = read('src/components/SubscribeForm.astro');

  assert.match(subscribe, /title = compact \? '' : 'Get the next essay'/);
  assert.match(subscribe, /subtext = ''/);
  assert.match(subscribe, /action="\/api\/newsletter\/subscribe"/);
  assert.match(subscribe, /data-newsletter-form/);
  assert.match(subscribe, /name="source"/);
  assert.match(subscribe, /compact \? 'blog-inline' : 'blog-footer'/);
  assert.match(subscribe, /initializeNewsletterForms\(\)/);
}

function testUnifiedFooterOrder() {
  const layout = read('src/layouts/BlogPost.astro');
  // Signup must be between body and footnotes for conversion, before tags/share.
  const bodyHtml = layout.indexOf('set:html={bodyHtml}');
  const subscribe = layout.indexOf('<SubscribeForm');
  const footnotes = layout.indexOf('set:html={footnotesHtml}');
  const footer = layout.indexOf('<footer class="article-footer">');
  const tags = layout.indexOf('<TagList', footer);
  const share = layout.indexOf('<ShareButtons', footer);
  const discussion = layout.indexOf('<Discussion', footer);

  assert.ok(bodyHtml >= 0, 'bodyHtml slot must exist');
  assert.ok(subscribe > bodyHtml, 'SubscribeForm must be after article body');
  assert.ok(
    footnotes === -1 || subscribe < footnotes,
    'SubscribeForm must be before footnotes when footnotes exist',
  );
  assert.ok(footer > subscribe, 'footer (tags/share) must be after signup');
  assert.ok(tags > footer && share > tags, 'tags/share must be inside footer');
  assert.ok(
    subscribe < footer,
    'SubscribeForm must not be inside footer (single instance before footnotes)',
  );
  assert.ok(
    discussion > footer,
    'Discussion must remain after the article footer',
  );
  // Ensure only one SubscribeForm per article (no duplicate in Markdown or footer)
  const subscribeCount = (layout.match(/<SubscribeForm/g) ?? []).length;
  assert.equal(
    subscribeCount,
    1,
    'exactly one SubscribeForm must be rendered per article',
  );
  assert.ok(
    layout.includes('FOOTNOTE_MARKER') &&
      layout.includes('<section data-footnotes'),
    'footnote split must use build-time slot HTML, not client DOM manipulation',
  );
  assert.equal(
    (layout.match(/Astro\.slots\.render/g) ?? []).length,
    1,
    'slot must be rendered once and split at build time',
  );
}

function testHeaderHierarchy() {
  const layout = read('src/layouts/BlogPost.astro');
  const breadcrumbs = layout.indexOf('<Breadcrumbs');
  const title = layout.indexOf('<h1>{title}</h1>');
  const meta = layout.indexOf('<div class="meta">');
  const hero = layout.indexOf('<div class="hero-image">');
  const toc = layout.indexOf('<TableOfContents');
  const body = layout.indexOf('set:html={bodyHtml}');

  assert.ok(
    breadcrumbs >= 0 && title > breadcrumbs,
    'breadcrumbs must be first',
  );
  assert.ok(
    meta > title,
    'meta must be after H1 (title first, then date·category·reading time)',
  );
  assert.ok(hero > meta, 'hero must be after title block');
  assert.ok(toc > hero, 'TOC must be after hero');
  assert.ok(body > toc, 'body must be after TOC');
  // Single H1 check
  const h1Count = (layout.match(/<h1>/g) ?? []).length;
  assert.equal(
    h1Count,
    1,
    'exactly one H1 must exist (no duplicate in breadcrumbs)',
  );
}

function testBreadcrumbVisibility() {
  const layout = read('src/layouts/BlogPost.astro');
  const breadcrumbs = read('src/components/Breadcrumbs.astro');

  // Visible breadcrumbs must omit title; structured data must include it.
  assert.ok(
    layout.includes('visibleBreadcrumbItems'),
    'visible breadcrumbs must be separate from JSON-LD',
  );
  assert.ok(
    layout.includes('breadcrumbJsonLdItems'),
    'JSON-LD must preserve full trail including title',
  );
  assert.ok(
    layout.includes('items={visibleBreadcrumbItems}') &&
      layout.includes('structuredDataItems={breadcrumbJsonLdItems}'),
    'visible breadcrumbs without title must be passed alongside full JSON-LD',
  );
  // Ensure old pattern (pushing title to visible items) is gone
  assert.equal(
    layout.includes('breadcrumbItems.push({ label: title })'),
    false,
    'title must not be pushed to visible breadcrumbs',
  );
  // Breadcrumbs component must support structuredDataItems for SEO
  assert.ok(
    breadcrumbs.includes('structuredDataItems'),
    'Breadcrumbs must accept structuredDataItems for SEO',
  );
  assert.ok(
    breadcrumbs.includes('schemaItems = structuredDataItems ?? items'),
    'Breadcrumbs must fall back to items when no structured data override',
  );
}

function testBreadcrumbLinkBehavior() {
  const breadcrumbs = read('src/components/Breadcrumbs.astro');

  // Smallest backward-compatible fix: when structuredDataItems is present,
  // all visible items with href must be links (no aria-current on Category/Writing).
  // Other pages without the override must keep the last-item-as-current behavior.
  assert.ok(
    breadcrumbs.includes('hasStructuredOverride'),
    'Breadcrumbs must track whether structuredDataItems override is present',
  );
  assert.ok(
    breadcrumbs.includes('isLinkable'),
    'Breadcrumbs must compute linkability instead of hard-coding isLast',
  );
  assert.ok(
    breadcrumbs.includes('!isLast || hasStructuredOverride'),
    'When structuredDataItems is present, last visible crumb with href must stay a link (Home/Writing/Category clickable)',
  );
  assert.ok(
    breadcrumbs.includes('!hasStructuredOverride && isLast'),
    'aria-current must only apply when there is no structuredDataItems override (preserve other pages)',
  );
  // No stray aria-current on Category when override is active — the span must be plain.
  assert.match(
    breadcrumbs,
    /\{\.\.\.\(!hasStructuredOverride && isLast[\s\S]*?aria-current/,
    'aria-current must be conditional on hasStructuredOverride',
  );
}

function testBreadcrumbRenderedOutput() {
  // Check actual rendered HTML, not just source patterns.
  // Requires `npm run build` to have produced dist/client.
  const candidates = [
    {
      path: 'dist/client/writing/anthropic_ipo/index.html',
      description: 'English with footnotes and category (Investing)',
      expectedCategoryHref: '/writing/category/investing/1',
    },
    {
      path: 'dist/client/writing/nonviolent/index.html',
      description: 'English without footnotes, with category (Culture)',
      expectedCategoryHref: '/writing/category/culture/1',
    },
    {
      path: 'dist/client/fr/writing/nonviolent/index.html',
      description: 'Translated (fr) with category',
      expectedCategoryHref: '/writing/category/culture/1',
    },
  ];

  const builtCandidates = candidates.filter((c) =>
    existsSync(path.join(REPO_ROOT, c.path)),
  );

  if (builtCandidates.length === 0) {
    assert.fail(
      'No built article pages found for breadcrumb regression check. Run `npm run build` first (expected dist/client/writing/*/index.html).',
    );
  }

  for (const {
    path: relPath,
    description,
    expectedCategoryHref,
  } of builtCandidates) {
    const html = read(relPath);
    const navMatch = html.match(
      /<nav class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>/,
    );
    assert.ok(
      navMatch,
      `${description} (${relPath}): breadcrumbs nav must exist`,
    );
    const nav = navMatch[0];

    // All visible crumbs (Home, Writing, Category) must be links — no aria-current on them.
    const linkHrefs = [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    const ariaCount = (nav.match(/aria-current="page"/g) ?? []).length;

    assert.equal(
      ariaCount,
      0,
      `${description}: visible breadcrumbs must not have aria-current (Category/Writing must be clickable), got ${ariaCount} in ${relPath}`,
    );
    // With category, we expect 3 links: Home, Writing, Category. Without category, 2.
    assert.ok(
      linkHrefs.length === 3 || linkHrefs.length === 2,
      `${description}: expected 2 or 3 visible breadcrumb links, got ${linkHrefs.length} (${linkHrefs.join(', ')}) in ${relPath}`,
    );
    if (linkHrefs.length === 3) {
      assert.equal(linkHrefs[0], '/', `${description}: Home must link to /`);
      assert.equal(
        linkHrefs[1],
        '/writing/1',
        `${description}: Writing must link to /writing/1`,
      );
      assert.equal(
        linkHrefs[2],
        expectedCategoryHref,
        `${description}: Category link mismatch in ${relPath}`,
      );
    } else {
      assert.equal(linkHrefs[0], '/', `${description}: Home must link to /`);
      assert.equal(
        linkHrefs[1],
        '/writing/1',
        `${description}: Writing must link to /writing/1 when no category`,
      );
    }

    // Visible breadcrumbs must not contain the article title (H1) — would be redundant.
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    assert.ok(h1Match, `${description}: H1 must exist`);
    const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim();
    // Only visible items (inside <ol>), not the JSON-LD script which also contains the title.
    const olMatch = nav.match(/<ol[^>]*>([\s\S]*?)<\/ol>/);
    const visibleText = olMatch
      ? olMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : nav
          .replace(/<script[\s\S]*?<\/script>/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
    assert.equal(
      visibleText.includes(h1Text.slice(0, 20)),
      false,
      `${description}: visible breadcrumbs must not repeat the article title; visible text "${visibleText.slice(0, 60)}" should not contain H1 "${h1Text.slice(0, 40)}"`,
    );

    // JSON-LD must preserve full trail including the title (4 items with category, 3 without).
    const jsonLdMatches = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ];
    const breadcrumbJson = jsonLdMatches
      .map((m) => {
        try {
          return JSON.parse(m[1]);
        } catch {
          return null;
        }
      })
      .find((j) => j && j['@type'] === 'BreadcrumbList');

    assert.ok(
      breadcrumbJson,
      `${description}: BreadcrumbList JSON-LD must exist in ${relPath}`,
    );
    const items = breadcrumbJson.itemListElement as Array<{
      name: string;
      item?: string;
    }>;
    assert.ok(
      Array.isArray(items) && items.length >= 3,
      `${description}: JSON-LD must have at least Home/Writing/Category or Home/Writing + title`,
    );
    // Last JSON-LD entry must be the article title (not a category).
    const lastName = items[items.length - 1].name;
    // Decode HTML entities for comparison (H1 is entity-encoded as &#39; etc.)
    const decodedH1 = h1Text
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    assert.equal(
      lastName,
      decodedH1,
      `${description}: JSON-LD last item must be the article title; expected "${decodedH1}" got "${lastName}"`,
    );
    // JSON-LD should have one more item than visible links (the title with no href).
    assert.equal(
      items.length,
      linkHrefs.length + 1,
      `${description}: JSON-LD must have one more entry than visible crumbs (includes title) in ${relPath}`,
    );
    assert.equal(
      items[items.length - 1].item,
      undefined,
      `${description}: JSON-LD title entry must not have an item URL (current page)`,
    );
  }

  // Also verify that the fallback (no structuredDataItems) would still mark current page.
  // Since all current article pages use the override, we check the source preserves that fallback,
  // and spot-check that the built HTML itself has zero aria-current as expected for the override case.
  // If a future non-article page adds breadcrumbs without structuredDataItems, the existing
  // Breadcrumbs logic (hasStructuredOverride === false) will correctly use aria-current.
}

export function runArticleFooterTests() {
  testTagDestinationsAndPresentation();
  testShareMenuAccessibilityAndBehavior();
  testNewsletterDefaultsAndPreservedSubmission();
  testUnifiedFooterOrder();
  testHeaderHierarchy();
  testBreadcrumbVisibility();
  testBreadcrumbLinkBehavior();
  testBreadcrumbRenderedOutput();
}
