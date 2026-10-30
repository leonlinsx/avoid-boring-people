# Historical pre-cutover newsletter readiness

> Superseded for current status by [the pre-import report](newsletter-pre-import-readiness.md). The October 11 findings below are historical; public signup cut over October 14, 2026.

Reviewed `main` at `9eaf0f2a060c017d8788dc2649b05534a9059e52` (2026-10-11, America/New_York). This PR prepares code for controlled validation; it does not authorize imports, production sending, configuration changes, or cutover. The public form still submits directly to Substack.

## Verified code safeguards

- **Warm-up readiness gap fixed:** explicit 200–300 recent-subscriber cohorts, stable UUID tiebreaking, active-only eligibility, atomic exact-count snapshot, safety ceiling, stored selection and immutable recipient membership on retry. All-active mode remains explicit through its exact-count approval. No engagement is invented.
- **Consent/security gaps fixed:** new and refreshed confirmation tokens expire after 24 hours in SQL. Undated legacy links fail closed. Confirmation consumes hash/expiry; unsubscribe invalidates both. Resubscription stays suppressed until a fresh, unexpired token is confirmed, preserves original attribution/timestamps, and never reopens bounced/complained rows. Authenticated permanent bounce/complaint events now also suppress pending and resubscribing confirmation recipients and invalidate their links. Confirmation delivery requires the guarded token write to succeed, so a concurrent suppression/activation does not receive an unused link.
- **Signup controls:** 8 KiB streaming byte cap (including chunked/UTF-8 bodies), typed/bounded email and metadata, consistent honeypot handling, canonical IP buckets. On Vercel only validated `x-vercel-forwarded-for` supplies the bucket; invalid/missing values share `unknown`. Off Vercel the adapter address is used. Per-address/IP hourly limits retain only hashes; indexed opportunistic cleanup deletes at most 100 expired rows per call and counters saturate. Owned signup retains neutral responses and fails closed on pipeline/store failure.
- **Approval integrity gap fixed:** preview prints a rendered-content digest; snapshot and send require that digest. Subject/body/renderer/footer/header drift is refused before sending. Existing drafts lacking a digest are refused. Campaign uniqueness, conditional campaign/recipient claims, suppression rechecks, SES account/quota/rate checks, local confirmation flags and indeterminate-send stops remain intact.
- **Error regression fixed:** malformed unauthenticated SNS bodies no longer reach logs through JSON parse messages; legacy relay errors and confirmation delivery logs no longer copy arbitrary exception messages. SNS topic/signature/certificate checks, atomic event deduplication and authenticated-failure retry responses remain intact. Legacy JSON/form fallback still targets the fixed Substack endpoint.

Verification: full `npm test`, 699 Python tests, `npm run lint`, `npm run build`, a real local preview, and disposable Postgres lifecycle/cohort/rate-limit, SES-event, and analytics suites. Fixtures only; no live email, subscriber import or production database use. The event suite's redacted-complaint assertion was already wrong on untouched main: a known campaign message ID legitimately identifies its recipient. It now checks that behavior. Extra `astro check` reports the same 14 errors on untouched main and this branch (no new errors); build passes.

## Remaining live AWS / Neon / DNS validation

These remain gates before owned production operation; local tests cannot establish them:

- Apply migrations through `005` in an approved Neon environment before changed endpoints/CLI deployment. Check deployed schema, role privileges, pooled runtime connection, rollback/recovery and the intentional rejection of undated tokens/old drafts. Do not automatically approve legacy draft content.
- Verify separate runtime/local IAM permissions and retained test-recipient restriction, SES verified identity/region/configuration set, production access, quota, account suppression and disabled open/click tracking. No permission expansion is authorized here.
- Exercise approved test-mail confirmation, expiry/reissue, resubscription, unsubscribe/one-click and SES simulator bounce/complaint with actual SNS delivery. Check exact topic/signature rejection, retry/deduplication, early-event reconciliation and failure visibility. Redacted complaints with neither a known campaign message nor a named confirmation recipient cannot be attributed from stored confirmation state; validate provider suppression as well, without guessing recipients.
- Verify SPF/DKIM/DMARC and MAIL FROM/inbound compatibility, monitored reply-to, delivered headers and inbox rendering, deployed privacy/assets, and Vercel platform IP buckets with forged forwarding headers. A proxy in front of Vercel can aggregate callers into a proxy bucket; do not trust arbitrary external forwarding values to avoid that.
- Review the exact warm-up snapshot locally; obtain separate human approval for every send and expansion. Hold/investigate at complaint rate ≥0.1% or hard-bounce rate ≥2%. Confirm logs and read-only health reporting are observed.

## Phase 5 cutover tasks

Only after controlled validation and successful warm-up: approve the real export/import with exact counts and suppression/provenance reconciliation, switch the canonical form to owned signup, replace the `/newsletter` redirect with its acquisition page, enable approved production confirmations and make the local SES CLI the canonical sender. Confirm privacy copy, end-to-end user flows and operational rollback. Keep Substack/manual cross-posting and the rollback path until stable. None is activated by this PR.

## Not genuine pre-migration blockers

- The original first `x-forwarded-for` value is not a demonstrated spoofing vulnerability on Vercel: its platform overwrites that header. The change makes trust explicit and rejects malformed chains. [Vercel request-header documentation](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).
- The legacy relay intentionally fails open during a rate-store outage, and the live form posts directly to Substack, bypassing that relay. This is an existing availability/provider boundary, not a newly introduced bypass or a reason to activate cutover early.
- No remote article-edit capability was established; content drift and missing cohort selection were operational approval gaps, not remote compromise findings. External image bytes are a controlled deployment check, not a reason to add blob storage/versioning infrastructure.
- No dashboard, vendor, tracking, generalized segmentation or sending automation is required. The unchanged main type-check debt is separate from newsletter migration readiness.
