# AI search discoverability and acquisition

## Audit before implementation — November 7, 2026

Reviewed latest `origin/main` at `9a57d79` in an isolated worktree. Public checks
used curl GETs, saved HTML and XML, and parsed server-rendered HTML. No production
writes, subscriber queries, form submissions, or emails were needed.

| Area                    | Current implementation                                                                                    | Verified status                                                                                                           | Gap                                                                                                                         | Recommended action                                                                                                   | Priority  |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| Search crawlers         | Explicit allow groups for OAI-SearchBot, PerplexityBot, Claude-SearchBot, Claude-User, Googlebot, Bingbot | Already implemented: live robots matches repository; article returns 200 for all six user-agent strings                   | Agent strings do not prove access from real crawler IPs                                                                     | Keep policy; inspect webmaster crawl diagnostics manually                                                            | P1 manual |
| Training policy         | GPTBot, Google-Extended, ClaudeBot disallowed                                                             | Already implemented in live robots                                                                                        | None found                                                                                                                  | Preserve exactly                                                                                                     | —         |
| Hosting / rendering     | Cloudflare → Vercel; static Astro article HTML                                                            | Already implemented: Anthropic, Kelly, Ergodicity return 200 with meaningful article text (about 23k, 12k, 8k characters) | Firewall rules and real crawler logs unavailable                                                                            | No security changes; manually check Cloudflare bot events                                                            | P1 manual |
| Canonicals / redirects  | Slashless self-canonical URLs; generated legacy 308 routes                                                | Already implemented: sampled canonicals correct, legacy Kelly URL with slash resolves to canonical 200                    | Not an exhaustive crawl                                                                                                     | Preserve                                                                                                             | —         |
| Sitemaps / RSS          | Astro sitemap index, dated article sitemap, RSS discovery link                                            | Already implemented: index, sitemap-0 and RSS return 200; article URLs present                                            | Submission / indexing status unavailable                                                                                    | Inspect GSC and Bing dashboards                                                                                      | P1 manual |
| Structured data / dates | Person, Organization, WebSite, BlogPosting, BreadcrumbList; publication/updated dates                     | Already implemented: sampled live JSON-LD matches underlying pages and canonical URLs                                     | No evidence new schema is needed                                                                                            | Preserve; never restamp metadata-only edits                                                                          | —         |
| Article metadata        | Shared editorial `description` feeds cards, email and invisible metadata                                  | Improvement opportunity: Anthropic metadata is only “Scale is all you need”                                               | Original financial analysis absent from description                                                                         | Optional metadata-only override for this article                                                                     | P1        |
| Other article metadata  | Kelly and ergodicity descriptions already explain the subject                                             | Already implemented                                                                                                       | Doctor GPT-3 has a playful subtitle, but historical article/title already identify subject; no compelling change identified | No bulk changes                                                                                                      | —         |
| Internal links          | Related articles, archive/category links, article cross-links; regression checks                          | Already implemented in sampled HTML and tests                                                                             | Editorial link changes out of scope                                                                                         | Preserve                                                                                                             | —         |
| llms.txt                | Existing guide to archive, author and selected essays                                                     | Already implemented: live file returns 200                                                                                | Links use trailing slash redirects; no proven retrieval failure                                                             | No new crawler files or speculative expansion                                                                        | —         |
| Webmaster / IndexNow    | Sitemap advertised; no repository evidence of IndexNow or Crawler Hints                                   | Requires manual verification                                                                                              | GSC/Bing ownership, submissions, Cloudflare settings unknown; no HTML verification tag is not proof of no ownership         | Check dashboards; no duplicate integration                                                                           | P1 manual |
| Newsletter safety       | Existing conclusion form, shared API, confirmation tokens, pending state, suppression safeguards          | Already implemented in repository                                                                                         | No live signup tested (would send email)                                                                                    | Exercise local tests only                                                                                            | —         |
| Acquisition             | Browser first attributable touch; raw bounded UTMs, landing path, referrer host; append-once insert       | Verified issue: ChatGPT/Perplexity referrals stored as organic_search; tagged ChatGPT links become generic referral       | AI cannot be separated in normal source report                                                                              | Add two explicit source labels for new signups; preserve old rows                                                    | P1        |
| Reporting               | Read-only report counts confirmations/imports, not pending requests; source and detail groups             | Already implemented                                                                                                       | No source × landing-page breakdown; historical AI buried in organic/referral                                                | Document read-only raw-field analysis with explicit derived labels                                                   | P1        |
| Report operation        | Existing runbook records analytics-reader column privilege failures on November 2                         | Requires manual verification of current permissions                                                                       | Production report operation and access to raw attribution columns not verified here                                         | Check reader privileges and complete the existing approved repair process if still needed; do not switch to a writer | P1 manual |
| GA4                     | Production gtag is present (G-T166SDEC42); conditional on PUBLIC_GA_ID                                    | Requires manual verification of collection/property access                                                                | No connected GA4 or webmaster reporting tool; visits and conversions unavailable, not zero                                  | Manual session-source/landing-page export                                                                            | P1        |
| Conversion placement    | One form after conclusion, before footnotes; archive/home signup also exists                              | Improvement opportunity: citation readers may leave before conclusion                                                     | No measured landing/scroll/subscriber baseline to justify more visual interruption                                          | Defer second form; measure baseline first                                                                            | P2        |

The web-fetch service could not retrieve several public resources, while direct
curl requests succeeded. Those tool errors are not site failures. User-agent
checks do not establish indexing, citation eligibility, or actual bot-IP access.
No changes to crawler policy, security, schema types, RSS, sitemap or article UI
are justified by this audit. Citation availability and acquisition outcomes are
unmeasured until the manual baseline below is completed.

## Implemented decisions

Only one article receives an override. Before, HTML, Open Graph, Twitter and
BlogPosting descriptions were all `Scale is all you need`. After, all four use:

> Anthropic IPO analysis estimates incremental cloud-channel fees of 17–37%, then ~36% from amended disclosures, subject to assumptions and timing—not disclosed contract rates.

This describes the author's estimates, not independently verified contractual
rates. It preserves the caveats in the article. The original `description`
remains exactly `Scale is all you need`; cards, RSS and email continue to read
that field. Optional `seoDescription` is read only by the English article's
BaseLayout metadata prop; translated pages retain translated descriptions.
Without an override, metadata falls back to the existing editorial description,
then BaseHead's existing site default. Publication/modification dates do not
change. Kelly and ergodicity metadata remain unchanged because they are adequate.

New signups normalize the exact ChatGPT and Perplexity hosts/tags to `chatgpt`
and `perplexity`. Their sum is **identifiable AI referrals**, not all AI visits
and not proof that a visit used a search feature instead of a shared chat link.
ChatGPT's automatic `utm_source=chatgpt.com` is documented in the
[OpenAI publisher FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq).
Only exact hosts (after removing www) match; suffix lookalikes do not. Explicit
UTMs still take precedence over referrers. No Google or Bing visit is inferred
to be AI, and missing referrers remain direct/unknown as before. No additional
AI brands are classified without comparable evidence.

The existing report recognizes these two new source labels automatically.
`npm run newsletter:analytics -- --days 30 --json` returns source counts based on
confirmed/imported subscriptions, including subscribers who subsequently leave;
pending requests do not count. Existing report fields, dates and old stored
labels are unchanged. Raw bounded UTMs, referring domain and first landing path
are preserved; subscriber attribution is still INSERT-only. Browser capture is
first _attributable_ touch: a prior direct/self visit can be upgraded, then an
informative source cannot be replaced. It is browser-local and may be lost when
storage is cleared, blocked, or another device is used.

For source × first landing page and historical evidence, run the separate
[read-only SQL](../scripts/newsletter/ai-acquisition.sql) with the existing
analytics-reader connection (already supplied securely through PG* variables):

```sh
PGOPTIONS='-c default_transaction_read_only=on' psql -X -v ON_ERROR_STOP=1 \
  -v window_start='2026-11-08T00:00:00Z' \
  -v window_end='2026-12-08T00:00:00Z' \
  -f scripts/newsletter/ai-acquisition.sql
```

Replace example UTC dates with the actual deployment window; end is exclusive.
Verify that the analytics reader has SELECT on the raw attribution columns used by this query; production grants were not inspected here. The existing analytics runbook also records a November 2 report-reader privilege blocker whose current status needs operator verification. Do not switch to a writer or apply grants without the existing approval process. Do not paste credentials into commands or save subscriber-level exports. This
query emits aggregates only, with `stored_source`, `derived_source`,
`signup_path` and confirmed counts. It can identify old organic/referral rows
from raw AI evidence without updating them. Always label this output **derived
raw-evidence classification**; do not silently substitute it into old reports.
Use the same query for every comparison window. For an AI total, sum derived
ChatGPT + Perplexity; compare with derived organic_search. Some organic rows
remain ambiguous (Google AI features share normal search attribution).
`signup_path` is the first captured landing path, not necessarily the page where
the form was submitted. A null path means unavailable, not the homepage.

No second signup placement was added. Before/after desktop and mobile placement
is unchanged: existing form after conclusion, before footnotes. There is no new
multi-form behavior to verify and no claim of conversion uplift. Reconsider a
compact reusable form only if qualified landing traffic and scroll/conversion
observations show readers consistently miss the current invitation.

## Manual visibility baseline and fixed questions

Freeze these questions for baseline, day 30 and day 90. Use a new conversation
per question, default free web-search mode, English, the same country/device and
signed-in state, and record all settings. Do not include site/author names, ask
for this site, provide its URL, or keep retrying until it appears. Record the
first completed answer. If a platform does not produce an AI answer, record
`no AI answer`, not a missing citation. Citation presence means an actual
clickable supporting link inspected in the answer/source panel, not a model's
claim that it cited something. Record the exact destination, including aliases
and query parameters, then separately normalize to canonical for comparisons.

| ID  | Exact non-branded question                                                                                            | Scope / relevant article |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Q1  | What do Anthropic's financial disclosures imply about incremental cloud distribution fees?                            | Narrow; anthropic_ipo    |
| Q2  | How can changes in cloud-channel revenue and channel-partner fees be used to estimate Anthropic's take rates?         | Narrow; anthropic_ipo    |
| Q3  | Why might estimates of Anthropic's incremental cloud-channel fees range from 17% to 37%?                              | Narrow; anthropic_ipo    |
| Q4  | What does Anthropic's amended disclosure imply about a roughly 36% cloud-channel take rate, and what are the caveats? | Narrow; anthropic_ipo    |
| Q5  | How should investors distinguish Anthropic's accounting losses from cash flow and compute commitments?                | Broader; anthropic_ipo   |
| Q6  | Can Anthropic's revenue growth offset its investment requirements and distribution costs?                             | Broader; anthropic_ipo   |
| Q7  | What take rates do cloud marketplaces charge AI providers, and how can financial statements reveal them?              | Broader; anthropic_ipo   |
| Q8  | How can the Kelly criterion inform angel investment position sizing?                                                  | Narrow; kelly            |
| Q9  | What assumptions limit the use of the Kelly criterion for startup portfolios?                                         | Narrow; kelly            |
| Q10 | Why does diversification matter when sizing risky startup investments?                                                | Broader; kelly           |
| Q11 | What is the difference between ensemble averages and time averages in investing?                                      | Narrow; ergodicity       |
| Q12 | How does non-ergodicity change the way investors should think about ruin and long-term risk?                          | Broader; ergodicity      |

As of November 7, 2026, ChatGPT's browser UI presented a Cloudflare human
verification challenge. Google Search redirected the Q1 attempt to its unusual
traffic/reCAPTCHA page. These are evaluation-environment limitations, not
leonlins.com access failures. No challenges were bypassed. No citation results
are inferred from the generic web-search tool or these access checks.

For manual completion, use ChatGPT with Search enabled; Perplexity's standard
Search; Google Search with its AI Overview expanded, plus AI Mode if available
(record them separately). Inspect every cited source panel, not just the visible
answer text. If unavailable in your region/account, record unavailable. Preserve
a screenshot or answer share URL as evidence, without saving account details.

Copy one row per question × platform × date:

| Date/time UTC | Q ID + exact question | Platform / mode / region / signed-in state | Status (tested / unavailable / no AI answer) | Citation (yes / no / unmeasured) | Exact cited URL | Original finding or generic explanation | Other cited sources (URLs) | Concrete reason to click through | Evidence link / notes |
| ------------- | --------------------- | ------------------------------------------ | -------------------------------------------- | -------------------------------- | --------------- | --------------------------------------- | -------------------------- | -------------------------------- | --------------------- |
|               |                       |                                            |                                              |                                  |                 |                                         |                            |                                  |                       |

Citation samples are nondeterministic and small. Count original-finding citations
separately from generic explanations. A click reason might be the fee calculation,
assumptions, or a table the answer cannot replace. Do not score a generic name
mention as a useful citation. A broader answer can cite other sources correctly
without including this site.

## Acquisition baseline and evaluation cadence

GA4 collection is configured in production, but no authenticated property/report
access is available here. Visits, confirmed production acquisitions and conversion
rates are **unmeasured**, not zero. There is no live subscription test.

In existing GA4 Reports → Acquisition → Traffic acquisition, inspect **Session
source / medium**, not only default channel groups (AI may be referral). In an
Exploration, use Session source, Session medium, Landing page + query string and
Sessions; filter hostname to leonlins.com. Group exact ChatGPT sources
`chatgpt.com`, `chat.openai.com`, `chatgpt`, and Perplexity sources `perplexity.ai`,
`perplexity`; inspect unexpected variants manually rather than broad substring
matching. Export aggregate sessions by source and article landing page. Keep
original dimensions, combine query-string variants only in the analysis, and
compare ordinary organic search separately. Do not reinterpret direct traffic.
These dimensions have distinct [session and user scopes](https://support.google.com/analytics/answer/11080067);
see the [Traffic acquisition report](https://support.google.com/analytics/answer/12923437).
Check Realtime/DebugView manually to establish collection works; installed gtag
alone does not establish recorded visits. Avoid including your own test visits
in the baseline.

- **T0, after an approved deployment:** record SHA, deployment time, UTC window,
  GA timezone/filters/consent coverage, citation sample and aggregate acquisition.
  Export the preceding 30 days if retained; mark that code/report labels changed
  at T0. Use the raw-evidence query for both old and new windows.
- **Day 30:** repeat the fixed question set once; compare equivalent 30-day
  traffic and confirmation windows, sources and first landing articles. Record
  absolute counts alongside changes; do not calculate percentage growth from
  an unavailable/zero baseline. Annotate publishing and external promotion.
- **Day 90:** repeat; compare days 61–90 with baseline and the full 90-day
  aggregate. Decide whether incremental qualified visits and confirmed readers
  justify implementation/maintenance time. Citation counts alone are not success.
  If acquisition is absent or too small to establish value, retain inexpensive
  metadata/attribution fixes and avoid expanding the project.

Do **not** divide first-touch confirmed subscriber counts by session-source visits
and call that a conversion rate: different touch scopes, browser coverage and
confirmation delays make them incompatible. There is no GA confirmed-subscription
event/cohort join in this implementation. Report conversion rate as **unavailable**
until numerator and denominator can share source, landing cohort, attribution
scope, date basis and consent coverage. A future first-touch cohort calculation
would need visits grouped by that same first attributable touch and a fixed
confirmation follow-up period; no new tracking infrastructure is added here.

| Window / deployed SHA | AI sessions (ChatGPT / Perplexity) | AI article landing sessions | Confirmed AI acquisitions (same SQL basis) | Ordinary organic sessions / confirmed acquisitions | Conversion rate / compatibility | Original citations / tested answers | Effort / interpretation / next decision |
| --------------------- | ---------------------------------- | --------------------------- | ------------------------------------------ | -------------------------------------------------- | ------------------------------- | ----------------------------------- | --------------------------------------- |
| Baseline              | unmeasured                         | unmeasured                  | unmeasured                                 | unmeasured                                         | unavailable                     | unmeasured                          | Complete dashboard and search checks    |
| Day 30                |                                    |                             |                                            |                                                    |                                 |                                     |                                         |
| Day 90                |                                    |                             |                                            |                                                    |                                 |                                     |                                         |

Manual priorities: (1) inspect GSC/Bing URL indexing and submitted sitemaps for
priority articles, plus Cloudflare bot events; check any account-level AI Search
visibility controls without enabling training crawlers; (2) complete GA4/source
and confirmed-acquisition baseline; (3) repeat the citation sample; (4) consider
another form only if acquisition evidence supports it. No new IndexNow/Crawler
Hints setup or special AI schema is warranted by this audit. Google's
[AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
points to ordinary SEO fundamentals rather than additional special markup.

### Pre-deployment citation spot check

One completed Perplexity standard Search answer was inspectable anonymously on
November 7, 2026 (desktop browser, no region setting, 21:10 UTC). For Q1,
leonlins.com did **not** appear in the answer citations or its expanded ten-source
panel. Original/generic support and reason to click this site are therefore not
applicable. The answer cited [Visionary Talks](https://visionarytalks.com/anthropic-ipo/),
[MBI Deep Dives](https://www.mbi-deepdives.com/ant-s1/) and
[Tanay Jaipuria](https://x.com/tanayj/status/2117465629737238961).
Other panel sources included Fidelity, Asimov's Addendum, Luminix, Blockspace,
Rittenhouse Research and dev.to. This records displayed sources, not endorsement
or independent validation of their claims. Evidence: [Q1 session](https://www.perplexity.ai/session/3cbd4460-1221-45a1-8cdb-41a8fbc5bf62).

A new Perplexity session did not reliably retain Q2 input after two fill attempts;
no second answer was obtained. The remaining questions require manual testing.
This is a partial pre-deployment spot check, not a completed citation baseline.
[Baseline worksheet](ai-search-baseline.csv) records every question/platform row:
no citation and unmeasured are kept distinct. Manual completion should preserve
these limitations, then create a fresh T0 baseline after deployment approval.

## Validation and review

- Production public GETs: six search user-agent responses, sampled canonical
  articles, redirect destination, RSS, sitemaps, live robots and llms.txt verified.
- `npm test`: all custom suites passed outside the restricted process sandbox;
  includes attribution, report reconciliation, confirmation, suppression and
  production-send safeguards. SES and databases are mocked in that suite.
- Python suite using the existing repository virtualenv: **735 passed**. The
  system Python lacks required dependencies; no dependency changes were made.
- `npm run lint`, `npm run build`, `npm run test:built:article-layout`: passed.
  Built checks cover metadata override, ordinary/translated fallback, canonical,
  dates, RSS editorial preservation and existing article layout/footnotes.
- Local disposable Postgres analytics harness: passed, including both source
  labels, legacy raw evidence, UTM precedence, first landing path, pending
  exclusion and a database-enforced read-only query. Local lifecycle harness:
  passed (confirmation, suppression, retries, cohort and rate-limit SQL).
- `astro check`: four pre-existing errors, reproduced identically on an untouched
  archive of `origin/main` at `9a57d79`: BaseHead keywords typing and meta key,
  generic CollectionEntry typing in text.ts, and the newsletter-drafts schema
  call typing. No new error locations; unrelated fixes are outside this PR.
- Independent baseline build comparison: all **666** built article pages retain identical visible text, image sources/alt text and link destinations/text. RSS, sitemap index, sitemap-0, robots.txt and llms.txt are byte-identical.
- Byte comparison against main confirms all original article files unchanged
  except adding the single seoDescription line. Every existing frontmatter
  value and every article-body byte is unchanged. No date changes.
- No crawler, security, subscription lifecycle or visible UI changes. No paid
  services, dependencies, schema migration or scheduled automation added.
  The task branch is excluded from automatic Vercel deployment in vercel.json
  to honor the requirement for deployment approval.
- No live email sent, no production subscriber records read or modified, and no
  production deployment or merge performed. Outcomes remain unmeasured.
