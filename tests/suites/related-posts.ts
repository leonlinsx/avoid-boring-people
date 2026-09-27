import assert from 'node:assert/strict';
import { selectRelatedPosts } from '../../src/utils/related-posts.ts';
import { makeCollectionEntry } from '../helpers/fixtures.ts';

const post = (
  id: string,
  tags: string[],
  category = 'Culture',
  pubDate = '2024-01-01',
) =>
  makeCollectionEntry({
    id,
    data: { tags, category, pubDate: new Date(`${pubDate}T00:00:00Z`) },
  });

const ids = (posts: Array<{ id: string }>) => posts.map(({ id }) => id);

export function runRelatedPostsTests() {
  const current = post('current', ['startups', 'strategy']);

  assert.deepEqual(
    ids(
      selectRelatedPosts(
        current as any,
        [
          post('weak', ['startups'], 'Culture', '2025-01-01'),
          post('strong', ['strategy', 'startups'], 'Technology', '2023-01-01'),
        ] as any,
      ),
    ),
    ['strong', 'weak'],
    'stronger tag overlap beats weaker matches',
  );

  assert.deepEqual(
    ids(
      selectRelatedPosts(
        current as any,
        [
          post('other-category', ['startups'], 'Technology', '2025-01-01'),
          post('same-category', ['startups'], 'Culture', '2023-01-01'),
        ] as any,
      ),
    ),
    ['same-category', 'other-category'],
    'category breaks equal tag relevance before recency',
  );

  assert.deepEqual(
    ids(
      selectRelatedPosts(
        current as any,
        [
          post('older', ['startups'], 'Culture', '2023-01-01'),
          post('newer', ['startups'], 'Culture', '2025-01-01'),
        ] as any,
      ),
    ),
    ['newer', 'older'],
    'recency deterministically breaks equal relevance',
  );

  assert.deepEqual(
    ids(
      selectRelatedPosts(
        current as any,
        [
          current,
          current,
          post('unique', ['startups']),
          post('unique', ['startups']),
        ] as any,
      ),
    ),
    ['unique'],
    'the current article and duplicate candidate ids are excluded',
  );

  const sparseCurrent = post('sparse', []);
  assert.deepEqual(
    ids(
      selectRelatedPosts(
        sparseCurrent as any,
        [
          post('unrelated-new', [], 'Technology', '2025-01-01'),
          post('category-old', [], 'Culture', '2023-01-01'),
          post('category-new', [], 'Culture', '2024-01-01'),
        ] as any,
      ),
    ),
    ['category-new', 'category-old'],
    'no-tag articles fall back to same-category recency',
  );

  const tied = [
    post('z-id', ['startups'], 'Culture', '2024-01-01'),
    post('a-id', ['startups'], 'Culture', '2024-01-01'),
  ];
  const first = ids(selectRelatedPosts(current as any, tied as any));
  const second = ids(
    selectRelatedPosts(current as any, [...tied].reverse() as any),
  );
  assert.deepEqual(first, ['a-id', 'z-id']);
  assert.deepEqual(
    second,
    first,
    'ordering is stable regardless of input order',
  );
}
