import { neonDb } from '../neon.ts';

// One SELECT / one MVCC snapshot. No recipient identifiers, addresses or tokens.
export async function campaignStatus(
  campaignId: string,
  db = neonDb('Newsletter'),
) {
  const rows =
    await db`SELECT c.id, c.status, c.content_hash, c.recipient_selection,
    c.batch_id, c.batch_send_limit, c.batch_accepted, c.batch_started_at, c.batch_finished_at,
    count(r.subscriber_id)::int AS total,
    count(*) FILTER (WHERE r.status = 'pending')::int AS pending,
    count(*) FILTER (WHERE r.status = 'sent')::int AS sent,
    count(*) FILTER (WHERE r.delivered_at IS NOT NULL)::int AS delivered,
    count(*) FILTER (WHERE r.status = 'bounced')::int AS bounced,
    count(*) FILTER (WHERE r.status = 'complained')::int AS complained,
    count(*) FILTER (WHERE r.status = 'failed' AND r.error_detail = 'suppressed before send')::int AS suppressed_skipped,
    count(*) FILTER (WHERE r.status = 'failed' AND r.error_detail IS DISTINCT FROM 'suppressed before send')::int AS failed,
    count(*) FILTER (WHERE r.status = 'sending')::int AS indeterminate
    FROM campaigns c LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
    WHERE c.id = ${campaignId} GROUP BY c.id`;
  if (rows.length !== 1) throw new Error('Campaign not found.');
  return rows[0];
}
