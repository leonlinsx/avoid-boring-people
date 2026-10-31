-- One immutable audience, separately authorized resumable waves. No subscriber
-- rows or existing campaign identities/statuses are changed by this migration.
BEGIN;
ALTER TABLE campaigns DROP CONSTRAINT campaigns_status_check;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft', 'paused', 'sending', 'completed', 'failed')),
  ADD COLUMN batch_id UUID,
  ADD COLUMN batch_send_limit INTEGER CHECK (batch_send_limit > 0),
  ADD COLUMN batch_accepted INTEGER NOT NULL DEFAULT 0 CHECK (batch_accepted >= 0),
  ADD COLUMN batch_started_at TIMESTAMPTZ,
  ADD COLUMN batch_finished_at TIMESTAMPTZ;

ALTER TABLE campaign_recipients ADD COLUMN subscribed_at_snapshot TIMESTAMPTZ;
UPDATE campaign_recipients r
SET subscribed_at_snapshot = COALESCE(s.original_subscribed_at, s.confirmed_at, s.created_at)
FROM subscribers s WHERE s.id = r.subscriber_id;
ALTER TABLE campaign_recipients ALTER COLUMN subscribed_at_snapshot SET NOT NULL;
CREATE INDEX campaign_recipients_pending_order_idx
  ON campaign_recipients (campaign_id, subscribed_at_snapshot DESC, subscriber_id)
  WHERE status = 'pending';
COMMIT;
