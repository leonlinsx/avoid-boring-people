# Automated Quality Coverage for the Astro Blog

## Summary
- None of the existing GitHub Actions workflows cover linting, formatting, dependency hygiene, link checking, or automated pull requests for fixes.
- The repository currently fails both `astro check` and ESLint, so any new quality automation must surface those issues and, when run in fix mode, attempt to resolve what it can automatically.
- A new `Quality upkeep` workflow adds targeted jobs for linting, formatting, dependency refreshes, and internal/external link validation while opening a pull request with any changes it makes.

## Current workflow coverage
| Workflow | Purpose | Quality signal provided? |
| --- | --- | --- |
| `autopost.yml` | Schedules social posts and updates `posted.json`. | No linting, formatting, dependency, or link checks.【F:.github/workflows/autopost.yml†L1-L54】 |
| `medium-prep.yml` | Generates Medium-ready summaries for new blog posts. | No quality checks; only runs a Python script.【F:.github/workflows/medium-prep.yml†L1-L27】 |
| `ping-search-engines.yml` | Notifies Google and Bing when posts change. | No quality checks; only fires `curl` requests.【F:.github/workflows/ping-search-engines.yml†L1-L15】 |

Because these workflows never touch the JavaScript/TypeScript/Astro toolchain, the project lacks continuous signals for linting, formatting, dependency drift, and broken links.

## Existing failures the workflow must catch
- `npx astro check` currently reports multiple type errors in `BaseHead.astro`, `BlogPost.astro`, `text.ts`, and related files.【34adfa†L1-L15】【34adfa†L16-L24】
- `npx eslint . --ext .js,.jsx,.ts,.tsx,.astro` surfaces 95 problems across automation scripts, Astro components, API routes, and tests, including Prettier formatting violations and missing type annotations.【e9bad7†L1-L101】

These failures demonstrate why a dedicated quality workflow is necessary: without it, regressions can land unnoticed.

## Recommended workflow: `quality-upkeep.yml`
The new workflow introduces two operating modes so that it can both gate pull requests and automatically apply fixes on a schedule.【F:.github/workflows/quality-upkeep.yml†L1-L92】 Key behaviors include:

- **Pull request runs** execute `astro check`, ESLint (no `--fix`), Prettier `--check`, and full link validation to block regressions before merge.【F:.github/workflows/quality-upkeep.yml†L16-L66】
- **Scheduled/manual runs** add ESLint/Prettier auto-fix passes, refresh npm dependencies to the latest minor/patch releases with `npm-check-updates`, and, if changes are produced, open an automated pull request via `peter-evans/create-pull-request`.【F:.github/workflows/quality-upkeep.yml†L28-L92】
- **Link checking** builds the Astro site, launches `astro preview`, waits for it to come online, and runs `linkinator` twice—first for internal-only links, then for external links using the repository’s existing `.linkinatorrc.json` configuration.【F:.github/workflows/quality-upkeep.yml†L44-L76】【F:.linkinatorrc.json†L1-L15】

This workflow gives the blog project end-to-end coverage for linting, formatting, dependency updates, link validation, and automated remediation pull requests while respecting Astro’s tooling and folder structure.

## Adoption tips
- The scheduled cron (`0 9 * * 1`) runs every Monday at 09:00 UTC; adjust as needed to match your desired cadence.
- Both `astro check` and ESLint currently fail, so the first few runs will surface existing debt. Use the automated pull requests as a starting point for repairs, then iterate until the workflow succeeds cleanly.
- For PR runs, failures surface directly in the GitHub UI without mutating developer branches, keeping the contributor experience predictable.
