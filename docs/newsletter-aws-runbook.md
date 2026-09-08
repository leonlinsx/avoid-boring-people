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
4. Deploy the Phase 3 code before creating the SNS HTTPS subscription, so `https://leonlins.com/api/newsletter/ses-events` exists.
5. Create an HTTPS subscription from `newsletter-ses-events` to that endpoint. The endpoint automatically confirms only a valid, correctly signed confirmation for the exact topic ARN. Verify the subscription shows `Confirmed` in SNS.

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
