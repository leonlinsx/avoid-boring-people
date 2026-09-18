# First-party newsletter attribution and analytics

Newsletter growth and health are measured from the owned database
(`Neon Postgres`) rather than from a vendor dashboard. The system answers three
questions: which channels produce subscribers, whether the list is growing or
shrinking, and whether the SES sending reputation is safe. It is deliberately
small: five read-only aggregate queries, one plain-text report, and no
third-party analytics.

The goals were deliberately narrow:

- record how each owned signup was acquired, as first-touch evidence
- rank acquisition sources against the previous window of the same length
- report audience, growth, deliverability, and unsubscribe pressure from rows
  already stored
- keep the whole thing runnable from a local CLI with no new service

It is not a marketing platform. There are no funnels, no per-reader journeys, no
segmentation, no charts or dashboards, no per-subscriber event history, and no
paid-membership metrics (the newsletter is free-only). Site-wide traffic
reporting remains separate and unchanged: `PUBLIC_GA_ID` still drives the
optional Google Analytics tag, and this system neither reads nor writes GA.

## Architecture

Four pieces, none of which adds a service:

| Piece                  | Location                                                                                                                                                                                                                        | Responsibility                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Capture (browser)      | [src/lib/newsletter/attribution.ts](../src/lib/newsletter/attribution.ts) used by [src/components/SubscribeForm.astro](../src/components/SubscribeForm.astro)                                                                   | Remember the first attributable visit in browser storage               |
| Tagging (distribution) | [scripts/automation/attribution.py](../scripts/automation/attribution.py) used by [scripts/automation/auto_post.py](../scripts/automation/auto_post.py)                                                                         | Add canonical `utm_*` tags to outbound social links                    |
| Write (server)         | [src/lib/newsletter/subscriptions.ts](../src/lib/newsletter/subscriptions.ts) via `/api/newsletter/subscribe`                                                                                                                   | Store normalized attribution on the subscriber row at INSERT time only |
| Read (report)          | [src/lib/newsletter/analytics.ts](../src/lib/newsletter/analytics.ts), [scripts/newsletter/analytics.ts](../scripts/newsletter/analytics.ts), [scripts/newsletter/analytics-email.ts](../scripts/newsletter/analytics-email.ts) | Aggregate rows into a deterministic report                             |

Capture and tagging are live today; the stored attribution stays **inert until
the Phase 5 cutover**, because the public signup form still posts to Substack and
Substack stores nothing this system records. `attributionPayload()` builds the
wire payload for the owned endpoint, and nothing currently sends it.

## Attribution model

Attribution is **first touch, single row, no history**. The browser keeps the
first attributable visit and the server writes those values once:

- `acquisition_source` and `acquisition_detail` — the normalized label and its
  qualifier, derived at write time so the vocabulary can change without a
  migration.
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` — the raw tags as
  received, capped in length and stripped of control characters.
- `signup_path` — the landing path (query and fragment removed) where the
  evidence was captured.
- `referrer_domain` — the normalized referring host, or `null` for a self
  referrer.

There is no separate `attributed_at` column: attribution is written in the same
statement that creates the row, so `subscribers.created_at` is when it was
recorded.

On resubmission the `ON CONFLICT` branch updates only the confirmation token, so
a later visit can never rewrite how a subscriber was originally acquired.
`source` and `source_detail` keep their Phase 1 meaning: `source` is the
provenance channel (`website`, `substack_import`, `manual`) and `source_detail`
is the form variant (`blog-inline`, `blog-footer`). Attribution never clobbers
either.

A stored first touch wins unless it carries no information: a stored
`direct`/`unknown`/`leonlins.com` is upgraded once a real source appears, and
nothing else is ever replaced. A visit referred by this site says only that the
reader was already here, so an internal navigation never claims the first touch
and never blocks the external visit that follows it.

### Source vocabulary

| Source                                                                                         | Meaning                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direct`                                                                                       | No tags and no referrer at all                                                                                                                                                              |
| `organic_search`                                                                               | Search engine or answer-engine referrer (`google`, `bing`, `duckduckgo`, `ecosia`, `brave`, `yandex`, `perplexity.ai`, `chatgpt.com`), a mapped search `utm_source`, or `utm_medium=search` |
| `x`, `threads`, `instagram`, `bluesky`, `reddit`, `mastodon`, `linkedin`, `farcaster`, `nostr` | Named community platforms, matched from `utm_source` or referrer host                                                                                                                       |
| `external_newsletter`                                                                          | Another newsletter or email platform (`substack`, `beehiiv`, `ghost`, `mailchimp`, `utm_medium=email`)                                                                                      |
| `referral`                                                                                     | Any other external host; `detail` keeps the host or unmapped `utm_source`                                                                                                                   |
| `leonlins.com`                                                                                 | Internal navigation (another page on this site); `detail` is the landing path                                                                                                               |
| `imported_substack`                                                                            | Imported legacy Substack rows, which have no recorded historical channel                                                                                                                    |
| `unknown`                                                                                      | No attribution data at all — rows written before this feature, manual rows, and any unrecognized value                                                                                      |

`detail` answers "which campaign, site, or page" and stays `null` when the source
already names the channel. The most specific value wins: `utm_campaign` when the
link carried one, otherwise for `referral` the host or unmapped `utm_source`, and
otherwise for `direct` and `leonlins.com` the landing path.

An unrecognized source value in the database is reported as `unknown` rather
than passed through, so a typo cannot create a new channel label.

## UTM conventions

Outbound distribution links are tagged so a signup can be traced back to the
post that produced it. Canonical article URLs stay untagged: dev.to cross-posts,
Farcaster embeds, and the localized Weibo post reference the canonical essay
rather than a campaign.

| Tag            | Value                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `utm_source`   | Pipeline platform, mapped to the canonical source: `twitter` → `x`, `bluesky`, `mastodon`, `linkedin`, `farcaster`, `nostr`, `threads`, `reddit` |
| `utm_medium`   | `social`                                                                                                                                         |
| `utm_campaign` | The article slug used as the post id                                                                                                             |

Tagging is idempotent: a URL that already carries a `utm_source`, an unknown
platform, or an unusable URL is returned unchanged, and existing query strings
and fragments are preserved. A link that already carries a `utm_source` is
reported on the run summary instead of being silently republished under the
wrong channel, and the summary records the tagged link that was published.
`tests/test_attribution.py` pins the tagged per-platform link, the tagging of
the thread link reply in the mode production runs, and the fact that the
canonical URL stays clean.

Every `utm_source` the pipeline emits is a named source in the vocabulary, so a
tagged signup reports as its own channel instead of falling into `referral`.
`tests/test_attribution.py` guards that direction only: it fails when the
pipeline tags a platform the vocabulary does not name or map. The reverse is
allowed, because the vocabulary also covers channels the pipeline never tags —
Instagram signups are recognized from the referrer host, and any other external
host, including a dev.to cross-post, is reported as `referral` with the host as
`detail` rather than being invented as a channel.

## Metric definitions

Every metric is re-derivable from stored rows. None is estimated.

- **Audience** — current `subscribers` rows by status (`active`, `pending`,
  `unsubscribed`, `bounced`, `complained`) plus a total. A `pending` row is a
  request that has not been confirmed, so it counts as audience, never growth.
- **Growth** — new subscribers and unsubscribes within the window, the 30-day
  totals, the net change, and the unsubscribe rate expressed against campaign
  sends in the window. A row counts as a new subscriber only once it has
  actually become a subscriber: `COALESCE(original_subscribed_at, confirmed_at,
created_at)` for confirmed or imported rows, and `NULL` for a request that is
  still pending. The unsubscribe rate counts every unsubscribe in the window over
  the sends in that same window; it is not restricted to recipients of those
  campaigns, so it is a list-health ratio rather than a per-campaign rate. Net
  change is `new − unsubscribed` and therefore excludes bounces and complaints,
  which the report states whenever such events occurred.
- **Acquisition** — new subscribers grouped by source and detail for the window,
  with the immediately preceding window of the same length as the comparison
  baseline. Sources with no current-window activity are omitted. Percentage
  shares are withheld below 20 new subscribers in the window, and individual
  details are listed only from 5 subscribers and only the top five, so a tiny
  cohort cannot look like a trend.
- **Deliverability** — campaign sends (`campaign_recipients.sent_at`) against
  deduplicated SES receipts (`newsletter_event_receipts.event_status`) as
  deliveries, hard bounces, complaints, and the two SES rates. Only receipts
  whose `provider_message_id` matches a campaign recipient are counted, so
  confirmation emails, allowlisted test sends, and this report's own email never
  enter the rates. Sends and events are both counted inside the window, and
  receipts arrive asynchronously, so a campaign sent in the last hours may still
  be reconciling and an event that arrives before the sender records its SES
  message id is excluded until reconciliation supplies the id; a rate is only
  compared with the account-level SES thresholds once the window holds at least
  20 sends.
- **Quality** — no paid or gifted subscribers exist, so paid conversion and paid
  churn are reported as not applicable instead of being inferred.
- **Engagement** — the newsletter carries no open or click tracking, so opens,
  clicks, and per-subscriber engagement are reported as not tracked and are
  never estimated.

Imported subscribers are classified as `imported_substack`; no importer change
was needed. A cancellation that was stamped onto an imported row at import time
(`imported_at IS NOT NULL`, `legacy_substack_cancel_date IS NULL`,
`unsubscribed_at <= imported_at`) is not a real unsubscribe event and is excluded
from growth, while a genuine Substack `Cancel date` still counts. A NULL
attribution is reported as `unknown`, not as `direct`, because nobody watched
that signup.

## Running the report

```bash
npm run newsletter:analytics -- --days 30        # default window is 7 days
npm run newsletter:analytics -- --days 30 --json # machine-readable metrics
```

Both forms read production rows through `DATABASE_URL` and change nothing; the
`--days` window accepts 1–365 whole days. The report is plain text and
deterministic, so the same window always renders the same output:

```text
Avoid Boring People — newsletter analytics (last 7 days)
Window: last 7×24h, 2026-02-22T12:00Z to 2026-03-01T12:00Z (UTC)

AUDIENCE (all subscribers)
  active                   1,204
  pending                      3
  unsubscribed                88
  bounced                      4
  complained                   1
  total                    1,300

GROWTH (last 7 days)
  new subscribers             42   (30-day: 178)
  unsubscribed                 6   (30-day: 14)
  net change                 +36
  unsubscribe rate      0.46% of 1,296 sends
  (rate = every unsubscribe in the window ÷ sends, not a per-campaign rate)

ACQUISITION (last 7 days)
  x                         18   43%
  reddit                    11   26%
  bluesky                    7   17%
  direct                     6   14%
  top details: launch-2026 18 · r/creativecoding 11 · /writing/why-systems-fail/ 6

DELIVERABILITY (last 7 days)
  sends                    1,296   deliveries: 1,291
  hard bounces                 3   rate: 0.23%
  complaints                   0   rate: 0.00%
  (rates cover this window's sends; SES events arrive asynchronously, so a
  campaign sent in the last hours may still be reconciling)

QUALITY
  paid and gifted subscribers: none — the newsletter is free-only, so paid
  conversion and paid churn are not reported.

ENGAGEMENT
  not tracked: newsletter email has no open or click tracking, so opens, clicks,
  and per-subscriber engagement are unavailable and are not estimated.

NOTABLE CHANGE
  ⚠ Unsubscribes rose: 6 in the last 7 days vs 2 in the prior 7 days.
  • net subscriber change excludes 3 bounces and complaints in this window.
  • x acquisition is above baseline: 18 in the last 7 days vs 4 in the prior 7 days.
  • reddit acquisition is above baseline: 11 in the last 7 days vs 3 in the prior 7 days.
```

The same report can be emailed to the author from the same local machine:

```bash
npm run newsletter:analytics:email -- --to <address> --confirm-send --days 30
```

Emailing is a separate explicit command because producing the report is
read-only while sending mail is not. The recipient must appear in the existing
`NEWSLETTER_TEST_RECIPIENTS` allowlist, `--confirm-send` is required,
`AWS_REGION` and `SES_CONFIGURATION_SET` must be configured, and the message
goes only from `newsletter@leonlins.com` to that address. Subscribers never
receive it, and no build, deploy, or CI job can send it.

## Thresholds

| Signal            | Rule                                                                         | Report section                    |
| ----------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| Hard bounce rate  | ≥ 2% of the window's sends, once the window holds ≥ 20 sends                 | `NOTABLE CHANGE` alert            |
| Complaint rate    | ≥ 0.1% of the window's sends, once the window holds ≥ 20 sends               | `NOTABLE CHANGE` alert            |
| No campaign sent  | 0 sends in the window                                                        | `NOTABLE CHANGE` alert            |
| Unmatched events  | delivery events in the window with no send to match                          | `NOTABLE CHANGE` alert            |
| Unsubscribe spike | ≥ 5 unsubscribes **and** ≥ 2× the prior window's unsubscribes                | `NOTABLE CHANGE` alert            |
| Acquisition surge | ≥ 10 subscribers from one source **and** ≥ 2× the same source's prior window | `NOTABLE CHANGE` note             |
| Small sample      | < 20 new subscribers in the window                                           | shares withheld, reported as such |

Every comparison puts a window count or ratio against the same-length window, so
no signal is produced by measuring one unit against another.

## Privacy

Attribution stores only what the reader's own browser sends with a signup: the
campaign tags on the link they followed, the referrer host, and the landing path.
There is no fingerprinting, no cookie set by this system, no IP address, and no
third party. The browser-side first touch lives in `localStorage` under
`abp.first-touch-attribution` and is sent only with a signup request on the
owned path; readers who clear storage simply sign up unattributed. The privacy
policy covers this explicitly.

## Verification

```bash
npm test                     # attribution + analytics unit and query-shape tests
npm run lint
npm run build
python -m pytest tests -q    # social tagging and dry-run expectations
```

An opt-in integration test exercises the real SQL against a disposable local
Postgres cluster (it never uses `DATABASE_URL`):

```bash
export PATH=$PATH:/usr/lib/postgresql/16/bin
NEWSLETTER_TEST_PG_SOCKET=/tmp/newsletter-analytics-pg-test \
  node --import ./tests/register-loaders.mjs --loader ts-node/esm tests/newsletter-analytics-postgres.ts
```

It applies migrations 001–004, inserts a dated fixture, and asserts the growth
rows, the window boundaries, the pending and import-time-cancellation
exclusions, acquisition grouping and its reconciliation with growth,
small-sample handling, and the deliverability rates and thresholds.

That test is a local-only harness: it talks to a private socket and a fixed
port, so CI does not run it and nothing in the build, test, or deploy path
depends on Postgres being reachable. CI covers the same SQL only through the
query-shape fixtures in `npm test`, which run against a stub `db`.

## Limitations

- No open, click, or per-subscriber engagement tracking exists, so engagement is
  reported as unavailable. Adding it would mean tracking pixels or link
  rewriting in subscriber mail, which this design deliberately avoids.
- There is no per-subscriber history: a row stores its first touch and its
  current status, not the sequence of visits that led to it.
- Growth and unsubscribes are reconstructed from lifecycle timestamps, so a
  historical row whose timestamps were never recorded is invisible to the
  window it actually belongs to.
- Shares and details are withheld for small windows, which is intentional: a
  window with 4 new subscribers reports counts and no percentages. For the same
  reason, deliverability rates in a window with fewer than 20 sends are printed
  but not compared with the account-level SES thresholds.
- The unsubscribe rate is a window heuristic, not a cohort rate: it divides
  every unsubscribe in the window by every send in the window, so it can exceed
  100% and does not tie a cancellation to the campaign that caused it. Only SES
  per-message events could attribute them, which is deferred scope.
- The public site still signs up through Substack, so production attribution
  data will remain absent until the Phase 5 cutover, and imported subscribers
  keep `imported_substack` as their only channel evidence.
- Post-deploy verification of the Vercel confirmation path and of SES/SNS event
  ingestion is unchanged by this feature and still requires the Phase 4 gates.
- Newsletter email links are not yet tagged for click attribution; only
  social/distribution links are, which is why `utm_medium=social` is the only
  medium currently produced.
- The report groups by normalized source and detail only; the raw `utm_*`
  values, including `utm_content`, are stored as evidence for auditing and are
  not yet reported.

## Deferred scope

Deliberately not built: email open/click tracking, per-subscriber event history,
a reporting dashboard or charts, cohort/segmentation analysis, paid-membership
metrics, revenue reporting, arbitrary report scheduling, third-party analytics
integrations, and any subscriber-facing reporting.
