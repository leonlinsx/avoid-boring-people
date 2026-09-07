CREATE TYPE newsletter_subscriber_status AS ENUM (
  'pending', 'active', 'unsubscribed', 'bounced', 'complained'
);

CREATE TYPE newsletter_subscriber_source AS ENUM (
  'substack_import', 'website', 'manual'
);

CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  name TEXT,
  status newsletter_subscriber_status NOT NULL,
  source newsletter_subscriber_source NOT NULL,
  source_detail TEXT,
  original_subscribed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  confirmation_token_hash TEXT,
  unsubscribe_token_hash TEXT NOT NULL,
  legacy_substack_type TEXT,
  legacy_substack_cancel_date TIMESTAMPTZ,
  consent_provenance TEXT NOT NULL,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscribers_email_normalized_lowercase
    CHECK (email_normalized = lower(email_normalized)),
  CONSTRAINT subscribers_pending_requires_confirmation_token
    CHECK (status <> 'pending' OR confirmation_token_hash IS NOT NULL)
);

CREATE UNIQUE INDEX subscribers_email_normalized_key
  ON subscribers (email_normalized);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE campaign_recipients (
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'bounced', 'complained', 'failed')),
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  error_detail TEXT,
  PRIMARY KEY (campaign_id, subscriber_id)
);

CREATE TABLE newsletter_rate_limits (
  scope TEXT NOT NULL CHECK (scope IN ('ip', 'email')),
  subject TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  PRIMARY KEY (scope, subject)
);

CREATE TABLE newsletter_event_receipts (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);
