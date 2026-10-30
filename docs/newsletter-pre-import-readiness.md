# Pre-import readiness — October 30, 2026

**GO — ready for fresh export and import dry run.** This verdict covers obtaining
an export and performing no-email, read-only reconciliation. It does **not**
authorize import, merge, deployment, subscriber mutations, campaigns or mail.
Checks were performed around 01:20–01:35 America/New_York. Source reviewed at
`af1e4b7` plus this cleanup; production remains at the SHA below.

## Legacy paths and cleanup

- Shared `SubscribeForm.astro` already used `/api/newsletter/subscribe` on home,
  article and localized pages. Removed its Substack no-JavaScript signup link;
  without JavaScript the form is hidden and an explicit explanation is shown.
  Enabled-JavaScript layout, validation, localized CTA copy and payload are retained.
- Repository search found no active caller of `/api/subscribe`. Its only references
  were the route, tests and historical documentation. Retired all methods with
  JSON HTTP 410, no redirect, body processing, database access or upstream fetch.
  External integrations cannot be ruled out from repository evidence; they now
  receive an explicit failure instead of being subscribed elsewhere.
- No other active Substack signup action, redirect or signup URL remains in
  source/config/scripts. Preserved historical article footnotes, third-party
  editorial citations and structured-data `sameAs` profile/archive URLs in
  `src/consts.ts`. Current header/footer navigation contains no Substack signup.
- Privacy now describes Neon, SES, double opt-in and current attribution, while
  retaining unsubscribe/suppression and no-email-tracking disclosures. Also
  disclosed the existing Microsoft Clarity script observed in live HTML.
- Corrected current operational docs and README; explicitly labeled older
  readiness/cutover execution evidence historical. Historical counts are not approval.

## Production evidence and limits

| Check | Result |
| --- | --- |
| Vercel project | `avoid-boring-people`, `prj_Swcosa9UBmQBNDvJXFLIbTkHF7u6` |
| Production deployment | `dpl_HLQe2ofc62hxq1iwonW31dhiimaz`, **READY**, target production |
| Production SHA | `bd219b30b307baaf3e0158b1fc0512d8666e190d` |
| Aliases | Both `leonlins.com` and `www.leonlins.com` assigned to that deployment; domain records verified |
| DNS / HTTP | Both resolve through Cloudflare. Canonical homepage/article GET returned 200 through Vercel fetch; www returned 301; Vercel's configured www redirect is 307 to apex |
| Rendered signup | Home and `/writing/2020_04_15_keen/` use POST `/api/newsletter/subscribe` |
| Confirmation flags | Production `NEWSLETTER_CONFIRMATION_DELIVERY_ENABLED=true` and `NEWSLETTER_CONFIRMATION_PRODUCTION_ENABLED=true`, read individually |
| Config presence | Production database URL, AWS region/access-key/secret-key, SES configuration set, SNS topic and test allowlist entries exist; secrets were not decrypted |
| Logs | No `newsletter` or confirmation-send-failure events in the available approximately 50-minute window. Seven-day query refused by plan retention; absence of recent logs does not establish historical health |
| SES live inspection | GetAccount, GetEmailIdentity, GetConfigurationSet and GetConfigurationSetEventDestinations all returned `AccessDeniedException` using existing local credentials; no permission changes attempted |

Direct terminal HTTP was blocked with 403; the authenticated Vercel GET tool
provided the page evidence. No live signup/confirmation/unsubscribe POST occurred.
Original end-to-end smoke-test success on October 14 is operator-provided history,
not a test repeated here. Current delivery, mailbox receipt, account quota,
suppression settings, authentication and SNS subscription health remain unverified.
The legacy fallback and relay remain live until this PR is approved and deployed.

## Owned database audit

SELECT-only queries targeted Neon project `wandering-cake-71980524`, confirmed
branch `production` / `br-little-forest-aevm3snk`. No database changes were made.

| Aggregate | Count |
| --- | ---: |
| Total subscribers | 4 |
| Active / pending / unsubscribed | 1 / 2 / 1 |
| Bounced / complained / imported | 0 / 0 / 0 |
| Website-origin created since October 14, 00:00 ET | 1 (pending) |
| Campaigns / campaign recipients | 0 / 0 |
| Duplicate normalized email groups / normalization exceptions | 0 / 0 |
| Active without consent provenance / active with outstanding confirmation | 0 / 0 |
| Suppressed with outstanding confirmation | 0 |
| Post-cutover signup missing source detail, consent provenance, attribution source or signup path | 0 |

All four rows have website double-opt-in provenance and source detail. Three
older rows have no attribution and remain unknown; the new row has referral
attribution and a signup path. No address, token, row ID or source-detail value
was retrieved. Nine stored `sent` delivery events appear in the last 30 days;
these do not establish current delivery or represent campaigns.

One pre-cutover pending row has no confirmation expiry. This is a known
fail-closed legacy state: confirmation SQL requires an unexpired token. The new
pending row has an expiry. Do not backfill, confirm or delete the old row here.

Physical columns, constraints and indexes match newsletter migrations 001–005:
unique normalized email, required status/source/consent and unsubscribe hash,
pending-token constraint, attribution, confirmation expiry, campaign digest,
recipient uniqueness/send-claim fields and event deduplication. No migration
ledger was used to infer application history. No new migration is needed.

## Import reconciliation and safeguards

Only the October 13 export was found in Downloads; no fresh post-cutover export
was available in the repository or usual local export locations. It was not
uploaded, printed or imported. Fresh counts, input/roster fingerprints, overlap
with the four owned rows and cancellation differences cannot yet be recalculated.
Historical baseline: 5,235 source / 5,116 eligible / 118 cancellations / one Author;
prior zero collisions is **not** evidence of zero collisions today.

| Case | Existing behavior / next gate |
| --- | --- |
| Fresh full export | Validate columns, dates, all counts, duplicate/invalid rows, exact input and eligible-roster fingerprints; compare with retained original cancellation evidence |
| Cancellations / unsubscribes | Excluded from SQL payloads; cancellation wins locally; an address previously cancelled but now presented as active fails the entire input |
| Existing owned subscribers / cross-source duplicates | Every collision, including active, pending and suppressed website rows, fails the entire import. No merge/skip override; preserves newer consent and attribution |
| Bounces / complaints / suppression | Exact retries never update existing rows; unexpected suppressed collisions refuse. SES account-level suppression was not inspectable and is a separate delivery gate |
| Active consent / provenance | Insert-only import stores original dates and Substack provenance/fingerprints; existing consent and first-touch attribution cannot be overwritten |
| Repeated import | Exact identity required; one bounded transaction, collision recheck under table lock, unique email and ON CONFLICT DO NOTHING; later opt-outs remain intact |
| Dry run then authorized import | Inspection and preflight send no mail. Writer CLI separately requires exact counts, three fingerprints, secret and explicit confirmation; no automatic retry |
| After import | Repeat read-only preflight; compare predicted totals, resumable/new rows, suppression, status counts, duplicate/consent exceptions and unchanged campaign/recipient counts. Preserve private before/after evidence |

An old cancelled address overlapping an owned row is deliberately omitted from
SQL, so the importer will not suppress or alter that owned row. Any conflicting
consent history needs private operator review, never an automatic state rewrite.
No evidence supports relaxing collision guards. A collision on the fresh file
is a mandatory stop and separate decision, not a reason to reactivate anyone.

## Next operator stage — no mail, no writes

Obtain a fresh **full** Substack subscriber export after cutover, including
cancellation dates and Author rows; do not provide an active-only filtered CSV.
Keep it and the immutable original export outside Git. Use the existing approved
original-evidence SHA-256 from the private record, not a hash newly blessed from
a changed file. Configure the existing SELECT-only production connection using
the established secret mechanism; do not paste credentials into commands.

```sh
# SUBSTACK_CSV: fresh full export; SUBSTACK_CANCELLATION_EVIDENCE: retained original.
# APPROVED_EVIDENCE_SHA256: previously approved private original-file fingerprint.
npm run newsletter:import:dry-run -- "$SUBSTACK_CSV" \
  --cancellation-evidence "$SUBSTACK_CANCELLATION_EVIDENCE" \
  --expect-evidence-file-sha256 "$APPROVED_EVIDENCE_SHA256"
npm run newsletter:import:preflight -- "$SUBSTACK_CSV" \
  --cancellation-evidence "$SUBSTACK_CANCELLATION_EVIDENCE" \
  --expect-evidence-file-sha256 "$APPROVED_EVIDENCE_SHA256"
```

Mandatory **before import**: privately reconcile fresh counts/hashes, all overlap
and cancellation differences against current Neon state; require `inputValid`
and `ready`, zero unexpected collisions and validation exceptions; approve the
exact target, roster, evidence and counts separately. The guarded future import
command and post-import recovery are in [the runbook](newsletter-import-runbook.md).
Never reuse historical projected totals (the owned baseline is now four, not three).
Merge/deploy of this cleanup also requires separate approval.

Optional for the export/dry-run stage, mandatory before claiming full delivery
readiness: obtain read-only SES/SNS/account-suppression evidence through an
already authorized operator and complete any outstanding inbox/provider gates.
Longer historical runtime logs are unavailable under current retention. The old
pending row needs no mutation to run preflight. No email or campaign is part of
reconciliation. Import approval never authorizes campaign creation or sending.

## Verification

- `npm test`: all custom suites passed, including owned signup, confirmation,
  unsubscribe, suppression, attribution, import guards and production-send guards.
  Initial sandbox execution failed in a translation child-process fixture;
  unrestricted local fixture-only rerun passed without changing that suite.
- `python -m pytest tests -q`: **721 passed**.
- `npm run lint`, `npm run build`: passed.
- `node tests/newsletter-signup-browser.mjs`: passed against local Astro with
  empty database URLs and both delivery flags false. All signup requests mocked;
  external/other API requests blocked. Home/article/Japanese forms, enabled and
  disabled JavaScript, existing compact UX, validation, attribution, duplicate
  submits and HTTP/network/JSON errors exercised.
- `npm run test:newsletter:browser`: local confirmation POST and origin controls passed
  with an invalid synthetic token, no SES and no real database access.
- Disposable local Postgres import and lifecycle suites passed with synthetic
  fixtures, including the full 5,235-row / 5,116-eligible import, rollback, collision
  rejection, exact retry and later opt-out preservation. No SES or production DB.
- Final diff reviewed; no lifecycle/import/send implementation, dependencies,
  production settings, schema or historical article content changed.
