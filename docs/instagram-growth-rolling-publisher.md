# ABP Instagram — rolling Trial Reel pilot, November 2026

**NOT LIVE.** This is an independent, locally hosted, opt-in Reel subsystem for
@avoidboringpeople only. Existing carousel automation and @leon.lin.s are untouched.

## Source and activation boundary

**November 21 local integration:** latest main including PR #140 was merged
without losing the workstation's four local documentation changes. All 24 v2
source anchors and hashes matched; the v2 register and protocol were preserved
byte for byte. Twelve distinct narrated/captioned exports and local review
manifests now exist under ignored `.tmp/instagram-growth/batch-v2/`; see its
`REVIEW_REPORT.txt`, `BATCH_STATUS.json`, and `publisher-real-artifact-checks.json`.
The source register remains uncommitted. Public Blob URLs and release times in
the local approval manifests are null, so they cannot enter the live queue.
No upload or real publish has been attempted: ABP credentials, authenticated
Blob upload and verified remaining free transfer usage are unresolved. Both
timers were verified uninstalled/inactive. The historical PR preparation notes
below explain the original handoff; they are not current render status.

The user's 24-concept register, docs/instagram-growth-reels-v2.json, and protocol,
docs/instagram-growth-rolling-batches.md, were reported as **uncommitted on the
Linux workstation**. They are not in the GitHub repository, and have not been
inspected or reconstructed. Preserve the exact source anchors/hashes and commit
them on a separate reviewed branch before integrating with this subsystem.

A concept is not a ready video. Each released asset requires a source-checked,
fully narrated, correctly captioned, rights-cleared MP4, an actual public URL,
and a human review decision (or a specifically authorized equivalent gate).
Existing silent layout previews are **not** publishable Reels.

## What is implemented

- scripts/instagram_growth/reel_pilot.py supports local check, public-host
  preflight, ABP credential identity verification, manual-graduation Trial Reel
  creation, AI-generated label, one-shot publish receipts, and read-only Insights.
- scripts/instagram_growth/rolling_queue.py selects at most one due approved
  concept each invocation. Default throttle: two total per rolling 24 hours,
  at least four hours apart. An ambiguous or unfinished receipt halts the queue.
- The local publisher follow-up also locks dispatch across processes, rejects
  identical video hashes under renamed concepts, and refuses direct manual
  publication while any earlier receipt is unresolved. These guards apply
  before network preflight and have focused negative and valid-control tests.
- The queue can sample each successful Reel at 24h, 48h, and seven days without
  publishing. This is overlapping measurement, not an unsupervised infinite
  posting mandate.
- Tests exercise account isolation, approval, checksum verification, API payload
  correctness, duplicate resistance, throttle, ambiguous calls and missing
  metric semantics. No credentials or real network calls are required in CI.

## One approved manifest, one unique creative

Store one JSON object per approved *rendered* creative in a private directory,
with exactly these required properties (the values are illustrative):

~~~json
{
  "account": "avoidboringpeople",
  "concept_id": "ergodicity-first-winning-bet-v1",
  "source_url": "https://leonlins.com/writing/ergodicity/",
  "format": "REELS",
  "video_path": "/home/leon/abp-media/ergodicity-first-winning-bet-v1.mp4",
  "video_url": "https://STORE-ID.public.blob.vercel-storage.com/instagram/reels/ergodicity-first-winning-bet-v1.mp4",
  "video_sha256": "REPLACE_WITH_ACTUAL_SHA256",
  "caption": "A positive expected payoff is not the same as your lived outcome. Follow @avoidboringpeople for original ideas about risk.",
  "ai_generated": true,
  "trial": true,
  "graduation_strategy": "MANUAL",
  "review_status": "approved",
  "approved_by": "editor",
  "release_after": "2026-11-23T15:00:00Z"
}
~~~

An example hash and public URL will not pass preflight. Do not mark 24 concepts
approved merely because they have source anchors.

## Public MP4 hosting: existing Vercel Blob

Meta fetches public video URLs. The existing site upload API is JPEG-only and
must not be repurposed for MP4s. On the authorized local Vercel CLI session,
linked to the project's existing public Blob store:

~~~sh
vercel link
vercel env pull
vercel blob put /home/leon/abp-media/ergodicity-first-winning-bet-v1.mp4 --pathname instagram/reels/ergodicity-first-winning-bet-v1.mp4 --content-type video/mp4 --access public
~~~

Copy the actual returned URL into the approved manifest. The publisher streams
the hosted MP4 and confirms its SHA-256 matches the local video before any
Meta container exists. The MP4 must be H.264/AAC at 48 kHz, 1080 x 1920,
23-60 fps, 3-90 seconds, below the conservative 200 MiB ceiling. Do not put
video binaries in Git, or expose a permanent Blob token.

Vercel CLI supports OIDC local authentication on a linked project. Check the
project's free usage and quotas before uploading: Hobby included limits may
be 1 GB storage and 10 GB Blob transfer, shared with the existing site. A
nominally free tier is not a promise of unlimited video uploads or bandwidth.

References:
https://vercel.com/docs/cli/blob
https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication
https://vercel.com/docs/vercel-blob/usage-and-pricing

## Commands on the local Linux workstation

Run from the repo root with an isolated Python environment and existing Meta
credentials for the Instagram Login integration. Use a persistent, private
state directory; not ephemeral GitHub Actions storage:

~~~sh
export ABP_IG_QUEUE="$HOME/.local/share/abp-instagram/approved"
export ABP_IG_STATE="$HOME/.local/state/abp-instagram/reels"
mkdir -p "$ABP_IG_QUEUE" "$ABP_IG_STATE"
chmod 700 "$ABP_IG_QUEUE" "$ABP_IG_STATE"

# No network, only inspect approved local bytes and codec:
python -m scripts.instagram_growth.reel_pilot check --manifest "$ABP_IG_QUEUE/ergodicity-first-winning-bet-v1.json"

# Read-only public MP4 byte integrity and exact ABP account token check:
python -m scripts.instagram_growth.reel_pilot preflight --manifest "$ABP_IG_QUEUE/ergodicity-first-winning-bet-v1.json"

# Dry-run queue selection:
python -m scripts.instagram_growth.rolling_queue queue --queue-dir "$ABP_IG_QUEUE" --state-dir "$ABP_IG_STATE"

# One explicit pilot post only after eligibility and editorial checks:
ABP_REELS_PUBLISH=enabled python -m scripts.instagram_growth.reel_pilot publish --manifest "$ABP_IG_QUEUE/ergodicity-first-winning-bet-v1.json" --state-dir "$ABP_IG_STATE" --yes-publish

# AFTER first pilot is confirmed, periodic scheduler commands:
ABP_REELS_PUBLISH=enabled python -m scripts.instagram_growth.rolling_queue run --queue-dir "$ABP_IG_QUEUE" --state-dir "$ABP_IG_STATE" --live
python -m scripts.instagram_growth.rolling_queue measure --state-dir "$ABP_IG_STATE"
~~~

This PR does **not** install or activate any systemd timer. Configure the
local timer only once account-specific Reel eligibility, a successful actual
post and persistent receipts have been verified. Keep a kill switch:
remove ABP_REELS_PUBLISH=enabled and the queue cannot publish.

## Special risks

- Never use an @leon.lin.s token or data on the ABP path.
- Meta supports Trial Reels through Instagram Login with trial_params and
  graduation_strategy MANUAL, but **account eligibility is unverified**.
- AI generated media is labeled through is_ai_generated=true on creation.
- Instagram Reels read back as VIDEO; media_product_type identifies REELS.
- A published media ID, not a container ID, proves that a Reel exists.
- If media_publish has an unknown outcome, the queue stops. Investigate
  recent native posts; do not delete the receipt to force an automatic retry.
- For media Insights under Instagram Login, a token normally needs
  instagram_business_manage_insights. Unsupported/missing values are null,
  not zero. The API may lag by up to 48 hours.
- Meta's per-media follows metric is documented for Feed/Stories, **not
  Reels**. Track ABP follower deltas and native insights separately; do not
  invent causal Reel-attributed follower numbers.
- Don't overfit to a single day or claim trial view counts equal followers.
  Prefer follow-per-reach and share-per-reach across several *distinct*
  sourced creative patterns.

Meta documentation:
https://developers.facebook.com/documentation/instagram-platform/content-publishing
https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights
https://developers.facebook.com/documentation/instagram-platform/changelog

## Remainder of the production pipeline

The code here is a safe **publication and measurement subsystem**, not an
unattended GPU renderer. Finish the original source register review, locally
generate complete Kokoro Heart / graphics / spokesperson variants, compare
their actual quality and rights, and put only approved, already-hosted MP4s
into the queue. Then validate one real live Reel before scheduling the
rolling dispatch. No Instagram posts, followers or signups were generated
while this PR was prepared.


## Optional unattended local user timers — disabled by default

The repo includes four **uninstalled** templates under deploy/systemd:
abp-instagram-rolling-publish.service/.timer and
abp-instagram-rolling-measure.service/.timer. These are NOT enabled by GitHub
and do not execute on the user's computer unless locally installed and started.

Once one real Reel is fully confirmed, the operator can create a private
$HOME/.config/abp-instagram/reels.env (mode 0600) with the exact ABP Instagram
User token/id and ABP_REELS_PUBLISH=enabled, and an isolated
$HOME/repos/avoid-boring-people/.venv-ig-reels with Python requests installed.
Do not reuse @leon.lin.s credentials.

~~~sh
# ONLY after the first approved live pilot is verified:
mkdir -p "$HOME/.config/systemd/user"
cp deploy/systemd/abp-instagram-rolling-* "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now abp-instagram-rolling-publish.timer
systemctl --user enable --now abp-instagram-rolling-measure.timer
systemctl --user list-timers 'abp-instagram-*'

# Pause live publishing without deleting the approved queue or measurements:
systemctl --user disable --now abp-instagram-rolling-publish.timer
~~~

The publish timer checks four local-time windows per day but the queue limits
actual publications to at most two within 24 hours, separated by at least four
hours. Measurement runs independently twice a day. Keep the timer disabled if
the user asks for a pause, if Meta's account/permission check changes, or if
captions/artifacts fail QA. Do not install timers as part of CI or a repository
merge.
