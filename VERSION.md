



# 2025-09-17

## ✅ Completed Refactors

### 1. BaseHead.astro
- Replaced string concatenations with `URL` constructor for canonical + OG image resolution.
- Simplified sitemap/RSS links with `new URL()` for safer path handling.

### 2. Footer.astro
- Removed hardcoded colors (`#000`, `#555`, `#eee`).
- Updated to use theme variables (`var(--color-text)`, `var(--color-border)`, etc.).
- Now fully theme-aware for light/dark mode.

### 3. FormattedDate.astro
- Props now accept both `string | Date`.
- Added optional `format` and `locale` props.
- Normalizes dates internally and keeps display consistent across site.

### 4. Header.astro + HeaderLink.astro + BaseLayout.astro
- Unified active link logic using `<HeaderLink />`.
- Extracted route logic into `BaseLayout` → passed `currentPath` down as prop.
- Cleaned up theme styling (consistent use of `var(--color-*)`).
- `HeaderLink` refactored with fallback `Astro.url` and robust active detection.

### 5. Pagination.astro
- Replaced string interpolation with `class:list` for active state.
- Cleaner and consistent with other components.

### 6. PostCard.astro
- Replaced inline `toLocaleDateString` with `<FormattedDate />`.
- Cleaner `post-meta` rendering for category · date · read-time.
- Safer handling of missing post data (fallback title/desc).

### 7. PostList.astro
- Added `variant` prop (`list` | `grid`) for flexible layouts.
- Scoped styles updated to use spacing tokens (`var(--space-*)`).

### 8. SearchBar.astro
- Extracted shared search form into its own component.
- Added optional `id` prop (Fuse.js targeting only when needed).
- Added `variant` prop (`compact` vs `full`).
- Now reused in both `/writing` (desktop/mobile search) and `/writing/search` (full-width search page).

### 9. WritingHeader.astro + search.astro
- Both now consume `<SearchBar />` instead of duplicating markup.
- Search page styling fixed: full-width pill box restored while `/writing` uses compact width.
- Avoids duplicate IDs by scoping `client-search-input` only on search page.

---

## 🔧 Deferred / Optional Refactors
(Identified but not needed right now)

- Props typing consistency (adding `interface Props {}` everywhere).
- Moving inline styles into CSS modules or global tokens.
- Extracting nav/footer links into a config file.
- Filters.astro cleanup (separating category logic from rendering).
- Adding Playwright smoke tests for key routes.

---

## ✅ Current State
The project is structurally consistent, theme-aware, and avoids duplicated markup/styling.  

## ⚡ Next Steps (Optional)
Only if you feel pain later — props typing sweep, style consolidation, or config extraction.
