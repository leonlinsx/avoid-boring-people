# Social distribution

The automated distribution job publishes a canonical leonlins.com article to Bluesky, Mastodon, Farcaster, Nostr, Threads, Instagram, and DEV (when category policy permits). X is excluded from the defaults while its API credit balance is depleted, but stays available through an explicit `PLATFORM` override. Reddit is deferred while API approval is pending, LinkedIn and Publish0x are inactive, and Weibo is implemented but unverified; those dormant adapters must not appear in default production workflows. Instagram is verified live end to end: one article becomes one carousel whose slides are uploaded to the public Vercel Blob store before the carousel is published.

The job generates one author-voice social distillation per article where required, then deterministically renders that shared argument per platform. The distillation is a single DeepSeek call that rewrites the author's own long-form writing — a teaser plus up to two alternate hooks plus standalone supporting points — and it is given the full article content from the search index rather than a truncated prefix. A deterministic specificity rubric (numbers, proper nouns, concrete length) selects the most specific usable teaser, ties keeping the model's first choice; unusable candidates are skipped, never repaired, and the dry run lists every candidate with the winner marked. Production uses DeepSeek-V4.1-Flash through the `deepseek-flash` API alias in non-thinking mode with JSON output, and a deterministic gate then rejects outside-summary framing such as "the author argues" or "this essay explains", URLs, leaked markdown, empty copy, and copy over the configured limits. Generation fails closed: an API error, unusable JSON, an empty response, or copy that fails the gate raises before any platform is attempted, so no account ever receives fallback text. DEV receives the full source-index article content with the canonical leonlins.com URL. `posted.json` is updated only after a platform confirms success, so retrying a failed run attempts only destinations that have not already succeeded. Transient failures (429, timeouts/connections, 500/502/503/504) are retried with backoff; permanent errors (400/401/403/422, validation failures) are not.

X and Bluesky share one deterministic thread. The root states the hook plus the strongest point that still fits, later replies carry whole standalone points, and the canonical article link is always the final reply — framed as `Full piece: <url>` so readers know why to tap — so the thread delivers an idea even if nobody clicks. No point is ever split mid-sentence — one that cannot stand as its own reply is skipped, and the thread is never padded to reach a target count. The formatter enforces X's 280-character limit on the shared representation, which satisfies Bluesky's 300, and each publisher keeps its own validation as defense in depth. Bluesky additionally attaches link facets (exact UTF-8 byte offsets) to every URL-bearing post plus hashtag facets to `#tag` tokens, and the link reply carries an external embed card built from the article's Open Graph title/description; a page whose metadata cannot be fetched still posts with facets, so a flaky fetch never loses the thread. Farcaster casts attach the canonical URL as a link embed (Neynar fetches it server-side) alongside the inline text link, so the cast renders a preview card.

New articles can use all eligible destinations. Evergreen distribution is limited to Bluesky, Mastodon, Farcaster, Nostr, Threads, and Instagram; DEV is never recycled and X is out of the defaults while its API credits are depleted. Evergreen selection serves the back catalog, not the freshest eligible article: least-posted first, then away from the most recently published category, then longest-unposted, with the priority score (including any engagement boost) as the final tiebreak.

Hashtags come only from sanitized article metadata, never from the model: the X/Bluesky thread root, the Mastodon status, and the Farcaster cast each append up to three `#tags` when everything fits, dropping them before trimming content. The Threads main post appends at most one — Threads supports a single topic tag per post, so further tags would render as dead text. Mastodon prefers two whole supporting points over one within its 500-character budget; the trim fallback stays tagless.

## Engagement ledger

`scripts/automation/engagement.py` closes the measurement loop without tracking anyone: it re-reads the remote posts `posted.json` already recorded and stores their public counts (likes, reposts, replies, views where exposed) in `engagement.json`. Covered: Bluesky via the keyless public API, Mastodon and DEV via their existing read credentials, Farcaster via the existing Neynar key. Threads/Instagram have no read API without an app token the repository deliberately does not store; Nostr and the dormant adapters are out of scope. Collection is fail-soft per post and runs weekly from `.github/workflows/engagement.yml`, which commits only the ledger. Evergreen ranking adds at most +0.75 for past interactions (absent data contributes exactly 0), and each `posted.json` entry records the copy engine (`deepseek/<model>` or `textrank-stub`) so observations stay attributable when copy changes.

The push-triggered run reads the deployed `/search-index.json`, so it does not publish until the new article is actually live: `scripts/automation/wait_for_deploy.py` polls the deployed index and the article URL until both are present, and fails the job with a `::error::` annotation if the deployment never lands within the timeout. The previous version waited a fixed 90 seconds and then relied on `auto_post` to reject a post the deployed index did not contain yet, so a slower deployment turned into a red run whose only remedy was a manual re-run.

Articles are eligible for evergreen redistribution by default. Mark a time-sensitive piece with `evergreen: false` in its frontmatter to exclude it. The prompt carries the article's publication date so time-sensitive facts are anchored in their own period in the author's own voice (for example "In 2020, ..." or "At the time, ...") instead of being described as facts from an older article. The prompt is bounded by a 60,000-character safety cap that exists only for pathological input: the longest article on the site is about 43,000 characters, so normal articles reach the model whole.

## Link tagging

Every link the distribution pipeline publishes is tagged so the newsletter's first-touch attribution can tell which channel produced a signup. `scripts/automation/attribution.py` maps the pipeline platform name to the canonical `utm_source` (`twitter` → `x`, `bluesky`, `mastodon`, `linkedin`, `farcaster`, `nostr`, `threads`, `reddit`), sets `utm_medium=social`, and sets `utm_campaign` to the article slug used as the post id. Tagging happens in `_publish` and in the dry run, so the review output shows the exact tagged URL before anything is sent.

Canonical article URLs stay untagged on purpose: the dev.to cross-post, the Farcaster embed, and the localized Weibo post reference the canonical essay rather than a campaign, so tagging them would blur the canonical reference without adding attribution. Internal links inside article bodies are likewise left alone. Tagging is idempotent — a URL that already carries a `utm_source`, an unknown platform, or an unusable URL is returned unchanged — and it preserves any existing query string and fragment.

`tests/test_attribution.py` pins the tagging behavior, and the per-platform dry-run expectations in `tests/test_distribution_hardening.py` carry the tagged URLs. The source vocabulary, the report that consumes it, and the reasoning behind first-touch storage are documented in [newsletter-analytics.md](newsletter-analytics.md).

## Required GitHub secrets

Bluesky, Mastodon, DEV, Threads (`THREADS_ACCESS_TOKEN`, a long-lived token for the `avoidboringpeople` profile), Instagram (`INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_MEDIA_UPLOAD_URL`, and `INSTAGRAM_MEDIA_UPLOAD_SECRET`; `INSTAGRAM_MEDIA_BASE_URL` is the alternative to the upload endpoint when the slides already live somewhere Meta can fetch — see [Instagram](#instagram)), DeepSeek (`DEEPSEEK_API_KEY`; the optional `DEEPSEEK_MODEL` overrides the default `deepseek-flash` alias for DeepSeek-V4.1-Flash, and an empty or unusable response fails the run rather than falling back), Neynar (`NEYNAR_API_KEY`, `NEYNAR_SIGNER_UUID`), and Nostr (`NOSTR_NSEC`, the publishing private key) secrets are the active production set. The `TWITTER_*` secrets are retained for an explicit `PLATFORM=twitter` run, but X API v2 posting is credit-based and returns `402 credits depleted` at a zero balance, so X is not a default destination. An optional `NOSTR_RELAYS` value overrides the default relay list. Add the following only when the corresponding deferred destination is approved for production:

- `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` (`urn:li:person:…` or organization URN). LinkedIn posts carry no body link (body links cost most of the post's reach): the adapter publishes the native argument and places the canonical URL as the first comment via `POST /rest/socialActions/{postUrn}/comments`. A failed comment is logged, never retried into a duplicate post.
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_REFRESH_TOKEN`
- `WEIBO_ACCESS_TOKEN` plus `WEIBO_APP_KEY`, `WEIBO_APP_SECRET`, and `WEIBO_REFRESH_TOKEN` for token refresh (all require a manually approved Weibo open-platform app with write scope)
- `REDDIT_USER_AGENT` (a descriptive, stable API user agent)

`REDDIT_SUBREDDIT` defaults to `AvoidBoringPeople`; set it as a repository variable or workflow environment value only if that changes. The Reddit adapter refreshes its OAuth token at run time; do not use a short-lived access token in GitHub secrets.

The default destinations are versioned in `scripts/automation/routing.py` as
`DEFAULT_PLATFORMS`: Bluesky, Mastodon, DEV, Farcaster, Nostr, Threads, and
Instagram.
LinkedIn, Reddit, and Weibo remain out of the defaults until their
setup is verified (Weibo additionally needs a Chinese mobile-verified account
and is parked). X stays out of the defaults until its API credits are restored.
For a local one-off override, set `PLATFORM` explicitly. Weibo posts
a Simplified-Chinese DeepSeek localization of the article, never the English
text; the localizer raises rather than falling back.

## Token health

Threads and Instagram are the only destinations whose credentials expire on a calendar: both are Meta long-lived tokens valid for about 60 days. Every other secret either does not expire on a schedule or fails visibly in the publish run that uses it, and reading a Meta token's *remaining* lifetime needs an app access token the repository deliberately does not store.

`.github/workflows/token-health.yml` runs daily at 08:00 UTC, before the Tuesday/Friday evergreen cycle, and reuses each publisher's own `verify_credentials` so the check exercises the same host, path, and header as a publish: `GET https://graph.threads.net/v1.0/me?fields=id,username` for Threads and `GET https://graph.instagram.com/v26.0/{ig-user-id}?fields=id,username` for Instagram. A refused token — or an account id that does not resolve — fails the run with the rotation step to perform, and only the HTTP status plus the platform's own message are reported, never the token. A platform whose secrets are unset is reported as `skipped` rather than failing, so a partially configured repository stays green and the job turns red only when a stored credential is actually rejected.

The probe never refreshes or rotates anything: a refresh returns a new token that would have to be written back into repository secrets, so rotation remains a deliberate human step. The same check runs locally with `python -m scripts.automation.check_tokens`.

## Token rotation

Both Meta tokens live about 60 days, and their remaining lifetime cannot be read back (that needs an app access token the repository deliberately does not store), so rotation is calendar-driven with the daily probe as backstop:

1. Refresh out of band: Threads via `GET /refresh_access_token?grant_type=th_refresh_token`; Instagram by refreshing the professional account's long-lived token.
2. Replace the corresponding repository secret (`THREADS_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`) — never commit a token, approval URL, or API key.
3. Verify with a manual `token-health.yml` dispatch (`workflow_dispatch`); both platforms should report `ok`, not `skipped`.
4. Note the new token's mint date where you track secrets and refresh again before day 60. A lapse otherwise surfaces as the probe's `::error::` failure at 08:00 UTC, ahead of the Tuesday/Friday evergreen cycle — rotate immediately, since an expired token fails the publish run as a permanent `401`, not a retry.

## Local review

Run a no-side-effect inspection with:

```sh
DRY_RUN=true POST_MODE=thread PLATFORM=twitter,bluesky,mastodon,devto python -m scripts.automation.auto_post
```

The output lists each channel's eligibility plus the exact copy that channel would publish — the X/Bluesky thread, the Mastodon status, the Threads post, the Farcaster cast, the Instagram cover/slides/caption — so voice and formatting can be judged before anything leaves the machine. In GitHub Actions, `FAIL_ON_PUBLISH_ERROR=true` makes a partial failure visible and retryable while retaining state for channels that already succeeded.

## Local model preview (Ollama)

The distillation normally runs on DeepSeek, and that stays the production path. For local preview without an API key, `SOCIAL_LLM_PROVIDER=ollama` sends the same prompt, through the same parser, the same quality gate, and the same renderers, to a model served by a local [Ollama](https://ollama.com) instance:

```sh
SOCIAL_LLM_PROVIDER=ollama OLLAMA_MODEL=qwen3.5:9b USE_LLM=true DRY_RUN=true TEST_API=true \
  POST_MODE=thread PLATFORM=twitter,bluesky,threads,mastodon,farcaster,instagram \
  TARGET_POST_ID=2020_06_17_data/index.md python -m scripts.automation.auto_post
```

`TEST_API=true` is required: without it `DRY_RUN=true` short-circuits the summarizer to mock copy, which would hide the model's real output. Drop `USE_LLM=true` to preview the deterministic TextRank stub instead.

The same preview against the production backend just needs the provider left alone, plus a real key:

```sh
DEEPSEEK_API_KEY='...' USE_LLM=true DRY_RUN=true TEST_API=true \
  POST_MODE=thread PLATFORM=twitter,bluesky,threads,mastodon,farcaster,instagram \
  TARGET_POST_ID=2020_06_17_data/index.md python -m scripts.automation.auto_post
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `SOCIAL_LLM_PROVIDER` | `deepseek` | `deepseek` or `ollama`; any other value fails before a request is made |
| `OLLAMA_MODEL` | none | Required with the Ollama provider; name an installed model (`ollama list`) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Where the Ollama server is listening |
| `OLLAMA_NUM_CTX` | `32768` | Context window in tokens, at least `2048` |

Provider selection is purely explicit configuration. There is no credential sniffing, no automatic fallback, and no retry against the other backend: a missing `DEEPSEEK_API_KEY` fails as a DeepSeek error rather than silently switching to a local model, and an unreachable or unusable Ollama server fails the run rather than falling back to DeepSeek. The local path is a preview and review tool; production workflows keep the DeepSeek default and never install Ollama.

Two implementation details are worth knowing, because both are caused by the Ollama server rather than by this repository. The provider talks to Ollama's native `/api/chat` endpoint, not its OpenAI-compatible `/v1` endpoint, because `/v1` ignores `num_ctx` and `think`; the OpenAI-compatible surface therefore cannot be given a large enough context or a disabled thinking mode. And Ollama picks a context window from available VRAM — 4096 tokens on a 16 GB GPU — while its `--context-shift` behavior drops the *oldest* tokens when the prompt overflows, which is exactly where the distillation instructions sit. A long article then produces plausible-looking but wrong output instead of an error. The native endpoint with `options.num_ctx` fixes both; the 32,768-token default holds the full article (the longest on the site is about 43,000 characters) plus instructions, and `OLLAMA_CONTEXT_LENGTH` or the desktop app's context slider is the server-level knob if a deployment needs more.

Both `qwen3.5:9b` and `gemma4:12b` were validated end to end through this path on real articles, from a 7,380-character essay up to the 43,049-character longest article. `qwen3.5:9b` is the recommended local model: it was faster (roughly 4–6 seconds per article including the search-index fetch versus 6–9 seconds) and wrote more concrete, author-voice copy. Neither reaches hosted DeepSeek quality on voice, and a local model that ignores the 240-character point limit produces points clipped with an ellipsis, so treat local preview as a draft to review rather than a production substitute.

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

Threads publishes through the Graph API's two-step container flow: create a container at `POST /v1.0/me/threads`, then publish it at `POST /v1.0/me/threads_publish`. The authenticated `me` alias removes the need to store an app-scoped user ID alongside a rotatable token. It is enabled in `DEFAULT_PLATFORMS` after a successful live run, so new articles and eligible evergreen cycles reach it without any override.

Threads reads as a conversational surface, so one article becomes one standalone idea rather than a link announcement: the main post carries the hook plus as many whole author-voice points as the 500-character limit allows, and the canonical URL follows as a self-reply. The post has to make sense without the click, and the link stays a secondary pointer. Points are never cut off mid-sentence, because an unfinished thought reads as a mistake on a conversational feed; only a lone over-long first point is trimmed, at a word boundary. Under `POST_MODE=single` the hook and the first point are both the article title, so the duplicate point is dropped.

Threads renders no markdown, so the renderer also strips leaked `>` blockquote markers that reach the summary when a quote-heavy article is summarized. Only markers that introduce a capitalised fragment are removed, which leaves comparisons such as `risk > return` intact.

The integration was verified live before promotion, and the same steps re-verify it after a token rotation or an API change:

1. Store `THREADS_ACCESS_TOKEN` as a repository secret, then confirm the account with `GET https://graph.threads.net/v1.0/me?fields=id,username`.
2. Run the `Social New Article` workflow manually with `post_id` set to a deployed article and `platforms=threads`.
3. Confirm the main post and the link reply appear on the profile and that `posted.json` records the root media id.

Before a manual run like that, review the rendered voice locally with `DRY_RUN=true POST_MODE=thread PLATFORM=threads python -m scripts.automation.auto_post`; the dry run prints the exact text of both posts. That run summarizes through the local TextRank stub; add `USE_LLM=true TEST_API=true` to review the DeepSeek summary that production actually uses, because `DRY_RUN` alone makes the summarizer return mock points.

Long-lived Threads tokens expire after 60 days and are refreshed with `GET /refresh_access_token?grant_type=th_refresh_token`. Refresh out of band and rotate the secret on a calendar, because Threads now runs unattended; the adapter never refreshes on its own, so an expired token surfaces as a `401` that is reported as permanent rather than retried. The token travels in an `Authorization: Bearer` header, so it never appears in a request URL or in an error message. The daily [token health](#token-health) probe reports a lapse the morning it appears instead of at the next publish.

Two operational limits are worth knowing:

- The API allows 250 posts and 1,000 replies per 24 hours; one article spends one of each.
- Threads has no idempotency key. A publish that the API accepts but reports without a media id is raised as a non-transient failure instead of being retried, so the retry loop can never turn a lost response into a duplicate post. If that error appears, check the profile before rerunning.

## Instagram

Instagram is a content-production problem rather than a caption problem, so it does not have a caption-only adapter. One article becomes one carousel: a cover slide, three to six argument slides, and a closing slide that carries the canonical link. Caption URLs are not clickable, so the caption never carries the raw link: it repeats the article title, the summary teaser, a `Full essay — link in bio` call to action, and up to four hashtags; it stays within 500 characters by choice, well inside Meta's 2,200-character cap. The storyboard validator enforces the bio-link call to action instead of a caption URL. After each publish, point the profile bio link at the new article (or at a stable link page that always resolves to the latest piece) — the automation cannot update the bio itself, so a stale bio leaves the caption CTA pointing nowhere.

`instagram` is registered in `scripts/automation/routing.py` and `scripts/automation/state_manager.py` and it is in `DEFAULT_PLATFORMS`, so new articles and eligible evergreen cycles reach it with no override. Category eligibility is unchanged: investing, risk, technology, system design, culture, and the uncategorized fallback all allow it. Its evergreen cooldown is 60 days like the other channels, configurable through `INSTAGRAM_EVERGREEN_COOLDOWN_DAYS`, so a recycled article cannot repeat on Instagram inside that window. `PLATFORM=instagram` remains available for a one-off manual run.

### What is implemented and mock-tested

Implemented:

- `scripts/automation/formatters/instagram_storyboard.py` builds the storyboard. It is deterministic, has no timestamps or randomness, and every slide is a verbatim slice of the article title, the generated summary, the tags, or the canonical URL, so no slide can invent a fact. The cover leads with the sharpest social hook and shows the literal article title as secondary context, because the cover sells the idea rather than the article's metadata. It also strips the Markdown that leaks through the summarizer, including half-open links left behind when the local stub truncates a sentence mid-link.
- `scripts/automation/renderers/instagram_slides.mjs` rasterizes each slide by building one deterministic SVG document per slide and passing it through `sharp`, at 1080x1350 (the 4:5 aspect ratio Instagram requires) and JPEG quality 92. There is no browser in this path: `sharp` is an ordinary project dependency, so a render needs nothing beyond `npm ci` and works in CI and headless containers without downloading Chromium. The palette is deliberately four colours (`#F7F7F5` background, `#111111` primary, `#555555` secondary, `#D9D9D4` rules) and the only slide kinds are `cover`, `body`, and `final`; the layout is left-aligned with a fixed padding, an understated kicker, slide number, and `leonlins.com` footer. Type is a short ladder per field: the largest size whose wrapped text still fits the field's line limit wins, so copy at the storyboard's character limits degrades in size rather than clipping. Wrapping is computed explicitly before the SVG is generated, and if no ladder size fits, the render fails with `content_overflow` (exit code 3) instead of writing a clipped image. After each JPEG is encoded the renderer decodes it and asserts the outer 40px band is still background, so "nothing is drawn off-canvas" is checked against the artefact, not the layout's own bookkeeping. `scripts/automation/renderers/instagram.py` is the Python facade: it checks the toolchain is available, sends the job on stdin, reads the manifest on stdout, and verifies every produced file is a JPEG at the expected size.
- Fonts: the site ships Atkinson Hyperlegible as WOFF, which `sharp`'s bundled fontconfig cannot index (only a system fontconfig can) and which font measuring needs as sfnt. `instagram_slides.mjs` therefore converts both faces from WOFF to sfnt in memory, writes them (plus a generated `fonts.conf`) into an ignored scratch directory under `.tmp/social/instagram/.fonts/`, and points `FONTCONFIG_FILE` at that file before importing `sharp`. The family name used for lookup is the one inside the font (`Atkinson Hyperlegible`), not the `Atkinson` CSS alias the site uses. Text width is measured with `fontkit` against those same faces, so wrapping and rasterizing agree; a missing glyph fails the render rather than shipping a tofu box. There is no network access and no system font requirement.
- `scripts/automation/media_host.py` is the hosting boundary, because the Graph API accepts a public HTTPS URL rather than image bytes. Three hosts implement it: `NullMediaHost` refuses with a message that names what would have to exist first, `UrlMappingMediaHost` maps the rendered file names onto an existing HTTPS host the operator maintains, and `UploadEndpointMediaHost` is the one approved uploader. The uploader is selected by `INSTAGRAM_MEDIA_UPLOAD_URL` plus `INSTAGRAM_MEDIA_UPLOAD_SECRET`, and an explicit `INSTAGRAM_MEDIA_BASE_URL` takes precedence over it. Every host proves each URL is a fetchable `image/jpeg` within Meta's 8 MB limit before the first container is created, so a hosting mistake fails before Instagram is involved.
- `src/pages/api/social/instagram-media.ts` is the only upload endpoint: a POST-only route that authenticates a shared bearer secret, accepts one JPEG plus the object path it is allowed to occupy, stores it in the **public** Vercel Blob store with `@vercel/blob`, and answers with the public HTTPS URL. GitHub Actions holds no Blob credential at all: the store is connected to the Vercel project and authenticated with OIDC (`BLOB_STORE_ID` plus the rotating `VERCEL_OIDC_TOKEN`), which only exists inside the deployed function.
- Blob object paths are content-addressed: `instagram/<article-id>/<carousel-digest>/slide-NN.jpg`, where the digest covers the whole rendered carousel. The uploader tells the endpoint which path to use and the endpoint re-validates it against that exact shape, so a caller cannot write outside it. Re-rendering unchanged slides rewrites identical bytes at the same stable path, so an upload is idempotent and safe to retry, while a changed render moves to a new path and can never overwrite an asset Instagram may still be serving. The shared secret travels in an `Authorization: Bearer` header, never in a URL, a log line, or an error message, and an upload failure raises before any Instagram call is made.
- `scripts/automation/publishers/instagram.py` publishes the carousel through the three Graph API steps documented in its module docstring, verified against Meta's Instagram Platform documentation for Graph API v26.0 under **Instagram API with Instagram Login**, whose host is `graph.instagram.com`. The credential pair is an Instagram User access token plus the Instagram professional account id, and no Facebook Page is involved; the Facebook Login alternative (`instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, a Page token, `graph.facebook.com`) is a different setup and is not used here.
- `scripts/automation/auto_post.py` builds the storyboard only when Instagram is targeted and prints the carousel in a dry run, including the rendered slide paths, sizes, and hashes. A dry run never uploads: when an uploading host is configured it prints `would upload:` and the content-addressed object path each slide would occupy, without contacting the endpoint.

Mock-tested: the whole publish flow against scripted Graph API responses (child containers, parent container, status polling, publish, permalink), the credential and copy validation that runs before the first network call, the non-retryable ambiguity policy, the media-host verification and its failure messages, the upload endpoint request and its content-addressed path, missing-credential and non-HTTPS-response failures, secret hygiene, an upload failure that stops before Instagram is called, the storyboard limits, renderer determinism, exact 1080x1350 JPEG output, long-title and long-body wrapping, the absence of ink outside the canvas, stable slide ordering, and the workflow allowlist. `tests/test_distribution_instagram.py` covers the Python side and touches no network, `tests/run-tests.ts` covers the upload endpoint with a stubbed Blob store, and the dry-run tests assert that a dry run performs zero uploads and zero Instagram calls.

Verified live: the first manual carousel (`2021_04_03_ergodicity/index.md`) completed the whole path — slides rendered, uploaded through the OIDC endpoint into the public Blob store, child containers and the parent carousel created, `media_publish` accepted, and `posted.json` recorded the media id `17959614963213061` with permalink `https://www.instagram.com/p/DdO8qGjgcCm/` under `last_mode: new`. Promotion to `DEFAULT_PLATFORMS` followed that run, so the only behavior that changes afterwards is who triggers it, not the API path that was proven.

Remaining risk: Instagram now publishes from the unattended runs, so the account receives one carousel per new article (subject to the category rules above) plus up to two a week from the schedule. `INSTAGRAM_ACCESS_TOKEN` is a long-lived Instagram User token that expires 60 days after issue or refresh, and both production workflows depend on it, so it needs the same calendar rotation as `THREADS_ACCESS_TOKEN`; the adapter never refreshes on its own, and an expired token surfaces as a `401` reported as a permanent failure rather than retried. The daily [token health](#token-health) probe reports a lapse the morning it appears.

### Credentials

`INSTAGRAM_USER_ID` is the Instagram professional account id, and `INSTAGRAM_ACCESS_TOKEN` is an **Instagram User access token** minted by the app's Instagram Login setup, with `instagram_business_basic` and `instagram_business_content_publish` granted. Both are used against `https://graph.instagram.com/v26.0`, which is the host for Instagram Login; the token travels in an `Authorization: Bearer` header, so it never appears in a request URL or in an error message. It is a long-lived token that expires 60 days after issue or refresh, and it now backs unattended runs, so refresh it before it lapses with `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>` (requires `instagram_business_basic`) and store the returned token as the new secret.

The first live run failed here, which is worth knowing before rotating anything: the adapter called `graph.facebook.com/v26.0` with an Instagram Login token and Meta answered `401 Invalid OAuth access token - Cannot parse access token`. That message means the *host and token pair* disagree, not that the token is dead: an Instagram Login token (`graph.instagram.com`) and a Facebook Login Page token (`graph.facebook.com`) are not interchangeable. `verify_credentials` now runs before the first container is created and names which of the two values is wrong — `INSTAGRAM_ACCESS_TOKEN` when the token is rejected, `INSTAGRAM_USER_ID` when the id does not resolve — so a wrong pair costs one read-only request instead of a half-built carousel. Neither message contains the token, and a preflight service error is still reported as a plain retryable failure.

`INSTAGRAM_MEDIA_UPLOAD_URL` is the absolute URL of the site's upload endpoint (`https://leonlins.com/api/social/instagram-media`), and `INSTAGRAM_MEDIA_UPLOAD_SECRET` is a shared secret generated for this one purpose, for example with `openssl rand -hex 32`. Vercel holds the same value as a project environment variable, GitHub holds it as a repository secret, and it is sent as an `Authorization: Bearer` header, so it never appears in a URL, a log line, or an error message. The endpoint answers 401 without it, 503 if Vercel has no value configured, and it never falls back to anonymous uploads.

The Blob store itself needs no credential outside Vercel: it is connected to the `avoid-boring-people` project and the endpoint authenticates with Vercel OIDC (`BLOB_STORE_ID` plus the rotating `VERCEL_OIDC_TOKEN`, read by the SDK from the function's environment). There is deliberately no `BLOB_READ_WRITE_TOKEN` to create or store. `INSTAGRAM_MEDIA_BASE_URL` remains the alternative for an existing host and takes precedence over the upload endpoint when both are set.

### Manual review and run

Review the carousel locally first. This renders the real slides and then stops at the hosting boundary:

```sh
DRY_RUN=true POST_MODE=thread PLATFORM=instagram TARGET_POST_ID=2019_02_18_why/index.md python -m scripts.automation.auto_post
```

The dry run writes nothing: `posted.json` is not created or modified, and no upload happens even when the upload endpoint is configured. Rendered slides land in the ignored `.tmp/social/instagram/<post-id>/` directory, and the dry run prints each slide's path, size, and hash, plus the media host in use (`would upload:` with the content-addressed object path each slide would occupy, or `reachable:` for an existing host it verifies).

A live run happens on the automatic `Social New Article` push path, from a manual `Social New Article` dispatch with `platforms=instagram` and a `post_id`, from an evergreen cycle, or from a local `PLATFORM=instagram python -m scripts.automation.auto_post`. It renders the slides, POSTs each JPEG to the upload endpoint, and hands the returned public HTTPS URLs to the publisher, which verifies them before creating the first container; the final Instagram media id is then recorded in `posted.json` like any other channel. Both production workflows install Node 22 and run `npm ci --omit=dev` with browser downloads disabled, because `instagram` is a production default: `Social Evergreen` installs the renderer on every run, and `Social New Article` installs it whenever the run can target Instagram, which includes the automatic push-triggered path where the `platforms` input is empty and the production defaults apply. Instagram media is hosted by the site's Vercel function and nowhere else, and Instagram publishing only ever happens from the distribution workflow itself — never from a build, a deploy, or a Vercel deployment hook.

### Failure policy

Uploads happen before any container exists, so an upload failure fails the run and is safe to retry: the retry overwrites the same content-addressed objects.

Everything up to and including the parent container is retried normally: an unpublished container expires after 24 hours on its own, and a retry simply builds fresh ones. The containers are polled once a minute for up to five minutes, and a container that reports `ERROR` or `EXPIRED` fails that attempt.

`media_publish` is the one call that is not retried blindly. If the response is lost, or returns 429 or a 5xx, or omits the media id, the carousel may already be live, and Instagram has no idempotency key, so a second call would publish a duplicate. That case raises `AmbiguousPublishError`, which is marked `retryable = False` and carries the parent and child container ids. When it appears, list the recent media with `GET https://graph.instagram.com/v26.0/{ig-user-id}/media?fields=id,caption,timestamp&limit=5` and check the profile before re-running.

### Manual setup checklist

1. Confirm the target account is a professional account. No Facebook Page is needed: this integration uses **Instagram API with Instagram Login**, so the account signs in through Instagram directly.
2. In the Meta app, add the *Instagram* product with *API setup with Instagram login*, then generate an **Instagram User access token** for the account with `instagram_business_basic` and `instagram_business_content_publish`. Confirm it answers on the Instagram Login host with `GET https://graph.instagram.com/v26.0/me?fields=id,username`, and copy the `id` it returns as `INSTAGRAM_USER_ID` — that id belongs to the Instagram professional account, not to a Facebook Page or app user.
3. Store `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` as repository secrets.
4. Create a Vercel Blob store with **public** access, connect it to the `avoid-boring-people` project, and confirm the project shows `BLOB_STORE_ID` and uses OIDC (Vercel dashboard, Storage, Blob, then the store's Projects tab). A private store would not serve the URLs Meta fetches, and no other storage client, bucket policy, or CDN is involved. No `BLOB_READ_WRITE_TOKEN` is created or stored anywhere.
5. Generate one shared secret with `openssl rand -hex 32`, store it as the Vercel project environment variable `INSTAGRAM_MEDIA_UPLOAD_SECRET` (production), and store the same value as the `INSTAGRAM_MEDIA_UPLOAD_SECRET` repository secret. Store `INSTAGRAM_MEDIA_UPLOAD_URL=https://leonlins.com/api/social/instagram-media` as a repository secret too, and leave `INSTAGRAM_MEDIA_BASE_URL` unset unless the slides are served from another host.
6. Run the local dry run above and review the rendered slides before any publish.
7. Do one manual live publish with `platforms=instagram` (lowercase, because the renderer-install gate matches that literal value) and a `post_id` before relying on the unattended runs, then confirm the carousel on the profile and the media id in `posted.json`. That step is done: the first live carousel published successfully, and Instagram is in `DEFAULT_PLATFORMS`, so it also runs unattended now. Repeat this manual check after any token rotation or adapter change.
8. Refresh `INSTAGRAM_ACCESS_TOKEN` before its 60-day lifetime lapses, with the `refresh_access_token` call in [Credentials](#credentials), and store the returned value as the new repository secret. Instagram is unattended, so an expired token fails the scheduled run rather than a manual one, and the daily [token health](#token-health) probe reports the lapse.

The storyboard limits are editorial, not platform limits: 5-8 slides, 60 characters for a body headline, 200 for its supporting text, 40 for the kicker, 1,000 for alt text. Meta documents at most 10 carousel children and no minimum, so at least 2 is enforced where the platform requires it, and the renderer fails visibly rather than shipping a clipped slide: copy that does not fit exits with `content_overflow`, and a missing brand font stops the render instead of falling back to a system typeface.
