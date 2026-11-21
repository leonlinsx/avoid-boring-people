# Continuous ABP Reel experiments

Target: **@avoidboringpeople only**, three distinct approved Reels per rolling
24 hours, at least three hours apart. No permanent self-hosted Actions runner,
local Instagram token, paid generation API or ChatGPT/Codex runtime is required.

## Execution and state

- Local RTX 5070 Ti: source-grounded concept generation and rendering; models
  and binaries remain in the existing isolated GPU environments. All new work
  enters review. An LLM factual score is never publication approval.
- Existing public Vercel Blob store: content-addressed immutable MP4s under
  `instagram/reels/<concept>/<full-sha256>.mp4`. Local upload uses short-lived
  project OIDC, not a permanent Blob token. The approved batch is capped at
  25 MiB per upload invocation. The Hobby plan, current store quota status and
  before/after size must be verified; billing-data unavailability is not zero
  measured transfer. Never enable paid overage to make an upload pass.
- GitHub-hosted `ABP Reel experiments`: uses existing Instagram repository
  secrets and their existing independent weekly refresh process. Standard
  hosted jobs on this public repository require no additional software spend.
- Reviewed hosted manifests live in `scripts/instagram_growth/approved/` and
  contain public URLs, source anchors/hashes and reviewer details, never tokens
  or local machine-specific output paths. New scripts still require review.
- `abp-instagram-state:instagram-state.json` is the durable aggregate ledger.
  Contents API writes compare the previous SHA, and the workflow has one shared
  concurrency group. Reservations and publish intent must be acknowledged by
  GitHub **before** the corresponding Meta call. Missing persistence, a CAS
  conflict or an uncertain receipt halts publication. Artifacts are not state.
  This state branch is excluded from Vercel deployment and does not mutate
  `posted.json`, the newsletter, other social destinations or the personal account.

## Verified cold-start delivery decision

The November 21 live Trial container request was rejected by Meta because ABP
does not meet the Trial Reel follower requirement. No container ID or
media_publish call was created. Keep its original durable receipt. An explicit
`reconcile-no-publish` action can classify only a Graph API container refusal
with no container or media ID; uncertain publishes remain blocked.

The initial live cohort is therefore explicitly **ordinary Reels**, registered
as `ABP-REELS-002-STANDARD-COLDSTART`. Concept `abp002-19-standard` is the
ordinary delivery of the rejected, never-published Trial creative. Do not pool
future Trial outcomes with these observations. Other approved creatives use
ordinary delivery until a separately checked Trial cohort becomes eligible.

## Activation and operation

A workflow dispatch defaults to read-only `preflight`. A separate explicit
`pilot` dispatch names exactly one approved concept. It checks ABP identity,
current Meta publication quota, source integrity, public/local byte identity and
video codecs before publishing. After a real media ID is returned, it reads back
identity/type/permalink and requests available Insights. A successful upload or
container ID alone is not a successful pilot. If Insights are unavailable, the
real post remains recorded but recurring publication stays disabled.

Create the state branch from the reviewed merged head, with an initial object:

```json
{"account":"avoidboringpeople","pilot_verified":false,"receipts":{},"observations":{},"account_snapshots":{}}
```

```sh
# No publishing and no token rotation:
gh workflow run instagram-reels.yml -f action=preflight
# One already-authorized live pilot, not a recurring schedule:
gh workflow run instagram-reels.yml -f action=pilot -f concept=abp002-19-standard
# If initial Insights are delayed, recheck without publishing again:
gh workflow run instagram-reels.yml -f action=verify
# Only after read-back verification and available Insights pass:
gh variable set ABP_REELS_ENABLED --body true
# Kill switch: disable future scheduled jobs and publication permission.
gh variable set ABP_REELS_ENABLED --body false
```

Publication checks run at 00:15, 08:15 and 16:15 UTC. These are initial test slots,
not a claim of optimal viral timing. Actual delivery can be delayed by Actions
or Meta; the cap and spacing apply to actual reservation times. The existing
carousel schedule remains unchanged; its usual windows are distinct from these
Reel slots. Revisit Instagram-only cadence if exposure evidence suggests overlap
is harmful; never alter all-platform routing to adjust Instagram output.

Measurement runs hourly at :45, taking due cumulative snapshots at 24h, 48h and
seven days. It records actual observation age and preserves missing values.
Account follower counts are captured independently; overlapping posts prevent
causal allocation of account gains to individual Reels. Per-Reel follows and
some profile/non-follower breakdowns are not promised by the API. An all-missing
Insights response fails visibly and leaves the snapshot pending. No fabricated
site sessions or newsletter signups: those require owned analytics evidence.

The weekly Monday 07:25 UTC review groups equal target-age observations,
reports timing/attribution limits and supplies new exploration candidates for
the local factory. Attention winners are not follower-acquisition winners.
No small-sample ranking automatically approves an asset or establishes causality.

Trial manifests use MANUAL graduation; ordinary Reels are a separate declared
format. Do not silently retry a rejected Trial as an ordinary post. Inspect and
reconcile the recorded outcome, then explicitly register the next delivery.

## Recovery

Read the durable state and the failed Action before doing anything. A receipt
at `reserved`, `container_created`, `publish_attempted` or
`reconciliation_required` prevents a blind retry. A lost publish response may
already represent a live post: inspect recent ABP media and match its caption,
publication time and media ID. Never delete the receipt simply to unblock a run.

The kill switch cannot recall an irreversible request already in flight. Pause
and inspect the active run too. Credentials stay in GitHub; a revoked token
needs operator reauthorization, not another model/chat session. Empty approved
inventory means no post; do not lower review standards to fill a quota.

Initial baseline, actual Blob/post URLs, measured results and remaining blockers
are recorded with the local batch execution report. This document is an
operating contract, not a claim that activation has already passed.
