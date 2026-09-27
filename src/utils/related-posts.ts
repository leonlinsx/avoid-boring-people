import type { CollectionEntry } from 'astro:content';
import { comparePostsByDate } from './text.ts';

const normalizedTags = (post: CollectionEntry<'blog'>) =>
  new Set(
    (post.data.tags ?? [])
      .map((tag: string) => tag.trim().toLowerCase())
      .filter(Boolean),
  );

/**
 * Select related posts by shared tags, then category, then publication date.
 * Candidates with neither a shared tag nor the same category are unrelated and
 * omitted. The same-category candidates preserve the old recency fallback.
 */
export function selectRelatedPosts(
  current: CollectionEntry<'blog'>,
  candidates: CollectionEntry<'blog'>[],
  limit = 3,
): CollectionEntry<'blog'>[] {
  const currentTags = normalizedTags(current);
  const currentCategory = current.data.category.trim().toLowerCase();
  const seenIds = new Set<string>([current.id]);

  return candidates
    .filter((candidate) => {
      if (seenIds.has(candidate.id)) return false;
      seenIds.add(candidate.id);
      return true;
    })
    .map((post) => ({
      post,
      sharedTags: [...normalizedTags(post)].filter((tag) =>
        currentTags.has(tag),
      ).length,
      sameCategory: post.data.category.trim().toLowerCase() === currentCategory,
    }))
    .filter(({ sharedTags, sameCategory }) => sharedTags > 0 || sameCategory)
    .sort(
      (a, b) =>
        b.sharedTags - a.sharedTags ||
        Number(b.sameCategory) - Number(a.sameCategory) ||
        comparePostsByDate(a.post, b.post),
    )
    .slice(0, limit)
    .map(({ post }) => post);
}
