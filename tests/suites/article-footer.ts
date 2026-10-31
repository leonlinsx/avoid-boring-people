import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

export function runArticleFooterTests() {
  testTagDestinationsAndPresentation();
  testShareMenuAccessibilityAndBehavior();
  testNewsletterDefaultsAndPreservedSubmission();
  testUnifiedFooterOrder();
  testHeaderHierarchy();
  testBreadcrumbVisibility();
}
