# Repository guide

## Project purpose

`leonlins.com` is Leon Lin's personal website and publishing platform, published under the **Avoid Boring People** identity. The site is a static Astro build whose writing is Markdown/MDX; around it sit owned first-party systems: an owned newsletter (Neon Postgres + Amazon SES) replacing Substack, article discussion, a minimal contact-note flow, social distribution, and the internal Lin Scout discovery tool.

Where the truth lives:

- `README.md` — system map, project structure, and the full command index.
- `docs/` — `newsletter-aws-runbook.md`, `newsletter-status.md`, `newsletter-analytics.md`, `newsletter-migration-plan.md`, `newsletter-sns-diagnostics.md`, `discussion.md`, `contact.md`, `scout.md`, `social-distribution.md`, and `template.md` (article frontmatter).

Priorities: reliable publishing and unchanged site behavior, subscriber consent and sending reputation, no duplicate or accidental production sends, a simple author workflow, portable and low-cost infrastructure, and preserved site performance and SEO.

## Non-goals

- Do not turn this into a generalized newsletter SaaS, WYSIWYG CMS, analytics suite, marketing platform, or CRM.
- Do not add segmentation, A/B testing, referrals, paid memberships, or automation unless explicitly requested.
- Do not add dashboards, distributed infrastructure, queues, Redis, Kafka, worker fleets, microservices, or provider abstractions for hypothetical scale.
- Do not automate production newsletter sends from CI, Vercel deploys, builds, or deployment hooks.
- Discussion moderation stays local-only: no public admin dashboard, no admin API, no browser-reachable moderation credentials.
- Newsletter analytics stays read-only and first-party: no open/click tracking in subscriber mail, no vendored analytics dependency, no dashboard, and no metric that cannot be recomputed from stored rows.
- The contact form stays an invitation: three fields, no scoring or qualification, no relationship record, no newsletter signup inside the form, no navigation entry, and no second place to read notes.
- Lin Scout stays a reporting tool: no publisher, no autonomous posting, no daemon or queue, no database or new state store, no second archive index, and no coupling to the site runtime or build.
- The Scout Jev shadow evaluation stays observational and removable: off unless both `SCOUT_JEV_SHADOW` and `TYPESAFE_API_KEY` are set, never able to add, drop, reorder, or redraft a candidate or fail a run, called only after the report and `scout-state.json` are written and bounded by its own wall-clock budget, enabled in `.github/workflows/scout.yml` only through the repository secret and a dedicated `continue-on-error` SDK install step (never in the pinned requirements), and its API key never printed or persisted.
- Keep the Substack integration until the explicit cutover.

## Important invariants

- `/writing` is the canonical article archive and Markdown/MDX is the canonical content source.
- Production email to subscribers requires an explicit human local-CLI action; the analytics report is author-only and may be scheduled.
- A recipient must never receive a campaign twice after a retry or resume; scheduled and runtime work must be safe to retry.
- Imports and automated processing must never reactivate `unsubscribed`, `bounced`, or `complained` subscribers, and Substack cancellation rows stay suppressed. Resubscription is explicit and confirmation-only: a signup request on an `unsubscribed` row issues a fresh token and leaves the row suppressed until that token is confirmed, while `bounced` and `complained` rows are never reopened.
- Missing email-rendering support must fail visibly rather than generate broken mail.
- SES/SNS event ingestion must authenticate messages before changing subscriber state.
- Failures must stay observable without new monitoring infrastructure: one greppable `newsletter_alert` log line carrying only a reason and an error name (`signup_pipeline_failure`, `ses_event_ingestion_failure`, `analytics_job_failure`), the scheduled analytics job reporting itself through a non-zero exit, and contact failures emitting one `contact_alert` line rather than retrying.
- Signup attribution must stay first-touch and append-once: a resubmission may never rewrite how a subscriber was originally acquired, an unattributed row is reported as `unknown` rather than claimed as `direct`, and imported Substack rows keep their import provenance.
- Analytics must stay read-only and honest: every reported metric is re-derivable from stored rows, and unavailable measurements (opens, clicks, paid conversion) are reported as unavailable instead of estimated.
- Report delivery stays author-only: a report goes from `newsletter@leonlins.com` to the single address fixed by `NEWSLETTER_AUTHOR_REPORT_TO`, which must be on the `NEWSLETTER_TEST_RECIPIENTS` allowlist. Subscribers are never addressed, no entry point accepts an arbitrary recipient, the manual `--to <address> --confirm-send` command keeps its explicit confirmation, and the unattended monthly run is a local user timer (`deploy/systemd/newsletter-author-report.timer`) that no build, deploy, or CI job runs.
- A contact note stays a note: never scored or qualified, never a relationship record, never a newsletter subscription, and never handled by an automated funnel. No IP address, browser token, or message body may reach a log line. Its Lin Check handoff stays optional and non-blocking, and the notification is recorded before the handoff runs so a delivered note is never left recorded as unfinished. Abuse protection stays Turnstile, the honeypot, the request-size cap, and the same-origin check — no rate-limiting service.
- A contact note is stored in the `contact_submissions` table and nowhere else. The contact form is an invitation, not navigation: `/about`, `/now`, and direct-link `/contact` offer it, and no nav or footer links to it. A missing `PUBLIC_TURNSTILE_SITE_KEY` removes the form and leaves the email address; a missing `DATABASE_URL` or `AWS_REGION` still renders the form, which then fails at submit with a message naming the email address.
- Discussion articles stay statically generated; only the comment island loads client-side, and a missing database or Turnstile configuration degrades to "temporarily unavailable" rather than breaking the article.
- The discussion stores no IP addresses, no email addresses, and no raw browser tokens. Ownership is a SHA-256 hash of an opaque cookie value; `is_author` is set only by the local CLI, never by public input; hidden comments are never returned publicly.
- Lin Scout keeps `scout-state.json` as its only state. The Jev shadow writes only to an ignored local `scout-shadow.jsonl` that nothing reads (`python -m scripts.scout jev` inspects it) and whose deletion cannot change a run.

## Verification

Run the narrow relevant tests, broader checks when core behavior changes, and build/type checks (`npm test` for all JS/TS suites, `python -m pytest tests -q`, `npm run lint`, `npm run build`). Inspect the final diff and report anything that could not be exercised locally.

- Newsletter changes: re-verify the production-send safeguards and disclose what cannot be exercised locally.
- Attribution or analytics changes: also run the opt-in Postgres analytics test (`tests/newsletter-analytics-postgres.ts`); the report SQL is otherwise untested.
- Report-delivery changes: verify the recipient safeguards in `npm test` (the recipient is configuration, never an argument; a `--to` argument to the scheduled command is refused; an address off the allowlist is refused) and exercise `npm run newsletter:analytics:author -- --dry-run`, which renders the report and sends nothing. A real send needs SES credentials and must never run in a test.
- Subscription-lifecycle changes: also run the opt-in Postgres lifecycle test (`tests/newsletter-lifecycle-postgres.ts`), which exercises the real request/confirm/unsubscribe SQL.
- Failure-alerting changes: verify against the log capture in `npm test`; never add a monitoring service, retry queue, or paging integration.
- Discussion changes: verify the abuse controls (Turnstile, honeypot, rate limiting, origin checks) and that no token, body, or display name can reach a log.
- Contact changes: verify that no log line carries note contents, that a missing database, Turnstile secret, or SES region degrades to a message naming the email address, and that the Lin Check handoff stays optional and non-blocking (a failed handoff still thanks the reader, is reported by `lin_check_failure`, and leaves `lin_check_synced_at` null without making the row look like a note nobody received).
- Scout changes: run a real `--dry-run` against the live sources and index, and disclose what the run could not exercise locally (model judgments and Bluesky search both need credentials).
- Scout shadow-experiment changes: verify with the SDK faked (never a live TypeSafe call) that a run with the experiment on and failing produces the same report, the same state file, and the same exit code as a run with it off (only the shadow's own log lines differ), that `scout-state.json` is already written when the evaluation is called, that the pass stops itself at its budget instead of spending the run's clock, and that the API key cannot appear in a record or a log line.
