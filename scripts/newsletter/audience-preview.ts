// Read-only audience preview: compares current active vs proposed default eligible.
// Never writes, never sends, never changes subscriber state.
import { neonDb } from '../../src/lib/neon.ts';
import {
  previewAudience,
  previewDeliveryUnverified,
} from '../../src/lib/newsletter/audience.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value.`);
  return value;
}

const json = process.argv.includes('--json');
const limit = Number(option('--limit') ?? '20');
if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100)
  throw new Error('--limit must be 0–100.');

const db = neonDb('Newsletter');
const preview = await previewAudience(db);

// Fetch sample rows before emitting any output so JSON mode can emit a single document.
let sampleRows:
  Awaited<ReturnType<typeof previewDeliveryUnverified>> | undefined;
let sample: Array<{ id: string; created_at: string }> | undefined;
if (limit > 0 && preview.activeUnverified > 0) {
  sampleRows = await previewDeliveryUnverified(db, limit);
  // JSON sample must never contain raw email addresses or tokens — only id/created_at.
  sample = sampleRows.map((r) => ({ id: r.id, created_at: r.created_at }));
}

if (json) {
  const output: Record<string, unknown> = { ...preview };
  if (sample !== undefined) output.sample = sample;
  // One valid JSON document even when --limit>0 and sample rows exist.
  // No raw email addresses or tokens are included; sample contains only id/created_at.
  console.log(JSON.stringify(output, null, 2));
} else {
  const pad = (label: string, value: number | string) =>
    `  ${label.padEnd(26)}${String(value).padStart(8)}`;
  console.log('Newsletter audience preview — safe-default eligibility');
  console.log(
    'Eligible = active AND (confirmed_at IS NOT NULL OR prior delivery confirmed)',
  );
  console.log('');
  console.log('AUDIENCE SEGMENTS (mutually exclusive)');
  console.log(
    pad('default eligible', preview.defaultEligible) +
      '   ← would be snapshotted',
  );
  console.log(
    pad('active unverified', preview.activeUnverified) +
      '   ← active, no double-opt-in, no confirmed delivery',
  );
  console.log(pad('hard bounces', preview.hardBounces));
  console.log(pad('unknown bounces', preview.unknownBounces));
  console.log(
    pad('validation suppressed', preview.validationSuppressed) +
      '   ← EmailValidationSuppressed',
  );
  console.log(pad('other suppressions', preview.otherSuppressions));
  console.log(pad('complained', preview.complained));
  console.log(pad('unsubscribed', preview.unsubscribed));
  console.log(pad('pending', preview.pending));
  console.log(pad('total', preview.total));
  console.log('');
  console.log('DERIVED');
  console.log(pad('active (total)', preview.active));
  console.log(pad('suppressed', preview.suppressed));
  console.log('');
  console.log('COMPARISON');
  console.log(pad('current active', preview.active));
  console.log(pad('proposed eligible', preview.defaultEligible));
  console.log(pad('excluded (unverified)', preview.activeUnverified));
  if (preview.active > 0) {
    const pct = ((preview.defaultEligible / preview.active) * 100).toFixed(1);
    console.log(
      `  ${preview.defaultEligible} of ${preview.active} active would be included (${pct}%)`,
    );
  }
  if (preview.activeUnverified > 0) {
    console.log('');
    console.log(
      `Note: ${preview.activeUnverified} active subscribers have no confirmed_at and no confirmed delivery.`,
    );
    console.log(
      'They are not deleted, unsubscribed, or marked bounced — simply not in the default snapshot',
    );
    console.log(
      'until a confirmed delivery or website double-opt-in confirmation is recorded.',
    );
  }
  console.log('');
  console.log('NOTES');
  for (const note of preview.overlapNotes) console.log(`  • ${note}`);
  if (!preview.subtypeDetailAvailable)
    console.log('  (subtype detail unavailable — apply migration 007)');

  if (sampleRows !== undefined) {
    console.log('');
    console.log(`DELIVERY-UNVERIFIED SAMPLE (up to ${limit}, newest first)`);
    console.log('  id                                   | created_at');
    if (sampleRows.length === 0) {
      console.log('  (none)');
    } else {
      for (const row of sampleRows) {
        // Never print raw email addresses or tokens; id + timestamp are sufficient for operator review.
        // The full email_normalized is available in the DB but deliberately not echoed.
        console.log(`  ${row.id} | ${row.created_at}`);
      }
    }
  }
}
