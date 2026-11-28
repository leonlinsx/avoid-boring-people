# History-derived evergreen creative episodes

Issue #160 introduces `ABP-CREATIVE-002` for the existing guarded graphics
factory. V1 scripts and signed admissions remain immutable and reconstruct
under their exact protected-main release digest pairs, including #161 and #162.
The compact-payoff template, source typography renderer and measurement-based
60/25/15 allocation are reused. No provider, model, service, subscription,
schedule, account, production limit or factual-admission scope is added.

## Claim identity and execution identity

`source_claim_id` is the existing paragraph-derived `claim_id`, independent of
presentation. The signed `source_sha256` still binds the entire article. The
source paragraph, qualifications, sentence order and attribution must reconstruct
exactly; creative freedom never authorizes paraphrased factual assertions.

Each V2 script freezes a `treatment_id`, `creative_spec_hash`, presentation
signature, audience and episode. Its specification describes the following
supported substantive levers:

| Primary variable | Control | Treatment |
|---|---|---|
| Narrative compression | Diagnostic question, then the complete explanation | Attributed source payoff and complete explanation, then an application question; no repeated payoff |
| Source typography | Existing graphics | Complete sentence groups with actual word-aligned emphasis and independently checked readable layout |
| Viewer decision stage | Making a choice | Reassessing an earlier choice, with an explicit retrospective opening or application question |
| Spoken application task | Request a follow | Ask the viewer to name a condition where the perspective is less useful; factual narration stays identical |

Only one variable changes across an episode's frozen control and treatment.
Voice (existing Kokoro Heart), caption segmentation, caption policy, production
components and factual text stay fixed. Different source claims and publication
slots remain observational blocks. Actual duration is measured, never assumed.
The first-beat caption follows the narrative, rather than introducing a second
caption-CTA test. Historical controls must match these secondary variables.

This protocol deliberately excludes color, voice-only, hook-rewording and
caption-only differences from its presentation signature. Identical bytes always
fail; equivalent claim/executions also fail even under a new episode/concept ID.
Similar adjacent/reworded claims cannot obtain another reuse allowance. Unknown
historical executions fail closed. A genuinely different whole-source visual
treatment can retain narration; its independent typography QA remains mandatory.
The old V1 typography admission gate remains closed; only reconstructed V2 can
use the new treatment identity and reuse policy. New presenters remain disabled.

## Automatic episode continuation

The factory derives a graph of single-variable contrasts from immutable history,
starting at the source-compatible baseline and building on observed presentation
contexts. An episode ID binds topic, primary variable and exact control context.
A later episode can test another variable against a prior treatment context;
it is not another numbered copy of a completed arm. Earlier control observations
may support another contrast, retaining their original publication and measurement
receipts. They are not generated again or counted as independent replications.

The application task is an additional contrast over each existing context, not
a new Cartesian axis that changes historical specifications or controls. Its
identity adds `application=condition_check` only to the treatment. Existing
controls retain their original presentation signatures and observations.

Each arm reserves at most three distinct claims per topic/specification. Once
both arms fill, or fourteen days pass after the episode's first publication,
selection automatically considers another unused supported contrast. Incomplete
evidence closes without a winner. Fresh weekly diagnostics order exploratory
ties. Existing follower-backed, multi-article replication evidence can select
an identical frozen V2 specification within its remaining capacity; otherwise
exploitation returns to exploration. Account follower change is not per-Reel
attribution. Qualified site outcomes remain unavailable until actually measured.

The supported useful space is **bounded**, not an assertion of infinitely useful
permutations. There are at most sixteen substantial presentation signatures per
eligible multi-sentence claim (fewer for single-sentence claims), and at most
twenty single-variable contrasts per topic. Different contexts create successive
episodes automatically. Exhausted signatures never reset when time passes.
When useful supply is saturated, produce fewer posts and report it; adding a
new independently verified creative lever would be exception maintenance.

## Repetition, recovery and resource boundaries

Admission and publication both check seven days between uses of a claim, at
most three claim exposures in 28 days, three article exposures in seven days
and five topic exposures in seven days. At admission, unpublished inventory
occupies a repetition reservation until it publishes; missing dates never imply
old age. At publication, actual published/ambiguous receipts determine exposure.
Queue limits remain at most three ordinary Reels per rolling 24 hours and at
least three hours apart. Historical signed assets are preserved unchanged.

Failed QA concepts are skipped during subsequent treatment selection. Media
recovery still reuses immutable completed artifacts without rerendering. PAUSE,
GPU faults, disabled production, unavailable device handling, 21 weekly render
reservations (failures never refund them), 40 attempts, wall-clock bounds and all
storage quotas remain authoritative. This change does not reset any ledger.
The #165 retention path bounds active media/feed storage while preserving
immutable historical evidence. All storage circuits remain authoritative;
evidence is never evicted silently to simulate perpetual availability.

Hourly publication/measurement, the existing local timer and Monday 07:25 UTC
review remain unchanged. The scorecard adds new/reused source counts, distinct
treatments/hypotheses, episode controls, stop conditions, actual publication and
24h/48h/7d measurement receipt keys, missing evidence, and signed supply/rejection
telemetry alongside the existing follower trend, inventory runway and failures.

## Verification and operating evidence

`tests/test_instagram_renewable_creative.py` advances the clock across eight
weekly budgets using the same finite discovered source library. It exercises
source reuse, automatic successive episodes, exact/equivalent duplication,
source/qualification/identity tampering, saturation, missing dates/measurements,
QA rejection, PAUSE and exhausted-budget recovery. Disposable signing and media
fixtures exercise real admission, feed promotion, queue eligibility and scorecard
joins. These are not GPU renders, actual publications or growth evidence.

Planning against a public ledger snapshot is reproducible without GPU/provider
access:

```sh
python -m scripts.instagram_growth.autonomy.renewal \
  --state PATH_TO_PUBLIC_LEDGER --output /tmp/abp-current-plan.json
python -m scripts.instagram_growth.autonomy.renewal \
  --state PATH_TO_PUBLIC_LEDGER --published-only \
  --at 2026-12-28T00:00:00Z --output /tmp/abp-published-history-replay.json
python -m pytest tests/test_instagram_renewable_creative.py -q
```

The second command explicitly excludes pending inventory and advances a
hypothetical clock. It proves novel treatments of real published claim IDs,
not current production eligibility. The first command preserves real pending
reservations. Neither signs, generates media, hosts nor publishes anything.

At implementation time the existing production week already reserved **21/21
renders**, so a new GPU/admission/hosting cycle was **NOT RUN**. The read-only
ledger snapshot showed 15 published Reels and 18 approved unpublished assets
(six days at maximum cadence), with zero followers in its latest snapshot and
unavailable full-week growth. Pending assets continue on the normal publisher;
no extra post is forced. Issue #160 must remain open until a real reused-claim
V2 generation → admission → queue → normal publication → measurement receipt
is verified after resources and repetition windows permit it. A synthetic
simulation or a single new candidate is not that production closeout.

The [November 28 focused audit](instagram-growth-opportunity-audit.md) records
editorial ranking, the additional relationship paragraph, the spoken-task CPU
media checks, current typography eligibility, deferred research routing and
operational blockers. Existing signed V2 inventory reconstructs under its
protected-main digest pair; that pair cannot authorize the new spoken task or
new source topic. No production render reservation was reset for verification.
