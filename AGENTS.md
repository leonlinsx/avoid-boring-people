# Repository guide

## Project purpose

`leonlins.com` is Leon Lin's personal website and publishing platform, published under the **Avoid Boring People** identity. It is primarily a static Astro site whose writing is authored in Markdown/MDX. The planned newsletter creates an owned distribution channel with Neon Postgres and Amazon SES, without becoming a general-purpose newsletter SaaS.

## Product priorities

1. Preserve reliable publishing and site behavior.
2. Protect subscriber consent and sending reputation.
3. Prevent duplicate or accidental production sends.
4. Keep the author workflow simple.
5. Keep infrastructure understandable and portable.
6. Maintain low operating cost.
7. Preserve good site performance and SEO.

## Non-goals

- Do not turn this into a generalized newsletter SaaS, WYSIWYG CMS, analytics suite, or marketing platform.
- Do not add segmentation, A/B testing, referrals, paid memberships, or automation unless explicitly requested.
- Do not add dashboards, distributed infrastructure, queues, Redis, Kafka, worker fleets, microservices, or provider abstractions for hypothetical scale.
- Do not automate production newsletter sends from CI, Vercel deploys, builds, or deployment hooks.

## Current architecture

- Astro 5 static site, configured in `astro.config.mjs`; content schema is in `src/content/config.ts`.
- Article source is `src/content/blog`; `/writing/[slug]` renders articles through `src/layouts/BlogPost.astro`, and `/writing/[page]` provides pagination.
- Shared UI includes `src/components/SubscribeForm.astro`; the home page and article layout use it.
- The current production signup remains Substack: the form posts to `https://avoidboringpeople.substack.com/api/v1/free`, and `src/pages/api/subscribe.ts` proxies that same integration. `/newsletter` redirects to `/#subscribe`.
- Search, RSS, sitemap, and static publishing are already implemented. Phases 1–3 added the Vercel adapter, Neon schema, isolated `/api/newsletter/*` lifecycle routes, constrained email rendering, authenticated SES/SNS event ingestion, and guarded local-only campaign tooling, while normal site pages remain static. Phase 4 adds first-touch signup attribution and a read-only local analytics report. No current UI routes to the owned signup endpoints, confirmation delivery is disabled by default, and no production campaign can send without explicit local confirmation and exact recipient counts. Failures surface as a single `newsletter_alert` log line (`src/lib/newsletter/alerting.ts`) plus a weekly `newsletter-health` workflow that runs the analytics `--check` and fails loudly, rather than through any monitoring service.
- The target newsletter architecture is Neon managed Postgres, short Vercel/Astro on-demand endpoints under `/api/newsletter/*`, Amazon SES, and an explicitly run local sender CLI.
- Newsletter acquisition is first-party and inert until cutover: `src/lib/newsletter/attribution.ts` captures first-touch evidence in browser storage and normalizes it, distribution links get canonical `utm_*` tags, and the owned signup route would store the normalized source on the subscriber row alongside the raw `utm_*` tags, landing path, and referrer domain. The live Substack form stores none of it. `src/lib/newsletter/analytics.ts` reads the existing tables and renders a deterministic report; no third-party analytics, no dashboards, and no open/click tracking.
- Article discussion is first-party: one `comments` table, on-demand `/api/comments/*` routes, a hydrated discussion island under statically generated articles, and a local-only moderation/author CLI in `scripts/comments/`. It replaced Giscus, so no third-party commenting script or iframe remains.
- Lin Scout (`scripts/scout/`, `docs/scout.md`) is a separate internal discovery tool: it reads the distribution job's `search-index.json`, searches Hacker News and Bluesky, deterministically gates candidates, asks the existing summarizer's provider for one verdict per survivor, and reports at most a handful of opportunities with a drafted reply in the workflow step summary. It has no publisher and no database; its only state is the committed `scout-state.json`, and `.github/workflows/scout.yml` runs it daily.

## Important invariants

- `/writing` is the canonical article archive and Markdown/MDX is the canonical content source.
- Production email requires an explicit human local-CLI action. `npm install`, tests, builds, pushes, CI, and Vercel deploys must never send it.
- A recipient must never receive a campaign twice after a retry or resume; scheduled/runtime work must be safe to retry.
- Imports and automated processing must never reactivate `unsubscribed`, `bounced`, or `complained` subscribers. Substack cancellation rows remain suppressed. Resubscription is explicit and confirmation-only: a signup request on an `unsubscribed` row issues a fresh token and leaves the row suppressed until that token is confirmed, while `bounced` and `complained` rows are never reopened and automated processing never changes their status.
- Missing email-rendering support must fail visibly rather than generate broken mail.
- SES/SNS event ingestion must authenticate messages before changing subscriber state.
- Failures must be observable without new monitoring infrastructure: each failure emits one greppable `newsletter_alert` log line (`signup_pipeline_failure`, `ses_event_ingestion_failure`, or `analytics_job_failure`) carrying only a reason and an error name, and the scheduled analytics job reports itself through a non-zero exit.
- Signup attribution must stay first-touch and append-once: a resubmission may never rewrite how a subscriber was originally acquired, an unattributed row is reported as `unknown` rather than claimed as `direct`, and imported Substack rows keep their import provenance.
- Analytics must stay read-only and honest: every reported metric is re-derivable from stored rows, and unavailable measurements (opens, clicks, paid conversion) are reported as unavailable instead of estimated.
- Discussion articles stay statically generated; only the comment island loads client-side, and a missing database or Turnstile configuration degrades to "temporarily unavailable" rather than breaking the article.
- The discussion stores no IP addresses, no email addresses, and no raw browser tokens. Ownership is a SHA-256 hash of an opaque cookie value; `is_author` is set only by the local CLI, never by public input; hidden comments are never returned publicly.

## Commands

| Purpose | Command |
| --- | --- |
| Install | `npm install` |
| Test | `npm test` |
| Test (Python distribution suite) | `python -m pytest tests -q`; needs `npm ci` for the carousel renderer tests and `pip install -r scripts/automation/requirements-test.lock` for pytest |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Run locally | `npm run dev` |
| Preview built site | `npm run preview` |
| Inspect Substack import | `npm run newsletter:import:dry-run -- <substack-export.csv>` |
| Apply verified Substack import | `npm run newsletter:import -- <substack-export.csv> --expect-active <count> --expect-suppressed <count> --confirm-import`; requires ignored production environment values and never sends email. |
| Newsletter preview | `npm run newsletter:preview -- <article-id> [output-file]` |
| Allowlisted newsletter test | `npm run newsletter:test -- <article-id> <recipient> --confirm-test` |
| Production campaign snapshot | `npm run newsletter:campaign -- <article-id> --expect-recipients <count> --confirm-snapshot` |
| Production newsletter send | `npm run newsletter:send -- <campaign-id> --expect-recipients <count> --confirm-production`; never invoke without explicit approval. |
| Newsletter analytics report | `npm run newsletter:analytics -- [--days <1-365>] [--json] [--check]` (read-only; `--check` exits non-zero on a deliverability or ingestion failure) |
| Email analytics report | `npm run newsletter:analytics:email -- --to <allowlisted-address> --confirm-send [--days <1-365>]`; sends only to an author address on `NEWSLETTER_TEST_RECIPIENTS`, never to subscribers. |
| Discussion moderation | `npm run comments:list -- [--slug <slug>] [--include-hidden]`, `npm run comments:hide -- <comment-id>`, `npm run comments:restore -- <comment-id>` |
| Discussion deletion / author reply | `npm run comments:delete -- <comment-id> --confirm-delete`; `npm run comments:reply -- --parent <comment-id> --body "..." --confirm-reply` |
| Scout run | `python -m scripts.scout run [--dry-run] [--no-llm] [--queries a,b] [--max-opportunities N]`; `--dry-run` writes nothing, and a real run needs `DEEPSEEK_API_KEY` |
| Scout queue | `python -m scripts.scout list [--status surfaced]`, `python -m scripts.scout dismiss <url>`, `python -m scripts.scout acted <url> [--outcome "..."]` |

## Change policy

- Prefer the smallest implementation that solves the requested problem; do not restructure unrelated code.
- Reuse existing patterns where reasonable and prefer explicit code to generic abstractions.
- Before adding a service, database, queue, framework, major dependency, recurring cost, or agent layer, establish why the current design cannot solve the need.
- Preserve the Substack integration until the explicit Phase 5 cutover.
- Discussion changes must keep moderation local-only: no public admin dashboard, no admin API, no browser-reachable moderation credentials.
- Newsletter analytics changes must stay read-only and first-party: no open/click tracking in subscriber mail, no vendored analytics dependency, no dashboard, and no metric that cannot be recomputed from stored rows.
- Scout changes must keep it a reporting tool: no publisher, no autonomous posting, no daemon or queue, no database or new state store, no second archive index, and no coupling to the site runtime or build.

## Verification

Before completing a change, run the narrow relevant tests, broader checks when core behavior changes, and build/type checks as applicable. Inspect the final diff. Newsletter changes additionally require verification of production-send safeguards and disclosure of anything that cannot be exercised locally. Attribution or analytics changes additionally require the opt-in Postgres analytics test (`tests/newsletter-analytics-postgres.ts`) because the report SQL is otherwise untested. Subscription-lifecycle changes additionally require the opt-in Postgres lifecycle test (`tests/newsletter-lifecycle-postgres.ts`), which exercises the real request/confirm/unsubscribe SQL. Failure-alerting changes must be verified against the log capture in `npm test`, and must never add a monitoring service, retry queue, or paging integration. Discussion changes additionally require verification of the abuse controls (Turnstile, honeypot, rate limiting, origin checks) and that no token, body, or display name can reach a log. Scout changes additionally require a real `--dry-run` against the live sources and index, and disclosure of anything the run could not exercise locally (model judgments and Bluesky search both need credentials).
