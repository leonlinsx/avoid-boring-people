import assert from 'node:assert/strict';
import { computeCleanSlug } from '../src/utils/slug-helpers.ts';
import { searchPosts, normalizeQuery } from '../src/utils/search.ts';
import { extractHeadings } from '../src/utils/toc.ts';
import {
  normalizeHeroImage,
  stripIndexSuffix,
  normalizeRelativePath,
} from '../src/utils/hero-image.ts';

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

function testExtractHeadings() {
  const html = `
    <h2 class="section" data-level="2" id="intro">Intro <em>text</em></h2>
    <h3 id='details' class="sub" data-role="anchor">Detailed <code>insights</code></h3>
    <h4 id="ignore">Ignore</h4>
  `;

  const headings = extractHeadings(html);

  assert.deepEqual(headings, [
    { level: 2, id: 'intro', text: 'Intro text' },
    { level: 3, id: 'details', text: 'Detailed insights' },
  ]);
}

function testNormalizeHeroImage() {
  const metadataLike = {
    src: '/optimized/image.webp',
    width: 800,
    height: 600,
    format: 'webp',
  };
  assert.equal(normalizeHeroImage(undefined, 'blog/post.md'), undefined);
  assert.strictEqual(
    normalizeHeroImage(metadataLike, 'blog/post.md'),
    metadataLike,
  );

  assert.equal(
    normalizeHeroImage('./cover.webp', 'blog/2024_02_03_new-idea/index.mdx'),
    '/blog/2024_02_03_new-idea/cover.webp',
  );

  assert.equal(
    normalizeHeroImage('../shared.webp', 'blog/2024_02_03_new-idea/index.mdx'),
    '/blog/shared.webp',
  );

  assert.equal(
    normalizeHeroImage('/images/custom.webp', 'blog/post.md'),
    '/images/custom.webp',
  );

  assert.equal(stripIndexSuffix('blog/slug/index.md'), 'blog/slug');
  assert.equal(stripIndexSuffix('blog/slug/index.mdx'), 'blog/slug');
  assert.equal(stripIndexSuffix('blog/slug.md'), 'blog/slug');
  assert.equal(stripIndexSuffix('blog/slug.mdx'), 'blog/slug');

  assert.equal(
    normalizeRelativePath('./cover.webp', 'blog/slug/index.mdx'),
    '/blog/slug/cover.webp',
  );
}

try {
  testSearchPosts();
  testComputeCleanSlug();
  testNormalizeQuery();
  testExtractHeadings();
  testNormalizeHeroImage();
  console.log('✅ All custom tests passed');
} catch (error) {
  console.error('❌ Test failure', error);
  process.exitCode = 1;
}
