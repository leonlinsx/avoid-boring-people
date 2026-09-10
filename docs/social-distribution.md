# Social distribution

The automated distribution job publishes a canonical leonlins.com article to X, Bluesky, Mastodon, Farcaster, Nostr, and DEV (when category policy permits). Reddit is deferred while API approval is pending, LinkedIn, Threads, and Publish0x are inactive, and Weibo is implemented but unverified; their dormant adapters must not appear in default production workflows.

The job generates one summary per article where required, then deterministically renders it per platform. DEV receives the full source-index article content with the canonical leonlins.com URL. `posted.json` is updated only after a platform confirms success, so retrying a failed run attempts only destinations that have not already succeeded. Transient failures (429, timeouts/connections, 500/502/503/504) are retried with backoff; permanent errors (400/401/403/422, validation failures) are not.

New articles can use all eligible destinations. Evergreen distribution is limited to X, Bluesky, Mastodon, Farcaster, and Nostr; DEV is never recycled.

## Required GitHub secrets

X, Bluesky, Mastodon, DEV, DeepSeek, Neynar (`NEYNAR_API_KEY`, `NEYNAR_SIGNER_UUID`), and Nostr (`NOSTR_NSEC`, the publishing private key) secrets are the active production set. An optional `NOSTR_RELAYS` value overrides the default relay list. Add the following only when the corresponding deferred destination is approved for production:

- `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` (`urn:li:person:…` or organization URN)
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_REFRESH_TOKEN`
- `WEIBO_ACCESS_TOKEN` plus `WEIBO_APP_KEY`, `WEIBO_APP_SECRET`, and `WEIBO_REFRESH_TOKEN` for token refresh (all require a manually approved Weibo open-platform app with write scope)
- `REDDIT_USER_AGENT` (a descriptive, stable API user agent)

`REDDIT_SUBREDDIT` defaults to `AvoidBoringPeople`; set it as a repository variable or workflow environment value only if that changes. The Reddit adapter refreshes its OAuth token at run time; do not use a short-lived access token in GitHub secrets.

The default destinations are versioned in `scripts/automation/routing.py` as
`DEFAULT_PLATFORMS`: X, Bluesky, Mastodon, DEV, Farcaster, and Nostr.
LinkedIn, Reddit, and Weibo remain out of the defaults until their setup is
verified (Weibo additionally needs a Chinese mobile-verified account and is
parked). For a local one-off override, set `PLATFORM` explicitly. Weibo posts
a Simplified-Chinese DeepSeek localization of the article, never the English
text; the localizer raises rather than falling back.

## Local review

Run a no-side-effect inspection with:

```sh
DRY_RUN=true POST_MODE=thread PLATFORM=twitter,bluesky,mastodon,devto python -m scripts.automation.auto_post
```

The output lists each channel's eligibility and rendering decision. In GitHub Actions, `FAIL_ON_PUBLISH_ERROR=true` makes a partial failure visible and retryable while retaining state for channels that already succeeded.

## Farcaster signer setup

Create the signing authority locally, never in GitHub Actions:

```sh
NEYNAR_API_KEY='...' python -m scripts.automation.setup_farcaster_signer --create
```

Open the returned approval URL in the Farcaster wallet app and approve it. Then confirm its state with:

```sh
NEYNAR_API_KEY='...' python -m scripts.automation.setup_farcaster_signer --status SIGNER_UUID
```

Only copy the UUID from an `approved` result to the `NEYNAR_SIGNER_UUID` GitHub Actions secret. Do not store the approval URL, API key, or a pending signer UUID in the repository.
