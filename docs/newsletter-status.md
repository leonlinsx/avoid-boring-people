# Newsletter migration status

## Current phase

**Phase 3 — SES/AWS production plumbing: in progress.**

Latest verified state: the canonical SNS subscription is confirmed (`PendingConfirmation: false`, suffix `e07d2dc4-e685-490a-a820-2b98d1df6503`). The signed confirmation completed in 175 ms in Vercel logs. Event-safety commit `8912f8b` is now deployed as `dpl_3KMzrse1Z2LV5FTkWGRANcEymfuE`; homepage 200, invalid SNS POST 400, non-exempt PUT 403. No schema change or email. Immediate rollback is promotion of `dpl_4fepkTj5cPvAFn7EXDWB5J7UJLSk`. Next authorization gate: SES event attachment and controlled validation; SES remains disconnected. Inspect confirmed subscriptions before attachment and never confirm the old diagnostic destinations. Earlier pending/deployment notes below are historical and superseded by this verification.

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
- Applied the validated `001_initial.sql` to Neon production and verified the expected newsletter tables. On Phase 3 revalidation, the linked production branch was found to have no public tables, so the same validated initial schema was applied again together with `002_event_and_campaign_state.sql`; the expected five tables and four event columns are now present, with zero subscriber records. No subscriber records were imported or created.
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

## Phase 3 progress

- Added the isolated `POST /api/newsletter/ses-events` endpoint. It parses the SNS envelope, requires an exact configured TopicArn, validates the AWS SNS signing-certificate URL, verifies the RSA signature before acting on the body, and returns a generic 400 for every invalid request.
- Valid SNS subscription confirmations may be automatically confirmed, but only after signature and exact-topic validation. This is the approved narrow automatic-confirmation exception; it cannot subscribe the endpoint to an arbitrary topic or URL.
- Added idempotent SNS receipt recording and SES delivery, permanent-bounce, and complaint processing. Replayed SNS MessageIds are no-ops. Only active subscribers can move to `bounced` or `complained`; missing/redacted complaint recipients are deliberately not suppressed.
- Added the additive `002_event_and_campaign_state.sql` migration for recipient event timestamps and indexed SES provider message IDs. It does not alter subscriber records or the Phase 1 schema behavior.
- Confirmation email now requires an SES configuration set. The existing local test allowlist remains the default. The separate `NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED=true` switch is required before automatic confirmations can go to arbitrary addresses, and remains unset for now.
- Created `docs/newsletter-aws-runbook.md`, including the separate Vercel confirmation identity, the exact SES/SNS setup, environment-secret boundary, verification, and stop/rollback actions. The existing local sender remains restricted to `contact@leonlins.com`.
- Created the normal Neon validation branch `newsletter-phase3-validation`, expiring 2026-09-14. Direct `psql` connections from this workspace stalled, so validation used the repository's Neon serverless driver instead: the committed Phase 1 schema plus the additive Phase 3 migration applied cleanly and all four recipient-event columns were verified.
- With explicit approval, applied the same migrations to linked Neon production and verified `campaign_recipients`, `campaigns`, `newsletter_event_receipts`, `newsletter_rate_limits`, and `subscribers`; `campaign_recipients` has all four new event columns and `subscribers` has zero rows. No email, import, or Substack data was touched.
- Focused tests and `npm run build` pass for the new route and signature-validation path.
- Deployed the Phase 3 event-ingestion code to Vercel production, including bounded (10-second) HTTPS retrieval for SNS signing certificates and confirmation URLs. The current healthy production deployment is `dpl_AhSw3dofJejuQ995JZs2AQs1VzmT`, which aliases `leonlins.com`; it includes sanitized confirmation-stage logs only and no send path.
- Created the dedicated standard SNS topic `newsletter-ses-events` in `us-east-2` and configured the production `NEWSLETTER_SNS_TOPIC_ARN` and `DATABASE_URL` as Vercel secrets. No Vercel SES send credentials or confirmation-delivery switches are set.
- Created the HTTPS subscription from that topic to `https://leonlins.com/api/newsletter/ses-events`. Earlier checks found pending subscriptions and no confirmation application logs. Those observations did not establish whether SNS sent a POST or whether an earlier framework/security layer rejected it; the previous AWS-side diagnosis was premature. Do not attach this topic to SES during the current diagnostics-only task.
- Created the `newsletter-sns-delivery-status` IAM role for SNS diagnostics. It is trusted only by `sns.amazonaws.com` and grants only CloudWatch Logs creation/stream/event writing for this topic's delivery-status log group. SNS confirmation requests do not generate delivery-status logs, so the role did not expose the pending-handshake cause.
- Verified the live route rejects both an empty request and an intentionally invalid signed-event-shaped request with HTTP 400. The latter completed in 0.25 seconds after attempting a permitted SNS certificate URL; it could not confirm a subscription, store an event, or send mail.

## Not started

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

Event-safety follow-up (2026-09-08, not yet deployed): receipt insertion, campaign updates, and subscriber suppression now share one atomic SQL statement. A failed mutation rolls back the receipt, concurrent duplicate deliveries do not repeat mutations, and terminal campaign-recipient states cannot be overwritten by late delivery events. Authenticated processing failures return 503 for SNS retry and log no database error detail. The opt-in `tests/newsletter-events-postgres.ts` suite passed against an isolated local Postgres 16 cluster with synthetic data: forced failure/retry, replay, concurrent duplicate/event races, late delivery, redacted complaints, and existing suppression. `npm test`, `npm run build`, and diff checks pass. No schema migration or production database changes. Deploy this follow-up before SES attachment; real SNS confirmation is still the immediate AWS gate.

2026-09-08 fix update: replaced Astro's global built-in origin middleware with equivalent project middleware except for exact `POST /api/newsletter/ses-events`. Signature and exact-topic verification remain mandatory. Certificate and confirmation requests each have a four-second absolute timeout under a shared eight-second deadline; confirmation URL tokens must match the signed envelope. Tests/build pass; local HTTP checks return 400 for an invalid SNS POST and 403 for a non-exempt PUT. Latest `main` site changes were merged and preserved. Commit `5905b40` is pushed and deployed to production as `dpl_4fepkTj5cPvAFn7EXDWB5J7UJLSk` using a remote build. Live checks: homepage 200, invalid SNS-style POST 400 in 0.28 seconds, non-exempt PUT 403, removed probe 404. Runtime logs confirm the POST reached envelope validation (`missing Type`); no unexpected errors were observed in that brief window. A real SNS confirmation and its latency remain unverified because the AWS browser session is no longer open. Rollback: promote the retained prior production deployment `dpl_5Lj4BLR9bCiaDFUzEUASr152hpZH`; no database migration accompanied this fix. No SES attachment or email occurred.

Sequential transport tests are complete; see `docs/newsletter-sns-diagnostics.md`. The external capture received SNS's confirmation; the custom-domain probe produced a correlated Vercel 403 before route execution. The exact deployment-hostname test has a Vercel sign-in gate and limited delivery visibility. The temporary probe has been removed from source and hosting. The origin-check fix above now needs real SNS confirmation and latency verification. Before attaching SES, deploy the verified event-safety follow-up above. Then validate delivery/bounce/complaint processing with controlled tests. No SES attachment or email has occurred in this fix. Before moving toward public owned signup, provide:

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
