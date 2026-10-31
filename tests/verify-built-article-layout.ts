import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './helpers/harness.ts';

const read = (relPath: string) =>
  readFileSync(path.join(REPO_ROOT, relPath), 'utf8');

type Candidate = {
  path: string;
  description: string;
  expectedCategoryHref: string;
  hasFootnotes: boolean;
};

const candidates: Candidate[] = [
  {
    path: 'dist/client/writing/anthropic_ipo/index.html',
    description: 'English with footnotes and category (Investing)',
    expectedCategoryHref: '/writing/category/investing/1',
    hasFootnotes: true,
  },
  {
    path: 'dist/client/writing/nonviolent/index.html',
    description: 'English without footnotes, with category (Culture)',
    expectedCategoryHref: '/writing/category/culture/1',
    hasFootnotes: false,
  },
  {
    path: 'dist/client/fr/writing/nonviolent/index.html',
    description: 'Translated (fr) with category',
    expectedCategoryHref: '/writing/category/culture/1',
    hasFootnotes: false,
  },
];

function verifyBreadcrumbs(
  html: string,
  description: string,
  relPath: string,
  expectedCategoryHref: string,
) {
  const navMatch = html.match(/<nav class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(
    navMatch,
    `${description} (${relPath}): breadcrumbs nav must exist`,
  );
  const nav = navMatch[0];

  const linkHrefs = [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  const ariaCount = (nav.match(/aria-current="page"/g) ?? []).length;

  assert.equal(
    ariaCount,
    0,
    `${description}: visible breadcrumbs must not have aria-current (Category/Writing must be clickable), got ${ariaCount} in ${relPath}`,
  );
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

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1Match, `${description}: H1 must exist`);
  const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim();
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
  const items = (
    breadcrumbJson as {
      itemListElement: Array<{ name: string; item?: string }>;
    }
  ).itemListElement;
  assert.ok(
    Array.isArray(items) && items.length >= 3,
    `${description}: JSON-LD must have at least Home/Writing/Category or Home/Writing + title`,
  );
  const lastName = items[items.length - 1].name;
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

function verifyDomOrdering(
  html: string,
  description: string,
  relPath: string,
  hasFootnotes: boolean,
) {
  const markers: Array<[string, string]> = [
    ['breadcrumbs', 'class="breadcrumbs"'],
    ['h1', '<h1'],
    ['meta', 'class="meta"'],
    ['hero-image', 'class="hero-image"'],
    ['toc', 'toc-desktop'],
    ['signup', 'class="signup"'],
    ['article-footer', 'class="article-footer"'],
  ];

  const indices = new Map<string, number>();
  for (const [name, pattern] of markers) {
    const idx = html.indexOf(pattern);
    assert.ok(
      idx !== -1,
      `${description} (${relPath}): marker "${name}" (${pattern}) must exist`,
    );
    indices.set(name, idx);
  }

  // Ensure ordering: breadcrumbs < h1 < meta < hero < toc < signup < article-footer
  const order = [
    'breadcrumbs',
    'h1',
    'meta',
    'hero-image',
    'toc',
    'signup',
    'article-footer',
  ];
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    assert.ok(
      (indices.get(a) as number) < (indices.get(b) as number),
      `${description}: expected DOM order ${a} before ${b} in ${relPath} (got ${indices.get(a)} vs ${indices.get(b)})`,
    );
  }

  // Signup must be before footnotes when footnotes exist; footnotes before footer.
  const signupIdx = html.indexOf('class="signup"');
  const footnotesIdx = html.indexOf('data-footnotes');
  const footerIdx = html.indexOf('class="article-footer"');

  if (hasFootnotes) {
    assert.ok(
      footnotesIdx !== -1,
      `${description}: expected data-footnotes section for article with footnotes in ${relPath}`,
    );
    assert.ok(
      signupIdx < footnotesIdx,
      `${description}: signup must be before footnotes (signup ${signupIdx} vs footnotes ${footnotesIdx}) in ${relPath}`,
    );
    assert.ok(
      footnotesIdx < footerIdx,
      `${description}: footnotes must be before article-footer in ${relPath}`,
    );
  } else {
    assert.equal(
      footnotesIdx,
      -1,
      `${description}: must not have data-footnotes for article without footnotes in ${relPath}`,
    );
    assert.ok(
      signupIdx < footerIdx,
      `${description}: signup must be before article-footer when no footnotes in ${relPath}`,
    );
  }

  // Single signup per article
  const signupCount = (html.match(/class="signup"/g) ?? []).length;
  assert.equal(
    signupCount,
    1,
    `${description}: exactly one signup must exist, got ${signupCount} in ${relPath}`,
  );

  // Single H1
  const h1Count = (html.match(/<h1[^>]*>/g) ?? []).length;
  assert.equal(
    h1Count,
    1,
    `${description}: exactly one H1 must exist in ${relPath}`,
  );
}

function verifyFootnoteBacklinks(
  html: string,
  description: string,
  relPath: string,
  hasFootnotes: boolean,
) {
  if (!hasFootnotes) return;

  // Find all footnote refs: href="#user-content-fn-*" and backrefs href="#user-content-fnref-*"
  const refHrefs = [...html.matchAll(/href="#(user-content-fn-\d+)"/g)].map(
    (m) => m[1],
  );
  const backrefHrefs = [
    ...html.matchAll(/href="#(user-content-fnref-\d+)"/g),
  ].map((m) => m[1]);

  assert.ok(
    refHrefs.length > 0,
    `${description}: expected footnote refs in ${relPath}`,
  );
  assert.ok(
    backrefHrefs.length > 0,
    `${description}: expected footnote backrefs in ${relPath}`,
  );

  for (const id of refHrefs) {
    assert.ok(
      html.includes(`id="${id}"`),
      `${description}: footnote target id="${id}" must exist for href="#${id}" in ${relPath}`,
    );
  }
  for (const id of backrefHrefs) {
    assert.ok(
      html.includes(`id="${id}"`),
      `${description}: footnote backref target id="${id}" must exist for href="#${id}" in ${relPath}`,
    );
  }

  // Also verify the footnotes section itself has the list items
  const footnotesSection = html.match(
    /<section[^>]*data-footnotes[^>]*>[\s\S]*?<\/section>/,
  );
  assert.ok(
    footnotesSection,
    `${description}: footnotes <section data-footnotes> must exist in ${relPath}`,
  );
  const footnoteIds = [...html.matchAll(/<li id="(user-content-fn-\d+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(
    footnoteIds.length > 0,
    `${description}: footnotes list must contain <li id="user-content-fn-..."> in ${relPath}`,
  );
}

function verifyBuiltLayout() {
  // Fail explicitly if required built pages are missing; don't silently skip.
  const missing: string[] = [];
  for (const c of candidates) {
    if (!existsSync(path.join(REPO_ROOT, c.path))) missing.push(c.path);
  }
  if (missing.length > 0) {
    console.error(`Missing required built pages: ${missing.join(', ')}`);
    console.error(
      'Run `npm run build` to produce dist/client before running this verification.',
    );
    throw new Error(
      `Missing required built pages for verification: ${missing.join(', ')}`,
    );
  }

  for (const candidate of candidates) {
    const html = read(candidate.path);
    verifyBreadcrumbs(
      html,
      candidate.description,
      candidate.path,
      candidate.expectedCategoryHref,
    );
    verifyDomOrdering(
      html,
      candidate.description,
      candidate.path,
      candidate.hasFootnotes,
    );
    verifyFootnoteBacklinks(
      html,
      candidate.description,
      candidate.path,
      candidate.hasFootnotes,
    );
  }

  console.log(
    `✅ Built article layout verification passed for ${candidates.length} page(s):`,
  );
  for (const c of candidates) console.log(`  - ${c.description} (${c.path})`);
}

verifyBuiltLayout();
