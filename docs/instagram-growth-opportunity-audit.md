# Focused creative opportunity audit — November 28, 2026

Repository: `leonlinsx/avoid-boring-people`. Base: protected main
`0028c2f19c31a8110f74aa83735a2d0b7c6fcf0d`, including #161–163 and #165.
This sprint changes editorial ordering, one spoken application task, one narrow
owned-source topic mapping, and the existing weekly proposals. It does not add
infrastructure, services, providers, schedules or publication capacity.

## Existing capability versus autonomous eligibility

| Dimension | Existing tooling | Current guarded graphics production |
|---|---|---|
| Source discovery | Whole Markdown/MDX archive scan, exact paragraphs, fixed reviewed references | V2 uses owned exact paragraphs; references remain in the older lane |
| Hooks/story order | Diagnostic questions, attributed statements, repeated payoff, nonrepeating payoff | V2 question versus payoff/explanation/application, with original sentence order and qualifications |
| Voices | Pinned Kokoro Heart and Nicole; older factory allocation varies voice | V2 freezes Heart; voice-only changes cannot create source-reuse capacity |
| Delivery/pacing | Kokoro speed 0.95, fixed seed, measured CTC word alignment, independent ASR | Same fixed delivery; no arbitrary tone, personality or speed generation |
| Duration | 15–50s QA; legacy allocation has duration targets | Actual duration comes from source and delivery; targets do not trim assertions |
| Captions | 3/5-word grouping, punctuation/length limits, active-word emphasis | V2 freezes five words; a caption rewrite cannot bypass duplicate checks |
| Visuals/rhythm | Cards, statement panels, offline specialty diagrams, native whole-source typography | V2 cards/source typography; source typography groups dependent conditions and checks readability |
| Audience | New choice / revisiting a choice | Substantive V2 positioning contrast, with frozen secondary variables |
| CTA | Follow narration, caption reflection/full-article strategies | Prior V2 uses source-question captions and spoken follow; this sprint adds a spoken condition-check contrast |
| Research | Weekly bounded signed Meta collector, signed synthetic fixtures; V1 research treatment | Disabled locally; V2 does not consume `research_cycle`. Not an autonomous live arm |
| Renewal | #163 history-derived, finite single-variable episodes | Automatically advances supported contexts; equivalent executions, exposure saturation and exhausted useful supply still stop selection |
| Measurement | Hosted 24h/48h/7d observations and Monday review | Existing follower-aware replication and diagnostics; no causal per-Reel follower allocation or invented site conversions |
| Retention | #165 immutable evidence archives and bounded active media | Reuses the existing retention path; no historical signatures or reservations removed |

**Typography is enabled by #163's V2 contract.** `worker.candidates()` routes
experimental guarded graphics to `renewable_candidates`; `renewal.options`
offers typography; the compiler binds layout/treatment identity; admission
reconstructs V2. The old `source_type_waiting_for_treatment_identity` rejection
still applies to V1. Issue #150's pre-#163 comments are stale on eligibility,
not proof of live typography results. Keep its measured live comparison open.

## Adopted / deferred / rejected

| Decision | Opportunity | Evidence / boundary |
|---|---|---|
| Adopt | Six-dimension editorial ordering after article/topic rotation | Transparent local heuristic; complete paragraphs only; no model or new admission authority in steady state |
| Adopt | Spoken condition-check task versus follow request | Same V2 episodes, controls, three claims per arm, stopping/repetition rules; only final spoken beat changes |
| Adopt | Narrow relationships template matching `loved ones` | One additional complete owned paragraph from “About time”; no changes to risk, quotation, numeric, source/hash, context or qualification checks |
| Adopt | Weekly proposals include typography and reflection | Previously diagnostics named older factors only; actual missing evidence stays unavailable |
| Retain | Native typography and compact payoff from #161–163 | Existing differentiation and independent QA; no new renderer framework |
| Defer | Nicole/Heart, sentence pauses, pace and duration experiments | Available components, but V2 intentionally freezes these; require separate matched audio/ASR and substantive identity evidence, not nominal permutations |
| Defer | Phrase-aware caption grouping from adjacent Shorts work | Sentence/word alignment and captions exist; existing Shorts join/pause/dangling-word techniques are useful, but no demonstrated ABP caption bottleneck earns a second change here |
| Defer | Optional #149 live outlier arm | Credential/scope absent AND V2 evidence routing absent; caption metadata cannot establish audiovisual rhythm |
| Defer | Owner-permissioned structural annotations or openly licensed research beyond captions | Can motivate future hypotheses; no unverified video analysis, footage/audio reuse, automatic schema expansion or inferred organic status |
| Reject | NeonClipping installation/code integration, HyperFrames runtime | Existing Pillow/FFmpeg already cover the adopted changes; additional app/browser/runtime and licensing burden lacks a measured need |
| Reject | Loudness spikes, fast cuts, controversy as article merit | These are not nonfiction relevance, completeness or evidence |
| Reject | Cosmetic relabels, quota reset, more posts, FlashHead/presenters, scraping, paid APIs | Do not solve the verified gap within the requested safety/cost boundaries |

## Editorial comparison

The previous selector sorted equally exposed paragraphs by file and claim hash.
`autonomy/editorial.py` uses six explainable lexical proxies: curiosity,
specificity, counterintuitiveness, practical relevance, audience relevance and
narrative payoff. Missing-context language incurs a penalty. Greedy article/topic
rotation takes precedence over score. Scores order candidates; they do not
approve facts, remove qualifications, generate prose or assert expected reach.
The existing signed supply report carries the ordering and dimension scores.

A separate already-installed local `mimo-v2.6:9b` model judged all original 16
whole paragraphs in a shuffled batch, with no titles, selector, scores or ranking
provided. CPU only (`num_gpu=0`, four threads, observed `size_vram=0`), fixed
rubric/seed/temperature, no paid API. The new source was a separate holdout call
using the same rubric. No ranker tuning followed the judgments. Frozen prompt,
model digest, scores and limitations are in
`tests/fixtures/instagram/editorial-evaluation-v1.json`.

| Top-six measure | Previous order | Editorial order |
|---|---:|---:|
| Mean editorial rating, 1–5 | 2.53 | 3.08 |
| Judged standalone | 4/6 | 6/6 |
| Distinct source articles | 5 | 6 |
| Curiosity | 2.67 | 2.50 |
| Specificity | 2.50 | 3.17 |
| Counterintuitiveness | 2.50 | 2.83 |
| Practical relevance | 2.50 | 3.67 |
| Audience relevance | 2.83 | 3.67 |
| Narrative payoff | 2.17 | 2.67 |

Representative changes: contextual “Temporal illusions” and animal-language
methodology no longer lead the queue merely because they are older files.
The top group instead includes keeping options open, city choice, legitimate
community boundaries, mapping a learning process, company incentives and skill
variance. The judge rated the practical process passage weak on curiosity;
the tool does not hide that tradeoff. This is one model's subjective screening
of a small corpus, not a human panel, a causal experiment, or evidence of
retention, follower growth or increased admission rate. Editorial weak spots
remain possible; passage ordering is deliberately not a new factual gate.

```sh
python -m scripts.instagram_growth.autonomy.editorial --output /tmp/editorial.json
```

This replay makes no model/API call and has no pass threshold. Missing ratings
are reported, not fabricated. The original six comparison positions remain
unchanged after the additional source mapping.

## Transferable research

The inspected pre-existing local NeonClipping checkout was
`6a3b9e758a1ddf25af47be45120888735cde29bd`; its source license is AGPL-3.0.
Its `smart.py`/`wholepass.py` favor self-contained setup, specific insight,
meaningful stakes, actual payoff and penalties for filler/incomplete thoughts.
These general editorial principles transfer. Audio-energy/activity shortlist
signals and cloud/local model generation do not belong in a text paragraph
admission system. No code was copied, installed or executed from NeonClipping.
[Upstream description](https://github.com/iamajmeena/neonclipping#how-it-finds-good-moments).

The adjacent November 26 Shorts experiment's discovery/revision records show
why an independent pass matters: full-transcript model suggestions sometimes
violated requested duration, excluded themes and factual caution. Final source
edits instead used concrete tension, explicit subject/context, complete endings,
and source timestamp receipts. The transferable techniques are context and
payoff review, faithful cut boundaries and distinct-theme screening. Its
interview footage, voice and third-party identities do not enter ABP articles.

[YouTube's creator/product discussion](https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/)
supports testing immediate openings and mini-story payoffs, not a universal
Instagram algorithm rule. [Chi et al.'s openly available self-explanation paper](https://education.asu.edu/sites/g/files/litvpz656/files/lcl/chideleeuwchiulavancher_2.pdf)
studied prompted explanations while learning an expository passage. It motivates
the spoken condition-check hypothesis; it does not demonstrate social-video
saves or follows. The new prompt changes the viewer's task from following an
account to considering where an attributed perspective stops applying. Only
this hypothesis is adopted; no paper's study result is added to public scripts.

## Additional owned-source review

The scanner already visits all 92 article files. Before this sprint, 16
paragraphs from 12 articles compiled; 3,026 considered paragraphs were rejected.
Most fail quotation/numeric/markup rules, source budget, context/risk, book-note
rights or named-entity checks. More crawl infrastructure would add nothing.

Review of unmapped evergreen prose identified the final nonquoted paragraph of
“About time” (`2020_02_26_time/index.md`). It already satisfies the unchanged
complete-paragraph standard. The only missing mechanism was a topic question
for time with loved ones. A narrow final topic mapping admits exactly one new
paragraph: **17 paragraphs / 13 articles**, with 3,025 rejections. The original
16 claim identities and 360 old V2 scripts remain unchanged. The full paragraph,
including the condition about making time, attribution and full-file source
hash is retained. The nearby Ryan Holiday/Seinfeld quotations remain excluded.
Other topical product assumptions, unexplained references and sensitive/numeric
material remain deferred; no universal broadening of “safe prose” was added.

## Issue #149: precise remaining activation requirements

Owner-controlled prerequisites for the existing collector:

1. Authorize a **separate Facebook User token** for ABP's professional Instagram
   account using the Facebook Login route. The existing Instagram Login publisher
   credential cannot substitute. ABP must have the necessary connected Page and
   the authorizing user must have access to it.
2. Grant `instagram_basic`, `instagram_manage_insights`,
   `pages_read_engagement`; if the Page role came through Business Manager,
   `ads_read` or `ads_management` is additionally required. App Review/access
   level requirements depend on app roles and who is served; do not promise
   that changing three local flags bypasses Meta approval.
3. Store the token and ABP IG user ID in an owner-only JSON file with `token`
   and `user_id` fields; set its absolute path as `research_meta_credential_file`
   in the existing private configuration. The launcher supplies
   `ABP_RESEARCH_META_TOKEN` / `ABP_RESEARCH_META_USER_ID` only to the collector.
   Choose up to four permitted professional creator usernames and set existing
   `research_creators` / `research_enabled` configuration. Do not
   paste credentials into an issue, PR, CLI argument or public file.

[Meta's Business Discovery reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery)
confirms the route/permissions. Public Reel `view_count` is Business-Discovery-only
and [includes paid/organic and accessible crossposted Facebook views](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media).
Captions are not transcripts. Public metadata does not establish spoken hooks,
pauses, scene cuts, soundtrack, organic status or audience job.

**An additional code prerequisite remains:** the guarded V2 production route
currently drops `research_cycle`, whereas the V1 chooser consumes it. A future
scoped integration must map an authenticated fresh receipt to an existing
source-aware structural contrast, freeze evidence in the episode, and reject
caption-only relabels/equivalent executions. It needs controlled tests before
activation. This sprint does not silently reopen V1 source reuse, pretend
credentials solve this disconnect, or issue external calls without authority.
The minimum owner action is the one-time permission/credential/creator-scope
setup above, after that integration is reviewed. Neither is necessary for the
article-first production loop. There are zero live external research receipts.

## Verification and operating boundaries

Five real offline CPU videos: two source claims × spoken-task control/treatment,
plus the additional relationship source. They use existing Kokoro/CTC models,
canonical Pillow/FFmpeg rendering, unprompted independent ASR, and canonical
`verify.py` / `admission.qa_check`. Hashes and actual metrics are in
[evidence/instagram-opportunity-media.json](evidence/instagram-opportunity-media.json).
No production signing, upload, Meta call, GPU inference or budget reservation
occurred. Four matched-task videos ran 18.50–22.50s with 1.56–1.96% ASR WER;
all five passed decode, codec, duration/size, loudness, caption/timing, source,
clipping and qualification checks. Sampled frames were inspected; full human
playback and native Instagram overlay behavior were not verified. This is
technical feasibility, not a preference or audience test. No new production
media was inserted into inventory.

Frozen protected-main vectors and old-runtime authorization negative cases
preserve old scripts while rejecting old signatures on the new task. All 21
actual public automatic admissions independently reconstruct unchanged.
Repetition tests still reject identical media, equivalent executions, unsupported
speech, lost qualifications, source/hash mutation, cooldown/pending inventory,
saturation and attempted budget/PAUSE bypass. Multi-week episode simulation
retains completed/incomplete-arm renewal and eventual honest exhaustion.

Commands: `python -m pytest tests -q`, `npm test` (CI Node 22),
`npm run lint`, `npm run build`, editorial replay, current-ledger planning and
explicitly hypothetical published-only replay. Run Python/JS suites sequentially:
the JS content fixture creates/removes temporary article files while Python
scans the archive. The first concurrent run encountered that fixture race;
serial verification resolves it without modifying tests or compiler behavior.
The sandboxed JS translation fixture also exited without stderr; the unchanged
suite passed with ordinary local subprocess access. Final exact-head CI and
head SHA belong in the PR receipt, not an unrun success assertion here.

Read-only operating snapshot: factory timer active; last service result success;
21/21 weekly render reservations consumed, unchanged after offline checks;
automatic canary already verified; 16 durable publications; latest follower
snapshot zero; 21 signed auto inventory records verified. #165 retention stays
intact. Pending/repetition reservations remain authoritative. Current planning
and historical cooldown replay are distinct; the latter never authorizes a live
post. No additional owner action is required to keep existing article-first
publication/measurement/weekly review running. New code still needs its PR
release review; no per-Reel manual approval is introduced.

**Keep #160 open:** a real reused-claim V2 production generation → admission →
queue → ordinary publication → measurement receipt remains outstanding after
the next legitimate resource/repetition window. Do not clear GPU holds, refund
reservations, force a post or claim growth to close it. Keep #150 open for actual
live typography results. The useful creative space is larger, not infinite;
when strong distinct supply is exhausted the system must lower cadence and
report the limitation. No paid API, subscription or new software spend occurred;
electricity was not metered.
