-- Phase 7: Preserve SES bounce diagnostics for deliverability analytics.
-- Additive only: no existing rows, statuses, or constraints are changed.
-- Stores only validated bounceType/bounceSubType (no PII, no raw payloads).
-- Historical receipts keep NULL subtype and are reported as "unknown" rather than guessed.

BEGIN;

ALTER TABLE newsletter_event_receipts
  ADD COLUMN bounce_type TEXT CHECK (char_length(bounce_type) <= 16),
  ADD COLUMN bounce_subtype TEXT CHECK (char_length(bounce_subtype) <= 64);

-- Per-recipient classification cache for read-only audit and campaign status.
ALTER TABLE campaign_recipients
  ADD COLUMN bounce_type TEXT CHECK (char_length(bounce_type) <= 16),
  ADD COLUMN bounce_subtype TEXT CHECK (char_length(bounce_subtype) <= 64);

COMMIT;
