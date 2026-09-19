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
- It does not depend on the optional Jev shadow evaluation. That experiment is
  off unless two separate environment variables are set, nothing in the pipeline
  reads what it produces, it runs only after the report and the state file are
  finished, and its failures are contained in its own local record
  file (see [Jev shadow evaluation](#jev-shadow-evaluation-experiment)).

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
9. **Shadow (optional, last)** (`scripts/scout/jev.py`) — when switched on, the
   candidates a model call judged are *also* sent to Jev, whose answers are
   written beside Scout's decision for later reading. Nothing reads them, and a
   candidate a gate dropped is not sent, because Scout never judged it. It is the
   final step on purpose: the report is out and `scout-state.json` is already
   written when the experiment is paid for, so an evaluation that hangs, times
   out, or fails outright cannot stand between the run and its own durable
   result. It carries its own wall-clock budget so the tail stays inside the
   job's ceiling (see [Authority and failure containment](#authority-and-failure-containment)).

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
  "matching_content_id": "<optional; only asked for when alternates are shown>",
  "reason": "one sentence",
  "why_now": "one sentence",
  "why_fits": "one sentence",
  "draft": "the reply the author could post",
  "link": true,
  "link_reason": "one sentence"
}
```

The prompt shows the paired article in full (title, metadata, URL, body) plus up
to two other articles that share vocabulary with the conversation, so a wrong
pairing cannot become a wrong draft. The prompt states that precision matters
more than recall, that STRONG must be rare, that nothing may be invented, and
that the candidate text is untrusted material rather than instructions.

`matching_content_id` is the one machine-owned value the reply may name, so it is
the one the model is not required to produce: it is absent from the schema unless
there are alternates to choose between, it is described there as optional, and an
absent or empty id keeps the deterministic pairing. A non-empty id that names no
article in the archive is still refused, and the model naming an existing article
still overrides the guess.

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

A surfaced row also keeps the context that made it worth surfacing, so one row
can be read without rerunning Scout: `thread_title`, `content_title`,
`content_url` (absolute, built from the article's relative index URL), and
`why_now`. Those keys are written only when Scout had them, so rows recorded
before they existed stay readable — anything reading state must treat them as
optional. Nothing decides anything from them; they are what the row *was*.

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

## Jev shadow evaluation (experiment)

An optional, deliberately temporary experiment: the candidates a model call
already judged are *also* sent to TypeSafe's Jev model, and Jev's answers are
written beside Scout's decision and read by nothing. It is not a second opinion
that changes an outcome — it is a record of what a cheap structured judgment says
about our own candidates. Candidates a deterministic gate dropped before any call
are left out: Scout never judged them, so there is no decision to compare
against.

The question it exists to answer is not "is Jev cheaper than the current
judgment call?" but whether cheap structured judgment could one day let Scout
look at a far larger universe of conversations while still surfacing only the few
worth the author's attention. That needs evidence from Scout's own candidates,
which is what the record file is for.

### Authority and failure containment

- **Zero production authority.** Jev cannot add, drop, reorder, or redraft a
  candidate, and nothing in `run`, `list`, `dismiss`, or `acted` reads its
  output. A run in which every Jev call fails produces the same report, the same
  state file, and the same exit code as a run with Jev switched off.
- **Last, so it cannot cost the run its result.** The pass is called after the
  report has been printed and after `scout-state.json` has been written and
  flushed, so a Jev call that is slow, that times out, or that never comes back
  cannot delay or lose what the run itself produced. The one thing that could
  still lose a committed state file is the job's own ceiling killing the run
  before the workflow's commit step, which is why the experiment is bounded
  (below) rather than merely placed at the end.
- **Off unless asked for twice.** Both `SCOUT_JEV_SHADOW` and `TYPESAFE_API_KEY`
  must be set; either one alone leaves the run untouched. The flag accepts
  `1`/`true`/`yes`/`on` (and `0`/`false`/`no`/`off`); any other value is reported
  as unrecognized rather than guessed at, so a typo is visible instead of silent.
- **Fail-safe by construction.** `evaluate()` never raises: a missing key, an
  unimportable SDK, a timeout, an HTTP error, a response with none of the
  expected answers, and an unwritable record file are each recorded rather than
  raised. When the experiment cannot run at all, the run prints one
  `⚠️  scout_jev_shadow_unavailable (reason)` line and continues. The pass as a
  whole is wrapped as well, so even a failure nothing anticipated costs one
  `⚠️  scout_jev_shadow_failure` line and not the run's exit code.
- **Bounded like the real judgment call.** One System One call per judged
  candidate (so at most `SCOUT_MAX_JUDGMENTS`, 8, per run), a 30-second HTTP
  timeout on each operation, and no retries: an experiment gains nothing from
  outliving the run that pays for it. The HTTP timeout alone is not a bound —
  the SDK applies it per request phase and builds its client per candidate, so a
  server that keeps dribbling bytes stays inside it — so the pass also carries its
  own wall-clock budget (`SHADOW_BUDGET_SECONDS`, 240). Before each candidate it
  checks the time it has spent against that budget, stops when it is used up, and
  reports
  `⚠️  scout_jev_shadow_budget_exhausted after N of M evaluation(s)`: the tail a
  scheduled run pays for is Scout's own measurement, not the SDK's timeout
  semantics. Because the tail also starts after the state file is written, a slow
  Jev call can lengthen a run but never takes the run's result away.
- **The key is never echoed.** The `TYPESAFE_API_KEY` value is scrubbed out of
  everything a response contributes — error text, model name, probability labels —
  before any of it is printed or persisted, and the record is what gets printed,
  so the two paths cannot disagree.

### What is sent

Only what the judgment call already had, and nothing that reveals Scout's
answer: the conversation's title, author, community, timestamp, reply count, and
up to 1200 characters of body, plus the matched article's title, category, tags,
and summary. The article body is never sent, and neither is Scout's verdict,
reason, draft, or score — so Jev's answers cannot be an echo of Scout's decision.

Each candidate is asked five questions in one call: four `noul` primitives
(`content_fit`, `substantive_conversation`, `relationship_value`,
`natural_contribution`) and one `score` primitive (`asymmetric_value`, "how
asymmetric is the value of contributing here?"). `content_fit` — does existing
writing materially help this conversation? — is deliberately the same question
Scout's own verdict answers, because that comparison is the point. Candidate text
is still untrusted input, and each question says so.

### Storage

`scout-shadow.jsonl`, one JSON object per line, appended at the repository root
next to the state file but ignored by `.gitignore` and never committed — so a
scheduled run's records exist only in that run's log, and `git` can never pick
them up. Append-only per record means a killed run loses at most a line; an
unreadable line is skipped and counted rather than trusted, including one that is
not valid UTF-8 at all. A dry run writes no records.

```json
{
  "candidate_id": "https://news.ycombinator.com/item?id=…", "evaluated_at": "…",
  "source": "hacker-news", "title": "…", "content_id": "…",
  "existing": {"selected": true, "verdict": "STRONG"},
  "jev": {"model": "jev-latest", "content_fit": {"noul": 0.81}, "…": {"noul": 0.0},
          "asymmetric_value": {"score": 2.0, "confidence": 0.7, "probabilities": {"2": 0.7}}},
  "usage": {"input_tokens": 812, "output_tokens": 41}, "latency_ms": 904, "error": null
}
```

`existing.selected` is the judgment's positive verdict (`verdict == "STRONG"`),
not a claim about what the run surfaced: it is recorded before the
`SCOUT_MAX_OPPORTUNITIES` cap and even under `--dry-run`, where a STRONG judgment
is never written to the state file. `existing.verdict` is the raw answer, so both
readings are recoverable from the record.

### Reading the results

`python -m scripts.scout jev` prints the comparison and writes nothing:

```
Jev shadow evaluations — scout-shadow.jsonl

Evaluations: 5 across 5 candidate(s) | with answers: 4 | failed: 1
Scout decisions: 2 selected | 2 not selected

Jev means (expected score for asymmetric_value, 0-2)
  content_fit              selected 0.45 (n=2) | not selected 0.55 (n=2)
  …
Disagreements (low < 0.25, high >= 0.75)

Scout selected, Jev saw little to add (content_fit or natural_contribution below low):
  https://news.ycombinator.com/item?id=2 (Scout: STRONG)
    … — hacker-news
    content_fit 0.10 · substantive_conversation 0.60 · relationship_value 0.40 · natural_contribution 0.05 · asymmetric_value 0.00
```

The thresholds are levels for inspection, not weights for tuning: the report
never declares either side correct, and neither mean is a metric that Scout is
optimized against. A disagreement is a candidate worth reading by hand. `n` is
reported beside every mean so a mean over two records cannot be mistaken for a
finding, and failed evaluations are listed separately rather than folded into a
mean as zeros.

### Removing it

The experiment is one module, its test file, and three hooks; nothing else
depends on it:

- delete `scripts/scout/jev.py` and `tests/test_scout_jev.py` (the latter imports
  the module, so leaving it behind would break the whole suite's collection);
- remove the `import ... jev` line, the `_shadow_pass` call in `run_command`,
  and the `_shadow_pass`/`jev_command` functions plus the `jev` subparser in
  `scripts/scout/cli.py`;
- drop the `Install the shadow experiment's SDK` step and the `SCOUT_JEV_SHADOW`
  and `TYPESAFE_API_KEY` variables from `.github/workflows/scout.yml`, and delete
  the `TYPESAFE_API_KEY` repository secret;
- drop `/scout-shadow.jsonl` from `.gitignore` and delete the file.

One shared edit came with the experiment: `filtering.ScreenResult.judged` holds
the model-judged rows rather than their count, so the shadow can offer exactly
what a model call produced instead of guessing from verdicts (gated and
model-`REJECT` rows are indistinguishable in `judgments`). It can be reverted to
an `int` and `report.py` back to `screen.judged`, or simply left alone, since the
only reader is `len(screen.judged)`. No schema, migration, or dependency manifest
is involved: the SDK is installed by one workflow step rather than by the pinned
requirements, so removal cannot break a run.

### Running it by hand

```bash
python -m pip install typesafe-sdk==0.7.0    # deliberately not in the pinned requirements
export SCOUT_JEV_SHADOW=1 TYPESAFE_API_KEY=…
python -m scripts.scout run                 # prints records and persists them
python -m scripts.scout run --dry-run       # prints records, writes nothing
python -m scripts.scout jev                 # reads the comparison afterwards
```

The SDK is absent from `scripts/automation/requirements*.lock` on purpose: the
pinned requirements are the publishing path's, and an experiment should not be
able to make a publish job depend on a third-party credential and a per-candidate
cost. `.github/workflows/scout.yml` installs it in a step of its own, which is why
removing the experiment does not touch a lock file.

Scout's provider module loads a repo-root `.env` at import, so a `.env` holding
both `SCOUT_JEV_SHADOW=1` and `TYPESAFE_API_KEY` enables the experiment just as an
`export` does — that is the documented recipe reached a second way, not a third
switch. Keep a key there and nowhere else in the checkout: it is a local
convenience, and the scheduled workflow takes its own copy from the repository
secret.

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
| `python -m scripts.scout jev` | Prints the optional shadow-evaluation comparison from `scout-shadow.jsonl`. Reads only, writes nothing, and reports an empty file as such. |

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
| `SCOUT_JEV_SHADOW` | — | Enables the optional Jev shadow experiment (`1`/`true`/`yes`/`on`; any other value is reported as unrecognized). Requires `TYPESAFE_API_KEY` and the `typesafe-sdk` package to be present. Set by the scheduled workflow. |
| `TYPESAFE_API_KEY` | — | The shadow experiment's own credential, read by the TypeSafe SDK. Scout's judgment call never uses it. The scheduled workflow reads it from the repository secret of the same name and passes it straight to the SDK; it is never written to a file, an artifact, a log line, or the state file. |

## Scheduling and observability

`.github/workflows/scout.yml` runs the CLI daily at 07:00 UTC (ahead of the daily
token probe and the social cycles) and on manual dispatch, with an optional
`dry_run` input. It installs the same hash-pinned Python requirements as the
distribution jobs, runs the CLI with `DEEPSEEK_API_KEY`, `BLUESKY_HANDLE`, and
`BLUESKY_PASSWORD` (plus the optional shadow experiment's two variables, below)
in its environment, commits `scout-state.json` when it changed, and then fails the
step if the run failed. That ordering mirrors the social workflows: the state
commit happens first, and a failed run still turns red so GitHub's own
notification reaches the author. Dispatch inputs are read from the environment
rather than interpolated into the step's shell, so a typed query stays data.

There is no monitoring service and no alerting integration. The report lands in
the run's step summary, and an unconfigured model, a run whose sources all
failed, and a run whose reachable sources returned nothing all fail loudly
instead of quietly reporting nothing.

The scheduled workflow also collects the Jev shadow observations. It installs
`typesafe-sdk` into the same interpreter the run uses — in its own step, still
not in the pinned requirements — and sets `SCOUT_JEV_SHADOW=1` plus
`TYPESAFE_API_KEY` from the repository secret of that name. That install step is
`continue-on-error`, because an experiment must not be able to cost the day's
report: without it a PyPI hiccup or a yanked version would fail the job before
the run started, and with it the CLI simply skips the shadow the way it does on
any machine where the package is unavailable. Three more things keep the
experiment from changing what the job is: the key is passed to the SDK as an
environment variable and written nowhere, so it reaches neither the log nor the
state file nor an artifact; the CLI calls the experiment only after
`scout-state.json` is written, so a slow or failed evaluation cannot keep the
state commit from running; and the SDK is not part of the pinned requirements, so
removing the experiment is deleting that install step and the two variables.
Scout's own model and provider configuration is untouched: `DEEPSEEK_API_KEY` is
still the only thing the judgment calls use.

What the experiment did in a scheduled run is one line in the step summary —
`🔬 Jev shadow: N evaluated, N failed, N not attempted` — alongside the per-candidate
`🔬 scout_jev_shadow` lines in the log. The record file itself is gitignored and
never uploaded, so those two are what the run leaves behind.

Without the `TYPESAFE_API_KEY` secret the run stays green: the shadow reports
`⚠️  scout_jev_shadow_unavailable (TYPESAFE_API_KEY is not set)` and stops there,
which is what makes the experiment safe to enable before the credential exists and
safe to leave enabled afterwards.

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
- The shadow experiment is covered by `tests/test_scout_jev.py`, which never
  imports the SDK and never reaches the network: it fakes the `_client()` seam
  and asserts the switch, the missing-key and missing-SDK paths, one evaluation
  per judged candidate, that gate-rejected and unjudged candidates are never
  sent, that a dry run
  writes nothing, the failure modes, the state it builds (including clipping and
  that no verdict, draft, or article body is sent), the question contract, and
  that the key is never printed or persisted, including in a clipped error
  message whose tail is a fragment of it — and that a fragment shorter than the
  point where scrubbing would eat ordinary text is left alone rather than
  mangled. Two of those tests are the ordering
  guarantee itself: one fails the Jev client from inside the SDK boundary and
  asserts `scout-state.json` was already on disk at that moment, and one makes the
  evaluation raise something its own guard does not catch and asserts the run
  still exits 0 with its state intact and the key unprinted. Both fail against the
  earlier order, where the shadow ran before the state was written. A third covers
  the budget: with a fake clock but a real sequence of three judged candidates,
  the pass evaluates one, prints the budget line, writes one record, leaves the
  state untouched, and still exits 0. The real SDK's client construction
  and response parsing were verified once by hand against a mocked transport:
  no live TypeSafe call is part of any test or run.
- The workflow's own claims are checked by inspection rather than by a workflow
  linter: the SDK install is a single `continue-on-error` step, and
  `typesafe-sdk==0.7.0` resolves
  against the pinned environment without changing a pinned package (it adds
  `tenacity` and nothing else).
- Known local limitations: the judgment stage needs `DEEPSEEK_API_KEY` and
  Bluesky search needs an app password, so both are covered by tests with fakes
  rather than by a live run; the scoring thresholds are reasoned from candidate
  counts and must be re-tuned against real verdicts once Scout has been run for a
  week. Whether Jev's judgments are any good is exactly what the shadow record
  file is for and cannot be settled locally.
