import { posix as path } from 'node:path';

export type HeroImageLike = unknown;

function stripIndexSuffix(postId: string): string {
  return postId
    .replace(/\/index\.(md|mdx)$/i, '')
    .replace(/\.(md|mdx)$/i, '');
}

function normalizeRelativePath(heroImage: string, postId: string): string {
  const baseDir = stripIndexSuffix(postId);
  const cleaned = heroImage.replace(/^\.\//, '');
  return path
    .join('/', baseDir, cleaned)
    .replace(/\\/g, '/');
}

export function normalizeHeroImage(
  heroImage: HeroImageLike,
  postId: string,
): string | HeroImageLike | undefined {
  if (!heroImage) return undefined;

  if (
    typeof heroImage === 'object' &&
    heroImage !== null &&
    'src' in heroImage &&
    'width' in heroImage &&
    'height' in heroImage &&
    'format' in heroImage
  ) {
    return heroImage;
  }

  if (typeof heroImage === 'string') {
    if (heroImage.startsWith('./') || heroImage.startsWith('../')) {
      return normalizeRelativePath(heroImage, postId);
    }

    return heroImage;
  }

  return undefined;
}

export { normalizeRelativePath, stripIndexSuffix };
