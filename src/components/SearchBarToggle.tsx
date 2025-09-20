import { useState, useEffect, useRef } from 'preact/hooks';

export default function SearchBarToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Esc
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <div class={`mobile-search ${isOpen ? 'is-open' : ''}`} ref={wrapperRef}>
      {!isOpen && (
        <button
          type="button"
          class="search-toggle"
          aria-label="Open search"
          onClick={() => setIsOpen(true)}
        >
          🔍
        </button>
      )}

      {isOpen && (
        <form
          class="search-bar-mobile"
          role="search"
          method="get"
          action="/writing/search"
        >
          <input
            type="search"
            name="q"
            class="search-input"
            placeholder=""
            autoComplete="off"
            autoFocus
          />
          <button type="submit" class="search-btn" aria-label="Search">
            🔍
          </button>
        </form>
      )}
    </div>
  );
}
