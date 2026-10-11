-- Old unbounded confirmation links deliberately fail closed. A fresh request
-- issues a 24-hour link without changing suppression or first-touch provenance.
ALTER TABLE subscribers ADD COLUMN confirmation_expires_at TIMESTAMPTZ;

-- Legacy drafts have no approved digest and cannot be sent by the new CLI.
ALTER TABLE campaigns
  ADD COLUMN content_hash TEXT CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN recipient_selection TEXT;

CREATE INDEX newsletter_rate_limits_window_idx
  ON newsletter_rate_limits (window_started_at);
