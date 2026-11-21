# ABP rolling archive experiments — November 21, 2026

Status: **DRAFT / OFFLINE ONLY**. Goal: grow genuine followers of
**@avoidboringpeople** from owned long-form writing at $0 additional software
spend. Website readership and newsletter signups are separate downstream
outcomes. No account, credential, upload, schedule or deployment changes are
authorized by this plan. This replaces the former six-post planning ceiling;
the ABP-REELS-001 register remains an unchanged historical protocol.

## Capacity and the next batch

The repo contains 92 `src/content/blog/*/index.md` or `index.mdx` entries at
the inspected head. This is a source-file count, not a verified public/eligible
article count. Exclude drafts and future material; resolve canonical slugs,
check publication and revalidate time-sensitive claims before generation.
Three useful angles per eligible essay could supply hundreds of concepts.
Do not count palette changes, arbitrary crops or repeated uploads as new ideas.

The [v2 discovery register](instagram-growth-reels-v2.json) contains **24
concepts: eight articles × three different editorial angles**, with source-file
hashes and exact source anchors. These are draft hooks and explanatory tasks,
not validated final narrations. Source anchoring establishes what the author
wrote, not independent factual correctness or permission to reuse embedded
third-party images, quotations or clips. Every final script needs its own claim
ledger, arithmetic checks, qualified wording and rights review.

Produce an initial review batch from this register using Kokoro Heart, animated
explanatory graphics and selected short FlashHead Pro openings. Avoid investing
GPU time in generated B-roll unless it improves understanding. Keep the
fictional presenter and AI voice clearly disclosed. Cache approved narration
and reusable assets; never regenerate a passing body merely to test a hook.

Parallelize independent script preparation, source checks and bounded CPU
encoding. Serialize large GPU stages initially on the single 16 GB RTX 5070 Ti;
measure memory and throughput before increasing GPU concurrency. Record failed
jobs as failures, with resumable per-asset manifests and hashes. Reuse isolated
environments and existing tools; no daemon, new service or paid API is needed.

## Rolling release proposal

After batch review and separate publication authorization, start with **12
distinct reviewed Reels over six days, two per day**, while later candidates
are being made. This is a proposed operational ramp, not a Meta recommendation,
known account limit or statistically optimal frequency. Keep several tests'
measurement windows open simultaneously. Do not wait seven days after each
post or wave before starting the next approved posts.

Select stories to cover all eight articles; alternate formats and balance
topic and posting-time blocks. Log the selection rubric, rejected concepts,
schedule, hook/format assignments and other ABP activity before release. Use
distinct claims/examples rather than uploading minimally changed versions of
one clip repeatedly. The initial batch explores packages of topic, angle and
presentation; it cannot isolate their individual causal effects.

Trial mode depends on **ABP's own eligibility**, which has not been checked.
If unavailable, register a standard-Reel cold-start cohort before release;
never silently substitute modes or pool their results. The zero-follower
baseline also needs rechecking. Preserve the existing carousel schedule until
a separately scoped Instagram-only cadence decision is approved, and record
overlapping carousel activity as a confound.

Use manual graduation initially. A publication integration must check current
account limits, bind to the ABP account ID, accept only a reviewed manifest,
enforce an explicit finite batch budget and prevent duplicates. Reconcile
ambiguous publish responses before retrying. Treat API limits as ceilings,
not growth targets. Approval should cover a concrete batch and bounds once;
it should not require a confirmation for every routine render or metrics read.
The existing carousel publisher does not yet implement these Reel operations.

## Hypotheses and observations

Discovery hypotheses, all **untested**:

1. A specific paradox or consequence earns more initial attention than an
   abstract topic introduction.
2. A usable decision tool earns more saves/shares than a general explanation.
3. A short full-motion fictional presenter increases attention enough to offset
   possible synthetic-person distrust and additional production time.

Log hypothesis ID, article, distinct claim/angle, hook, audience need, format,
duration, CTA, script/source/model revisions, rights, seed, render time/VRAM,
QA status and file hashes before publication. Freeze the actual released batch
and analysis rules, with a timestamp, before looking at its results. This draft
is not a frozen preregistration. Changes become new versions with reasons.

Take cumulative snapshots at **24, 48 and 168 hours** after each publication,
with actual capture times and missing/delayed flags. Preserve snapshots instead
of overwriting them. The 24-hour read checks delivery and technical problems;
48 hours screens creative diagnostics; seven days closes the discovery cohort.
Continue subsequent approved cohorts while these clocks run. Do not compare a
24-hour candidate to a seven-day candidate.

The business outcome is genuine new ABP followers. Track **account-level net
follower growth per calendar week** separately from any **post-attributed
follows** the native app actually provides. The latter, divided by same-snapshot
reach, measures conversion efficiency. Also report absolute attributed follows
per post and production hours: a high conversion rate on tiny reach can still
produce little growth. Account-level net growth includes unfollows and other
activity; it cannot be allocated to overlapping posts without evidence.

Automate the supported reach, views, shares, saves, watch-time and skip-rate
diagnostics. Do not label them follower growth. Missing follows remain missing;
native Insights capture may be necessary. No available attribution means no
automatically validated follower-conversion winner. Do not switch the primary
metric to whichever diagnostic improves after seeing outcomes. Bio-link
sessions and confirmed signups stay distinct; views are not unique reach and
watch-time/duration is not completion rate.

## Learn and confirm

Discovery uses descriptive summaries by topic/angle/format, equal-age outcomes
and post-level uncertainty. Do not treat thousands of views as thousands of
randomized experiments: Instagram selects audiences, and posts can interact.
Many candidates create selection bias; the top observed post is a candidate
for replication, not proof of a winning recipe.

Before launch, specify any 48-hour rule for reallocating **future production**
budget. Keep low-exposure results inconclusive. Do not repeatedly extend a
cohort, delete/reupload losing posts or change its scoring to manufacture a
winner. Log factual/rights/recommendation failures independently of performance.
Do not let successful watch time excuse false claims or poor follower results.

Reserve fresh articles/claims for a separate confirmation batch. Select at most
one or two promising contrasts from discovery; fix the claim, voice, duration,
CTA and edit when isolating a hook or presenter effect. Counterbalance posting
slots across topics and record residual confounds. Use observed post-level
variance and exposure to plan sample size and a practical follower effect
before freezing confirmation; no arbitrary views threshold establishes power.
If attribution remains unavailable, report exploratory attention findings and
account growth separately rather than asserting causal follow conversion.

Increase the next finite batch only after repeated useful growth, maintained
quality and account-health checks. Preserve some new-topic exploration instead
of indefinitely copying one lucky hit. Cadence, allocation fractions and sample
sizes are hypotheses to update between registered cohorts, not viral formulas.

## Current official platform capabilities and gaps

Checked November 21, 2026 against Meta's documentation:

- Meta added API Trial Reel publishing on December 3, 2025. Both Instagram and
  Facebook login routes support it. [Official changelog](https://developers.facebook.com/documentation/instagram-platform/changelog).
- Reel creation accepts `trial_params.graduation_strategy` as `MANUAL` or
  `SS_PERFORMANCE`; the latter can graduate automatically. The media endpoint
  also offers `is_ai_generated` for disclosure. [Media reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media).
- Trial Reels target non-followers first, with native engagement information
  around 24 hours. This does not randomize audiences or guarantee useful
  exposure for every candidate. [Meta Trial Reels explanation](https://about.fb.com/news/2024/12/trial-reels-try-content-non-followers-first-see-what-perfoms-best/).
- The media Insights table lists reach, views, shares, saves, average Reel watch
  time and Reel skip rate. It lists `follows` and `profile_visits` for feed posts
  and stories, **not Reels**. API data can lag up to 48 hours and unavailable
  data can be empty. Do not promise fully automated per-Reel follower
  attribution. [Media Insights reference](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights).
- Professional-account Insights require permissioned access; some account
  metrics are unavailable below 100 followers. This is a measurement limitation,
  not a verified Trial eligibility threshold. [Insights guide](https://developers.facebook.com/documentation/instagram-platform/insights).

Not verified: ABP Trial access, current permissions/account limit, API field
responses for ABP, native per-Reel follows availability, or any live growth
outcome. The official Trial eligibility help page redirected to login during
research. No Instagram session or credential was accessed.

The existing v1 evaluator is specific to its matched six-post pilot. It must
not score this broader discovery batch as though the designs were equivalent.
The next implementation should extend existing offline production mechanisms,
then add a separately reviewed bounded Reel publisher and aggregate collector.
This plan and concept register implement neither live integration nor an
unattended experiment. Nothing has been published.
