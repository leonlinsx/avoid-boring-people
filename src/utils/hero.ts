import { posix } from 'node:path';
import type { ImageMetadata } from 'astro';

/**
 * Normalize heroImage field to either ImageMetadata or string URL.
 * - Returns Astro ImageMetadata objects as-is.
 * - Resolves relative string paths against the owning post's directory,
 *   stripping trailing index.md/mdx (or standalone .md/.mdx) segments.
 * - Returns absolute URLs unchanged.
 */
export function normalizeHeroImage(
  heroImage: unknown,
  postId: string,
): ImageMetadata | string | undefined {
  if (!heroImage) return undefined;

  if (
    typeof heroImage === 'object' &&
    heroImage !== null &&
    'src' in heroImage &&
    'width' in heroImage &&
    'height' in heroImage &&
    'format' in heroImage
  ) {
    return heroImage as ImageMetadata;
  }

  if (typeof heroImage === 'string') {
    if (heroImage.startsWith('./') || heroImage.startsWith('../')) {
      const baseId = postId.replace(/(?:\/index)?\.(md|mdx)$/i, '');
      const resolved = posix.join('/', baseId, heroImage);
      return resolved;
    }

    return heroImage;
  }

  return undefined;
}
