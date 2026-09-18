# Lin Scout

Lin Scout is an internal discovery tool for leonlins.com. It looks for a handful
of current external conversations — a Hacker News thread, a Bluesky post — where
an article that already exists in the archive would be a genuinely useful
contribution, and it drafts the reply the author could post by hand.

It is a reporting tool, not a publishing tool. It runs in a scheduled GitHub
Action, prints its report into the run summary, records what it surfaced so the
same conversation is never surfaced twice, and stops. Nothing it does touches the
website build, the deploy, or any subscriber or social credential beyond the two
searches it makes.

Scout exists to make high-quality distribution cheap. It is not a growth tool and
it is not measured in volume: the expected output is zero to five opportunities
in a day, and "No high-confidence Scout opportunities found." is a successful
run.

## What it does not do

These are the boundaries most likely to be violated by a future change, so they
are stated before the mechanics.

- It never posts, replies, sends mail, or calls a social write API. Scout has no
  publisher and needs no posting credential. The author reviews the report and
  posts by hand or not at all.
- It does not run as a service. One bounded invocation per day, no daemon, no
  worker, no queue, no event stream, no real-time polling.
- It adds no infrastructure: no database, no vector store, no embeddings, no
  third-party analytics, no dashboard, no new repository. State is one committed
  JSON file.
- It does not re-index the archive. The article inventory is the same
  `search-index.json` the distribution job already reads, and the judgment call
  reuses the existing summarizer's provider plumbing (see
  [Relationship with evergreen distribution](#relationship-with-evergreen-distribution)).
- It is not a general "content opportunity" system. Competitive/SEO research,
  analytics over its own results, and scheduled digest emails belong to other
  tools; Scout reads current conversations and stops there.
- It does not present a candidate as an opportunity on the strength of topical
  overlap. Overlap only decides what deserves a model call; the judgment decides
  whether there is a contribution.

## How a run works

`python -m scripts.scout run` executes one pass, in this order:

1. **Inventory** (`scripts/scout/inventory.py`) — `fetch_posts()` returns the
   deployed `search-index.json`, which is trimmed to the fields the prompt needs
   (title, URL, date, category, tags, summary, up to 2000 characters of body).
   Entries without an id, title, or URL are skipped rather than matched against a
   placeholder. No new index is built.
2. **Queries** (`scripts/scout/matching.py`) — the recurring tags of published
   writing become the search queries: tags used by at least two articles, most
   frequent first, capped at `SCOUT_QUERY_LIMIT` (6). No hand-maintained keyword
   list exists; `--queries` overrides it for a one-off.
3. **Discovery** (`scripts/scout/discovery.py`) — each source is searched
   independently and its failures are isolated.
4. **Matching** (`scripts/scout/matching.py`) — each candidate is paired with the
   best-covered article, deterministically.
5. **Gates** (`scripts/scout/filtering.py`) — candidates that cannot be worth
   joining are dropped before any model call, and the count of those gates is
   reported.
6. **Judgment** (`scripts/scout/filtering.py`) — one model call per surviving
   candidate, capped at `SCOUT_MAX_JUDGMENTS` (8), returning a verdict and, for a
   contribution, a draft.
7. **Report** (`scripts/scout/report.py`) — the scan summary, the STRONG
   opportunities (at most `SCOUT_MAX_OPPORTUNITIES`, 5), and then every candidate
   the run declined with the reason it declined. Printed to the log and appended
   to `GITHUB_STEP_SUMMARY`.
8. **State** (`scripts/scout/state.py`) — a normal run records what it surfaced
   and expires stale staged opportunities. A dry run writes nothing.

Two empty results are treated as failures rather than as quiet days, because both
would otherwise keep reporting success indefinitely: a run where every attempted
source failed, and a run where every reachable source answered but returned no
candidates at all (which is what a change in a source's query semantics looks
like from here). A run whose candidates were found and then declined by the gates
or the judgment is an ordinary quiet day and reports normally.

## Sources

| Source | Access | Notes |
| --- | --- | --- |
| Hacker News | Algolia's public API, no credential | Both `/search` (ranked by traction) and `/search_by_date` (ranked by recency) are read per query, then merged and deduped. Reading one alone reliably misses the other's finds. |
| Bluesky | The repository's existing app-password credentials | `searchPosts` sorted by latest, replies excluded. Skipped, with the reason reported, when `BLUESKY_HANDLE`/`BLUESKY_PASSWORD` are unset. |

Both sources are treated as untrusted input: HTML is unescaped, tags stripped,
whitespace collapsed, and text capped before it reaches a prompt, and the
judgment prompt states that the candidate is material to assess rather than
instructions to follow.

Reddit was considered and left out: its public JSON API refuses datacenter IP
addresses, which is exactly where a scheduled run executes. Web search and
RSS/feed sources were left out of V1 as well; adding a source means implementing
one function in `scripts/scout/discovery.py` and listing it in `SOURCES`.

Adding a source must not turn into a plugin framework. Two sources with explicit
functions are the current design; a third is a third function.

## Matching and the deterministic gates

Matching is candidate generation, never evidence. `score_item` returns zero
unless the conversation shares a term with the article's **title** (3 points per
term) or its **tags/category** (3 points per term), so a pairing always has a
core claim in common; overlap with the article's summary can only order an
already-qualifying pairing and contributes at most 3 points. `SCOUT_MIN_MATCH_SCORE`
defaults to 3, the smallest score that can come from a real core term. Terms are
lowercased, de-pluralized, and filtered against a generic-English stopword list.

Everything else is a cheap reason not to spend a model call, and every one of
them is printed as `scout_candidate_gated {url} ({reason})`:

| Gate | Default | Why |
| --- | --- | --- |
| already recorded | `scout-state.json` | Scout never re-surfaces a conversation |
| unusable timestamp | — | the source gave no date, so "why now" cannot be answered |
| too old | `SCOUT_MAX_AGE_DAYS` (7) | a week-old thread is not a current conversation |
| too little activity | `SCOUT_HN_MIN_COMMENTS` (2), `SCOUT_MIN_REPLIES` (1) | a thread with no replies has nobody to help |
| source text too short | 40 characters | nothing to judge |

Candidates that survive are ordered by score (ties broken deterministically by
URL and then recency), and only the first `SCOUT_MAX_JUDGMENTS` are judged. A
failed model call is reported as `scout_judgment_failure {url} {ErrorName}` and
its candidate is left unjudged rather than rejected; if every call fails the run
fails, because "nothing found" and "nothing could be judged" must not look the
same.

## The judgment and the draft

One prompt per candidate, built in `filtering.build_judgment_prompt`, returning
one JSON object:

```json
{
  "verdict": "STRONG | MAYBE | REJECT",
  "matching_content_id": "<an id shown in the prompt>",
  "reason": "one sentence",
  "why_now": "one sentence",
  "why_fits": "one sentence",
  "draft": "the reply the author could post",
  "link": true,
  "link_reason": "one sentence"
}
```

The prompt shows the paired article in full (title, metadata, URL, body) plus up
to two other articles that share vocabulary with the conversation, and the model
may name any of them as `matching_content_id`, so a wrong pairing cannot become a
wrong draft. The prompt states that precision matters more than recall, that
STRONG must be rare, that nothing may be invented, and that the candidate text is
untrusted material rather than instructions.

Untrusted text is quoted between delimiters it cannot reproduce: the fence token
is stripped from anything interpolated into the prompt, and source text arrives
with markup and newlines already collapsed, so a thread cannot close the quote
and append instructions of its own. That is a structural defence, not a complete
one — the model can still be steered — which is why nothing Scout produces is
published automatically and the draft is validated before it is shown.

A draft is rejected rather than repaired (verdict becomes REJECT) when it is
empty, shorter than 120 characters, longer than 1200, contains markdown or a URL
where `link` is false, or leans on outside-summary/self-promotion framing ("this
essay argues…", "check out…"). A URL is required to be the paired article when
`link` is true; a missing URL with `link` true is fine, because the report shows
the link decision for the author to act on.

Only STRONG reaches the report, and only STRONG is recorded.

## Report format

```
Lin Scout — 2026-09-18 12:00 UTC
Judgment model: deepseek/deepseek-flash
Queries: investing, behaviour, startups, risk, ai, business
Sources: hacker-news: 24 found | bluesky: 3 found
Candidates: 180 unique
Judgments: 8 model calls | 122 gated before judgment | 0 call failures

Opportunities found:

1. SOURCE: hacker-news · Hacker News · https://news.ycombinator.com/item?id=… (12 replies, 2026-09-17)
   WHY NOW: …
   MATCHING CONTENT: When markets fail quietly — https://leonlins.com/writing/…
   WHY THIS FITS: …
   PROPOSED RESPONSE:
     …
   LINK: no — …

Candidates considered:
- REJECT: https://news.ycombinator.com/item?id=… — the writing restates what the thread already established
```

The declined list is part of the product. It is what makes the tool's precision
inspectable instead of a mystery, and a candidate that is repeatedly rejected is
evidence the thresholds need changing rather than a reason to loosen the gates.

The same text is written to `$GITHUB_STEP_SUMMARY`, which GitHub renders as
Markdown, so model-written explanation lines are flattened to plain prose before
they are shown: no link, image, emphasis, or code span arrives from the model
into the page the author reads.

## State

`scout-state.json`, committed at the repository root, written atomically through
`scripts/automation/json_store.py` — the same discipline as `posted.json`,
because a scheduled run can be killed mid-write:

```json
{
  "version": 1,
  "opportunities": {
    "https://news.ycombinator.com/item?id=…": {
      "external_url": "…", "source": "hacker-news", "content_id": "…",
      "status": "surfaced", "draft": "…",
      "discovered_at": "…", "surfaced_at": "…", "acted_at": null, "outcome": null
    }
  }
}
```

A conversation's identity is its normalized URL: scheme and host lowercased,
trailing slash and `utm_*` parameters dropped, fragment ignored. Statuses are
`surfaced`, `dismissed`, `acted`, and `expired`. Recording is append-once — a
later run may never rewrite what Scout said about a conversation the day it
surfaced it — and any status counts as already recorded, so an expired or
dismissed conversation is not suggested again.

`expire_stale` moves `surfaced` rows older than `SCOUT_EXPIRE_DAYS` (14) to
`expired`. It never touches `dismissed` or `acted` rows, because a human decision
is a fact; and it leaves a row with an unreadable timestamp alone rather than
guessing. A malformed `opportunities` object fails the run instead of silently
forgetting history.

## Commands

| Command | Purpose |
| --- | --- |
| `python -m scripts.scout run` | One normal run: search, judge, report, record. |
| `python -m scripts.scout run --dry-run` | Identical work, but writes nothing. This is how a change to any stage is inspected first. |
| `python -m scripts.scout run --dry-run --no-llm` | Stops after the deterministic gates: what the sources returned and why candidates were dropped, without spending a model call. |
| `python -m scripts.scout run --queries "a,b"` | Overrides the derived queries for a one-off run. |
| `python -m scripts.scout list [--status surfaced]` | Recorded opportunities, newest first. |
| `python -m scripts.scout dismiss <url>` | Records that an opportunity was not worth joining. |
| `python -m scripts.scout acted <url> [--outcome "…"]` | Records that an opportunity was acted on, and what came of it. |

A normal run requires a judgment model, so it fails with a clear message rather
than reporting unjudged candidates when none is configured. `--no-llm` is only
accepted together with `--dry-run` for the same reason.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | — | Required for a normal run (or `SOCIAL_LLM_PROVIDER=ollama` with `OLLAMA_MODEL`), through the existing summarizer provider selection. |
| `BLUESKY_HANDLE`, `BLUESKY_PASSWORD` | — | Bluesky search credentials; the source is skipped without them. |
| `SCOUT_QUERY_LIMIT` | 6 | How many derived queries are searched. |
| `SCOUT_PER_QUERY_LIMIT` | 20 | Per-source, per-query result cap. |
| `SCOUT_TIMEOUT_SECONDS` | 20 | Per-request timeout. |
| `SCOUT_MIN_MATCH_SCORE` | 3 | Smallest pairing score that is worth a model call. |
| `SCOUT_MAX_AGE_DAYS` | 7 | How current a conversation must be. |
| `SCOUT_HN_MIN_COMMENTS` | 2 | Comments a Hacker News thread needs. |
| `SCOUT_MIN_REPLIES` | 1 | Replies a Bluesky post needs. |
| `SCOUT_MAX_JUDGMENTS` | 8 | Model calls per run. |
| `SCOUT_MAX_OPPORTUNITIES` | 5 | Opportunities reported and recorded per run. |
| `SCOUT_EXPIRE_DAYS` | 14 | Age at which an unacted opportunity is marked expired. |

## Scheduling and observability

`.github/workflows/scout.yml` runs the CLI daily at 07:00 UTC (ahead of the daily
token probe and the social cycles) and on manual dispatch, with an optional
`dry_run` input. It installs the same hash-pinned Python requirements as the
distribution jobs, runs the CLI with only `DEEPSEEK_API_KEY`, `BLUESKY_HANDLE`,
and `BLUESKY_PASSWORD` in its environment, commits `scout-state.json` when it
changed, and then fails the step if the run failed. That ordering mirrors the
social workflows: the state commit happens first, and a failed run still turns
red so GitHub's own notification reaches the author. Dispatch inputs are read
from the environment rather than interpolated into the step's shell, so a typed
query stays data.

There is no monitoring service and no alerting integration. The report lands in
the run's step summary, and an unconfigured model, a run whose sources all
failed, and a run whose reachable sources returned nothing all fail loudly
instead of quietly reporting nothing.

Bluesky app passwords are not scopeable, so Scout logs in with the same
credential the publisher uses: the job only calls `login` and `search_posts`, but
a dedicated app password for Scout is what would make revoking or auditing one
consumer independent of the other.

## Relationship with evergreen distribution

Scout and evergreen distribution ask different questions — "what is worth
resurfacing now?" versus "where is this useful right now?" — and V1 deliberately
shares code only where the duplication is real:

- The article inventory is the distribution job's own `search-index.json`.
- The judgment call reuses the summarizer's provider selection, request shaping,
  and JSON parsing (`llm_summarizer.complete_json`) so Scout inherits the
  DeepSeek/Ollama contract, including the rule that `DRY_RUN` mocks social copy
  but never fabricates a judgment. The hosted client states its own request
  timeout and retry count (`HOSTED_TIMEOUT_SECONDS`, `HOSTED_MAX_RETRIES`),
  because the SDK's defaults can outlive the run that is paying for the call;
  those are fixed bounds rather than new environment variables.
- The state file uses the distribution job's atomic JSON writer.

The matchers are **not** shared. Evergreen resurfacing ranks articles against
time and engagement; Scout pairs a conversation with an article. They have no
input, state, or output in common, and a "unified relevance layer" would be an
abstraction built for a symmetry rather than a need. If a third consumer appears,
extract then.

## Verification

- `python -m pytest tests/test_scout_*.py -q` covers inventory, state,
  discovery, matching, filtering, the report, and the CLI, plus
  `tests/test_json_store.py` for the shared writer.
- A real dry run against live sources and the live index is the check that
  matters for a change to discovery, matching, or the gates:
  `/tmp/scout-venv/bin/python -m scripts.scout run --dry-run --no-llm`.
- Known local limitations: the judgment stage needs `DEEPSEEK_API_KEY` and
  Bluesky search needs an app password, so both are covered by tests with fakes
  rather than by a live run; the scoring thresholds are reasoned from candidate
  counts and must be re-tuned against real verdicts once Scout has been run for a
  week.
