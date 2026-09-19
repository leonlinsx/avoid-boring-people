-- Contact notes: messages a reader chose to send from the site.
--
-- One table, one row per note. A row records what arrived and whether it has
-- finished moving; it is deliberately not a relationship record. Nothing here
-- creates, links, or scores a Person, an Organization, or a company/domain
-- association, and nothing here counts or qualifies a sender. Deciding whether
-- an inbound is worth promoting into a relationship graph is a human review
-- step that happens inside Lin Check, against Lin Check's own data.
--
-- `notified_at` is the one marker of work still owed to a reader: a note whose
-- notification email was rejected stays NULL and therefore unfinished, so the
-- operator query is "what still needs attention" rather than "what arrived
-- recently". It records that SES accepted the notification, not that the
-- notification was delivered: a mailbox-level bounce of the notification itself
-- is only visible as notes that stopped arriving. `lin_check_synced_at` is
-- forensic rather than workflow state: the handoff is optional and best-effort,
-- so a row without it is not a row anybody is waiting on, and a failed handoff
-- is reported by its own alert line.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  -- '/about', '/now', '/contact', or 'unknown'. Never a full URL: the site
  -- records the page, not the query string or the referring site.
  source_page TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  lin_check_synced_at TIMESTAMPTZ,
  -- Length limits mirror src/lib/contact/domain.ts. The application validates
  -- first and returns friendly errors; these constraints are only a backstop
  -- against a writer that skipped validation.
  CONSTRAINT contact_submissions_name_length
    CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT contact_submissions_email_length
    CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT contact_submissions_message_length
    CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT contact_submissions_source_page_length
    CHECK (char_length(source_page) BETWEEN 1 AND 200)
);

-- Partial index on the only query that has an operator waiting on it: a note whose
-- notification never went out. A skipped or failed Lin Check handoff is reported by
-- the `lin_check_failure` alert line and stays visible in `lin_check_synced_at`, so
-- it does not make a row unfinished.
CREATE INDEX IF NOT EXISTS contact_submissions_unfinished_idx
  ON contact_submissions (created_at)
  WHERE notified_at IS NULL;
