# 2025-09-22

## Automation updates

### Medium Prep

- Whenever you push a new blog post to src/content/blog/**/index.md,
GitHub Actions runs medium_prep.py and outputs a ready-to-paste Medium snippet in the logs.
- Use medium.com/p/import to cross-post with the canonical link set to leonlins.com.

### publish0x
- tried setting up but ran into cookies issues, dropping for now

## comments
- added comments with giscus

# 2025-09-21

## 🚀 Automation Updates (Twitter + Bluesky)

### Enhancements
- Added **Bluesky publisher** (`publishers/bluesky.py`) with support for single posts and threaded replies.
- Updated **`auto_post.py`** to support multi-platform posting:
  - `PLATFORM=twitter,bluesky` now posts the same content to both platforms in one run.
  - Non-blocking logging per platform (`✅ success` / `❌ failure`) so one failure doesn’t stop others.
- Added **GitHub Actions summary logging**:
  - Results (`✅` or `❌`) for each platform are written to `$GITHUB_STEP_SUMMARY`.
  - Visible at the top of the Actions run page, no need to scroll logs.

### Mastodon Autopost Integration
- Added `mastodon.py` publisher with `post_single_to_mastodon` and `post_thread_to_mastodon`.
- Updated `auto_post.py`:
  - Loads `.env` automatically with `dotenv`.
  - Supports multiple platforms via comma-separated `PLATFORM` env var (e.g. `twitter,mastodon`).
  - Added Mastodon dispatch block with dry-run support.
- Fixed 401 error by generating proper Mastodon **Access Token** with `write:statuses` scope.
- Cleaned up debug prints in `mastodon.py`; now logs only successful authentication and post URLs.


### Configuration
- Adjusted `autopost.yml`:
  - Use `PLATFORM=twitter,bluesky` for cross-posting.
  - Added Bluesky secrets
- added post.json to gitignore to prevent future merge conflicts

### Testing & Reliability
- Confirmed dry-run and live posting paths work for both Twitter and Bluesky.
- Thread reply handling fixed on Bluesky (using proper `ReplyRef`).
- Clearer logs for debugging partial failures across platforms.

## Social
- heatmap vis analytics js embed support



# 2025-09-20

## Formatting Bug fixes

### Related Posts & PostList
- Refactored `PostList.astro` to support a `compact` variant for Related Posts.  
- Moved overrides for spacing, title, summary, and meta into the compact variant (instead of `BlogPost.astro`).  
- Fixed divider → next card spacing by restoring controlled `padding-bottom` + `margin-bottom` on `.post-card`.  
- Cleaned up `BlogPost.astro` so Related Posts wrapper only handles the section divider + heading; all card-level spacing lives in `PostList.astro`.

### Search Bar
- Fixed misaligned 🔍 icon in the search bar when resizing:  
  - Removed conflicting vertical padding in `.search-bar-desktop`.  
  - Let `.search-input` control the container height with balanced padding.  
  - Updated `.search-btn` to `height: 100%` + `aspect-ratio: 1` so it stays square and vertically centered. 

### Headings / TOC
- Replaced custom `Heading` type with Astro’s built-in `MarkdownHeading[]` across:
  - `[slug].astro`
  - `BlogPost.astro`
  - `TableOfContents.astro`
- Removed unnecessary mapping (`depth → level`, `slug → id`).
- Fixed prop typing in `TableOfContents.astro` using a `Props` type (`headings?: MarkdownHeading[]`) to avoid missing property warnings.

### Hero Image Typing
- Updated `BlogPost` type to use Astro’s `ImageMetadata` for `heroImage` instead of `{ src: string; width: number; height: number; format: string }`.
- Fixed `normalizeHeroImage` to return `ImageMetadata | undefined` and cast properly, eliminating type mismatches on `format`.

### Package.json
- Added a proper `"name"` field (`"leonlins-blog"`) instead of leaving it empty, improving clarity and avoiding npm/tooling warnings.

### SubscribeForm
- Removed invalid `rel="noopener"` attribute from `<form>`.  
  - `rel` is not valid on forms (only `<a>` / `<link>`).  
  - Security impact is covered by `target="_blank"` on forms by default.

### PostList
- Removed unnecessary `key={post.id}` prop when mapping over posts in `PostList.astro`.  
  - Astro doesn’t use React’s diffing model, so `key` is not a valid prop.  
  - This eliminated the TS error: `Property 'key' does not exist on type 'IntrinsicAttributes & Props'` 

### Linting & Code Quality
- Fixed ESLint/Prettier integration:
  - Migrated to `eslint.config.js` (flat config).
  - Added Prettier plugin support with `plugin:prettier/recommended`.
  - Configured `globals.browser` for browser APIs (document, window, etc.).
- Resolved lint errors:
  - Cleaned up structured data script in `BaseHead.astro`.
  - Added type-safe handling for Astro image metadata.
  - Removed unused variables and standardized single quotes.
  - Suppressed false positives for `gtag`, `Response`, `fetch`, etc.

### Link Checking
- Integrated **Linkinator** with custom `link-report.js`:
  - Generates `dist/link-report.html` summarizing broken links.
  - Added timeout handling and flexible modes (`internal` vs `external`).
  - Configurable via `.linkinatorrc.json` for whitelist/skip rules.
- First full run found broken image paths (`heroImage` relative imports) that were due to dev env and some 403 external links.

## 🚀 Performance Improvements Changes
- **Optimized Largest Contentful Paint (LCP)**
  - Removed duplicate `<link rel="preload">` for banner image.
  - Added `fetchpriority="high"` + explicit `width`/`height` to `<img>` to prevent CLS.
  - Identified `<h1>` as the true LCP element on mobile and optimized font loading.

- **Improved Font Loading**
  - Added `@font-face` for Atkinson font with `woff2` + `woff` fallback.
  - Configured `font-display: swap` to render text immediately.
  - Added `<link rel="preload">` for `atkinson-regular.woff2` in `BaseHead.astro`.

- **Confirmed Text Compression**
  - Verified Brotli (`content-encoding: br`) is active in production.
  - No further action needed for gzip/Brotli.

- **JavaScript Optimization Prep**
  - Traced `lucide-astro` imports (icons) to ensure no global imports.
  - Next step: switch to per-icon imports or inline SVGs to cut bundle size (~271 KB in dev).

- **📊 Expected Impact**
  - Faster LCP and FCP on mobile (2–2.5s vs 3.6–4.0s).
  - Reduced font render delay (no blank text before Atkinson loads).
  - Compression confirmed → smaller network payloads for real users.
  - Clear path to reduce JS bundle size and main-thread work.

## Automated posting

- **Core scripts added** under `scripts/automation/`:
  - `fetch_post.py` → fetch posts from RSS/search index  
  - `state_manager.py` → track and rotate posts via `posted.json`  
  - `auto_post.py` → main driver with support for:
    - `POST_MODE=single|thread`
    - `THREAD_MODE=bullets|narrative`
    - `USE_LLM=true|false`
    - `DRY_RUN=true|false`

- **Thread formatter**  
  - First tweet = title + teaser + link  
  - Follow-ups = bullet or narrative summary  

- **Summarizers**  
  - `llm_summarizer.py`: integrated DeepSeek API, robust JSON parsing, fallback to stub  
  - `summarizer_stub.py`: upgraded to TextRank (Sumy + NLTK), smart truncation (≤200 chars), content cleaner  

- **Secrets & config**  
  - `.env` locally, GitHub Secrets for API keys (Twitter + DeepSeek)  

- **GitHub Actions**  
  - Workflow `.github/workflows/autopost.yml` created  
  - Runs daily at 14:00 UTC ±30min jitter  
  - Installs from `requirements.txt`  
  - Commits `posted.json` back to `main` to persist state  
  - Successfully tested in dry-run mode  

- **Flipped `DRY_RUN: 'false'` in `autopost.yml` to enable live posting**

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
