-- Read-only, author-only analysis. psql -v window_start=... -v window_end=...
-- Derived source labels do not change stored or normal report classifications.
-- Same confirmation/import dates and UTM precedence as the existing report.
WITH evidence AS (
  SELECT acquisition_source AS stored_source, source,
    signup_path,
    lower(trim(utm_source)) AS tag,
    regexp_replace(lower(trim(referrer_domain)), '^www\.', '') AS host,
    CASE WHEN confirmed_at IS NULL AND imported_at IS NULL THEN NULL
      ELSE COALESCE(original_subscribed_at, confirmed_at, created_at)
    END AS subscribed_at
  FROM subscribers
), classified AS (
  SELECT *, CASE
    WHEN source = 'substack_import' THEN 'imported_substack'
    WHEN tag IN ('chatgpt', 'chatgpt.com', 'chat.openai.com') THEN 'chatgpt'
    WHEN tag IN ('perplexity', 'perplexity.ai') THEN 'perplexity'
    WHEN COALESCE(tag, '') = '' AND host IN ('chatgpt.com', 'chat.openai.com') THEN 'chatgpt'
    WHEN COALESCE(tag, '') = '' AND host = 'perplexity.ai' THEN 'perplexity'
    ELSE COALESCE(stored_source, 'unknown')
  END AS derived_source
  FROM evidence
)
SELECT derived_source, stored_source, signup_path, count(*)::int AS confirmed_subscriptions
FROM classified
WHERE subscribed_at >= :'window_start'::timestamptz
  AND subscribed_at < :'window_end'::timestamptz
GROUP BY derived_source, stored_source, signup_path
ORDER BY derived_source, stored_source, signup_path
