# ABP autonomous growth loop: November 26 operational review

Objective: unattended admit → replenish → publish → measure → learn at effectively
zero incremental software spend, with owner reviews for outcomes, strategy and
exceptions. Routine `AUTO_ADMITTED` assets require no individual human approval.

This review precedes creative expansion. It does not activate a provider,
publish a Reel, change a timer, or claim growth. The separate active
`codex/instagram-auto-lifecycle` checkout was left untouched; its uncommitted
producer/promotion changes are not deployed infrastructure evidence.

## Evidence inspected

Production code base: `20eb43eec8d29bf7aa38e5f8c36bdc77c0829e2c`.
Public aggregate ledger blob: `5370a8cf6320f72d10188db9b95f774e7f60883f`,
last measurement November 26 at 08:54 UTC / 03:54 EST. These are different
identities: a code commit and a state-file blob, respectively.

| Layer | Observed evidence | Conclusion |
| --- | --- | --- |
| Source-bound admission | PR #148 compiler, independent script reconstruction, signed QA receipts and mutation controls exist | Implemented and tested; activation is a separate gate |
| Admission consumer | Main's publication manifest validator still requires `review_status=approved` and `approved_by`; hosted queue reads only `approved/` | Main does not yet consume `AUTO_ADMITTED` inventory |
| Automatic replenishment | No `auto_inventory` or `auto_canary_verified` in inspected state; no `ABP_AUTO_MODE` repository variable | Not verified or active |
| Local factory | Enabled user timer; installed command remains `factory.weekly --count 40 --render-limit 21`; Monday 04:30 America/New_York | Scheduling exists, but it produces review packages rather than automatic inventory |
| Last factory execution | November 23 journal and durable `factory-status.json`: `TimeoutExpired`, draft subprocess exceeded 2,400 seconds | Last unattended generation failed; `systemctl show Result=success` alone was misleading after service reload |
| Next factory execution | Installed timer reported Monday November 30 at 04:30 EST | A scheduled future attempt is not successful replenishment |
| Publication | 12 durable `published` receipts with media IDs and verified ABP permalinks; one distinct rejected Trial attempt is `confirmed_unpublished` | Ordinary-Reel publication has live evidence |
| Current inventory | All 12 approved ordinary assets consumed; zero unused inventory | Replenishment is the immediate operational constraint |
| Latest publish workflow | [Run 45819172719](https://github.com/leonlinsx/avoid-boring-people/actions/runs/45819172719): successful exit, `EXHAUSTED`, `NO_DUE_APPROVED_ITEMS` | Successful no-op, not a new publication |
| Measurement | 16 durable observations: nine 24h and seven 48h; six outside the existing age tolerance; no seven-day sample yet | Measurement runs, but comparable evidence is sparse |
| Recent measurement failure | [Run 45651025579](https://github.com/leonlinsx/avoid-boring-people/actions/runs/45651025579): GitHub state PUT returned HTTP 500 | Correctly failed; do not disguise unavailable persistence with a success or blind retry |
| Growth | Account snapshots November 21–26 show 0 → 0 followers | Observed net change zero; no complete weekly boundary coverage or validated growth result |
| Owned-site outcomes | Scorecard has no independently measured qualified visits or newsletter conversions | Unavailable, not zero and not implied by reach |

Ledger and code can be inspected in the
[state branch](https://github.com/leonlinsx/avoid-boring-people/blob/abp-instagram-state/instagram-state.json)
and [PR #148](https://github.com/leonlinsx/avoid-boring-people/pull/148).
One actual published example is
[abp002-24](https://www.instagram.com/reel/DgMEn0-TK4G/).
The local journal is corroborated by the durable factory failure marker; local
machine paths and configuration contents are deliberately omitted here.

Recorded reach ranges from 4 to 98 and views from 5 to 112 across the stored
observations; these include repeated cumulative age windows, not independent
audiences. All recorded shares and saves are zero. No observation passes the
existing 100-reach comparison floor, and no replicated pattern earns
exploitation. Do not promote a creative based on output volume or tiny
differences in these numbers.

## Measurement repair in this PR

The original inner-loop `break` permitted more than 12 media fetches across
different Reels. An overdue Reel could also trigger separate API reads labeled
24h, 48h and 7d during the same run; filtering late rows later prevented ranking
but could not recover their historical values. Weekly reporting did not refresh
account evidence before recommending future production. A single unavailable
Reel discarded other unsaved progress.

The repair bounds attempts globally, orders useful reads by comparison deadline,
records expired windows explicitly, uses the provider-read timestamp for age,
persists partial successes before returning failure, and refreshes measurement
before weekly review. Existing late rows, null semantics, comparison tolerances,
publication limits, account identity, receipts, allocation and admission policy
are preserved. Regression controls reproduce the old over-budget and multi-age
reads. The CLI integration test exercises real identity checks, metric parsing,
state CAS, report generation and the next allocation plan with only HTTP
transport substituted and disposable credentials. It makes no live Meta calls.

## Remaining gate before creative arms

Finish and review the separate lifecycle implementation first. Required evidence:
an automatically compiled and independently verified source/rights/ASR/media
artifact; signed immutable hosting; independent consumer verification;
durable admission/publish intent before Meta writes; a bounded ordinary-Reel
canary with ABP ownership, permalink and available Insights; recovery from delayed
Insights without republishing; and a subsequent unattended replenishment cycle
whose output reaches the hosted queue. Test outages, crash recovery, duplicate
claims/media, account mismatch, quota exhaustion and both kill switches.
No per-Reel human approval should be added to that automatic lane.

Check actual free storage and operation/transfer limits before activation.
Neither existing free-tier hosting nor a software-cost field proves measured
zero transfer or zero electricity cost. Finite free budget or source exhaustion
must stop production visibly, not recycle claims or lower admission quality.

Once that gate passes, use small follow-up PRs inside the existing framework:

1. Freeze viewer, concrete problem and promised payoff before generation. Test
   one audience-positioning factor at a time on independent source ideas; retain
   the presenter/graphics matched waveform control and existing 60/25/15 mix.
   Current topic questions and `standalone_context` are source/context controls,
   not an implemented audience experiment.
2. Compare distinct hook structures (for example, a decision scenario versus
   an explicit diagnostic question) and caption strategies (a reflection prompt
   versus a source-reading invitation). Freeze a hypothesis and one primary
   changed factor; match topic, duration, voice, format, CTA and publishing slot
   where feasible. Use distinct ideas rather than reuploading near duplicates.
   Current automatic policy has two question templates and a single caption
   construction; arbitrary rewording would not establish these experiments.
3. Implement [Issue #149](https://github.com/leonlinsx/avoid-boring-people/issues/149)
   as a bounded, weekly, read-only research proof, then shadow it before a finite
   canary. Stratify a subset of exploration; preserve article-first controls and
   all factual, rights, quality and publication gates. Require evidence receipts
   with source, creator, retrieval/post dates, views, a recent creator median,
   outlier ratio, relevance and promotion uncertainty. Unknown or unsupported
   stats do not become verified outliers. Retain structural lessons only; never
   import external footage, audio, scripts, identities or retrieved instructions.

The provider feasibility review found no verified free live research source in
the current integration. [Monid's own listing](https://monid.ai/tools/instagram)
quotes endpoint-specific and per-result charges; advertised signup credit is
not verified available credit or authorization to spend it. No Monid calls,
installation or external SKILL execution occurred. The official
[Business Discovery documentation](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery)
describes Facebook/Unified Login, distinct from the publisher's Instagram Login
credentials, and says public `view_count` combines paid and organic views.
Do not assume existing credentials can obtain organic-only competitor counts.
The current count of audited external outlier receipts is **zero**; twenty
verified candidates have not been retrieved. Research discovery remains
unimplemented and should report no evidence rather than fabricate a cohort.

Weekly decisions should use actual same-age observations, net account follower
change and separately measured qualified owned-site outcomes. Retain unknowns
and variance. Attention-only replication can motivate another bounded test but
must not be called a follower or conversion winner. Update only future candidate
mix, never frozen releases. Until growth evidence exists the defensible decision
is **ADJUST the operational loop; no growth winner**. No 30-day calendar or new
reporting service is needed.
