import type { CollectionEntry } from 'astro:content';
import { computeCleanSlug } from './slug-helpers.ts';

export function getCleanSlug(post: CollectionEntry<'blog'>): string {
  return computeCleanSlug(post);
}

export { computeCleanSlug };
