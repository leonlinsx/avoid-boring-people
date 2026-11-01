-- Preserve permanent delivery suppression independently of opt-out status.
-- A hard bounce (Permanent + General/NoEmail/Suppressed) or a complaint is a
-- deliverability fact that must survive an unsubscribe/resubscribe cycle.
-- EmailValidationSuppressed, other provider suppressions, and unknown bounces
-- are not classified as mailbox-not-found and do not set this flag.
-- This is additive: no existing statuses are changed, no rows are deleted.

BEGIN;

ALTER TABLE subscribers
  ADD COLUMN hard_bounced_at TIMESTAMPTZ,
  ADD COLUMN complained_at TIMESTAMPTZ;

-- Backfill from existing campaign evidence where classification is unambiguous.
UPDATE subscribers s SET hard_bounced_at = sub.min_bounced_at
FROM (
  SELECT subscriber_id, min(bounced_at) AS min_bounced_at
  FROM campaign_recipients
  WHERE status = 'bounced'
    AND bounce_type = 'Permanent'
    AND bounce_subtype IN ('General','NoEmail','Suppressed')
  GROUP BY subscriber_id
) sub
WHERE s.id = sub.subscriber_id AND s.hard_bounced_at IS NULL;

UPDATE subscribers s SET complained_at = sub.min_complained_at
FROM (
  SELECT subscriber_id, min(complained_at) AS min_complained_at
  FROM campaign_recipients
  WHERE status = 'complained'
  GROUP BY subscriber_id
) sub
WHERE s.id = sub.subscriber_id AND s.complained_at IS NULL;

-- Helpful index for the eligibility query: active + not suppressed + verified.
CREATE INDEX subscribers_eligible_idx
  ON subscribers (status, confirmed_at, hard_bounced_at, complained_at)
  WHERE status = 'active';

COMMIT;
