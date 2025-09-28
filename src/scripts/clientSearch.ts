import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';

type SearchablePost = {
  el: HTMLElement;
  title: string;
  summary: string;
  category: string;
};

export interface SetupClientSearchOptions {
  input: HTMLInputElement;
  posts: HTMLElement[];
  emptyState?: HTMLElement | null;
  initialQuery?: string | null | undefined;
  fuseOptions?: IFuseOptions<SearchablePost>;
}

export interface ClientSearchController {
  runSearch(query: string): void;
  destroy(): void;
}

export function setupClientSearch(options: SetupClientSearchOptions): ClientSearchController {
  const { input, posts, emptyState = null, initialQuery, fuseOptions } = options;

  const postEntries: SearchablePost[] = posts.map((el) => ({
    el,
    title: el.querySelector<HTMLElement>('.post-title')?.textContent?.trim() ?? '',
    summary: el.querySelector<HTMLElement>('.post-summary')?.textContent?.trim() ?? '',
    category: el.querySelector<HTMLElement>('.post-meta')?.textContent?.trim() ?? '',
  }));

  const fuse = new Fuse(postEntries, {
    keys: ['title', 'summary', 'category'],
    threshold: 0.3,
    ...(fuseOptions ?? {}),
  });

  const showPost = (el: HTMLElement) => {
    el.style.display = '';
    el.removeAttribute('data-initially-hidden');
  };

  const hidePost = (el: HTMLElement) => {
    el.style.display = 'none';
    el.setAttribute('data-initially-hidden', 'true');
  };

  const updateEmptyState = (hasResults: boolean) => {
    if (!emptyState) return;
    emptyState.classList.toggle('is-visible', !hasResults);
  };

  const runSearch = (rawQuery: string) => {
    const query = rawQuery.trim();

    if (!query) {
      posts.forEach(showPost);
      updateEmptyState(true);
      return;
    }

    const matches = fuse.search(query).map((result) => result.item.el);
    posts.forEach(hidePost);
    matches.forEach(showPost);
    updateEmptyState(matches.length > 0);
  };

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    runSearch(target?.value ?? '');
  };

  input.addEventListener('input', handleInput);

  const initial = initialQuery?.trim() ?? '';
  if (initial) {
    input.value = initial;
    runSearch(initial);
  } else {
    runSearch('');
  }

  return {
    runSearch,
    destroy() {
      input.removeEventListener('input', handleInput);
    },
  };
}
