import { initSearchPage } from './search-page';

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const start = () => {
    initSearchPage();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
