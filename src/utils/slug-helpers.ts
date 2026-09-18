export interface SlugSourceLike {
  id: string;
  data: {
    slug?: string;
  };
}

/**
 * Canonical spelling of a pathname: no trailing slash, except for the root.
 * Every comparison or lookup keyed on a pathname (sitemap lastmod, redirect
 * keys, canonical URLs) must use this so the two sides of a lookup cannot
 * drift apart and silently fall back.
 */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
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
