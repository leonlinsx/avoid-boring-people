# Newsletter migration status

## Current phase

**Phase 3 — SES/AWS production plumbing: complete. Phase 4 is blocked by SES production access.**

- Production `main` includes the crash-safe campaign sender at merge commit `f443477`; rollback tag `newsletter-pre-main-integration-20260909` preserves pre-integration main `a20c5f6`. Main's site and autopost changes were preserved, and the separate distribution-refactor worktree was not modified.
- Validation ran against successful GitHub/Vercel production deployment record `6351004359` at `https://avoid-boring-people-m387l3f23-leons-projects-b248d9a2.vercel.app`. Post-deployment checks returned homepage 200, invalid SNS POST 400, and non-exempt form-style PUT 403; later documentation-only deployments do not change that runtime.
- SNS subscription confirmation is complete (`PendingConfirmation: false`) and completed in 175 ms. The canonical `https://leonlins.com/api/newsletter/ses-events` endpoint is the only confirmed topic subscription.
- SES event destination `newsletter-ses-events` is enabled for DELIVERY, BOUNCE, and COMPLAINT only. Its topic policy permits `ses.amazonaws.com` to publish only from account 079415246848 and configuration set `my-first-configuration-set`.
- End-to-end delivery validation passed: a fresh marked test sent only to allowlisted `contact@leonlins.com` was accepted by SES; SNS invoked the production handler; Vercel returned 204; and Neon recorded the authenticated receipt. Subscriber count remains zero and no Substack data was read.
- Production Vercel has only `DATABASE_URL` and `NEWSLETTER_SNS_TOPIC_ARN` newsletter secrets. It has no email-send credentials or confirmation-delivery flags.
- AWS identity readiness is healthy: `leonlins.com` is verified, DKIM succeeds with 2048-bit keys, `mail.leonlins.com` MAIL FROM succeeds, and account suppression covers bounces and complaints. Public SPF records exist and DMARC is monitoring-only (`p=none`).
- **External blocker:** SES production access is false and the latest access review is DENIED. Sandbox quota is 200 messages/day at 1 message/second, so arbitrary-recipient and warm-up sends cannot begin.
- Controlled SES event validation is complete. With explicit approval, exactly two synthetic messages were sent from `newsletter@leonlins.com`: one to AWS's bounce simulator (SES message `010f01a086400e5c-fe3e2a52-ab32-4c69-82be-db00ae14bb20-000000`) and one to AWS's complaint simulator (SES message `010f01a086400edf-79a5402a-ce4f-4241-8d8c-9bcbddd767ad-000000`). The production endpoint stored three new authenticated SNS receipts, consistent with the enabled delivery plus terminal-event notifications. Subscriber and suppression counts remain zero; no Substack data was read.
- Migration `003_production_send_safety.sql` is applied to Neon production and the matching code is deployed. Production has zero subscribers, campaigns, and campaign recipients; it has five authenticated event receipts.
- A post-deployment, non-email SNS validation publish (`20d0ec84-4e72-56d4-a8d3-8f9f2d5e2aba`) was authenticated and stored exactly once with provider message `phase3-deploy-validation-f443477`, normalized `sent` state, and the supplied event timestamp. It matched no recipient and changed no subscriber data.
- A Phase 1–3 completion audit closed the remaining implementation gaps: the applied importer is guarded and retry-safe; one-click unsubscribe accepts originless RFC POSTs while GET is non-mutating; SES test messages carry the rendered list-unsubscribe headers; and the renderer's required failure-path matrix now covers missing assets, unsupported MDX, localhost URLs, external HTTPS links, and the exact size boundary. These changes sent no email and imported no real subscriber data.
- PR #33 merged the completion patch into production as `24d0f24`; rollback tag `newsletter-pre-phase123-completion-20260909` preserves the exact preceding main commit `d1d87c8`. Vercel deployment `8KFb6NCu939F12maEdCpehFmRsT7` succeeded. Live checks returned homepage 200, non-mutating unsubscribe GET 200, originless one-click POST 204, invalid SNS POST 400, and non-exempt PUT 403. Neon remained at zero subscribers, campaigns, and recipients and five prior event receipts. No email was sent.
- **Next controlled gate:** obtain SES production access before Phase 4 arbitrary-recipient validation. The latest request remains denied, and the real-list IAM recipient restriction remains locked.

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
- Added CSV dry-run and applied-import commands. Both report source rows, Author exclusions, active/suppressed outcomes, and duplicate normalized emails. The applied path additionally requires exact active/suppressed counts, `--confirm-import`, an explicit production environment, and a 32-byte local secret; it never sends email.
- Linked the Neon `leonlins.com` project production branch and initialized `neon.ts`; its deploy plan and deploy were no-ops because the policy declares no new infrastructure.
- The Neon connection values are in ignored `.env.local`; they are not committed.
- Created disposable Neon branch `newsletter-phase1-validation` from production. It did not initially contain the newsletter schema, so applied the committed `001_initial.sql` there using a direct connection and verified the resulting schema. The branch expires on 2026-09-14.
- Applied the validated `001_initial.sql` to Neon production and verified the expected newsletter tables. On Phase 3 revalidation, the linked production branch was found to have no public tables, so the same validated initial schema was applied again together with `002_event_and_campaign_state.sql`; the expected five tables and four event columns are now present, with zero subscriber records. No subscriber records were imported or created.
- Inspected the existing SES setup in `us-east-2`: `leonlins.com` and `contact@leonlins.com` are verified; Easy DKIM (RSA-2048) and the custom `mail.leonlins.com` MAIL FROM domain are successful. The account is healthy but remains in the SES sandbox (200 emails per 24 hours; 1 email per second).
- Created the non-console IAM user `newsletter-local-sender` and group `newsletter-ses-senders`. Its sole inline policy permits `ses:SendEmail` only through the `leonlins.com` SES identity, only when `ses:FromAddress` is `newsletter@leonlins.com`, and only with `my-first-configuration-set`; it has no permissions to manage AWS resources, no console access, and no credentials in the repository.
- Created one local CLI access key for that user. Its secret is shown by AWS once and must be downloaded and stored by the account owner; this migration does not read, log, or store it.
- Added isolated on-demand routes under `/api/newsletter/*` for a generic-response subscription request, one-time confirmation, and idempotent unsubscribe. The unsubscribe GET only renders a confirmation page, preventing link scanners from changing state; both the visible form and originless RFC one-click request mutate only via POST with the hashed bearer token. Suppressed subscribers remain suppressed. `src/pages/api/subscribe.ts` and `SubscribeForm.astro` remain untouched.
- Configured Astro's Vercel adapter while retaining static output. Only the new newsletter routes opt out of prerendering.
- Confirmation delivery is disabled unless both `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED=true` and the recipient is in the explicit local `NEWSLETTER_TEST_RECIPIENTS` allowlist. This prevents arbitrary-recipient or production sends during Phase 1.
- Added retry-safe database-backed rate limiting: five subscription attempts per normalized email and twenty per hashed client IP in a rolling one-hour window. The route still returns the same generic response when the limit is exceeded.
- Added focused tests for token hashing and rate-limit decisions; `npm test` and `npm run build` pass after the route and rate-limit changes.
- Ran the full pending → active → unsubscribed lifecycle against the disposable branch with a generated `example.test` address and confirmation delivery explicitly disabled. A second confirmation was rejected, a second unsubscribe was safe, and a subsequent subscription request did not reactivate the suppressed record. No email was sent.
- Ran the synthetic applied importer twice against disposable Neon branch `newsletter-phase3-send-validation`. Stable state was identical after the retry; normalized duplicates obeyed cancellation precedence; existing bounced/complained rows were not reactivated; a pending row activated with its original source preserved; and all synthetic rows were removed. No real export was read and no email was sent.
- Sent one authorized mailbox-simulator validation message from `newsletter@leonlins.com` to `success@simulator.amazonses.com`; SES accepted it. No human recipient or subscriber data was involved.
- No current subscription flow, production email behavior, or public signup UI has changed. The isolated owned endpoints are present in source but are not linked from the site.

## Phase 2 progress

- Added a constrained Markdown-to-email renderer that produces HTML and plain text, preserves public HTTP(S) article links, converts site-relative links to `https://leonlins.com`, and rejects relative article links, localhost/private URLs, raw HTML, MDX imports/exports/components, unsupported images, missing assets, and email HTML at or above the approximate Gmail 100 KB clipping threshold.
- Added a stable newsletter-asset build step. It copies only supported co-located blog images (`gif`, `jpeg`, `jpg`, `png`, `webp`) to public `/newsletter-assets/<article>/...` URLs; the renderer refuses unsupported or missing local assets rather than emitting broken mail. The normal Astro hashed-asset pipeline is unchanged.
- Added conservative inline email styles, a compact footer, privacy/unsubscribe links, and `List-Unsubscribe` plus RFC one-click headers. At the author's direction, the renderer intentionally omits the physical postal address and is limited to editorial editions; commercial or promotional editions require a fresh compliance decision.
- Added `npm run newsletter:preview -- <article-id> [output-file]`. It loads ignored `.env.local`, writes HTML only, and never sends mail. It requires local `NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL`; the default privacy URL is the published `/privacy/` page. A preview of the existing Nonviolent Communication article and the deployed static newsletter asset path were validated locally.
- Added focused renderer tests, including asset URL conversion, inline image styling, exact one-click headers, footer behavior, unchanged external HTTPS links, missing and unsupported assets, unsupported MDX/raw HTML, localhost rejection, and the exact 100 KB failure boundary.
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
- Created and confirmed the HTTPS subscription from that topic to `https://leonlins.com/api/newsletter/ses-events`; the earlier pending-confirmation incident was resolved without weakening signature or topic verification.
- Created the `newsletter-sns-delivery-status` IAM role for SNS diagnostics. It is trusted only by `sns.amazonaws.com` and grants only CloudWatch Logs creation/stream/event writing for this topic's delivery-status log group. SNS confirmation requests do not generate delivery-status logs, so the role did not expose the pending-handshake cause.
- Verified the live route rejects both an empty request and an intentionally invalid signed-event-shaped request with HTTP 400. The latter completed in 0.25 seconds after attempting a permitted SNS certificate URL; it could not confirm a subscription, store an event, or send mail.
- Connected SES delivery, bounce, and complaint events to the confirmed SNS endpoint and validated the authenticated path first with the allowlisted human test and then with exactly two explicitly approved AWS mailbox-simulator messages. Neon recorded the events and still contains zero subscribers.
- Added migration `003_production_send_safety.sql` and local-only campaign tooling. The migration adds a recipient `sending` state and timestamp, one-campaign-per-article uniqueness, and minimal event reconciliation fields. The CLI requires an exact recipient count twice, a hard local ceiling, an explicit production environment, a 32-byte unsubscribe secret, SES production access/quota, and explicit snapshot/send confirmation flags. It sends sequentially within the account rate and never automatically retries an indeterminate outcome.
- Validated migration 003 and the exact-count snapshot on a fresh short-lived Neon branch created from production. A synthetic early redacted complaint was safely retained before recipient/message association, then applied after reconciliation. Synthetic rows were removed. No email was sent by these checks.
- With explicit approval, applied migration 003 atomically to Neon production, verified its four columns and two indexes, and confirmed zero subscribers/campaigns/recipients before and after. PR #31 merged as `f443477`, Vercel production deployed successfully, public route/security checks passed, and one non-email signed SNS notification exercised the new receipt fields end to end.

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

1. Appeal or resubmit the denied SES production-access request with accurate use-case and consent details. Do not submit it or broaden IAM recipient permissions without explicit approval.
2. Supply the Substack export when the real import is explicitly approved. First inspect its dry-run totals, then apply only with matching exact counts; no legacy subscriber has been loaded.
3. Before any Phase 4 confirmation/delivery tests, explicitly approve each controlled recipient and configure the required local/Vercel credentials without committing them.
4. Before any warm-up, explicitly approve the cohort and broaden the current `contact@leonlins.com` IAM recipient restriction only to that cohort. Full-list delivery remains prohibited.

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
