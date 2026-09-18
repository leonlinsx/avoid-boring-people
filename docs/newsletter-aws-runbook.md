# Newsletter AWS and Vercel runbook

This runbook is for Phase 3/4 setup only. It must not be used to authorize a campaign or broaden the existing local sender. The current Substack form remains the public signup flow.

## Safety boundary

- The existing `newsletter-local-sender` IAM identity stays restricted to `newsletter@leonlins.com`, `my-first-configuration-set`, and `contact@leonlins.com`. Do not alter it for this work.
- Create a separate Vercel confirmation identity. It needs only `ses:SendEmail` in `us-east-2`, constrained to `newsletter@leonlins.com` and the SES configuration set. It has no SNS, IAM, database, or console permissions.
- Store its access key only in Vercel environment secrets. Never add it to `.env.local`, source control, CI, or the local sender profile.
- `NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED` stays absent/false until Phase 4 controlled confirmation tests. Campaign delivery has no Vercel path and remains local-CLI-only.

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

Do not set `NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED` yet. `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED` is also left disabled in Vercel until Phase 4.

## Verification and rollback

- Send only a controlled SES mailbox-simulator or explicitly approved test email using the configuration set; check that its SNS event reaches the endpoint and is recorded once.
- Replay the same SNS delivery intentionally through SNS only when validating idempotency; the database's `(provider, event_id)` key makes the state change a no-op on repeats.
- Confirm invalid-topic and invalid-signature requests receive HTTP 400 and do not create rows or alter subscribers.
- To stop ingestion immediately, remove the SES event destination or SNS subscription. To stop automatic confirmations, unset `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED` in Vercel and redeploy. Neither action touches the Substack flow.
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
NEWSLETTER_MAX_PRODUCTION_RECIPIENTS=<hard safety ceiling>
NEWSLETTER_UNSUBSCRIBE_SECRET=<at least 32 random bytes; never commit or rotate casually>
```

The final production sender IAM policy needs `ses:GetAccount` for quota/production-access checks and `ses:SendEmail` constrained to the verified From identity and configuration set. Keep the current `contact@leonlins.com` recipient restriction until the explicit warm-up/cutover approval.

After migration `003_production_send_safety.sql` is applied, the operator workflow is deliberately two-step:

1. Run `npm run newsletter:campaign -- <article-id> --expect-recipients <exact-count> --confirm-snapshot`. This renders the article first, creates at most one campaign per article, snapshots only active subscribers, and sends nothing.
2. Inspect the returned campaign ID and count. Only with separate explicit sending approval, run `npm run newsletter:send -- <campaign-id> --expect-recipients <same-exact-count> --confirm-production`.

The sender checks SES production access, sending state, daily quota, and account rate before sending sequentially. It rechecks suppression before every recipient and derives each unsubscribe token locally while storing only its hash. If any recipient remains in `sending`, the outcome is indeterminate: do not rerun or reset it automatically. Reconcile the SES message ID and database row manually first. This conservative stop may omit a message, but prevents a crash/retry from delivering it twice.
