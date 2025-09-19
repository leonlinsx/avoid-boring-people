

# 2025-09-18

## Table of Contents
- Added a **desktop TOC** styled like Substack/Notion:
  - Collapsed mini-bar on the right, expands on hover.
  - Scroll spy highlights active section.
  - Smooth scrolling to headings.
- Mobile TOC:
  - Floating button (`☰ Contents`) bottom-left.
  - Expands into a drawer with backdrop overlay.
  - Clicking outside or on a link closes it.
- Fixed bug with headings starting with numbers (`1. Heading`):
  - Switched to `getElementById` to handle numeric-start IDs.
  - Scroll spy now correctly activates these headings.

## BlogPost Layout
- Unified newsletter CTA styling:
  - Blog posts now use the same `.signup` structure as the index page.
  - Removed inline iframe styles; rely on shared `.signup-box`.
- Related posts:
  - Refactored to reuse `<PostList>` for consistent alignment and styling.
  - Adjusted CSS so related posts are left-aligned and match index layout.

## Pagination
- Improved pagination ellipsis (`…`) styling:
  - Made ellipsis center-aligned with pagination buttons. 
  - Couldnt figure out how to get bottom aligned, but center looks good
  - Styled as “ghost button” (no border/hover, faint text).
  - Ensures consistent visual alignment across numbers, next/prev buttons, and ellipses.

## Tooltip (Banner Easter Egg)
- Refactored tooltip design:
  - Appears **above the banner** (no extra spacing below).
  - Muted caption-style text, not a popup box.
  - Fades in after a short hover delay (3s).
  - Fades out immediately when hover ends.
- Removed old global tooltip styles (`visibility`, `box-shadow`, arrow).
- Kept a **mobile override**: tooltip hidden on screens ≤600px (since no hover on mobile).

---

## Summary
Today’s refactoring focused on **polish and consistency**:
- Clean, modular Table of Contents for desktop and mobile.
- Unified newsletter signup styling.
- Consistent alignment of related posts and pagination UI.
- Subtle Easter egg tooltip above the banner without breaking layout.
- Removed redundant global styles to keep CSS lean.

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
