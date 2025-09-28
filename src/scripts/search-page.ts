import Fuse from 'fuse.js';

type HeroAsset = {
  kind: 'asset';
  src: string;
  width?: number;
  height?: number;
};

type HeroExternal = {
  kind: 'external';
  src: string;
};

type SearchItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  pubDate: string | null;
  readingTime: number | null;
  heroImage: HeroAsset | HeroExternal | null;
  fallbackImage: string;
};

type SearchPageConfig = {
  inputId: string;
  postListId: string;
  dataId: string;
  emptyStateId: string;
};

type SearchPageController = {
  destroy(): void;
};

const DEFAULT_CONFIG: SearchPageConfig = {
  inputId: 'client-search-input',
  postListId: 'post-list',
  dataId: 'search-data',
  emptyStateId: 'search-empty',
};

export function initSearchPage(
  partialConfig: Partial<SearchPageConfig> = {},
): SearchPageController | null {
  const config: SearchPageConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  const input = document.getElementById(config.inputId) as HTMLInputElement | null;
  const postListElement = document.getElementById(config.postListId);
  const dataEl = document.getElementById(config.dataId);
  const emptyStateElement = document.getElementById(config.emptyStateId);

  if (!input || !postListElement || !dataEl) {
    console.error('Search page assets failed to load');
    return null;
  }

  const postList = postListElement as HTMLElement;
  const emptyState = emptyStateElement as HTMLElement | null;

  let postsData: SearchItem[] = [];

  try {
    postsData = JSON.parse(dataEl.textContent || '[]');
  } catch (error) {
    console.error('Failed to parse search payload', error);
  }

  const fuse = new Fuse(postsData, {
    keys: ['title', 'description', 'category'],
    threshold: 0.3,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q')?.trim() || '';

  if (initialQuery) {
    input.value = initialQuery;
    runSearch(initialQuery, false);
  } else {
    renderPosts(postsData);
    updateEmptyState(postsData.length > 0, '');
  }

  const handler = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    const query = typeof target?.value === 'string' ? target.value.trim() : '';
    runSearch(query, true);
  };

  input.addEventListener('input', handler);

  return {
    destroy() {
      input.removeEventListener('input', handler);
    },
  };

  function runSearch(query: string, updateHistory: boolean) {
    const results = query
      ? fuse.search(query).map((result) => result.item)
      : postsData;

    renderPosts(results);
    updateEmptyState(results.length > 0, query);

    if (updateHistory) {
      try {
        const nextUrl = new URL(window.location.href);
        if (query) {
          nextUrl.searchParams.set('q', query);
        } else {
          nextUrl.searchParams.delete('q');
        }
        window.history.replaceState({}, '', nextUrl);
      } catch (error) {
        console.error('Failed to update search history', error);
      }
    }
  }

  function renderPosts(items: SearchItem[]) {
    const fragment = document.createDocumentFragment();
    items.forEach((post) => {
      fragment.appendChild(createPostCard(post));
    });
    postList.replaceChildren(fragment);
  }

  function createPostCard(post: SearchItem) {
    const article = document.createElement('article');
    article.className = 'post-card';
    article.dataset.postId = post.id;

    const href = `/writing/${post.slug}/`;

    const thumbLink = document.createElement('a');
    thumbLink.href = href;
    thumbLink.className = 'thumb-link';

    const thumb = document.createElement('img');
    const hero = post.heroImage;
    if (hero && hero.kind === 'asset') {
      thumb.src = hero.src;
      thumb.width = hero.width || 120;
      thumb.height = hero.height || 80;
    } else if (hero && hero.kind === 'external') {
      thumb.src = hero.src;
      thumb.width = 120;
      thumb.height = 80;
    } else {
      thumb.src = post.fallbackImage;
      thumb.width = 120;
      thumb.height = 80;
    }
    thumb.alt = `Thumbnail for ${post.title}`;
    thumb.className = 'post-thumb';
    thumb.loading = 'lazy';
    thumb.decoding = 'async';

    thumbLink.appendChild(thumb);
    article.appendChild(thumbLink);

    const content = document.createElement('div');
    content.className = 'post-content';

    const titleEl = document.createElement('h2');
    titleEl.className = 'post-title';
    const titleLink = document.createElement('a');
    titleLink.href = href;
    titleLink.textContent = post.title;
    titleEl.appendChild(titleLink);
    content.appendChild(titleEl);

    if (post.description) {
      const summary = document.createElement('p');
      summary.className = 'post-summary';
      summary.textContent = post.description;
      content.appendChild(summary);
    }

    const meta = document.createElement('p');
    meta.className = 'post-meta';
    const parts: string[] = [];
    if (post.category) parts.push(post.category);
    if (post.pubDate) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      parts.push(formatter.format(new Date(post.pubDate)));
    }
    if (post.readingTime) {
      parts.push(`${post.readingTime} min read`);
    }
    meta.textContent = parts.join(' · ');
    content.appendChild(meta);

    article.appendChild(content);
    return article;
  }

  function updateEmptyState(hasResults: boolean, query: string) {
    if (!emptyState) return;
    emptyState.classList.toggle('is-visible', !hasResults && Boolean(query));
  }
}
