// Read-only reconciliation/audit for campaign bc9c04a7-90ee-4036-84a7-c442c79e549e
// Usage: node --env-file-if-exists=.env.local --import ts-node/esm scripts/newsletter/audit-anthropic-reconciliation.ts
// Never writes, never sends, never logs PII (only IDs and counts).

import { neonDb } from '../../src/lib/neon.ts';

const CAMPAIGN_ID = 'bc9c04a7-90ee-4036-84a7-c442c79e549e';

async function main() {
  const db = neonDb('Newsletter');
  console.log(`Anthropic IPO campaign reconciliation — ${CAMPAIGN_ID}`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');

  // Campaign ledger (read-only, no PII)
  const campaign =
    await db`SELECT id, article_slug, subject, status, recipient_selection,
    content_hash, created_at, started_at, completed_at,
    batch_id, batch_send_limit, batch_accepted, batch_started_at, batch_finished_at
    FROM campaigns WHERE id = ${CAMPAIGN_ID}::uuid`;
  if (campaign.length === 0) {
    console.log('Campaign not found in this database (check DATABASE_URL).');
    console.log('This is expected in non-production environments.');
    process.exit(0);
  }
  console.log('CAMPAIGN');
  console.log(JSON.stringify(campaign[0], null, 2));
  console.log('');

  // Recipient totals by status (no addresses)
  const totals = await db`SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE status = 'pending')::int AS pending,
    count(*) FILTER (WHERE status = 'sent')::int AS sent,
    count(*) FILTER (WHERE status = 'bounced')::int AS bounced,
    count(*) FILTER (WHERE status = 'complained')::int AS complained,
    count(*) FILTER (WHERE status = 'failed')::int AS failed,
    count(*) FILTER (WHERE status = 'sending')::int AS indeterminate,
    count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
    count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS accepted
    FROM campaign_recipients WHERE campaign_id = ${CAMPAIGN_ID}::uuid`;
  console.log('RECIPIENT LEDGER (counts only, no PII)');
  console.log(JSON.stringify(totals[0], null, 2));
  console.log('');

  // Bounce subtype breakdown from campaign_recipients cache (after migration)
  // Historical rows will have NULL subtype => unknown.
  const recipientSubtype = await db`SELECT
    COALESCE(bounce_subtype, 'UNKNOWN_HISTORICAL') AS subtype,
    COALESCE(bounce_type, 'UNKNOWN') AS type,
    count(*)::int AS count
    FROM campaign_recipients
    WHERE campaign_id = ${CAMPAIGN_ID}::uuid AND status = 'bounced'
    GROUP BY 1,2 ORDER BY count DESC`;
  console.log('BOUNCED RECIPIENTS BY STORED SUBTYPE (campaign_recipients)');
  console.log(JSON.stringify(recipientSubtype, null, 2));
  console.log('');

  // Event receipt breakdown (source of truth for deliverability)
  // Per AWS: Permanent/General, NoEmail, Suppressed COUNT toward reputation;
  // EmailValidationSuppressed, OnAccount/OnTenant/Unsubscribed do NOT;
  // NULL or unrecognized subtype remains unknown.
  const receipts = await db`SELECT
    count(*)::int AS receipts,
    (count(*) FILTER (WHERE event_status = 'sent'))::int AS deliveries,
    (count(*) FILTER (WHERE event_status = 'bounced' AND bounce_subtype = 'EmailValidationSuppressed'))::int AS validation_suppressions,
    (count(*) FILTER (WHERE event_status = 'bounced' AND bounce_type = 'Permanent' AND bounce_subtype IN ('General','NoEmail','Suppressed')))::int AS hard_bounces,
    (count(*) FILTER (WHERE event_status = 'bounced' AND bounce_subtype IN ('OnAccountSuppressionList','OnTenantSuppressionList','UnsubscribedRecipient')))::int AS other_suppressions,
    (count(*) FILTER (WHERE event_status = 'bounced' AND (bounce_subtype IS NULL OR bounce_subtype NOT IN ('General','NoEmail','Suppressed','EmailValidationSuppressed','OnAccountSuppressionList','OnTenantSuppressionList','UnsubscribedRecipient'))))::int AS unknown_bounces,
    (count(*) FILTER (WHERE event_status = 'bounced'))::int AS bounced_total,
    (count(*) FILTER (WHERE event_status = 'complained'))::int AS complained
    FROM newsletter_event_receipts
    WHERE provider_message_id IN (SELECT provider_message_id FROM campaign_recipients WHERE campaign_id = ${CAMPAIGN_ID}::uuid AND provider_message_id IS NOT NULL)
      AND provider = 'sns'`;
  console.log('EVENT RECEIPTS JOINED TO CAMPAIGN (SES perspective)');
  console.log(JSON.stringify(receipts[0], null, 2));
  console.log('');

  // What can be established vs unknown
  console.log('RECONCILIATION SUMMARY');
  console.log(`- Snapshotted recipients: ${totals[0].total} (expected 5118)`);
  console.log(
    `- Attempted (accepted by SES): ${totals[0].accepted} (campaign_recipients.sent_at not null)`,
  );
  console.log(`- Bounced (ledger status): ${totals[0].bounced}`);
  console.log(
    `- Receipts show unknown_bounces=${receipts[0].unknown_bounces} of ${receipts[0].bounced_total} bounced receipts`,
  );
  console.log(
    `- Validation suppressions identifiable: ${receipts[0].validation_suppressions}`,
  );
  console.log(
    `- Genuine hard bounces identifiable: ${receipts[0].hard_bounces}`,
  );
  console.log(`- Other suppressions: ${receipts[0].other_suppressions}`);
  console.log('');
  console.log('EVIDENCE LIMITS:');
  console.log(
    '- Historical 207 bounced rows have NULL bounce_subtype because events.ts did not preserve it.',
  );
  console.log(
    '- They cannot be retrospectively classified as EmailValidationSuppressed vs General/NoEmail/Suppressed; unknown remains unknown.',
  );
  console.log(
    '- No raw SNS payloads, email addresses, or tokens are stored, so re-derivation from retained rows is limited to counts above.',
  );
  console.log(
    '- Provider suppression list state is external to this database and not captured.',
  );
  console.log(
    '- Actual reputation bounce rate for the 1,296 attempted sends is not fully ascertainable due to 207 unknown subtypes.',
  );
  console.log('');
  console.log('IMPLICATIONS FOR REMAINING 3,822 PENDING:');
  console.log(
    '- Pending recipients are still in status=pending and have never been attempted; their eligibility is unchanged.',
  );
  console.log(
    '- However, if the list contains similarly invalid addresses, future waves will generate new validation suppressions.',
  );
  console.log(
    '- Those future suppressions will now be recorded with subtype and excluded from reputation bounceRate, but remain terminal (no auto-resend).',
  );
  console.log(
    '- Real hard-bounce risk remains: unknown historical rate cannot be used to estimate true list quality; scheduled health check is inconclusive for that window.',
  );
  console.log('');
  console.log(
    'GUARDED OPERATOR STEPS (reference only — do not execute without separate explicit approval; this script does not authorize sending):',
  );
  console.log(
    '1. Apply migration 007_bounce_classification.sql via direct DB connection (read docs/migration instructions), if separately approved.',
  );
  console.log(
    '2. Verify with: npm run newsletter:status -- bc9c04a7-90ee-4036-84a7-c442c79e549e (read-only, no PII).',
  );
  console.log(
    '3. Re-run this audit to confirm pending=3822, indeterminate=0, status=paused. Do not change recipient ledger.',
  );
  console.log(
    '4. Any resumption — if separately approved — must use the guarded interface with exact expectations, e.g.: npm run newsletter:send -- <campaign-id> --expect-recipients 5118 --expect-content <preview-sha256> --send-limit <limit> --confirm-production (see docs/newsletter-aws-runbook.md). This audit does not approve sending.',
  );
  console.log(
    '5. Monitor SES reputation dashboard; hold if known hard-bounce rate (General/NoEmail/Suppressed) >=2% or complaint >=0.1%, or if unknown rate makes the window inconclusive.',
  );
}

main().catch((e) => {
  console.error('Audit failed (read-only):', e instanceof Error ? e.name : e);
  process.exit(1);
});
