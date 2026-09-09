# Social distribution

The automated distribution job publishes a canonical leonlins.com article to X, LinkedIn, Bluesky, Mastodon, Farcaster, DEV (when category policy permits), and r/AvoidBoringPeople. Threads is deliberately not an automation destination.

The job first creates one `SocialPost`, then applies platform renderers. DEV receives the source-index article content with the canonical leonlins.com URL; Reddit receives a link post. `posted.json` is updated only after a platform confirms success, so retrying a failed run does not repost successful destinations.

New articles can use all eligible destinations. Evergreen distribution is limited to X, LinkedIn, Bluesky, Mastodon, and Farcaster; DEV and Reddit are never recycled.

## Required GitHub secrets

Existing X, Bluesky, Mastodon, DEV, and DeepSeek secrets remain unchanged. Add the following before enabling real posting on the new destinations:

- `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` (`urn:li:person:…` or organization URN)
- `NEYNAR_API_KEY` and `NEYNAR_SIGNER_UUID`
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_REFRESH_TOKEN`
- `REDDIT_USER_AGENT` (a descriptive, stable API user agent)

`REDDIT_SUBREDDIT` defaults to `AvoidBoringPeople`; set it as a repository variable or workflow environment value only if that changes. The Reddit adapter refreshes its OAuth token at run time; do not use a short-lived access token in GitHub secrets.

The default destinations are versioned in `scripts/automation/routing.py` as
`DEFAULT_PLATFORMS`: X, Bluesky, Mastodon, DEV, and Farcaster. LinkedIn and
Reddit remain disabled pending separate provider work. For a local one-off
override, set `PLATFORM` explicitly.

## Local review

Run a no-side-effect inspection with:

```sh
DRY_RUN=true POST_MODE=thread PLATFORM=twitter,linkedin,bluesky,mastodon,farcaster,devto,reddit python -m scripts.automation.auto_post
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
