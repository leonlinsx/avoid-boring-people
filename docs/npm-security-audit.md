# npm security dependency review

Reviewed October 21, 2026. This change refreshes `package-lock.json` within
existing manifest ranges; it adds no overrides and changes no application code.
Astro remains 7.3.5 and the Vercel adapter remains 11.0.11.

## Audit results

Counts are npm's vulnerable-package counts, including affected parent packages,
not counts of independently exploitable vulnerabilities.

| Audit                               | Before                                | After                        |
| ----------------------------------- | ------------------------------------- | ---------------------------- |
| Production (`npm audit --omit=dev`) | 8 high, 1 moderate (9 total)          | 3 high, 1 moderate (4 total) |
| Full (`npm audit`)                  | 21 high, 6 moderate, 1 low (28 total) | 7 high, 1 moderate (8 total) |

Baseline: `/tmp/abp-prod-audit.json` and `/tmp/abp-full-audit.json` supplied for this
review. Both after audits completed successfully as reports and exited 1 because
findings remain.

The lock refresh used `npm audit fix --package-lock-only --ignore-scripts`, then
`npm update brace-expansion --package-lock-only --ignore-scripts` for the remaining
compatible 2.1.7 patch. The incidental adapter update and its extra dependencies were restored to the
original versions, then `npm install --package-lock-only --ignore-scripts`
regenerated the final lockfile. No force option was used. Patched dependencies include
sharp 0.35.5 (and libvips platform packages), devalue 5.9.4,
http-cache-semantics 4.3.0, source-map-js 1.2.2, Vite 8.3.5, flatted 3.4.4,
minimatch, brace-expansion, picomatch, AJV, postcss-selector-parser, and diff.
TypeScript ESLint moves from 8.44.0 to 8.72.0 and astro-eslint-parser from 1.2.2
to 1.4.0 within their existing ranges. npm also selects gaxios 6.3.0 instead of
6.7.1 under linkinator's `^6.0.0` range, removing its vulnerable uuid dependency;
this is development link-check tooling. Production Google authentication retains
its separate gaxios 7.3.1 copies. No Astro or Vercel downgrade was accepted.

## Remaining exposure

### Vercel route parser: three production high package findings

Chain: `@astrojs/vercel@11.0.11` → `@vercel/routing-utils@6.6.0` →
`path-to-regexp@6.1.0`.
[GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j)
describes expensive backtracking when multiple parameters share a segment, such
as `/:a-:b`; 6.3.0 is patched. routing-utils pins 6.1.0 and installs a patched
6.3.0 alias, but its `dist/superstatic.js` comparison wrapper returns the old
parser's regex. The alias therefore does not eliminate the finding.

The adapter's build hook calls `getTransformedRoutes` to compile configured
redirects and asset headers. Inputs come from `astro.config.mjs` and owned
article metadata through `src/utils/article-routes.ts`. Current redirects are
static legacy paths or a single category parameter per segment. The generated
`.vercel/output/config.json` contains the category regex
`^/writing/category(?:/([^/]+?))$`; the known two-parameter segment trigger was
not found in current configured routes. This is a real vulnerable dependency
whose output can reach production routing, but exploitability of the known
advisory is not demonstrated for this configuration. No deployment was inspected
or changed. npm's suggested adapter downgrade to 8.0.4 is incompatible with this
Astro generation; no override was applied. Registry metadata reports routing-utils
6.6.0 as latest at review time.

### CSV import: one production moderate package finding

`csv-parse@6.2.1` is used by `src/lib/newsletter/importer.ts` for explicit local
Substack import/preflight CLIs. No public request handler calls it.
[GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx)
requires duplicate prototype headers with `group_columns_by_name: true`.
The importer rejects duplicate headers in its `columns` callback and does not
enable grouping. The known trigger is therefore excluded by current options.
The latest 6.x remains 6.2.1; the patched version is 7.0.2 or newer. A major
migration is outside this compatible-update change. Continue treating import
files as operator-supplied data; the installed package remains flagged.

### Development glob parser: four additional high package findings

Chain: `astro-eslint-parser@1.4.0` → `fast-glob@3.3.3` → `micromatch@4.0.8` →
`braces@3.0.3`.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
reports stack exhaustion from deeply nested glob patterns and lists all braces
versions as affected. This chain is development-only. The Astro parser resolves
globs from `parserOptions.project`/`projectFolderIgnoreList`; `eslint.config.js`
does not configure a project glob. No production request input path was found.
npm suggests astro-eslint-parser 3.2.0, a major migration, rather than a compatible
braces patch. No forced parser upgrade or override was applied.

## Validation

- `npm ci`: passed with the final lockfile.
- `npm test`: passed, including import and redirect safeguards.
- `npm run build`: passed, including sharp image optimization and Vercel output.
- `npm run lint`: passed.
- Python suite with the existing project virtual environment: 721 passed.
  Plain `python` was unavailable and system `python3` lacked test dependencies;
  the existing `.venv/bin/python -m pytest tests -q` completed successfully.
- `python3 tests/test_rss_build.py`: passed against the built feed.
- `npm run test:newsletter:browser`: passed, including cross-origin rejection.
- `npm run linkcheck:internal`: passed against the built output.

No real newsletter send, production data mutation, merge, or deployment was run.
These checks establish installation and existing behavior compatibility; the
remaining advisory conditions above are based on source and generated-output
inspection, not a claim that every possible attack has been excluded.
