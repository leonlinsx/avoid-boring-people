-- Phase 4: first-touch acquisition attribution for owned signups.
-- Additive only: subscribers keep their existing lifecycle columns, and the
-- Substack import leaves these columns NULL because the historical channel of an
-- imported subscriber is not known. Raw values are preserved; the normalized
-- source vocabulary lives in src/lib/newsletter/attribution.ts so it can change
-- without a migration.
ALTER TABLE subscribers
  ADD COLUMN acquisition_source TEXT,
  ADD COLUMN acquisition_detail TEXT,
  ADD COLUMN utm_source TEXT,
  ADD COLUMN utm_medium TEXT,
  ADD COLUMN utm_campaign TEXT,
  ADD COLUMN utm_content TEXT,
  ADD COLUMN signup_path TEXT,
  ADD COLUMN referrer_domain TEXT;

-- No index: acquisition reporting groups the whole table by source over a time
-- range, which no available key order can narrow, and the growth query reads the
-- same rows without one. A single ALTER TABLE is also atomic, so a failed
-- application leaves nothing half-applied.
