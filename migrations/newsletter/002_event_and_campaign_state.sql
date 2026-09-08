-- Phase 3: retain delivery-event timing and make provider-message lookups cheap.
-- This is additive: existing campaign rows and the Phase 1 subscriber lifecycle are unchanged.
ALTER TABLE campaign_recipients
  ADD COLUMN delivered_at TIMESTAMPTZ,
  ADD COLUMN bounced_at TIMESTAMPTZ,
  ADD COLUMN complained_at TIMESTAMPTZ,
  ADD COLUMN last_event_at TIMESTAMPTZ;

CREATE INDEX campaign_recipients_provider_message_id_idx
  ON campaign_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
