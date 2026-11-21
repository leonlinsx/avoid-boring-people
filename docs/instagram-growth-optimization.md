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
