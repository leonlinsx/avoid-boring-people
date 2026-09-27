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
  assert.match(
    subscribe,
    /action="https:\/\/avoidboringpeople\.substack\.com\/api\/v1\/free"/,
  );
  assert.match(subscribe, /id="substack-form"/);
  assert.match(subscribe, /name="source"/);
  assert.match(subscribe, /compact \? 'blog-inline' : 'blog-footer'/);
  assert.match(subscribe, /e\.preventDefault\(\)/);
  assert.match(subscribe, /setTimeout\(\(\) => \{\s*form\.submit\(\)/);
  assert.match(subscribe, /firstTouchAttribution\(/);
}

function testUnifiedFooterOrder() {
  const layout = read('src/layouts/BlogPost.astro');
  const footer = layout.indexOf('<footer class="article-footer">');
  const tags = layout.indexOf('<TagList', footer);
  const share = layout.indexOf('<ShareButtons', footer);
  const subscribe = layout.indexOf('<SubscribeForm', footer);
  const discussion = layout.indexOf('<Discussion', footer);

  assert.ok(footer >= 0 && tags > footer && share > tags && subscribe > share);
  assert.ok(
    discussion > subscribe,
    'Discussion must remain after the article footer',
  );
}

export function runArticleFooterTests() {
  testTagDestinationsAndPresentation();
  testShareMenuAccessibilityAndBehavior();
  testNewsletterDefaultsAndPreservedSubmission();
  testUnifiedFooterOrder();
}
