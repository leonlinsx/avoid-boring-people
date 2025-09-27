import assert from 'node:assert/strict';
import { computeCleanSlug } from '../src/utils/slug-helpers.ts';
import { searchPosts, normalizeQuery } from '../src/utils/search.ts';

function makePost(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    slug: 'sample',
    body: 'Base body',
    collection: 'blog',
    data: {
      title: 'Base Title',
      description: 'Base description about finance',
      pubDate: new Date('2024-01-01T00:00:00Z'),
      updatedDate: undefined,
      category: 'Finance',
      categoryNormalized: 'finance',
      readingTime: 3,
      tags: ['compounding'],
      heroImage: undefined,
    },
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...base.data,
      ...(overrides.data ?? {}),
    },
  };
}

function makeEntry(overrides: Record<string, any> = {}) {
  const base = {
    id: '2024_01_01_sample/index.md',
    data: {},
  };

  return {
    ...base,
    ...overrides,
    data: {
      ...(base.data ?? {}),
      ...(overrides.data ?? {}),
    },
  };
}

function testSearchPosts() {
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

  assert.deepEqual(searchPosts(detailedPosts as any, 'venture'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'markets'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'equities'), [detailedPosts[0]]);
  assert.deepEqual(searchPosts(detailedPosts as any, 'digest'), [detailedPosts[1]]);
  assert.deepEqual(
    searchPosts(detailedPosts as any, 'venture capital'),
    [detailedPosts[0]],
  );
  assert.equal(searchPosts(detailedPosts as any, 'nonexistent').length, 0);
}

function testComputeCleanSlug() {
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
    computeCleanSlug(
      makeEntry({ id: '2024_02_03_new-idea/index.mdx' }),
    ),
    'new-idea',
  );
  assert.equal(
    computeCleanSlug(
      makeEntry({ data: { slug: '  /custom-slug/ ' } }),
    ),
    'custom-slug',
  );
}

function testNormalizeQuery() {
  assert.equal(normalizeQuery('   Venture   Deals  '), 'venture deals');
  assert.equal(normalizeQuery('\n\t  MIXED Case  '), 'mixed case');
}

try {
  testSearchPosts();
  testComputeCleanSlug();
  testNormalizeQuery();
  console.log('✅ All custom tests passed');
} catch (error) {
  console.error('❌ Test failure', error);
  process.exitCode = 1;
}
