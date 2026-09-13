# Social distribution

The automated distribution job publishes a canonical leonlins.com article to Bluesky, Mastodon, Farcaster, Nostr, Threads, and DEV (when category policy permits). X is excluded from the defaults while its API credit balance is depleted, but stays available through an explicit `PLATFORM` override. Reddit is deferred while API approval is pending, LinkedIn and Publish0x are inactive, and Weibo is implemented but unverified; those dormant adapters must not appear in default production workflows. Instagram is implemented and mock-tested but manual-only: rendered carousel slides are uploaded to a Vercel Blob store, and it stays opt-in until one live carousel publish has been verified end to end.

The job generates one summary per article where required, then deterministically renders it per platform. DEV receives the full source-index article content with the canonical leonlins.com URL. `posted.json` is updated only after a platform confirms success, so retrying a failed run attempts only destinations that have not already succeeded. Transient failures (429, timeouts/connections, 500/502/503/504) are retried with backoff; permanent errors (400/401/403/422, validation failures) are not.

New articles can use all eligible destinations. Evergreen distribution is limited to Bluesky, Mastodon, Farcaster, Nostr, and Threads; DEV is never recycled and X is out of the defaults while its API credits are depleted.

Articles are eligible for evergreen redistribution by default. Mark a time-sensitive piece with `evergreen: false` in its frontmatter to exclude it. The summarizer receives the article's publication date so historical facts are framed as belonging to the original publication period rather than as current facts.

## Required GitHub secrets

Bluesky, Mastodon, DEV, Threads (`THREADS_USER_ID` and `THREADS_ACCESS_TOKEN`, a long-lived token for the `avoidboringpeople` profile), DeepSeek, Neynar (`NEYNAR_API_KEY`, `NEYNAR_SIGNER_UUID`), and Nostr (`NOSTR_NSEC`, the publishing private key) secrets are the active production set. The `TWITTER_*` secrets are retained for an explicit `PLATFORM=twitter` run, but X API v2 posting is credit-based and returns `402 credits depleted` at a zero balance, so X is not a default destination. An optional `NOSTR_RELAYS` value overrides the default relay list. Add the following only when the corresponding deferred destination is approved for production:

- `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` (`urn:li:person:…` or organization URN)
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_REFRESH_TOKEN`
- `WEIBO_ACCESS_TOKEN` plus `WEIBO_APP_KEY`, `WEIBO_APP_SECRET`, and `WEIBO_REFRESH_TOKEN` for token refresh (all require a manually approved Weibo open-platform app with write scope)
- `REDDIT_USER_AGENT` (a descriptive, stable API user agent)
- `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, and `BLOB_READ_WRITE_TOKEN` for a manual Instagram run; `INSTAGRAM_MEDIA_BASE_URL` is the alternative to the Blob token when the slides already live somewhere Meta can fetch. See [Instagram](#instagram-implemented-manual-only)

`REDDIT_SUBREDDIT` defaults to `AvoidBoringPeople`; set it as a repository variable or workflow environment value only if that changes. The Reddit adapter refreshes its OAuth token at run time; do not use a short-lived access token in GitHub secrets.

The default destinations are versioned in `scripts/automation/routing.py` as
`DEFAULT_PLATFORMS`: Bluesky, Mastodon, DEV, Farcaster, Nostr, and Threads.
LinkedIn, Reddit, and Weibo remain out of the defaults until their
setup is verified (Weibo additionally needs a Chinese mobile-verified account
and is parked). Instagram stays out until a live carousel publish has been
verified end to end. X stays out of the defaults until its API credits are restored.
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

## Instagram (implemented, manual only)

Instagram is a content-production problem rather than a caption problem, so it does not have a caption-only adapter. One article becomes one carousel: a cover slide, three to six argument slides, and a closing slide that carries the canonical link. The caption repeats the article title, the summary teaser, the canonical URL, and up to four hashtags; it stays within 500 characters by choice, well inside Meta's 2,200-character cap.

`instagram` is registered in `scripts/automation/routing.py` and `scripts/automation/state_manager.py`, but it is deliberately absent from `DEFAULT_PLATFORMS`, so it never runs unattended. Culture articles are eligible for it by category, and `PLATFORM=instagram` is the only way to reach it. Its evergreen cooldown is 60 days like the other channels, configurable through `INSTAGRAM_EVERGREEN_COOLDOWN_DAYS`.

### What is implemented and mock-tested

Implemented:

- `scripts/automation/formatters/instagram_storyboard.py` builds the storyboard. It is deterministic, has no timestamps or randomness, and every slide is a verbatim slice of the article title, the generated summary, the tags, or the canonical URL, so no slide can invent a fact. It also strips the Markdown that leaks through the summarizer, including half-open links left behind when the local stub truncates a sentence mid-link.
- `scripts/automation/renderers/instagram_slides.mjs` rasterizes each slide by building one deterministic SVG document per slide and passing it through `sharp`, at 1080x1350 (the 4:5 aspect ratio Instagram requires) and JPEG quality 92. There is no browser in this path: `sharp` is an ordinary project dependency, so a render needs nothing beyond `npm ci` and works in CI and headless containers without downloading Chromium. The palette is deliberately four colours (`#F7F7F5` background, `#111111` primary, `#555555` secondary, `#D9D9D4` rules) and the only slide kinds are `cover`, `body`, and `final`; the layout is left-aligned with a fixed padding, an understated kicker, slide number, and `leonlins.com` footer. Type is a short ladder per field: the largest size whose wrapped text still fits the field's line limit wins, so copy at the storyboard's character limits degrades in size rather than clipping. Wrapping is computed explicitly before the SVG is generated, and if no ladder size fits, the render fails with `content_overflow` (exit code 3) instead of writing a clipped image. After each JPEG is encoded the renderer decodes it and asserts the outer 40px band is still background, so "nothing is drawn off-canvas" is checked against the artefact, not the layout's own bookkeeping. `scripts/automation/renderers/instagram.py` is the Python facade: it checks the toolchain is available, sends the job on stdin, reads the manifest on stdout, and verifies every produced file is a JPEG at the expected size.
- Fonts: the site ships Atkinson Hyperlegible as WOFF, which `sharp`'s bundled fontconfig cannot index (only a system fontconfig can) and which font measuring needs as sfnt. `instagram_slides.mjs` therefore converts both faces from WOFF to sfnt in memory, writes them (plus a generated `fonts.conf`) into an ignored scratch directory under `.tmp/social/instagram/.fonts/`, and points `FONTCONFIG_FILE` at that file before importing `sharp`. The family name used for lookup is the one inside the font (`Atkinson Hyperlegible`), not the `Atkinson` CSS alias the site uses. Text width is measured with `fontkit` against those same faces, so wrapping and rasterizing agree; a missing glyph fails the render rather than shipping a tofu box. There is no network access and no system font requirement.
- `scripts/automation/media_host.py` is the hosting boundary, because the Graph API accepts a public HTTPS URL rather than image bytes. Three hosts implement it: `NullMediaHost` refuses with a message that names what would have to exist first, `UrlMappingMediaHost` maps the rendered file names onto an existing HTTPS host the operator maintains, and `VercelBlobMediaHost` is the one approved uploader. The uploader is selected by `BLOB_READ_WRITE_TOKEN` alone, and an explicit `INSTAGRAM_MEDIA_BASE_URL` takes precedence over it. Every host proves each URL is a fetchable `image/jpeg` within Meta's 8 MB limit before the first container is created, so a hosting mistake fails before Instagram is involved.
- Blob object paths are content-addressed: `instagram/<article-id>/<carousel-digest>/slide-NN.jpg`, where the digest covers the whole rendered carousel. Re-rendering unchanged slides rewrites identical bytes at the same stable path, so an upload is idempotent and safe to retry, while a changed render moves to a new path and can never overwrite an asset Instagram may still be serving. Uploads use the documented HTTP `put` with the read-write token in an `Authorization` header, `x-add-random-suffix: 0` (the path is already unique), and `x-allow-overwrite: 1` (safe precisely because the same path always holds the same bytes). The token never appears in a URL, a log line, or an error message, and an upload failure raises before any Instagram call is made.
- `scripts/automation/publishers/instagram.py` publishes the carousel through the three Graph API steps documented in its module docstring, verified against Meta's Instagram Platform documentation for Graph API v26.0.
- `scripts/automation/auto_post.py` builds the storyboard only when Instagram is targeted and prints the carousel in a dry run, including the rendered slide paths, sizes, and hashes. A dry run never uploads: when an uploading host is configured it prints `would upload:` and the planned public URL instead.

Mock-tested: the whole publish flow against scripted Graph API responses (child containers, parent container, status polling, publish, permalink), the credential and copy validation that runs before the first network call, the non-retryable ambiguity policy, the media-host verification and its failure messages, the Blob PUT request and its content-addressed path, missing-token and non-HTTPS-response failures, token hygiene, an upload failure that stops before Instagram is called, the storyboard limits, renderer determinism, exact 1080x1350 JPEG output, long-title and long-body wrapping, the absence of ink outside the canvas, stable slide ordering, and the workflow allowlist. `tests/test_distribution_instagram.py` covers this and touches no network, and the dry-run tests assert that a dry run performs zero uploads and zero Instagram calls.

Remaining risk: no live publish has happened. Uploads and the three-step container flow are verified against the documented API shapes and scripted responses only, so the live Blob response and the live Graph API path are both unexercised. The first live run is the manual dispatch below, and its media id, permalink, and outcome belong here afterwards.

### Credentials

`INSTAGRAM_USER_ID` is the Instagram professional account id, and `INSTAGRAM_ACCESS_TOKEN` is a Facebook Page access token with `instagram_basic`, `instagram_content_publish`, and `pages_read_engagement`. The token travels in an `Authorization: Bearer` header, so it never appears in a request URL or in an error message.

`BLOB_READ_WRITE_TOKEN` is a Vercel Blob read-write token, created by connecting a Blob store to the project (the token is in the store's `.env.local` snippet or in the store's settings). It is the only credential the uploader needs, it is sent as an `Authorization` header, and it is stored as a GitHub secret. The store id embedded in the token is used only to predict the public URL in a dry run; a live run always uses the URL the upload returns. `INSTAGRAM_MEDIA_BASE_URL` remains the alternative for an existing host and takes precedence over the Blob token when both are set.

### Manual review and run

Review the carousel locally first. This renders the real slides and then stops at the hosting boundary:

```sh
DRY_RUN=true POST_MODE=thread PLATFORM=instagram TARGET_POST_ID=2019_02_18_why/index.md python -m scripts.automation.auto_post
```

The dry run writes nothing: `posted.json` is not created or modified, and no upload happens even when `BLOB_READ_WRITE_TOKEN` is set. Rendered slides land in the ignored `.tmp/social/instagram/<post-id>/` directory, and the dry run prints each slide's path, size, and hash, plus the media host in use (`would upload:` with the planned public Blob URL, or `reachable:` for an existing host it verifies).

A live run is a manual `Social New Article` dispatch with `platforms=instagram` and a `post_id`, or a local `PLATFORM=instagram python -m scripts.automation.auto_post`. It renders the slides, uploads each JPEG to Vercel Blob, and hands the returned public HTTPS URLs to the publisher, which verifies them before creating the first container; the final Instagram media id is then recorded in `posted.json` like any other channel. The workflow installs Node and runs `npm ci --omit=dev` with browser downloads disabled, but only when `platforms` contains `instagram`, so the renderer is present exactly when it is needed and the unattended default path stays unchanged. `BLOB_READ_WRITE_TOKEN` is read by the manual workflow alone: the unattended `Social Evergreen` schedule has no Instagram or Blob configuration and must not gain any. Publishing to Instagram never happens from a push, a build, or an unattended evergreen cycle.

### Failure policy

Uploads happen before any container exists, so an upload failure fails the run and is safe to retry: the retry overwrites the same content-addressed objects.

Everything up to and including the parent container is retried normally: an unpublished container expires after 24 hours on its own, and a retry simply builds fresh ones. The containers are polled once a minute for up to five minutes, and a container that reports `ERROR` or `EXPIRED` fails that attempt.

`media_publish` is the one call that is not retried blindly. If the response is lost, or returns 429 or a 5xx, or omits the media id, the carousel may already be live, and Instagram has no idempotency key, so a second call would publish a duplicate. That case raises `AmbiguousPublishError`, which is marked `retryable = False` and carries the parent and child container ids. When it appears, list the recent media with `GET https://graph.facebook.com/v26.0/{ig-user-id}/media?fields=id,caption,timestamp&limit=5` and check the profile before re-running.

### Manual setup checklist

1. Convert the target account to a professional account and link it to a Facebook Page.
2. Create a Meta app with the Instagram Graph API, then generate a long-lived Page access token with the three permissions above.
3. Store `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` as repository secrets.
4. Create a Vercel Blob store with **public** access for the project (Vercel dashboard, Storage, Blob, then connect it to the project) and store its read-write token as the `BLOB_READ_WRITE_TOKEN` repository secret. The token is documented for code that runs outside Vercel, which is exactly this case. A private store would not serve the URLs Meta fetches, and no other storage client, bucket policy, or CDN is involved.
5. Run the local dry run above and review the rendered slides before any publish.
6. Do the first live publish manually with `platforms=instagram` (lowercase, as the workflow gate that installs the renderer matches that literal value) and a `post_id`, then record the media id, permalink, and outcome here before adding Instagram to `DEFAULT_PLATFORMS`.

The storyboard limits are editorial, not platform limits: 5-8 slides, 60 characters for a body headline, 200 for its supporting text, 40 for the kicker, 1,000 for alt text. Meta documents at most 10 carousel children and no minimum, so at least 2 is enforced where the platform requires it, and the renderer fails visibly rather than shipping a clipped slide: copy that does not fit exits with `content_overflow`, and a missing brand font stops the render instead of falling back to a system typeface.
