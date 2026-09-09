-- Phase 3: make production campaign snapshots unique and sends crash-safe.
-- A recipient left in `sending` is deliberately indeterminate and must never be
-- retried automatically: SES may have accepted the message before the process
-- lost its database connection.
ALTER TABLE campaign_recipients
  DROP CONSTRAINT campaign_recipients_status_check;

ALTER TABLE campaign_recipients
  ADD CONSTRAINT campaign_recipients_status_check
    CHECK (status IN ('pending', 'sending', 'sent', 'bounced', 'complained', 'failed')),
  ADD COLUMN attempt_started_at TIMESTAMPTZ;

CREATE UNIQUE INDEX campaigns_article_slug_key
  ON campaigns (article_slug);

-- Retain only the provider message identifier and normalized event state. This
-- permits reconciliation when SNS wins the race against the sender recording
-- the SES message id, without storing the signed SNS body.
ALTER TABLE newsletter_event_receipts
  ADD COLUMN provider_message_id TEXT,
  ADD COLUMN event_status TEXT CHECK (event_status IN ('sent', 'bounced', 'complained')),
  ADD COLUMN event_at TIMESTAMPTZ;

CREATE INDEX newsletter_event_receipts_provider_message_id_idx
  ON newsletter_event_receipts (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
