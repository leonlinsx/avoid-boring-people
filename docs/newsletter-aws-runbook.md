# Newsletter AWS and Vercel runbook

This runbook records Phase 3/4 setup and current operations. It must not be used to authorize a campaign or broaden the existing local sender. Public signup has used the owned endpoint since October 14, 2026.

## Safety boundary

- The existing `newsletter-local-sender` IAM identity stays restricted to `newsletter@leonlins.com`, `my-first-configuration-set`, and `contact@leonlins.com`. Do not alter it for this work.
- Create a separate Vercel confirmation identity. It needs only `ses:SendEmail` in `us-east-2`, constrained to `newsletter@leonlins.com` and the SES configuration set. It has no SNS, IAM, database, or console permissions.
- Store its access key only in Vercel environment secrets. Never add it to `.env.local`, source control, CI, or the local sender profile.
- Both production confirmation flags are enabled following the October 14, 2026 public signup cutover. Campaign delivery has no Vercel path and remains local-CLI-only.

## SES configuration set and SNS destination

Perform these steps in **Amazon SES, us-east-2**:

1. Reuse the existing `my-first-configuration-set`; do not create a second configuration set without a reason.
2. In Amazon SNS, also in `us-east-2`, create a dedicated standard topic named `newsletter-ses-events`. Do not use an existing unrelated topic.
3. In the configuration set's event destinations, add the new SNS topic and select delivery, bounce, and complaint events. Do not enable open/click tracking.
4. In the configuration set's Tracking options, keep open tracking and click tracking disabled (link wrappers contradict the published no-tracking privacy notice and look phishy). Verified off 2026-09-10; re-check after any console edits, since nearby settings screens (e.g. VDM engagement tracking) do not control link rewriting.
5. Deploy the Phase 3 code before creating the SNS HTTPS subscription, so `https://leonlins.com/api/newsletter/ses-events` exists.
6. Create an HTTPS subscription from `newsletter-ses-events` to that endpoint. The endpoint automatically confirms only a valid, correctly signed confirmation for the exact topic ARN. Verify the subscription shows `Confirmed` in SNS.

Set these Vercel environment secrets for the production environment only:

```
DATABASE_URL=<pooled Neon runtime URL>
AWS_REGION=us-east-2
SES_CONFIGURATION_SET=my-first-configuration-set
NEWSLETTER_SNS_TOPIC_ARN=arn:aws:sns:us-east-2:<account-id>:newsletter-ses-events
AWS_ACCESS_KEY_ID=<Vercel confirmation identity>
AWS_SECRET_ACCESS_KEY=<Vercel confirmation identity secret>
```

Current Production settings are `NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED=true` and `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED=true`. The setup steps above are historical prerequisites; do not recreate identities, destinations or credentials for the completed cutover.

## Verification and rollback

- Send only a controlled SES mailbox-simulator or explicitly approved test email using the configuration set; check that its SNS event reaches the endpoint and is recorded once.
- Replay the same SNS delivery intentionally through SNS only when validating idempotency; the database's `(provider, event_id)` key makes the state change a no-op on repeats.
- Confirm invalid-topic and invalid-signature requests receive HTTP 400 and do not create rows or alter subscribers.
- To stop ingestion immediately, remove the SES event destination or SNS subscription. To stop automatic confirmations, unset `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED` in Vercel and redeploy. Disabling confirmations prevents completion of new owned signups; it requires separate operational approval.
- Revert the code deployment to the preceding Vercel deployment if necessary. The additive Phase 3 database migration can remain in place safely; it is unused by earlier code.

## Failure alerts

Alerting adds no infrastructure: a failure writes one `newsletter_alert` line to the log stream of the process that failed, and the scheduled job reports itself by exiting non-zero. Three kinds exist — `signup_pipeline_failure`, `ses_event_ingestion_failure`, and `analytics_job_failure` — and each line carries only a `reason` and an error name, never an address, token, or event body.

- **Ingestion** — `ses_event_ingestion_failure` with `reason: 'configuration'` means `NEWSLETTER_SNS_TOPIC_ARN` is missing, so no event can ever be ingested; check that Vercel secret first. This one is checked before authentication, because it is a deployment fault rather than internet noise, and it re-alerts once per incoming request until the secret is fixed, so match it with a count window rather than a single line. `reason: 'processing'` means an authenticated event failed to apply, and `reason: 'uncorrelated'` means a delivery, permanent bounce, or complaint arrived without a `mail.messageId` and was dropped. An unauthenticated request is not alerted: that is internet noise, not an operator problem.
- **Signup** — `signup_pipeline_failure` means the owned subscribe route failed after understanding the request. The visitor still receives the generic response, so check the Vercel runtime logs rather than the site. A malformed body is not alerted.
- **Weekly health check** — `.github/workflows/newsletter-health.yml` runs `npm run newsletter:analytics -- --days 30 --check` on Mondays and fails on a hard-bounce rate at or above 2%, a complaint rate at or above 0.1%, or sends past the one-hour grace period with no correlated SES event. It reads `secrets.NEWSLETTER_ANALYTICS_DATABASE_URL` (a read-only connection string) and fails loudly when that secret is unset or is not a `postgres://`/`postgresql://` string, so a red run with a missing-secret message means the check never ran, not that the list is unhealthy. A collection failure prints a generic line rather than the driver's message, because this repository is public; run the report locally to see the real error.
- Nothing here pages a human. Signup and ingestion alerts are delivered only if an alert rule on the Vercel log stream matches `newsletter_alert`; the scheduled job notifies through the workflow's own failure email. Add the log rule before relying on either runtime alert.
- Do not add retry queues, third-party monitoring, or a paging integration for this. The failure-only line plus the scheduled job is the whole design.

## Local production campaign workflow

Production campaigns never run in Vercel, CI, builds, deploy hooks, or tests. The local environment must contain the pooled `DATABASE_URL`, local sender credentials, `AWS_REGION=us-east-2`, `SES_CONFIGURATION_SET=my-first-configuration-set`, and all of these additional ignored values:

```
NEWSLETTER_ENVIRONMENT=production
NEWSLETTER_MAX_PRODUCTION_RECIPIENTS=<whole-audience hard safety ceiling>
NEWSLETTER_MAX_PRODUCTION_SENDS=<per-invocation SES attempt ceiling>
NEWSLETTER_UNSUBSCRIBE_SECRET=<at least 32 random bytes; never commit or rotate casually>
```

The final production sender IAM policy needs `ses:GetAccount` for quota/production-access checks and `ses:SendEmail` constrained to the verified From identity and configuration set. Keep the current `contact@leonlins.com` recipient restriction until the explicit warm-up/cutover approval.

Apply migrations through `006_phased_delivery.sql` before deploying the changed owned endpoints or running these commands. Existing confirmation hashes with no expiry fail closed until a fresh signup request issues a 24-hour link. Existing campaign drafts with no content digest are refused; review and recreate an unattempted draft with fresh approval rather than automatically backfilling its digest. Never recreate/reset a campaign with attempted recipients.

The local workflow binds a reviewed preview, an audience snapshot, and separate sending approval:

1. Run `npm run newsletter:preview -- <article-id> <output.html>` with a public HTTPS `NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL`. Inspect the HTML and retain its printed content SHA-256. Production uses the canonical privacy URL; a custom preview privacy URL will produce a digest the production commands refuse.
2. For an explicitly approved initial warm-up cohort, run `npm run newsletter:campaign -- <article-id> --cohort-size 250 --expect-recipients 250 --expect-content <preview-sha256> --confirm-snapshot`. The supported cohort size is 200–300. Selection is active subscribers ordered by `COALESCE(original_subscribed_at, confirmed_at, created_at)` descending, then UUID ascending. This uses subscription recency, not inferred engagement. Fewer eligible rows abort without creating a campaign. Omitting `--cohort-size` retains the existing all-active exact-count behavior; it is not warm-up approval.
3. Inspect the returned campaign ID, count, selection and digest, and review its stored `campaign_recipients` membership locally before approving a send. Repeating the snapshot command returns the existing audience without adding/replacing recipients or resetting delivery state. A different digest, selector, count or safety ceiling is refused.
4. Only with separate explicit sending approval, run `npm run newsletter:send -- <campaign-id> --expect-recipients <same-exact-count> --expect-content <same-preview-sha256> --send-limit <separately-approved-limit> --confirm-production`. Source/title/rendered HTML/text/header/footer drift fails before SES or send-state mutation. Only the generated per-recipient unsubscribe token varies. The digest covers rendered content and image URLs, not remotely served image bytes; check deployed assets in controlled validation.

The sender checks SES production access, sending state, daily quota for the approved wave, and account rate before sending sequentially up to the approved send limit. See the phased workflow below for the Anthropic full-audience snapshot and first 200-recipient wave. It rechecks suppression before every recipient and derives each unsubscribe token locally while storing only its hash. If any recipient remains in `sending`, the outcome is indeterminate: do not rerun or reset it automatically. Reconcile the SES message ID and database row manually first. This conservative stop may omit a message, but prevents a crash/retry from delivering it twice.

## Phased delivery: one audience, separate wave approval

Migration `006_phased_delivery.sql` is required for these commands. It adds a `paused` campaign state, last/current batch metadata and immutable subscription-date ordering on recipient rows; it does not change subscriber records or reset any campaign. Apply it only under separate migration authorization, using the existing direct-connection migration procedure. It has been tested locally, not applied to production by this change. Stop all campaign send processes before the migration; do not use the older sender after applying this rollout.

The two required local safety ceilings are independent:

```dotenv
NEWSLETTER_MAX_PRODUCTION_RECIPIENTS=5118
NEWSLETTER_MAX_PRODUCTION_SENDS=200
```

The first remains the maximum **whole snapshot**, retaining the existing environment variable name. The second bounds **SES SendEmail attempts per invocation**. Both must be positive integers; missing either refuses snapshot/send. `--send-limit` is a required, separately authorized exact limit, never an override of either ceiling. It counts attempted requests, including a rejected or uncertain request, not only accepted requests. There is no automatic retry within a wave. Keep credentials, unsubscribe secret, sender restrictions, and test-recipient allowlist unchanged. The commands below are a proposed operator sequence, not authorization to execute them.

For the Anthropic edition, use the all-active snapshot. **Do not pass `--cohort-size`**: that legacy option deliberately creates a smaller campaign, not a delivery wave. Its 200–300 range and exact-count check remain available for separately approved cohort-only campaigns. Passing `--cohort-size 200 --expect-recipients 5118` is refused. An existing smaller snapshot for the same article also refuses the 5,118-person operation; never delete or replace an attempted campaign to expand it.

After migration/configuration approval and a fresh preview review:

```bash
npm run newsletter:preview -- 2026_10_31_anthropic_ipo/index.md /tmp/anthropic-newsletter.html
```

Retain the reviewed preview's exact SHA-256 as `APPROVED_HASH`. Use the existing valid public `NEWSLETTER_PREVIEW_UNSUBSCRIBE_URL` and identical presentation settings. Article, subject, rendering, footer, privacy URL, preheader and image URL drift require another review; preview and campaign digests must agree. Remote image bytes are outside the digest. The production sender also checks the published article and public image availability before SES access or ledger mutation.

With separate snapshot authorization:

```bash
npm run newsletter:campaign -- 2026_10_31_anthropic_ipo/index.md --expect-recipients 5118 --expect-content "$APPROVED_HASH" --confirm-snapshot
```

Expected: `recipients: 5118`, `selection: "all-active"`, `status: "draft"`, `emailSent: false`, and a campaign UUID. Retain that UUID as `CAMPAIGN_ID`. A changed eligible count aborts without inserting a campaign. Repeating the identical command returns the existing immutable audience (`created: false`); it never adds members or resets attempts. The existing article uniqueness guard protects this edition. Delivery uses campaign UUIDs throughout; corrections/resend editions are intentionally deferred and must not bypass that guard by resetting this campaign.

Inspect with the read-only command (requires database access only, not SES credentials or send configuration):

```bash
npm run newsletter:status -- "$CAMPAIGN_ID"
```

Expected before the first wave: `total: 5118`, `pending: 5118`, all delivery counts zero, and `batch_id: null`.

Only after separate explicit authorization for the first 200-recipient wave:

```bash
npm run newsletter:send -- "$CAMPAIGN_ID" --expect-recipients 5118 --expect-content "$APPROVED_HASH" --send-limit 200 --confirm-production
npm run newsletter:status -- "$CAMPAIGN_ID"
```

Expected with no intervening suppression or errors: `accepted: 200`, `attempted: 200`, `pending: 4918`, `status: "paused"`; status shows `batch_send_limit: 200`, `batch_accepted: 200`, `batch_finished_at` set. Delivery starts with the most recently subscribed snapshotted readers, ordered by `COALESCE(original_subscribed_at, confirmed_at, created_at)` descending then UUID ascending. The date is frozen at snapshot, so later subscriber edits cannot reorder the wave. Review SES delivery/bounce/complaint results before authorizing another wave.

A later separately approved execution uses the **same UUID, 5118 count, and digest**, with its own explicit `--send-limit` and confirmation. Already attempted recipients are never selected again. A second 200-send wave normally leaves 4,718 pending. Suppression may lower these counts: pending recipients no longer active are marked `failed` with the fixed reason `suppressed before send` and counted as `suppressed_skipped`, not actual send failures. Their snapshot membership remains unchanged.

Status fields are derived from the ledger in one SELECT: `total`, `pending`, `sent` (current sent status, including delivered messages), `delivered` (delivery timestamp present), `bounced`, `complained`, `suppressed_skipped`, `failed` (other terminal failures), and `indeterminate` (unresolved `sending`). `delivered` overlaps other delivery counts and is not an additional population to sum. The mutually exclusive statuses excluding `delivered` sum to `total`. `batch_accepted` is the last/current wave's **durably recorded SES acceptances**, not confirmed inbox delivery. During a finalization outage or lost response it is a lower bound; `indeterminate` may represent further accepted messages. Batch metadata describes the latest wave; recipient rows/message IDs/event timestamps remain the edition's coherent delivery ledger. Routine output includes only campaign/batch identifiers, counts, timestamps and digest, never recipient addresses, tokens, message IDs, or raw provider/DB exceptions.

The sender checks quota for `min(approved send limit, active pending)` and respects the lower of SES rate and ten sends/second. Other senders can consume quota after preflight; any resulting rejection stops this wave conservatively. SDK retries are disabled (`maxAttempts: 1`) because SES SendEmail has no idempotency key. SES rejection, timeout, missing message ID, database failure and reconciliation failure all stop the invocation. No unattended continuation, scheduler, queue, or production send hook is installed.

For a future full-audience edition, after separate authorization operators can configure higher audience/send ceilings and approve one run with a full-audience `--send-limit`. The same sequential loop bounds each individual request and the invocation total; no manual invocation is required for internal technical chunks. A ceiling does not authorize sending, and this change does not automatically advance from the first wave. Quota must cover that invocation; a later human-approved wave can resume remaining pending rows.

### Stop, inspect, and recover

1. Press Ctrl-C once or send SIGTERM to the actual Node sender process. It stops claiming after the in-flight recipient is finalized and reconciled, then checkpoints `paused` (or `completed` if no pending recipients remain). Wait for the summary and process exit. Signal forwarding through npm can differ by shell; confirm the Node process exited. Do not force kill a process that may have an in-flight SES request merely to get a quick checkpoint.
2. Run `newsletter:status`. A clean `paused` campaign with zero `indeterminate` can resume only with another exact count/hash/limit/confirmation approval. `completed` means no pending or unresolved `sending` recipients remain; failed/skipped rows are terminal and are never retried automatically. Delivered events can continue arriving after completion.
3. A crash, SIGKILL, uncertain SES result, failed DB finalization, or failed checkpoint leaves the campaign `sending`. A second process is refused even if `indeterminate: 0` (for example, the recipient was recorded before event reconciliation failed). There is **no stale-lock timeout or automatic unlock**. First prove the old process is terminated and cannot resume, then preserve and inspect its last `batch_id`, attempt timestamps, recipient ledger and SES/SNS evidence privately. Do not paste recipient data or credentials into chat/PR logs.
4. Keep unresolved recipients in `sending` while investigating. A missing SES/SNS event is not evidence of non-delivery. Never set an uncertain row back to `pending`, recreate the audience, or start a replacement campaign to resend. If an accepted SES message ID is recovered, a separately approved manual reconciliation may record the ID and sent timestamp on that exact claimed row and run the existing `reconcileSesMessage(messageId, db)` helper to apply stored SNS receipts. Message IDs must be uniquely attributable; do not guess by nearby timestamps. Do not mark an accepted request as unattempted. A proven rejection can be closed as terminal `failed` with a fixed non-PII reason; this change provides no automatic retry of failed rows. If acceptance cannot be determined, leave it blocked or explicitly authorize abandoning that recipient as a terminal failure with the fixed reason `indeterminate abandoned`; it must never be resent automatically.
5. After every attempted row has been explicitly reconciled or abandoned and any missed SNS reconciliation has been completed, a separately approved operator can release **only that stopped batch**. Review the following transaction with `campaign_id` and `stopped_batch_id` set as psql variables; this is a recovery write, not part of the read-only status command:

```sql
BEGIN;
UPDATE campaigns SET status = 'paused', batch_finished_at = now()
WHERE id = :'campaign_id'::uuid
  AND status = 'sending'
  AND batch_id = :'stopped_batch_id'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM campaign_recipients
    WHERE campaign_id = :'campaign_id'::uuid AND status = 'sending'
  )
RETURNING id, status, batch_id;
COMMIT;
```

Expected: exactly one returned campaign. Zero rows means the conditions were not met; do not broaden the UPDATE. This command does not reset recipients or batch acceptance counts. `newsletter:status` plus another separately authorized send invocation finishes any pending work or checkpoints `completed` if none remains. Never unlock while the original process can still execute. If a recovered acceptance was not counted in `batch_accepted`, retain that discrepancy in the private incident record; recipient/event rows are authoritative.

### Local verification without production services

```bash
npm run test:newsletter:delivery
npm test
npx tsc --noEmit
# Focused check, independently runnable if the broad check has unrelated errors:
npx tsc --noEmit --target ESNext --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --esModuleInterop --skipLibCheck --types node scripts/newsletter/create-campaign.ts scripts/newsletter/send-campaign.ts scripts/newsletter/campaign-status.ts tests/newsletter-delivery-postgres.ts
npm run lint
npm run build
```

The delivery suite needs local PostgreSQL 16 tools (`psql` on PATH; optionally set `NEWSLETTER_TEST_PG_BIN`). It creates a private `/tmp/newsletter-delivery-pg-*` cluster with no TCP listener, applies migrations there, seeds synthetic subscribers, injects fake SES, and destroys the cluster afterward. It ignores production `DATABASE_URL` and AWS credentials. Expected final line: `PASS all phased delivery Postgres tests (synthetic only; no SES calls)`. It covers two 200-person waves on a 5,118-person snapshot, concurrent starters, deterministic/frozen ordering, suppression races, SES rejection/timeout/missing ID, unresolved claims, failed finalization/reconciliation/checkpoint, quota/access/rate/ceiling guards, changed approvals/content, graceful stop and exhaustion, and SNS status counts. It does not prove live SES delivery, production Neon behavior, IAM permissions, quota availability, or the current production audience. These still require separately approved rollout checks; no production migration/snapshot/send is part of implementation verification.
