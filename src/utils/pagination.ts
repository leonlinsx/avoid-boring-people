export function buildPaginationHref(page: number, activeCategory?: string) {
  const normalizedPage = Math.max(1, Math.trunc(page));

  if (activeCategory) {
    return `/writing/category/${encodeURIComponent(activeCategory)}/${normalizedPage}`;
  }

  return `/writing/${normalizedPage}`;
}
