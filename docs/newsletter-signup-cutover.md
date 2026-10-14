# Owned signup cutover — prepared, not activated

Status: **READY FOR SIGNUP CUTOVER**, subject to separate approval of the PR head,
merge/deployment, production flag change, and the single smoke-test identity.
No subscriber import, campaign, warm-up or campaign send is authorized by this
status. Protect the 5,116 real Substack subscribers by leaving them in Substack.

## Prepared behavior

`SubscribeForm.astro` posts JSON to `/api/newsletter/subscribe`, carrying email,
form source, honeypot and the existing first-touch attribution payload. Layout,
compact/full variants and translated CTA copy are retained. Native required/email
validation, unique label/status associations and a polite live region remain.
Only one request is allowed while a form is busy; there is no automatic retry.
JavaScript-disabled readers have a Substack link.

The API intentionally returns one generic response for sent, skipped, suppressed,
rate-limited and failed requests. UI copy is conditional: check the inbox/spam;
**if** a confirmation arrives, follow its link. It never asserts delivery,
activation or membership. HTTP/network/malformed-response failures show an error
and allow a deliberate retry. A generic HTTP 200 cannot verify email delivery;
the operator smoke test below must verify SES/SNS and mailbox receipt separately.

The backend, suppression SQL, rate limits, SES configuration, test allowlist and
confirmation flags are unchanged. Signup imports only subscription, attribution,
input and alerting helpers; it never selects or writes campaigns/recipients and
has no campaign ID parameter. The focused test also supplies a campaign ID and
rejects any campaign query. Campaign creation/send code lives in local scripts,
with no public route or build/CI hook. Production sending still requires the
local `newsletter:send` CLI, campaign ID, `--confirm-production`, expected
recipient count, expected preview content hash, production environment, recipient
cap, SES readiness and suppression/idempotency checks. The tests exercise those
existing guards. Nothing in this cutover changes those permissions or flags.

## Evidence — 2026-10-13 (America/New_York)

- `npm test`: passed, including the real API handler with mocked Neon SQL and
  zero SES calls, suppression/rate-limit/honeypot cases, campaign separation,
  and existing production-send/test-recipient guards.
- `python -m pytest tests -q` via the repository virtualenv: 706 passed.
- `npm run lint`, `npm run build`: passed.
- `node tests/newsletter-signup-browser.mjs`: actual locally rendered home/article forms and
  a compact-mode DOM fixture; mocked signup responses, blocked external/other API requests;
  validation, first-touch payload, honeypot, duplicate submits, conditional copy,
  HTTP/network/JSON failures and blocked localStorage verified. Local server used
  empty database URLs and both confirmation flags false. No real mail or data.
- Read-only Vercel checks: production delivery flag true, production-public flag
  false. Existing allowlist untouched. No environment, role or SES changes.
- Read-only production SQL before/after: three subscribers (active 1, pending 1,
  unsubscribed 1), zero campaigns and zero campaign recipients; aggregate hash
  of complete subscriber rows unchanged. No production POSTs were made.

No live delivery was exercised here. The previously passed double-opt-in
lifecycle evidence is in `newsletter-status.md`; its broader provider/inbox gates
still apply before any campaign or import authorization.

## Coordinated production procedure — execute only after separate approval

1. **Record rollback and baseline.** In Vercel → project `avoid-boring-people` →
   Deployments, record the deployment currently serving `leonlins.com` and verify
   its rendered form still targets Substack (GET only). At preparation time this
   is `dpl_9h5iPXErMjyg1k73qC7dnbLoP8hC` /
   `avoid-boring-people-qh3jyjk72-leons-projects-b248d9a2.vercel.app`; refresh this
   record at execution, since unrelated deployments may advance it. Keep it
   available for Instant Rollback. Record subscriber fingerprints/counts and
   zero campaign/recipient counts using the SQL below. Verify delivery flag true,
   public flag false, existing test identity allowlisted, SNS destination healthy,
   and existing SES configuration/permissions sufficient. If a check fails, stop;
   this approval does not authorize role, secret or permission repair.
2. **Deploy the owned form.** Recheck CI and the exact reviewed PR head. Run the
   required private-repository merge gate for that head; merge only under the
   separate approval. Let the existing main-branch Vercel production integration
   build that approved change. Wait for READY and the canonical alias, then GET
   the home page and an article and verify `/api/newsletter/subscribe` and the
   conditional instructions. Keep the public flag false during this brief stage;
   no general-reader delivery is available yet. Do not announce signup, import,
   run campaign commands or make diagnostic production POSTs.
3. **Enable genuine new-reader confirmations.** Vercel → project → Settings →
   Environment Variables: edit only `NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED`
   for **Production** to the exact string `true`; keep Preview false and leave
   `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED=true` and `NEWSLETTER_TEST_RECIPIENTS`
   unchanged. Redeploy the exact approved production commit from Deployments
   using the updated Production environment. Wait for READY and confirm the
   canonical alias points to that deployment. Saving an environment setting
   alone does not update an already-running deployment. This only enables
   confirmations for explicit signup requests; it does not send to existing rows.
4. **One approved smoke test.** Use exactly one explicitly approved identity on
   the existing test allowlist, preferably the existing lifecycle test identity
   that is currently unsubscribed. Submit once from the canonical rendered form;
   no automated/repeated requests. Verify the generic conditional UI, one SES
   send-attempt/success, mailbox receipt and correlated SNS delivery. The row
   must stay pending (new identity) or unsubscribed (returning identity) until
   the human clicks the confirmation button. Verify active afterward, single-use
   replay rejection, then unsubscribe that test identity and verify suppression.
   Preserve the other original subscriber row fingerprints and attribution;
   campaign and recipient counts must remain zero. A new approved identity adds
   one row; reuse adds none. Document this expected change before the test. If
   delivery is unclear, stop and investigate; do not retry blindly.
5. **Decide outcome.** Mark the public signup cutover validated only after the
   mailbox/backend checks pass. Otherwise execute rollback immediately. Campaign
   sending remains separately guarded and unauthorized in either outcome.

## Immediate rollback

In Vercel → project → Deployments, choose the recorded pre-cutover Substack
production deployment and use **Instant Rollback**. Verify `leonlins.com` renders
`action="https://avoidboringpeople.substack.com/api/v1/free"` with GET only. The
recorded deployment must have public confirmations disabled in its deployment
snapshot. Set only the **Production** public flag back to `false` for future
builds; leave the test allowlist intact. If Instant Rollback is unavailable,
redeploy the recorded pre-cutover commit with the public flag false and promote
that READY deployment to production. Do not reset subscribers or remove tokens:
previously issued links/consent remain valid. Do not change SES permissions or
roll back database schema. No import or campaign action is part of recovery.

## Read-only baseline SQL

Run on project `wandering-cake-71980524`, branch `br-little-forest-aevm3snk`
(`production`). Retain only aggregate output, never subscriber addresses/tokens.

```sql
SELECT
  (SELECT count(*) FROM subscribers) AS subscribers,
  (SELECT jsonb_object_agg(status, n)
   FROM (SELECT status, count(*) n FROM subscribers GROUP BY status) s) AS statuses,
  (SELECT count(*) FROM campaigns) AS campaigns,
  (SELECT count(*) FROM campaign_recipients) AS recipients,
  (SELECT md5(string_agg(to_jsonb(s)::text, '' ORDER BY id))
   FROM subscribers s) AS subscriber_fingerprint;
```

## Import remains a later, separate gate

After the public signup cutover, obtain a **fresh Substack export**. Reconcile
consent and suppression against that export and current owned state: cancellations,
unsubscribes, bounces and complaints stay suppressed; automated import must never
reactivate them. Review the no-email dry-run counts, provenance and differences
from the old 5,116-row export before separately authorizing a no-email import.
Do not import the old export during signup preparation or cutover. Successful
signup does not authorize import, campaign snapshots, recipient creation or mail.
