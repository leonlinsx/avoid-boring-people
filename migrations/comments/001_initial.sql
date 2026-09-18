-- First-party article discussion (replaces Giscus).
--
-- One table only. Identity is an opaque hashed browser token, so there is no
-- accounts table, identity table, rate-limit table, or moderation log: rate
-- limiting counts rows here, and ownership is compared against
-- author_token_hash. `id` is a UUID so public identifiers never expose how many
-- comments exist or in what order they arrived.
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id),
  author_token_hash TEXT,
  author_name TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  is_author BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comments_status_check CHECK (status IN ('published', 'hidden')),
  CONSTRAINT comments_parent_is_not_self CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT comments_post_slug_length
    CHECK (char_length(post_slug) BETWEEN 1 AND 120),
  -- Length limits mirror src/lib/comments/domain.ts; the application validates
  -- first and this is only a backstop against a non-conforming writer.
  CONSTRAINT comments_author_name_length
    CHECK (author_name IS NULL OR char_length(author_name) BETWEEN 1 AND 60),
  CONSTRAINT comments_body_length
    CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 3000),
  -- Either a comment carries its content and the token that owns it, or it is a
  -- content-removed placeholder kept only so replies do not lose their thread.
  -- Author comments written by the local operator CLI have no owning token.
  CONSTRAINT comments_content_state CHECK (
    (
      author_name IS NOT NULL
      AND body IS NOT NULL
      AND (author_token_hash IS NOT NULL OR is_author)
    )
    OR (
      author_name IS NULL
      AND body IS NULL
      AND author_token_hash IS NULL
    )
  )
);

-- Reading a discussion, and counting recent comments by one browser identity for
-- rate limiting.
CREATE INDEX IF NOT EXISTS comments_post_slug_created_at_idx ON comments (post_slug, created_at);
CREATE INDEX IF NOT EXISTS comments_author_token_created_at_idx
  ON comments (author_token_hash, created_at);
CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON comments (parent_id);
