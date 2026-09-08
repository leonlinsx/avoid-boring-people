export const categories = [
  { label: 'Investing', slug: 'investing' },
  { label: 'Technology', slug: 'technology' },
  { label: 'System Design', slug: 'system-design' },
  { label: 'Risk & Decision Making', slug: 'risk-decision-making' },
  { label: 'Culture', slug: 'culture' },
] as const;

export const categoryLabels = categories.map(({ label }) => label) as [
  (typeof categories)[number]['label'],
  ...(typeof categories)[number]['label'][],
];

const categoryByLabel = new Map<string, (typeof categories)[number]>(
  categories.map((category) => [category.label, category]),
);
const categoryBySlug = new Map<string, (typeof categories)[number]>(
  categories.map((category) => [category.slug, category]),
);

export function categorySlug(category: string): string {
  const value = (category ?? '').trim();
  return categoryByLabel.get(value)?.slug ?? value.toLowerCase();
}

export function categoryLabel(category: string): string {
  const value = (category ?? '').trim();
  return categoryBySlug.get(value.toLowerCase())?.label ?? value;
}

export function orderedCategorySlugs(values: Iterable<string>): string[] {
  const present = new Set(Array.from(values, categorySlug));
  return categories
    .map(({ slug }) => slug)
    .filter((slug) => present.has(slug));
}
