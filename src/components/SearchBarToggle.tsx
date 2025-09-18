import { useState, useEffect, useRef } from "preact/hooks";

export default function SearchBarToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Esc
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    // IMPORTANT: we toggle a class on the wrapper so CSS can move the bar to a new line
    <div class={`mobile-search ${isOpen ? "is-open" : ""}`} ref={wrapperRef}>
      {/* Icon (hidden when open) */}
      <button
        type="button"
        class="search-toggle"
        aria-label="Open search"
        onClick={() => setIsOpen(true)}
        hidden={isOpen}
      >
        🔍
      </button>

      {/* Bar (always in DOM; only shown when wrapper has .is-open) */}
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
          placeholder="Search…"
          autoComplete="off"
          autoFocus={isOpen}
        />
        <button type="submit" class="search-btn" aria-label="Search">🔍</button>
      </form>
    </div>
  );
}
