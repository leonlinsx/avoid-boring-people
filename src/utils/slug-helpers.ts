export interface SlugSourceLike {
  id: string;
  data: {
    slug?: string;
  };
}

/**
 * Shared implementation for computing a clean slug from a content entry.
 */
export function computeCleanSlug(post: SlugSourceLike): string {
  const explicitSlug = post.data?.slug;
  if (typeof explicitSlug === 'string') {
    const trimmed = explicitSlug.trim().replace(/^\/+|\/+$/g, '');
    if (trimmed) {
      return trimmed;
    }
  }

  const raw = post.id
    .replace(/\/index\.(md|mdx)$/i, '')
    .replace(/\.(md|mdx)$/i, '');
  return raw.replace(/^\d{4}_\d{2}_\d{2}_/, '');
}
