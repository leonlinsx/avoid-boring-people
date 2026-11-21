# Local ABP creative factory

The production commands use cached local models and ordinary Python, Node,
FFmpeg and systemd. They do not call Codex, ChatGPT or a paid model API. The
existing isolated environments and model files are required on the workstation;
there is no permanent self-hosted GitHub Actions runner.

## Produce and review

```sh
# Reproduce a curated source-grounded batch (does not approve or upload):
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.run \
  --spec scripts/instagram_growth/specs/batch-v2.json \
  --output .tmp/instagram-growth/my-reviewed-template-run --limit 12

# Propose context-complete candidates with cached local models and source critique:
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.draft \
  --output .tmp/instagram-growth/new-drafts --count 32

# Render source-screened drafts, still requiring review:
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.run \
  --spec .tmp/instagram-growth/new-drafts/drafts.json \
  --output .tmp/instagram-growth/new-render --limit 12 --voice af_heart
```

Outputs include exact source anchors/file hashes, hypotheses, full narration,
model revision/digest, inference time, GPU memory where measured, aligned word
times, independent ASR, original animated graphics, ffprobe and loudness results,
contact sheets, and a `review-queue/`. The renderer supports the cached fictional
FlashHead Pro presenter and optional cached Kokoro Nicole comparisons. Generated
B-roll is not used when it adds no explanatory value.

The initial model-only test quarantined all 32 proposals. A later raw-passage
batch passed technical checks but failed owner review because viewers lacked
context. Raw extraction no longer feeds production. New scripts need an explicit
subject, situation and payoff; surrounding exact source anchors support the
setup. One bounded repair uses concrete context/source findings, then remaining
failures are quarantined. A model critic is only a screen. Earlier validation found that a critic could
miss an inverse-causation claim; that candidate was rejected manually. Neither a
source anchor nor a technical PASS authorizes publication. Correct weak hooks,
unsupported mechanisms, missing qualifications, inaccurate pronunciation and
layout issues before approving. Generated concepts can be quarantined without
making the renderer or publisher accept them. Candidates and rejections are
recorded in `proposals.jsonl`; no run overwrites an existing frozen draft batch.

Use the [batch review and replenishment commands](instagram-growth-optimization.md)
to review 20–30 videos, import durable decisions and open a queue PR. The older
single-asset approval command still requires standalone context and full review;
it is never called by a timer:

```sh
.venv-ig-reels/bin/python -m scripts.instagram_growth.factory.approve \
  --batch .tmp/instagram-growth/new-render --concept EXACT_CONCEPT_ID \
  --reviewer leon --confirm-reviewed
node scripts/instagram_growth/upload_blob.mjs \
  .tmp/instagram-growth/new-render/approved \
  .tmp/instagram-growth/new-render/hosted
```

Uploading requires the existing Vercel login and Development OIDC store access.
It uses the existing public store, a 25 MiB per-invocation cap, full-hash paths,
no overwrite, and public-byte SHA verification. If a weekly approved batch is
larger, divide it into bounded upload invocations. Never upgrade the Hobby plan
or mint a permanent token just to make an upload pass.

Freeze release timestamps with timezone offsets and submit the hosted manifests
as a scoped PR under `scripts/instagram_growth/approved/`. Preserve creative
hypothesis, voice, duration, format and CTA fields. Do not reuse a published
concept ID or ignore the publisher's hash/receipt halt. The default approval delivery is ordinary Reels because ABP failed the live Trial follower requirement. `--delivery trial` is a separate explicit cohort choice only after eligibility is rechecked.

## Weekly local job

`factory.weekly` reads only the public aggregate experiment state, uses the last
weekly attention report to propose fresh-source replications while preserving
exploration, attempts up to 40 context-complete candidates, and renders at most
21 source-screened assets. Planned allocation is 60/25/15 exploration,
exploitation and controls; unsupported exploitation returns to exploration.
Actual accepted/rendered allocation and duration are reported, not guaranteed.
Controls preserve established production attributes, not raw prose fragments.
Historical dates stay visible. Most use Heart, with Nicole comparisons. A
review HTML package and durable success/failure marker are automatic outputs.
It places **all** new outputs in review, not the live queue. It has no Instagram
credential or publishing action. A low-quality draft yield or an empty approved
inventory is an operational issue requiring review, not permission to lower the
quality gate.

Templates: `deploy/systemd/abp-instagram-factory.service` and `.timer`. The timer
runs Monday 04:30 America/New_York, with missed-run catch-up. The local
machine and existing Ollama service must be available; GitHub publishing can
continue from approved hosted inventory while the workstation is offline.
Model timeouts, failed source checks or absent experiment state produce a
nonzero service exit. Inspect with:

```sh
systemctl --user status abp-instagram-factory.timer
journalctl --user -u abp-instagram-factory.service -n 80
# Pause generation independently of the GitHub publishing kill switch:
systemctl --user disable --now abp-instagram-factory.timer
```

Use the hosted publisher's `ABP_REELS_ENABLED=false` repository variable to stop
new publications. No chat session needs to remain open. Human review, occasional
provider reauthorization after revocation, workstation availability and finite
free storage remain real operating constraints. A scheduled template alone is
not evidence of successful unattended generation.
