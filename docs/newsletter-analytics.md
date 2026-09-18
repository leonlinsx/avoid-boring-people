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

On resubmission the `ON CONFLICT` branch updates only the confirmation token —
for a `pending` row, and for an `unsubscribed` row whose reader is asking to come
back — so a later visit can never rewrite how a subscriber was originally
acquired.
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
npm run newsletter:analytics -- --days 30         # default window is 7 days
npm run newsletter:analytics -- --days 30 --json  # machine-readable metrics
npm run newsletter:analytics -- --days 30 --check # exit non-zero when a failed check is listed
```

All three forms read production rows through `DATABASE_URL` and change nothing;
the `--days` window accepts 1–365 whole days. `--check` prints the same report
and then exits non-zero only when the report lists a failure, which is what the
scheduled health check runs. The report is plain text and
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

## Failure-only alerting and the weekly health check

Scheduled newsletter work is unattended, so the question that matters is "did it
fail?" That is answered with mechanisms that already exist — structured logs on
the routes, and a scheduled job whose failure is itself the notification. There
is no new service, no queue, no retry, and no dashboard.

Exactly three failures alert, and nothing else does:

| Alert kind                    | Emitted by                                                                                    | What it means                                                                                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signup_pipeline_failure`     | `/api/newsletter/subscribe`                                                                   | A signup failed inside the pipeline (database, confirmation send). A rate-limited request returns early and is not a failure, so it never alerts. The visitor still receives the generic response.                                                |
| `ses_event_ingestion_failure` | `/api/newsletter/ses-events`, [src/lib/newsletter/events.ts](../src/lib/newsletter/events.ts) | An authenticated event could not be applied (`reason: 'processing'`), the endpoint has no topic to verify against (`reason: 'configuration'`), or a delivery/bounce/complaint arrived with no message id to correlate (`reason: 'uncorrelated'`). |
| `analytics_job_failure`       | [scripts/newsletter/analytics.ts](../scripts/newsletter/analytics.ts)                         | Collecting the report failed (`reason: 'collection'`), or `--check` found a deliverability or ingestion failure (`reason: 'threshold'`).                                                                                                          |

Each one writes exactly one line, which is what makes it greppable and
matchable by a log rule:

```text
newsletter_alert { kind: 'analytics_job_failure', reason: 'threshold' }
```

[src/lib/newsletter/alerting.ts](../src/lib/newsletter/alerting.ts) accepts only
`kind`, `reason`, and `errorName`, and omits a field the caller did not set.
`kind` and `reason` are closed unions declared in that module, so the allowlist is
enforced by the type checker as well as by the call sites: an email address, a
token, a request body, or an SES message id cannot reach the line even if a caller
passes one. `errorName` is the one field the checker cannot constrain, so the
module forbids passing an error's message, and the signup route no longer logs the
driver's message next to its alert, because a Postgres or `fetch` message can
quote the failing row or the connection string. Two older lines still log a
provider message — `newsletter_confirmation_send_failure`, and the unauthenticated
branch of the SES route, whose message describes the sender's own envelope — and
both are pre-existing rather than part of this change.

Unauthenticated SNS traffic stays silent by design. A request that fails
signature or topic verification, or a malformed signup body, is junk internet
traffic rather than an operator problem, and alerting on it would train the
author to ignore alerts. The one exception is a missing topic configuration:
that is checked before authentication, because nothing can be ingested without
it, and it is a deployment fault rather than junk, so it alerts. It also repeats
once per incoming request until the environment is fixed, so its log rule needs
a count or rate window rather than a single line. Nothing on these paths
retries, buffers, or changes a response status: the alert records a failure, and
the route keeps the status code it already returned.

Alerts also repeat: every occurrence writes its own line, because a dropped
event or a failed signup is evidence, and collapsing repeats would hide the
second failure that happened while the first was still true. A log-alert rule
should therefore trigger on a count or rate within a window rather than on a
single matching line.

### The weekly job

[.github/workflows/newsletter-health.yml](../.github/workflows/newsletter-health.yml)
runs `npm run newsletter:analytics -- --days 30 --check` every Monday at 13:00
UTC, and on demand. A failed run is the alert — GitHub mails the repository
owner, the same way
[.github/workflows/token-health.yml](../.github/workflows/token-health.yml)
reports a failing social token.

It needs one repository secret, `NEWSLETTER_ANALYTICS_DATABASE_URL`, holding a
read-only connection string for the newsletter database. When that secret is
absent, or is not a `postgres://`/`postgresql://` connection string, the step
fails on purpose before the report runs: a health check that quietly verifies
nothing is worse than no health check at all.

This repository is public, so the job never prints the driver's message: a
collection failure is reported as
`newsletter_alert { kind: 'analytics_job_failure', reason: 'collection' }`, one
generic line, and a non-zero exit. Run the report locally to see the message,
which some drivers build by quoting the connection string back.

**Owner step:** the two runtime kinds are logged, but only the scheduled job can
notify by itself. To be told about a signup or ingestion failure, add an alert
rule on the Vercel project's log stream matching `newsletter_alert` — Vercel's
own log alerts, so still no new service — or read them during a normal check.
Until such a rule exists those two failures are recorded and not pushed
anywhere.

## Thresholds

| Signal               | Rule                                                                         | Report section                    | `--check`   |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ----------- |
| Hard bounce rate     | ≥ 2% of the window's sends, once the window holds ≥ 20 sends                 | `NOTABLE CHANGE` alert            | fails       |
| Complaint rate       | ≥ 0.1% of the window's sends, once the window holds ≥ 20 sends               | `NOTABLE CHANGE` alert            | fails       |
| Ingestion stopped    | past-grace sends in the window with no correlated SES receipt of any kind    | `NOTABLE CHANGE` alert            | fails       |
| Events out of window | delivery events whose matching send falls outside the window                 | `NOTABLE CHANGE` alert            | report only |
| No campaign sent     | 0 sends in the window                                                        | `NOTABLE CHANGE` alert            | report only |
| Unsubscribe spike    | ≥ 5 unsubscribes **and** ≥ 2× the prior window's unsubscribes                | `NOTABLE CHANGE` alert            | report only |
| Acquisition surge    | ≥ 10 subscribers from one source **and** ≥ 2× the same source's prior window | `NOTABLE CHANGE` note             | report only |
| Small sample         | < 20 new subscribers in the window                                           | shares withheld, reported as such | report only |

The exit contract is deliberately narrow: `--check` fails only on the bounce
rate, the complaint rate, and the ingestion switch, because those are
sending-reputation and event-ingestion problems that should interrupt whatever
the author is doing. A weekly job that also failed on "no campaign was sent" or
on an unsubscribe fluctuation would go red for ordinary reasons in an irregular
publishing cadence, and a red run that is usually meaningless stops being read.

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
NEWSLETTER_TEST_PG_SOCKET=/tmp/newsletter-lifecycle-pg-test \
  node --import ./tests/register-loaders.mjs --loader ts-node/esm tests/newsletter-lifecycle-postgres.ts
```

The analytics harness applies migrations 001–004, inserts a dated fixture, and
asserts the growth rows, the window boundaries, the pending and import-time-
cancellation exclusions, acquisition grouping and its reconciliation with
growth, small-sample handling, the deliverability rates and thresholds, and the
ingestion dead-man's switch (a window with sends past the grace period and no
receipt at all alerts and fails, and a single correlated receipt clears it).

The lifecycle harness replaces the stub in the unit tests with real Postgres and
asserts the subscription rules the fake database can only describe: an `active`,
`bounced`, or `complained` row is untouched by a signup request (whole-row
comparison), a resubscription request issues a fresh token while changing
nothing else, only a matching token confirms a resubscription, a confirmation
token works once, a stale token cannot reopen a bounce, a cancellation clears
the confirmation token so an earlier link cannot reopen the row, and a
cancellation after a resubscription records its own timestamp while a repeated
unsubscribe click keeps the cancellation time the row already had.

Both are local-only harnesses: they talk to a private socket and a fixed port,
so CI does not run them and nothing in the build, test, or deploy path depends
on Postgres being reachable. CI covers the same SQL only through the query-shape
fixtures in `npm test`, which run against a stub `db`.

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
- Failure-only alerting means an unqueried path is an unverified path: a signup
  or ingestion failure is logged but only reaches a human if a log rule or a
  person looks at the log stream. The scheduled job is the one failure that
  notifies on its own.
- `--check` deliberately does not fail on "no campaign was sent" or on an
  unsubscribe spike, so a quiet weekly run means "nothing is proven wrong", not
  "everything is fine".
- A green weekly run is evidence only about the rows the configured connection
  string returned. It cannot prove that the secret points at the production
  database, and until the cutover the audience is empty by design, so the report
  is honest but thin: the job's value grows with the data, not with the check.
- A resubscription is a token and a confirmation, not a new subscriber: the row
  keeps its first `confirmed_at`, so growth still dates that reader from the
  original signup, and `unsubscribed_at` stays as the last-cancellation marker
  even while the row is active again. The report therefore treats a returning
  reader as a retained subscriber rather than as new acquisition, and a reader
  who cancels again is counted once, in the later window.

## Deferred scope

Deliberately not built: email open/click tracking, per-subscriber event history,
a reporting dashboard or charts, cohort/segmentation analysis, paid-membership
metrics, revenue reporting, arbitrary report scheduling, third-party analytics
integrations, and any subscriber-facing reporting.
