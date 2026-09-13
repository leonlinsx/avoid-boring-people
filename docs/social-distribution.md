# Social distribution

The automated distribution job publishes a canonical leonlins.com article to Bluesky, Mastodon, Farcaster, Nostr, Threads, and DEV (when category policy permits). X is excluded from the defaults while its API credit balance is depleted, but stays available through an explicit `PLATFORM` override. Reddit is deferred while API approval is pending, LinkedIn and Publish0x are inactive, and Weibo is implemented but unverified; those dormant adapters must not appear in default production workflows.

The job generates one summary per article where required, then deterministically renders it per platform. DEV receives the full source-index article content with the canonical leonlins.com URL. `posted.json` is updated only after a platform confirms success, so retrying a failed run attempts only destinations that have not already succeeded. Transient failures (429, timeouts/connections, 500/502/503/504) are retried with backoff; permanent errors (400/401/403/422, validation failures) are not.

New articles can use all eligible destinations. Evergreen distribution is limited to Bluesky, Mastodon, Farcaster, Nostr, and Threads; DEV is never recycled and X is out of the defaults while its API credits are depleted.

Articles are eligible for evergreen redistribution by default. Mark a time-sensitive piece with `evergreen: false` in its frontmatter to exclude it. The summarizer receives the article's publication date so historical facts are framed as belonging to the original publication period rather than as current facts.

## Required GitHub secrets

Bluesky, Mastodon, DEV, Threads (`THREADS_USER_ID` and `THREADS_ACCESS_TOKEN`, a long-lived token for the `avoidboringpeople` profile), DeepSeek, Neynar (`NEYNAR_API_KEY`, `NEYNAR_SIGNER_UUID`), and Nostr (`NOSTR_NSEC`, the publishing private key) secrets are the active production set. The `TWITTER_*` secrets are retained for an explicit `PLATFORM=twitter` run, but X API v2 posting is credit-based and returns `402 credits depleted` at a zero balance, so X is not a default destination. An optional `NOSTR_RELAYS` value overrides the default relay list. Add the following only when the corresponding deferred destination is approved for production:

- `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` (`urn:li:person:…` or organization URN)
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_REFRESH_TOKEN`
- `WEIBO_ACCESS_TOKEN` plus `WEIBO_APP_KEY`, `WEIBO_APP_SECRET`, and `WEIBO_REFRESH_TOKEN` for token refresh (all require a manually approved Weibo open-platform app with write scope)
- `REDDIT_USER_AGENT` (a descriptive, stable API user agent)

`REDDIT_SUBREDDIT` defaults to `AvoidBoringPeople`; set it as a repository variable or workflow environment value only if that changes. The Reddit adapter refreshes its OAuth token at run time; do not use a short-lived access token in GitHub secrets.

The default destinations are versioned in `scripts/automation/routing.py` as
`DEFAULT_PLATFORMS`: Bluesky, Mastodon, DEV, Farcaster, Nostr, and Threads.
LinkedIn, Reddit, and Weibo remain out of the defaults until their
setup is verified (Weibo additionally needs a Chinese mobile-verified account
and is parked). X stays out of the defaults until its API credits are restored.
For a local one-off override, set `PLATFORM` explicitly. Weibo posts
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

## Threads

Threads publishes through the Graph API's two-step container flow: create a container at `POST /v1.0/{user-id}/threads`, then publish it at `POST /v1.0/{user-id}/threads_publish`. It is enabled in `DEFAULT_PLATFORMS` after a successful live run, so new articles and eligible evergreen cycles reach it without any override.

Threads reads as a conversational surface, so one article becomes one standalone idea rather than a link announcement: the main post carries the hook plus as many whole summary points as the 500-character limit allows, and the canonical URL follows as a self-reply. The post has to make sense without the click, and the link stays a secondary pointer. Points are never cut off mid-sentence, because an unfinished thought reads as a mistake on a conversational feed; only a lone over-long first point is trimmed, at a word boundary. Under `POST_MODE=single` the hook and the first point are both the article title, so the duplicate point is dropped.

Threads renders no markdown, so the renderer also strips leaked `>` blockquote markers that reach the summary when a quote-heavy article is summarized. Only markers that introduce a capitalised fragment are removed, which leaves comparisons such as `risk > return` intact.

The integration was verified live before promotion, and the same steps re-verify it after a token rotation or an API change:

1. Store `THREADS_USER_ID` and `THREADS_ACCESS_TOKEN` as repository secrets, then confirm the user id with `GET https://graph.threads.net/v1.0/me?fields=id,username`.
2. Run the `Social New Article` workflow manually with `post_id` set to a deployed article and `platforms=threads`.
3. Confirm the main post and the link reply appear on the profile and that `posted.json` records the root media id.

Before a manual run like that, review the rendered voice locally with `DRY_RUN=true POST_MODE=thread PLATFORM=threads python -m scripts.automation.auto_post`; the dry run prints the exact text of both posts. That run summarizes through the local TextRank stub; add `USE_LLM=true TEST_API=true` to review the DeepSeek summary that production actually uses, because `DRY_RUN` alone makes the summarizer return mock points.

Long-lived Threads tokens expire after 60 days and are refreshed with `GET /refresh_access_token?grant_type=th_refresh_token`. Refresh out of band and rotate the secret on a calendar, because Threads now runs unattended; the adapter never refreshes on its own, so an expired token surfaces as a `401` that is reported as permanent rather than retried. The token travels in an `Authorization: Bearer` header, so it never appears in a request URL or in an error message.

Two operational limits are worth knowing:

- The API allows 250 posts and 1,000 replies per 24 hours; one article spends one of each.
- Threads has no idempotency key. A publish that the API accepts but reports without a media id is raised as a non-transient failure instead of being retried, so the retry loop can never turn a lost response into a duplicate post. If that error appears, check the profile before rerunning.

## Instagram (planned, not implemented)

Instagram is a content-production problem rather than a caption problem, so it will not get a caption-only adapter. The intended shape is carousel-first:

1. A storyboard renderer turns one article's argument into 4-7 slides (claim, supporting points, takeaway), reusing the constrained structured summary that already feeds the text platforms.
2. Static HTML/CSS slide templates cover the three content shapes that actually recur: essay (text-led), framework (diagram-led), and data (chart-led). Slides render at 1080x1350.
3. A publisher creates one Graph API container per slide, publishes the carousel, and puts the canonical link in the caption rather than on a slide.

The renderer needs a headless browser to screenshot the slide templates, which is why this is deferred: it adds a Playwright dependency and an image pipeline that the current text-only adapters do not need. See `TODO.md`.
