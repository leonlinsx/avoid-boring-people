# Newsletter migration status

## Current phase

**Phase 2 — Email renderer: complete.**

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
- Created disposable Neon branch `newsletter-phase1-validation` from production. It did not initially contain the newsletter schema, so applied the committed `001_initial.sql` there using a direct connection and verified the resulting schema. The branch expires on 2026-09-14.
- Applied the validated `001_initial.sql` to Neon production and verified the expected newsletter tables. No subscriber records were imported or created.
- Inspected the existing SES setup in `us-east-2`: `leonlins.com` and `contact@leonlins.com` are verified; Easy DKIM (RSA-2048) and the custom `mail.leonlins.com` MAIL FROM domain are successful. The account is healthy but remains in the SES sandbox (200 emails per 24 hours; 1 email per second).
- Created the non-console IAM user `newsletter-local-sender` and group `newsletter-ses-senders`. Its sole inline policy permits `ses:SendEmail` only through the `leonlins.com` SES identity, only when `ses:FromAddress` is `newsletter@leonlins.com`, and only with `my-first-configuration-set`; it has no permissions to manage AWS resources, no console access, and no credentials in the repository.
- Created one local CLI access key for that user. Its secret is shown by AWS once and must be downloaded and stored by the account owner; this migration does not read, log, or store it.
- Added isolated on-demand routes under `/api/newsletter/*` for a generic-response subscription request, one-time confirmation, and idempotent GET/POST unsubscribe. They use hashed tokens and retain suppressed subscribers as suppressed. `src/pages/api/subscribe.ts` and `SubscribeForm.astro` remain untouched.
- Configured Astro's Vercel adapter while retaining static output. Only the new newsletter routes opt out of prerendering.
- Confirmation delivery is disabled unless both `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED=true` and the recipient is in the explicit local `NEWSLETTER_TEST_RECIPIENTS` allowlist. This prevents arbitrary-recipient or production sends during Phase 1.
- Added retry-safe database-backed rate limiting: five subscription attempts per normalized email and twenty per hashed client IP in a rolling one-hour window. The route still returns the same generic response when the limit is exceeded.
- Added focused tests for token hashing and rate-limit decisions; `npm test` and `npm run build` pass after the route and rate-limit changes.
- Ran the full pending → active → unsubscribed lifecycle against the disposable branch with a generated `example.test` address and confirmation delivery explicitly disabled. A second confirmation was rejected, a second unsubscribe was safe, and a subsequent subscription request did not reactivate the suppressed record. No email was sent.
- Sent one authorized mailbox-simulator validation message from `newsletter@leonlins.com` to `success@simulator.amazonses.com`; SES accepted it. No human recipient or subscriber data was involved.
- No current subscription flow, production email behavior, or public signup UI has changed. The isolated owned endpoints are present in source but are not linked from the site.

## Phase 2 progress

- Added a constrained Markdown-to-email renderer that produces HTML and plain text, preserves public HTTP(S) article links, converts site-relative links to `https://leonlins.com`, and rejects relative article links, localhost/private URLs, raw HTML, MDX imports/exports/components, unsupported images, missing assets, and email HTML at or above the approximate Gmail 100 KB clipping threshold.
- Added a stable newsletter-asset build step. It copies only supported co-located blog images (`gif`, `jpeg`, `jpg`, `png`, `webp`) to public `/newsletter-assets/<article>/...` URLs; the renderer refuses unsupported or missing local assets rather than emitting broken mail. The normal Astro hashed-asset pipeline is unchanged.
- Added conservative inline email styles, a compact footer, privacy/unsubscribe links, and `List-Unsubscribe` plus RFC one-click headers. At the author's direction, the renderer intentionally omits the physical postal address and is limited to editorial editions; commercial or promotional editions require a fresh compliance decision.
- Added `npm run newsletter:preview -- <article-id> [output-file]`. It loads ignored `.env.local`, writes HTML only, and never sends mail. It requires local `NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL`; the default privacy URL is the published `/privacy/` page. A preview of the existing Nonviolent Communication article and the deployed static newsletter asset path were validated locally.
- Added focused renderer tests, including asset URL conversion, inline image styling, one-click headers, footer behavior, unsupported relative links, and raw HTML rejection. No SES send capability or production campaign workflow was added or changed in Phase 2.
- Added the public `/privacy/` notice, linked from the site footer but intentionally omitted from the primary navigation. It accurately distinguishes the current Substack sign-up path from the planned Neon/SES migration and documents newsletter data, providers, unsubscribe/suppression, and contact choices.
- Recorded the fixed newsletter identity for all owned email: visible From `Leon Lin <newsletter@leonlins.com>` and Reply-To `contact@leonlins.com`.
- Added a local `npm run newsletter:test -- <article-id> <allowlisted-recipient> --confirm-test` workflow. It never queries subscribers, campaigns, or Substack data; it requires the exact recipient in ignored `NEWSLETTER_TEST_RECIPIENTS`, an explicit confirmation argument, local footer/configuration-set settings, and emits a clearly marked test subject. It is the only Phase 2 path that may call SES.
- Exercised the test-send recipient guard with a non-allowlisted address; it failed before an SES call. SES then accepted one explicitly authorized, clearly marked article-rendering test to `contact@leonlins.com`, and the human recipient confirmed receipt. The local sender IAM policy is now stricter: it permits `ses:SendEmail` only from `newsletter@leonlins.com`, only using `my-first-configuration-set`, and only when every recipient is `contact@leonlins.com`. No Substack export, subscriber, campaign, or recipient-list data was read or changed.

## Not started

- Phase 3 — SES/AWS production plumbing.
- Phase 4 — Controlled infrastructure validation.
- Phase 4.5 — Warm-up.
- Phase 5 — Cutover.

## Current production behavior

- Substack remains the only production signup and newsletter-sending system.
- The current form posts to `https://avoidboringpeople.substack.com/api/v1/free`.
- `src/pages/api/subscribe.ts` remains untouched.
- The owned lifecycle endpoints exist but are not linked from the public site; Substack remains the only production signup path.
- No owned production campaign send, public owned-signup cutover, or DNS change has occurred during this migration work.

## Next human/external gate

Phase 2 is complete. The next work is Phase 3 — production plumbing, and must not start without an explicit Phase 3 prompt. Before moving toward public owned signup, provide:

1. The Substack export when importer validation begins.
2. Explicit approval to broaden the IAM recipient restriction beyond `contact@leonlins.com`; until then the local sender cannot mail any other address.

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
