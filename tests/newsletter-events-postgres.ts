// Opt-in integration test against a disposable local Postgres cluster only.
// NEWSLETTER_TEST_PG_SOCKET must be a private /tmp directory; never uses DATABASE_URL.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { recordSesEvent } from '../src/lib/newsletter/events.ts';
import type { SnsEnvelope } from '../src/lib/newsletter/sns.ts';
import type { newsletterDb } from '../src/lib/newsletter/db.ts';

const socket = process.env.NEWSLETTER_TEST_PG_SOCKET;
assert.match(socket ?? '', /^\/tmp\/newsletter-event-pg-[A-Za-z0-9]+$/);
function sql(query: string): string {
  return execFileSync('psql', ['-X', '-h', socket!, '-p', '55439', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, PGOPTIONS: '-c search_path=newsletter_event_test,public' },
  }).trim();
}
function literal(value: unknown): string {
  if (value === null) return 'NULL';
  if (Array.isArray(value)) return `ARRAY[${value.map(literal).join(',')}]::text[]`;
  return `'${String(value).replaceAll("'", "''")}'`;
}
const db = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const query = parts.reduce((query, part, index) => query + part + (index < values.length ? literal(values[index]) : ''), '');
  await promisify(execFile)('psql', ['-X', '-h', socket!, '-p', '55439', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], {
    env: { PATH: process.env.PATH, PGOPTIONS: '-c search_path=newsletter_event_test,public' },
  });
  return [];
}) as unknown as ReturnType<typeof newsletterDb>;
const event = (id: string, eventType: string, extra = {}) => ({
  MessageId: id, Message: JSON.stringify({ eventType, mail: { messageId: 'test-message' }, ...extra }),
}) as SnsEnvelope;
const bounce = (id: string) => event(id, 'Bounce', { bounce: { bounceType: 'Permanent', timestamp: '2026-09-08T12:00:00Z', bouncedRecipients: [{ emailAddress: ' PERSON@example.com ' }] } });
const delivery = (id: string) => event(id, 'Delivery', { delivery: { timestamp: '2026-09-08T11:00:00Z' } });
const state = () => sql("SELECT s.status || ':' || r.status FROM subscribers s JOIN campaign_recipients r ON r.subscriber_id=s.id");
sql('CREATE SCHEMA newsletter_event_test');
try {
  sql(readFileSync(new URL('../migrations/newsletter/001_initial.sql', import.meta.url), 'utf8'));
  sql(readFileSync(new URL('../migrations/newsletter/002_event_and_campaign_state.sql', import.meta.url), 'utf8'));
  sql(`INSERT INTO subscribers (email,email_normalized,status,source,unsubscribe_token_hash,consent_provenance)
    VALUES ('person@example.com','person@example.com','active','manual','test','synthetic test');
    INSERT INTO campaigns (article_slug,subject,status) VALUES ('test','test','draft');
    INSERT INTO campaign_recipients (campaign_id,subscriber_id,status,provider_message_id)
      SELECT c.id,s.id,'sent','test-message' FROM campaigns c CROSS JOIN subscribers s;`);
  // Force suppression to fail after the receipt and recipient update are attempted.
  sql("ALTER TABLE subscribers ADD CONSTRAINT forced_failure CHECK (status <> 'bounced')");
  await assert.rejects(() => recordSesEvent(bounce('retry'), db));
  assert.equal(sql('SELECT count(*) FROM newsletter_event_receipts'), '0');
  assert.equal(state(), 'active:sent');
  sql('ALTER TABLE subscribers DROP CONSTRAINT forced_failure');
  await recordSesEvent(bounce('retry'), db);
  assert.equal(state(), 'bounced:bounced');
  const snapshot = sql('SELECT row_to_json(r) FROM campaign_recipients r');
  await recordSesEvent(bounce('retry'), db);
  assert.equal(sql('SELECT row_to_json(r) FROM campaign_recipients r'), snapshot);
  await recordSesEvent(delivery('late-delivery'), db);
  assert.equal(state(), 'bounced:bounced');
  assert.equal(sql('SELECT delivered_at IS NOT NULL FROM campaign_recipients'), 't');
  // Synthetic fixture reset, confined to this disposable schema.
  sql("UPDATE subscribers SET status='active'; UPDATE campaign_recipients SET status='sent'");
  await recordSesEvent(event('redacted', 'Complaint', { complaint: {} }), db);
  assert.equal(state(), 'active:complained');
  await recordSesEvent(event('complaint', 'Complaint', { complaint: { complainedRecipients: [{ emailAddress: 'person@example.com' }] } }), db);
  await recordSesEvent(delivery('after-complaint'), db);
  assert.equal(state(), 'complained:complained');
  sql("UPDATE subscribers SET status='unsubscribed'");
  await recordSesEvent(bounce('already-suppressed'), db);
  assert.equal(state(), 'unsubscribed:complained');
  await recordSesEvent(event('ignored', 'Open'), db);
  assert.equal(state(), 'unsubscribed:complained');
  await Promise.all(Array.from({ length: 5 }, () => recordSesEvent(bounce('concurrent-retry'), db)));
  assert.equal(sql("SELECT count(*) FROM newsletter_event_receipts WHERE event_id='concurrent-retry'"), '1');
  sql("UPDATE subscribers SET status='active'; UPDATE campaign_recipients SET status='sent'");
  await Promise.all([recordSesEvent(bounce('concurrent-bounce'), db), recordSesEvent(delivery('concurrent-delivery'), db)]);
  assert.equal(state(), 'bounced:bounced');
  console.log('Newsletter Postgres integration checks passed (rollback, retry, concurrent replay/events, late delivery, redaction, suppression).');
} finally {
  sql('DROP SCHEMA newsletter_event_test CASCADE');
}
