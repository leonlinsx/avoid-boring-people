# Astro Personal Blog — Comprehensive Code Review

## 1. Restore the self-hosted font pipeline
- **File/Location**: `src/styles/global.css` lines 78-87; `src/components/BaseHead.astro` lines 143-150; `public/fonts/`
- **Issue Type**: Performance, Code Quality
- **Severity**: High
- **Impact**: The CSS references a non-existent `atkinson-regular.woff2`, and the `<link rel="preload">` advertises the remaining `.woff` file as `font/woff2`. Browsers attempt to download the missing asset (404) and then re-request the `.woff` with a mismatched MIME type, delaying font display and wasting bandwidth.
- **Description**: The `@font-face` definition expects a `.woff2` that is not present in `public/fonts`, while the preload tag declares the `.woff` file with the wrong MIME. This breaks the intended fast font loading path and causes unnecessary network errors.
- **Recommendation**: Either add the optimized `.woff2` asset or update both the `@font-face` and preload tag to match the actual files and MIME types.
- **Code Example**:
  ```astro
  /* src/styles/global.css */
  @font-face {
    font-family: 'Atkinson';
    src: url('/fonts/atkinson-regular.woff') format('woff');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  ```
  ```astro
  <!-- src/components/BaseHead.astro -->
  <link
    rel="preload"
    href="/fonts/atkinson-regular.woff"
    as="font"
    type="font/woff"
    crossorigin
  />
  ```
- **Tools**: Use the browser DevTools network panel or Lighthouse to confirm the font request succeeds without 404s.

## 2. Avoid render-blocking Google Fonts import
- **File/Location**: `src/styles/global.css` line 6
- **Issue Type**: Performance
- **Severity**: Medium
- **Impact**: `@import`ing Google Fonts inside CSS blocks page rendering until the font stylesheet downloads, slowing FCP/LCP, especially on mobile.
- **Description**: The top-level `@import` pulls Google Fonts synchronously. Astro already allows managing fonts via `<link rel="preload">` / `<link rel="stylesheet">` in the head for better control.
- **Recommendation**: Move the Google Font request into `BaseHead` using `<link rel="preconnect">` and a deferred stylesheet, or self-host the Merriweather font to keep everything on the same CDN as the rest of the site.
- **Code Example**:
  ```astro
  <!-- BaseHead.astro -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;600;700&display=swap"
    media="print"
    onload="this.media='all'"
  />
  ```
- **Tools**: Run Lighthouse or PageSpeed Insights and compare render-blocking resources before/after.

## 3. Fix slug fallback in the public search index API
- **File/Location**: `src/pages/api/search-index.json.ts` lines 7-17
- **Issue Type**: Code Quality, SEO
- **Severity**: Medium
- **Impact**: When a post lacks `post.slug`, the fallback only strips `.md`, leaving `.mdx` extensions in URLs. Links built from this API can 404 and harm discoverability.
- **Description**: `post.id.replace(/\.md$/, '')` fails for `.mdx`. The API feeds client-side search; malformed URLs here break search results and any consumer of the JSON feed.
- **Recommendation**: Normalize with a regex covering both `.md` and `.mdx`, or reuse `getCleanSlug` to ensure consistency.
- **Code Example**:
  ```ts
  const index = posts.map((post) => ({
    slug: post.slug ?? post.id.replace(/\.(md|mdx)$/, ''),
    // ...
  }));
  ```
- **Tools**: Unit-test the API with fixtures containing `.mdx` posts; use automated link checkers to verify search URLs.

## 4. Remove redirect hops from pagination links
- **File/Location**: `src/components/Pagination.astro` lines 10-89
- **Issue Type**: Performance, SEO
- **Severity**: Medium
- **Impact**: Page 1 links point to `/writing`, which immediately 308-redirects to `/writing/1`. This adds latency, wastes crawl budget, and can confuse analytics.
- **Description**: The `pageHref` helper intentionally links to `/writing`, relying on Astro config redirects. Users and bots pay an extra round trip.
- **Recommendation**: Link directly to the canonical destination (`/writing/1` and `/writing/category/<slug>/1`) so no redirect fires.
- **Code Example**:
  ```ts
  return page === 1
    ? `/writing/1`
    : `/writing/${page}`;
  ```
- **Tools**: Crawl with `linkinator` or Lighthouse to confirm redirects disappear.

## 5. Bundle Fuse.js instead of blocking on a CDN script
- **File/Location**: `src/pages/writing/search.astro` lines 49-107
- **Issue Type**: Performance, Privacy
- **Severity**: High
- **Impact**: The blocking `<script src="https://cdn.jsdelivr.net/.../fuse.min.js">` stalls HTML parsing, exposes readers to a third-party CDN, and ships Fuse despite already depending on it in `package.json`.
- **Description**: Because the script lacks `defer`, the browser pauses rendering until Fuse downloads. This hurts FCP and adds an extra DNS/TLS handshake on mobile.
- **Recommendation**: Import Fuse from the local dependency graph (`import Fuse from 'fuse.js'`) and let Astro bundle it, or at least load the CDN script with `defer`/`async`.
- **Code Example**:
  ```astro
  ---
  import Fuse from 'fuse.js';
  const fuse = new Fuse(postsData, {/* ... */});
  ---
  ```
- **Tools**: Lighthouse and WebPageTest to quantify main-thread blocking, plus browser devtools coverage to ensure Fuse ships once.

## 6. Render fewer nodes on initial search results
- **File/Location**: `src/pages/writing/search.astro` lines 35-46
- **Issue Type**: Performance
- **Severity**: Medium
- **Impact**: The page renders every post and hides non-matching ones with `display: none`. For large archives this balloons HTML size, slows hydration, and increases CLS risk when elements pop in/out.
- **Description**: Even when a query is present, hidden `PostCard` components stay in the DOM. Server-side filtering already produced `filteredPosts`; duplicating the full list adds overhead without benefit.
- **Recommendation**: Only render `filteredPosts` on the server, and let client-side Fuse progressively enhance results.
- **Code Example**:
  ```astro
  <div id="post-list">
    {(q ? filteredPosts : posts).map((post) => (
      <PostCard post={post} />
    ))}
  </div>
  ```
- **Tools**: Use Chrome DevTools performance panel to measure DOM node count and HTML payload size.

## 7. Ensure the search page stays deployable on static hosting
- **File/Location**: `src/pages/writing/search.astro` lines 10-12
- **Issue Type**: Build/Deployment
- **Severity**: High (if deploying statically)
- **Impact**: Accessing `Astro.request.url` opts the route into server output. Without setting `export const prerender = false` or using an SSR adapter, static builds will fail or misbehave when deployed to CDN-only hosts.
- **Description**: The page reads from the request object to parse the querystring. For a static Astro blog, this either breaks `astro build` or forces dynamic rendering.
- **Recommendation**: Mark the page as `prerender = false` and plan for SSR deployment, or refactor to read the query entirely on the client (e.g., via `Astro.url` at build time plus runtime JS).
- **Code Example**:
  ```astro
  ---
  export const prerender = false;
  const url = new URL(Astro.request.url);
  // ...
  ---
  ```
- **Tools**: Run `astro build` targeting static output to ensure the route either builds or is intentionally excluded.

## 8. Reduce hydration by replacing the mobile search toggle
- **File/Location**: `src/components/SearchBarToggle.tsx`; `src/components/WritingHeader.astro` line 19
- **Issue Type**: Performance
- **Severity**: Medium
- **Impact**: Shipping a hydrated Preact island (`client:load`) just to toggle a search form adds ~30 kB of JS and hydration cost on every archive page.
- **Description**: The component only needs to show/hide a form. Hydrating Preact for this is overkill compared to a lightweight `<details>`/`<dialog>` or a tiny inline script.
- **Recommendation**: Replace the Preact island with native HTML disclosure + CSS, or a minimal inline script using `is:inline`.
- **Code Example**:
  ```astro
  <details class="mobile-search">
    <summary aria-controls="search-mobile">🔍 Search</summary>
    <form id="search-mobile" role="search" action="/writing/search">
      <!-- inputs -->
    </form>
  </details>
  ```
- **Tools**: Measure bundle sizes with `npm run build` and inspect `dist/stats.html` (Rollup visualizer) to confirm Preact drops from the archive route.

## 9. Improve TOC accessibility and motion respect
- **File/Location**: `src/components/TableOfContents.astro` lines 15-299
- **Issue Type**: Accessibility
- **Severity**: Medium
- **Impact**: The TOC toggle lacks `aria-expanded`/`aria-controls`, the decorative bars aren’t marked as such, and smooth scrolling ignores users’ `prefers-reduced-motion` setting—potentially disorienting keyboard and motion-sensitive users.
- **Description**: The mobile “Contents” button provides no state to assistive tech, and the script always requests smooth scrolling.
- **Recommendation**: Add ARIA attributes, hide decorative segments with `aria-hidden`, and gate smooth scrolling behind a media query check.
- **Code Example**:
  ```astro
  <button
    id="toc-toggle"
    class="toc-button"
    aria-expanded={drawerOpen}
    aria-controls="toc-drawer"
  >☰ Contents</button>
  ```
  ```js
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (target) {
    target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }
  ```
- **Tools**: Test with aXe/WAVE and with macOS/Windows reduced-motion settings enabled.

## 10. Make the share dropdown screen-reader friendly
- **File/Location**: `src/components/ShareButtons.astro` lines 58-133
- **Issue Type**: Accessibility
- **Severity**: Medium
- **Impact**: The mobile “Share” button doesn’t expose its expanded state or relationship to the menu, so screen-reader users can’t tell whether options are available.
- **Description**: There’s no `aria-haspopup`, `aria-expanded`, or `aria-controls`, and focus isn’t managed when the menu opens/closes.
- **Recommendation**: Add standard ARIA attributes, focus the first link on open, and close the menu on `Escape`.
- **Code Example**:
  ```astro
  <button
    type="button"
    class="dropdown-toggle"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    aria-controls="share-menu"
  >
    <Share2 class="icon" /> Share
  </button>
  <div id="share-menu" role="menu" hidden={!isOpen}>
    <!-- links -->
  </div>
  ```
- **Tools**: Use NVDA/VoiceOver and keyboard-only testing to validate the menu behaviour.

## 11. Trim the public JSON search index
- **File/Location**: `src/pages/search-index.json.ts` lines 9-17
- **Issue Type**: Performance, Security
- **Severity**: Medium
- **Impact**: Exposing full `post.body` in a single JSON endpoint creates a large payload (~entire blog) and makes scraping effortless. It slows clients that rely on it and increases bandwidth costs.
- **Description**: The endpoint returns raw markdown for every post. For on-site search you only need small excerpts.
- **Recommendation**: Limit the payload to title, URL, summary, and metadata, or paginate/compress the content. If full text is required, add HTTP caching headers.
- **Code Example**:
  ```ts
  const index = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    url: `/writing/${getCleanSlug(post)}/`,
    excerpt: post.data.description ?? post.body.slice(0, 160),
  }));
  ```
- **Tools**: Inspect the network payload in DevTools or run `curl` to confirm the response shrinks.

## 12. Announce the active navigation link
- **File/Location**: `src/components/HeaderLink.astro` lines 10-31
- **Issue Type**: Accessibility
- **Severity**: Low
- **Impact**: The header visually highlights the active section but doesn’t expose `aria-current`, so screen-reader users can’t tell which section they’re in.
- **Description**: `HeaderLink` sets a CSS class when active but doesn’t set any ARIA state.
- **Recommendation**: Add `aria-current="page"` when the link matches the current route.
- **Code Example**:
  ```astro
  <a
    href={href}
    aria-current={isActive ? 'page' : undefined}
    class:list={[className, { active: isActive }]}
    {...props}
  >
    <slot />
  </a>
  ```
- **Tools**: Use VoiceOver/NVDA to verify the active link is announced correctly.

