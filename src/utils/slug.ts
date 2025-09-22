import type { CollectionEntry } from 'astro:content';

export function getCleanSlug(post: CollectionEntry<'blog'>): string {
  // Use frontmatter override if present
  if (post.data.slug) return post.data.slug;

  // Fallback: folder name without yyyy_mm_dd_
  const raw = post.id.replace(/\/index\.md$/, '').replace(/\.md$/, '');
  return raw.replace(/^\d{4}_\d{2}_\d{2}_/, '');
}
