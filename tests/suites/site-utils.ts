// Unit coverage for the pure utilities behind search, slugs, pagination, and taxonomy.

import assert from 'node:assert/strict';
import { computeCleanSlug } from '../../src/utils/slug-helpers.ts';
import { searchPosts, normalizeQuery } from '../../src/utils/search.ts';
import { normalizeCategory, titleCase } from '../../src/utils/text.ts';
import { categoryLabel } from '../../src/utils/taxonomy.ts';
import { buildPaginationHref } from '../../src/utils/pagination.ts';
import { makePost, makeEntry } from '../helpers/fixtures.ts';

export function testSearchPosts() {
  const posts = [
    makePost(),
    makePost({ id: '2024_01_02_other/index.md', slug: 'other' }),
  ];
  assert.deepEqual(searchPosts(posts as any, '   '), posts);

  const shuffled = searchPosts(posts as any, 'base');
  assert.deepEqual(
    shuffled.map((p) => p.id),
    posts.map((p) => p.id),
  );

  const detailedPosts = [
    makePost({
      id: '2024_01_02_growth/index.md',
      slug: 'growth',
      data: {
        title: 'Growth Stocks',
        description: 'Looking at multiples',
        category: 'Markets',
        tags: ['Equities'],
      },
      body: 'This essay analyses venture capital deal flow.',
    }),
    makePost({
      id: '2024_01_03_notes/index.md',
      slug: 'notes',
      data: {
        title: 'Weekly Notes',
        description: 'Digest',
        category: 'Notes',
        tags: ['newsletter'],
      },
      body: 'miscellaneous thoughts',
    }),
  ];

  assert.deepEqual(searchPosts(detailedPosts as any, 'venture'), [
    detailedPosts[0],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'markets'), [
    detailedPosts[0],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'equities'), [
    detailedPosts[0],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'digest'), [
    detailedPosts[1],
  ]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'venture capital'), [
    detailedPosts[0],
  ]);
  assert.equal(searchPosts(detailedPosts as any, 'nonexistent').length, 0);
}

export function testComputeCleanSlug() {
  assert.equal(
    computeCleanSlug(makeEntry({ data: { slug: 'custom-slug' } })),
    'custom-slug',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea.md' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea/index.md' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ id: '2024_02_03_new-idea/index.mdx' })),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(makeEntry({ data: { slug: '  /custom-slug/ ' } })),
    'custom-slug',
  );
}

export function testNormalizeQuery() {
  assert.equal(normalizeQuery('   Venture   Deals  '), 'venture deals');
  assert.equal(normalizeQuery('\n\t  MIXED Case  '), 'mixed case');
}

export function testBuildPaginationHref() {
  assert.equal(buildPaginationHref(1), '/writing/1');
  assert.equal(buildPaginationHref(2), '/writing/2');
  assert.equal(
    buildPaginationHref(1, 'finance'),
    '/writing/category/finance/1',
  );
  assert.equal(
    buildPaginationHref(5, 'markets & money'),
    '/writing/category/markets%20%26%20money/5',
  );
  assert.equal(
    buildPaginationHref(0, 'finance'),
    '/writing/category/finance/1',
  );
  assert.equal(buildPaginationHref(3.7), '/writing/3');
}

export function testTitleCase() {
  assert.equal(titleCase('hello world'), 'Hello World');
  assert.equal(titleCase('multi\nline text'), 'Multi\nLine Text');
  assert.equal(titleCase(''), '');
  assert.equal(titleCase(undefined as any), '');
}

export function testNormalizeCategory() {
  assert.equal(normalizeCategory('Investing'), 'investing');
  assert.equal(
    normalizeCategory('Risk & Decision Making'),
    'risk-decision-making',
  );
  assert.equal(normalizeCategory(undefined as any), '');
  assert.equal(categoryLabel('system-design'), 'System Design');
}

export async function runSiteUtilityTests() {
  await testSearchPosts();
  await testComputeCleanSlug();
  await testNormalizeQuery();
  await testBuildPaginationHref();
  await testTitleCase();
  await testNormalizeCategory();
}
