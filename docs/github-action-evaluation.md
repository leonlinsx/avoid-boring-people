# GitHub Actions coverage for the Astro blog

## Summary

The repository has four workflows, all tied to content publishing. None of
them gate on tests, linting, types, or link checking — those run locally via
`npm test` and `npm run build`. The distribution workflows carry their own
safety properties (dry-run mode, per-platform independence, state written
only after confirmed success).

## Current workflow coverage

| Workflow | Trigger | What it does | Quality signal? |
| --- | --- | --- | --- |
| `social-new.yml` | Push adding `src/content/blog/**/index.md`; manual dispatch (`post_id`, `dry_run`, `platforms`) | Waits for deploy, publishes the article to `DEFAULT_PLATFORMS`, commits `posted.json` | Publish outcome per platform; `FAIL_ON_PUBLISH_ERROR` fails the run on partial failure |
| `social-evergreen.yml` | Schedule Tue/Sat 14:00 UTC; manual dispatch | Republishes one eligible evergreen post, same state handling | Same as above |
| `medium-prep.yml` | Push touching `src/content/blog/**/index.md` | Installs unpinned `requirements.txt` and logs a Medium-ready snippet | None |
| `ping-search-engines.yml` | Push to `main` touching `src/content/blog/**` | Curls Google/Bing sitemap ping endpoints | None |

## Gaps worth knowing

- **No CI test gate.** `tests/run-tests.ts` (`npm test`), the Python distribution suite, and `npm run build` are local-only. A breaking change to a publisher, route, or renderer can merge without any workflow noticing.
- **No lint/type gate.** Formatting, ESLint, and `astro check` are not enforced anywhere.
- **`medium-prep.yml` installs unpinned dependencies** (`requirements.txt` without hashes) while the social workflows use `--require-hashes` lockfiles. A compromised or drifting transitive dependency lands silently there.
- **No link checking.** Internal/external link validation is manual (`npm run linkcheck:internal` / `linkcheck:external` exist as scripts but run nowhere automatically).

## Suggestion (not scheduled)

If CI signal is ever wanted, the smallest useful addition is one workflow that
runs `npm test`, the Python distribution tests, and `npm run build` on pull
requests. Lint, pinned-medium-prep installs, and link checks can follow only
if they prove worth the maintenance.
