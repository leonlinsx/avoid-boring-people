# ABP operating loop and human review

The live account remains **@avoidboringpeople**, ordinary Reels only. The
three-per-rolling-24-hour cap, three-hour publication spacing, live quota,
verified account, CAS receipts and `ABP_REELS_ENABLED` kill switch remain.
Other channels and the newsletter are unchanged.

## Weekly growth evidence

The existing Monday 07:25 UTC GitHub job writes `weekly-scorecard.json` and
`weekly-scorecard.md`, preserves them as a 30-day Actions artifact, and adds
the readable report to its job summary. It retains the compact learning
summary on `abp-instagram-state`; detailed observations remain recomputable.

Primary KPI: net new account followers across observed week boundaries. A
partial first week has an observed change and actual timestamps, but no
fabricated full-week result. An ending snapshot older than two hours is stale;
a starting snapshot can precede the week boundary by at most 24 hours, with
its actual timestamp disclosed. Per-Reel acquisition remains unavailable.

Compare cumulative 24h, 48h and seven-day observations separately. Late
observations (more than six hours late for 24h/48h, 24 hours for seven days)
are excluded from comparisons. The initial screening floor is 100 reached
accounts per Reel, a low-information guard rather than a significance test.
Only patterns repeated across at least two articles can enter the replication
list; at least two such patterns are needed for comparative ranking. A single
viral outlier cannot earn increased allocation. Shares per 1,000 reached,
watch time, skip rate and engagement are attention diagnostics. They do not
prove follower acquisition or causal improvement. Provider watch-time units
remain explicit; missing measurements remain null.

The current API path has no independently attributed website sessions,
newsletter signups, non-follower/profile breakdown or per-Reel follows. Do
not infer them or copy newsletter credentials into this subsystem.

## Approved inventory

Every hosted operation prints an inventory check and adds it to the Actions
summary. Below 21 is `BUFFER_SHORT` (less than seven days at maximum cadence),
below seven is `LOW`, and zero is `EXHAUSTED`. Each non-OK state emits an
Actions warning. Count only valid ordinary, explicitly approved, released
manifests; exclude used concepts, used hashes and duplicate hashes. Future
release times are shown separately from assets ready now. A warning is never
permission to approve generated media or increase the publication cap.

Local generation status must be checked from the local service and durable
review report; a hosted report must not pretend it can see workstation state.
No chat process is required by either scheduler.

## Batch review and replenishment

The Monday factory now creates `review/index.html`, its hash-bound
`review-manifest.json`, and a durable `factory-status.json`. Read the local
journal for `instagram_factory_alert` on failure or low inventory. A failed
source/model/render step exits nonzero; partial outputs remain available.

Open the local review HTML in an installed browser with H.264/AAC support
(tested in Google Chrome). Review 20–30 clips in one page: video, source,
transcript, voice, presenter/style, timing, factual/rights evidence, production
time and duplication flags are visible. All decisions start Pending. Browser
progress is optional convenience storage; the exported JSON becomes durable
only after import. Nothing in this interface calls Meta or auto-approves media.

```sh
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.review build \
  --root /path/to/weekly-batch --state /path/to/latest-abp-state.json
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.review apply \
  --package /path/to/weekly-batch/review --decisions /path/to/exported-decisions.json \
  --confirm-reviewed
# After checking the existing Hobby free storage/transfer allowance:
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.replenish \
  --root /path/to/weekly-batch --state /path/to/latest-abp-state.json \
  --release-after 2026-11-23T12:00:00Z --confirm-free-quota --submit-pr
```

Import records immutable, hash-bound decisions under `review-decisions/`, then
materializes only explicitly approved clips. Reject/revise requires a new
corrected creative; changing an old decision cannot override rejection. Recheck
the actual video bytes, original source and any added context anchors. Reject
wrong accounts, changed files, used concepts/hashes, missing technical QA and
missing human decisions. An editorial hold blocks the entire batch.

Replenishment reuses the existing Development OIDC uploader in <=25MiB
invocations, with <=75MiB per release. Uploads are immutable, content-addressed
and publicly hash-verified. Freeze release times and queue manifests, then
create a scoped queue PR through the existing authenticated GitHub CLI, without
stashing or changing the local worktree. CI and reviewed merge still apply;
this command never merges or publishes. If a remote write fails ambiguously,
inspect the named branch/PR before retrying. Never bypass free quotas or enable
paid overage to replenish inventory.

## Standalone content correction

The first 21-video review batch was returned by the owner: many scripts lacked
context. Its files are preserved on editorial hold, not treated as approved.
New scripts must name their subject in the first spoken sentence, define the
situation and unfamiliar terms, and deliver a complete payoff before a CTA.
Article citations are provenance, not substitutes for an understandable setup.
Do not reference an unseen chart, an earlier paragraph or an undefined "this".
Historical product/business claims must retain their date and qualifications.

`specs/standalone-v3.json` records 21 explicit editorial rewrites after that
feedback. Reproduce without coding using `factory.weekly --spec
scripts/instagram_growth/specs/standalone-v3.json --count 21 --render-limit 21
--output-root /path/to/a-new-root`. This is an editorial revision batch, not
evidence of autonomous script-writing quality. New model proposals include
surrounding exact source anchors and a context screen/source critic. A single
bounded editorial repair uses the actual findings; remaining failures are
quarantined. Raw paragraph extraction no longer feeds the production factory.
Source presence and a model critic are never enough for human approval.

## Initial allocation policy

Forty attempts allocate 24 exploration, ten exploitation and six controls.
Controls use an established production format with an explicitly contextualized
new script, not unedited article fragments. Interleave allocations rather than
putting all controls at the end. With no encouraging seven-day pattern replicated
across two articles, reassign exploitation to fresh exploration and record why;
do not invent a winner to fill that allocation. Report the realized accepted
and rendered mix separately, since failed quality checks reduce yield.

Vary Heart/Nicole, presenter/graphics, short/long duration targets, cards/statement
visuals, three/five-word caption groups and follow/article CTAs. Actual durations
remain measured results, not guaranteed target labels. Exploitation must use a
different source article and remain source-grounded. Weights are experimental,
not statistically optimal; attention replication is not follower causality.

## Presenter comparison

Future 21-render batches reserve six matched presentation pairs (15 unique
scripts plus six alternates). Each pair keeps the source, script, waveform,
voice, duration, visual style and word timing fixed. The tested factor is a
fictional presenter opening followed by graphics, versus graphics throughout.
Unique IDs and the appropriate synthetic-media disclosures still differ. This
does not establish how a full-video talking head would perform.

The current context-revision batch keeps its 21 frozen originals and adds six
graphics counterparts to completed presenter clips: 27 review assets, six
pairs. `factory.pair_batch --root /path/to/context-batch --state /path/to/state
--pairs 6` reuses the exact audio/alignments and verifies duration and caption
equality. It preserves the originals and records `presentation-pairs.json` and
`PRESENTATION_COMPARISON.json`. The review page links each counterpart.

Pair IDs/roles flow into approved manifests and the weekly scorecard. Both
members need sufficient reach, equal target ages and actual ages within one
hour before a pair is marked comparable. Results remain observational:
posting time and audience exposure differ, and no per-variant follower gain
can be inferred from account totals.
