# Newsletter migration status

## Current phase

**Phase 1 — Subscriber ownership: in progress.**

This status file is the handoff record for the current newsletter migration phase. Update it at the end of every phase or when an external/human gate prevents safe progress. Do not advance phases by implication.

## Completed in Phase 0

- Created the repository operating guide in `AGENTS.md`.
- Recorded the detailed migration design and phased gates in `docs/newsletter-migration-plan.md`.
- Confirmed current behavior: Astro 5.13.7 static site; content under `src/content/blog`; `/writing/[slug]` uses `BlogPost.astro`; `SubscribeForm.astro` and `src/pages/api/subscribe.ts` use Substack; `/newsletter` redirects to `/#subscribe`.
- Confirmed there is no existing Vercel adapter, managed database, owned newsletter endpoint, newsletter CLI, privacy-policy page, or deployment configuration in the repository.
- Identified co-located relative article image assets as an email-rendering risk that must be designed before Phase 2 implementation.

## Phase 1 progress

- Created a portable initial Postgres migration for subscribers, campaigns, campaign recipients, database-backed rate-limit buckets, and event-receipt deduplication.
- Added pure subscriber status, email normalization, and Substack-row mapping rules with tests.
- Added a CSV dry-run inspection command. It reports source rows, Author exclusions, active/suppressed outcomes, and duplicate normalized emails without connecting to a database or changing subscriber data.
- Linked the Neon `leonlins.com` project production branch and initialized `neon.ts`; its deploy plan and deploy were no-ops because the policy declares no new infrastructure.
- The Neon connection values are in ignored `.env.local`; they are not committed.
- Created disposable Neon branch `newsletter-phase1-validation` from production, applied `001_initial.sql` using a direct connection, and completed read-only schema validation there. The branch expires on 2026-09-14.
- Applied the validated `001_initial.sql` to Neon production and verified the expected newsletter tables. No subscriber records were imported or created.
- Inspected the existing SES setup in `us-east-2`: `leonlins.com` and `contact@leonlins.com` are verified; Easy DKIM (RSA-2048) and the custom `mail.leonlins.com` MAIL FROM domain are successful. The account is healthy but remains in the SES sandbox (200 emails per 24 hours; 1 email per second).
- Created the non-console IAM user `newsletter-local-sender` and group `newsletter-ses-senders`. Its sole inline policy permits `ses:SendEmail` only through the `leonlins.com` SES identity and only when `ses:FromAddress` is `newsletter@leonlins.com`. It has no permissions to manage AWS resources, no console access, and no credentials in the repository.
- Created one local CLI access key for that user. Its secret is shown by AWS once and must be downloaded and stored by the account owner; this migration does not read, log, or store it.
- Added isolated on-demand routes under `/api/newsletter/*` for a generic-response subscription request, one-time confirmation, and idempotent GET/POST unsubscribe. They use hashed tokens and retain suppressed subscribers as suppressed. `src/pages/api/subscribe.ts` and `SubscribeForm.astro` remain untouched.
- Configured Astro's Vercel adapter while retaining static output. Only the new newsletter routes opt out of prerendering.
- Confirmation delivery is disabled unless both `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED=true` and the recipient is in the explicit local `NEWSLETTER_TEST_RECIPIENTS` allowlist. This prevents arbitrary-recipient or production sends during Phase 1.
- Added retry-safe database-backed rate limiting: five subscription attempts per normalized email and twenty per hashed client IP in a rolling one-hour window. The route still returns the same generic response when the limit is exceeded.
- Added focused tests for token hashing and rate-limit decisions; `npm test` and `npm run build` pass after the route and rate-limit changes.
- No endpoint, current subscription flow, deployment behavior, or email behavior has changed yet.

## Not started

- Phase 2 — Email renderer.
- Phase 3 — SES/AWS production plumbing.
- Phase 4 — Controlled infrastructure validation.
- Phase 4.5 — Warm-up.
- Phase 5 — Cutover.

## Current production behavior

- Substack remains the only production signup and newsletter-sending system.
- The current form posts to `https://avoidboringpeople.substack.com/api/v1/free`.
- `src/pages/api/subscribe.ts` remains untouched.
- No owned newsletter endpoint, DNS change, or email send has occurred during this migration work.

## Next human/external gate

Before testing database-backed Phase 1 routes that deliver confirmation email, obtain or confirm:

1. Download and securely store the newly created IAM access key secret, then configure it locally without committing it. The local sender policy intentionally lacks quota-read permission because that is not needed for Phase 1 confirmation sends; add it only with the Phase 3 CLI.
2. Validate the database-backed subscribe, confirm, and unsubscribe lifecycle on the disposable Neon branch before enabling any test confirmation delivery.
3. Explicit approval for a no-recipient SES mailbox-simulator send from `newsletter@leonlins.com`, then inspect the result. A real inbox test requires a separately verified sandbox recipient and explicit approval at send time.
4. The Substack export when importer validation begins.

DNS authority, production SES access, a compliant postal address, mailbox confirmation, and privacy-policy approval remain later launch gates; they do not block local Phase 1 development.

## Locked decisions

- Canonical archive: `/writing`; canonical source: repository Markdown/MDX.
- Newsletter brand: `Avoid Boring People by Leon Lin`.
- Owned database: Neon managed Postgres.
- Delivery: Amazon SES; start with shared IPs.
- Runtime boundary: static Astro site plus narrowly scoped Vercel/Astro newsletter endpoints; campaign sends from a local CLI only.
- New subscribers use double opt-in. Legitimate uncancelled legacy subscribers import active; cancelled/suppressed subscribers never reactivate automatically.
- Visible From: `Leon Lin <newsletter@leonlins.com>`; Reply-To: `contact@leonlins.com`; preferred SES MAIL FROM: `mail.leonlins.com` subject to DNS validation.

## Safety reminders

- Never send production mail from an install, test, build, push, CI job, or deployment.
- Never replace the Substack route/form before Phase 5 and a successful warm-up.
- Never treat `Expiration date = Paused` as lost consent; never import a cancellation as active.
- Never mutate subscriber state from unauthenticated SNS traffic.
