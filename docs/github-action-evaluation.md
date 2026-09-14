# GitHub Actions coverage for the Astro blog

## Summary

The repository has six workflows. Five are tied to content publishing and one
gates code changes: `ci.yml` runs the existing local suites (`npm test`, the
Python distribution tests, `npm run build`) on pushes to `main` and on pull
requests, so the distribution state machine and the newsletter send guards are
no longer verified only by hand. The distribution workflows carry their own
safety properties (dry-run mode, per-platform independence, state written only
after confirmed success, a bounded deploy wait before the first publish).

## Current workflow coverage

| Workflow | Trigger | What it does | Quality signal? |
| --- | --- | --- | --- |
| `ci.yml` | Push to `main`, pull request, manual dispatch | Runs `npm test`, `python -m pytest tests -q`, `npm run build` plus internal linkcheck, and `npm run lint` in four independent jobs | Fails the run on any test, build, link, or lint failure; no secrets needed |
| `social-new.yml` | Push adding `src/content/blog/**/index.md`; manual dispatch (`post_id`, `dry_run`, `platforms`) | Waits for the new article to appear in the deployed search index and respond `200`, then publishes it to `DEFAULT_PLATFORMS` and commits `posted.json` | Publish outcome per platform; a deploy that never lands fails the wait with a `::error::` annotation instead of publishing from a stale index; `FAIL_ON_PUBLISH_ERROR` fails the run on partial failure |
| `social-evergreen.yml` | Schedule Tue/Sat 14:00 UTC; manual dispatch | Republishes one eligible evergreen post, same state handling | Same as above |
| `medium-prep.yml` | Push touching `src/content/blog/**`; manual dispatch (`post_id`) | Renders one Medium-ready HTML draft per newly added or modified article and uploads it as an artifact | Upload fails the job when no file is produced (`if-no-files-found: error`); the job summary lists the drafts |
| `indexnow.yml` | Push to `main` touching `src/content/blog/**`; manual dispatch (`post_id`) | Submits changed article URLs to IndexNow after verifying the deployed key file | A rejected submission or a missing key file fails the run; Google has no replacement endpoint and relies on the sitemap plus Search Console |
| `token-health.yml` | Daily 08:00 UTC; manual dispatch | Probes the Threads and Instagram long-lived tokens with a read-only request | Fails with rotation instructions when a stored token is rejected; a platform whose secrets are unset is reported as skipped |

## Gaps worth knowing

- **No `astro check` gate.** ESLint (`npm run lint`) and the internal linkcheck (as a post-build step) are enforced; `astro check` is not, because it reports pre-existing type friction in site components and the test harness's mocked `astro:content` module, and fixing those is unrelated churn.
- **No external link checking.** Internal validation runs in CI; external (`npm run linkcheck:external`) stays manual because remote hosts routinely 403 automated checks.
- **No deploy verification for the other push consumers.** `social-new.yml` waits for the deployment; `indexnow.yml` and `medium-prep.yml` do not, and neither publishes from the deployed index, so they are not exposed to the race.
- **Token coverage is Meta-only.** Only the Threads and Instagram long-lived tokens expire on a schedule and can be probed with a read-only request; the remaining credentials do not lapse on a calendar, and reading a Meta token's remaining lifetime would require an app access token the repository does not store.

## Verification

`ci.yml` was validated against intentionally broken guards before it was added:
disabling the `should_publish_new` dedupe in `scripts/automation/state_manager.py`
and the recipient-count check in `assertRecipientScope` makes
`python -m pytest tests -q` fail three state tests and `npm test` fail the
production-send safeguard case (exit code 1) with the unmodified commands the
workflow runs. Restoring both files returns both suites to green.

All six workflow files parse cleanly under `actionlint` 1.7.7 (its `shellcheck`
and `pyflakes` integrations were unavailable locally, so `run:` scripts were
checked by executing them rather than by shell linting). GitHub Actions itself
has not been exercised for these workflows: nothing has been pushed, and the
scripts were validated by running them directly.

The newer gates were red-tested the same way before being enforced: a
whitespace breakage makes `npm run lint` exit 1, and an injected broken
internal link makes `npm run linkcheck:internal` exit 1 naming the URL;
both return to green once reverted. The linkcheck caught a real production
404 on its first full-site run (the article breadcrumb linked `/writing/`,
which has no trailing-slash redirect), fixed by pointing the breadcrumb at
the canonical `/writing/1`.
