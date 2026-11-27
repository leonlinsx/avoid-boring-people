# Source-bound automatic ABP lifecycle

This is the automatic lane authorized by the owner. Routine content that passes
`docs/instagram-growth-auto-policy.md` enters `AUTO_ADMITTED` without an individual
human decision. The existing human-reviewed lane remains available for exceptions.
No new fact-generation, creative treatment, provider or publication cap is added.

## Execution and evidence boundary

The local launcher fetches **public main** into a dedicated Git ref, then executes
an immutable detached worktree. It never checks out, pulls into or resets the
author's active branch. A runtime environment allowlist excludes Instagram,
GitHub, newsletter, database and unrelated cloud credentials. The local factory
needs only existing GPU environments, the dedicated owner-only Ed25519 admission
key and the existing local Vercel login. The key is delivered by systemd
`LoadCredential`; no private key is committed or sent to GitHub.

The worker compiles complete owned paragraphs and the existing fixed low-risk
references. It retains context, attribution, source hashes, model/portrait
provenance, independently measured captions/ASR, technical QA and matched-pair
waveforms. It cannot invent a human reviewer. Numeric/sensitive claims and
unsupported changes remain quarantined. The hosted consumer reconstructs the
script under main's policy and verifies signatures, immutable envelope identity,
public MP4 bytes and ffprobe before adding data to the existing CAS ledger.
Nothing in a public feed is executed as code or treated as instructions.

The Python → JavaScript → Python handoff preserves exact signed payload and
envelope bytes. JavaScript must not reserialize Python's `0.0` evidence as `0`
before verifying or hosting it. The cross-runtime test executes the real helper,
then authenticates and promotes its output with the real Python consumer; the
signature policy itself is unchanged.

The timer template checks inventory every six hours and Monday morning; each run
is limited to 12 assets, 21 render reservations and 40 QA attempts per week, a
90-minute work budget and the service's two-hour hard timeout. Reservations are
persisted **before** GPU work and are not refunded after failure. An occupied GPU
defers generation without terminating another process. Existing local/cache
paths are configuration, not content in public manifests.

Crash recovery reuses a persisted signed upload request and immutable media;
it does not regenerate or publish. Recovery intent is written before local
inventory, and recovery reconstructs that inventory if the process died between
the two writes. A failed render pair is not blindly rerendered through its other
member. Early HTTP/config/GPU failures leave a durable `status.json` plus the
service's nonzero exit. Source exhaustion stays visible and never loosens policy.

## Existing free storage only

The helper checks the exact existing team/store, active Hobby status, public-store
availability, provider quota flag and a 750 MiB shared-store ceiling. Autonomous
uploads reserve at most 256 MiB and 900 conservative operation allowances per
calendar month. Each upload attempt reserves twelve operations before any write;
this is a conservative local allowance, not measured provider billing. A full
inventory refreshes its signed heartbeat at most daily. The feed has at most 64
entries; it stops for review rather than silently evicting evidence.

MP4s and envelope hashes are immutable. The signed feed uses an ETag conditional
write, and a conflicting writer fails rather than replacing its update. Local
usage reservations are atomic and run under the worker's process lock. Existing
signed concept envelopes cannot be replaced with different ones.

Transfer usage is unavailable from the current Hobby billing response and must
never be reported as zero. [Vercel's documented Hobby behavior](https://vercel.com/docs/vercel-blob/usage-and-pricing)
blocks Blob access at the free limit rather than charging overage. No automatic
upgrade, paid fallback, permanent Blob token or new store is permitted. Quotas
are shared with the existing site; hard free limits bound cost, not availability.
Electricity is unmetered and is not claimed to cost zero.

## Canary and regular operation

Only reviewed main with passing scoped CI may be installed. Activation requires
the existing verified ordinary-Reel pilot, `ABP_REELS_ENABLED=true`, a signed
fresh feed and `ABP_AUTO_MODE=canary` or `enabled`. `enabled` still starts with the
fixed, shadow-tested source-exact graphics canary. It cannot skip that gate.
`canary` permits only that bounded canary; `enabled` continues automatically only
after its durable verification succeeds.

A container is not a publication. The canary must have a published media ID,
ABP ownership/permalink and available Insights. If Insights lag, later ticks only
read the **same hash-bound published receipt**; they never call `media_publish`
again. Delayed Insights are a pending phase, not a fabricated success or a reason
to trip the publishing failure breaker after three normal processing delays.
Unavailability beyond 48 hours fails visibly for a permissions/API exception.
`verify` also rechecks an automatic canary before falling back to the old manual
pilot. An uncertain publish intent still halts the queue for reconciliation.

Regular publication uses the existing account check, live quota, CAS reservation
and publish intent, at most three ordinary Reels per rolling 24 hours and at least
three hours apart. No Trial delivery, extra destination or duplicate retry is
introduced. Three consecutive operation failures and stale/future heartbeats
block automatic inventory. `ABP_AUTO_MODE=off` stops automatic admission; the
existing global `ABP_REELS_ENABLED=false` stops scheduled publication. Local
`PAUSE` or `enabled=false` stops the factory independently.

Measurement includes automatic manifests in inventory and the existing weekly
scorecard. PR #151's age-window and freshness safeguards remain in place.
Actual follower change stays account-level. Views, shares and watch time cannot
be called follower acquisition, and unavailable owned-site conversions remain
unknown. The producer keeps the established 60/25/15 allocation; unsupported
exploitation returns to exploration and actual admission yield is disclosed.

## Verification and current operational limitation

Run the existing focused and full suites, including
`tests/test_instagram_autonomy_lifecycle.py`. The storage helper is executed with
disposable keys and provider I/O substituted, covering a valid signed feed,
signature/byte tampering, paid-plan refusal, quota/budget exhaustion and a feed
CAS conflict. No live provider is called by these tests.

For a real-artifact offline check, the worker accepts `--canary --dry-run
--output-root <disposable-directory> --state <public-ledger-snapshot>
--seed-render <existing-shadow-render>`, with `ABP_AUTO_CONFIG` pointing to local
configuration. Dry-run refuses the production state directory, verifies the
frozen control treatment and existing artifact bytes/QA/ASR/signature, and invokes
no storage upload or publisher. Omitting `--seed-render` tests fresh rendering
when the GPU is available. The public snapshot override is dry-run only.

An existing canary pair first passed reuse-only verification. After an initial
GPU driver failure recovered, a **fresh** pair was generated and automatically
admitted at code head `ccb7666e9b037ed08c74d7732f03e41156273d24`: 86.55 seconds
total, two 22.807-second assets, identical narration/timings, ASR word error 0,
-16.35 LUFS and -1.98 dBTP. Decode, codec, faststart, source, caption, clipping
and safe-bounds checks passed. The graphics MP4 SHA-256 is
`5ce5a0ee429adbb934d51dd6414fbcac26f72bcb697a8b8f3ec3758f755feefc`;
the presenter treatment is
`52b3da3b84e154f0e0b8987efed13e22d9c0b8d7dfe41c31cf238d8112d5f233`.
These are local artifacts, not publication receipts. The offline run uploaded
nothing. A read-only storage check found an active Hobby store with 32,515,725
bytes and no quota-exceeded flag. A **live automatic canary remains NOT RUN**;
no timer was installed or activated and no new Reel was published while this PR
was prepared.

Audience positioning, structural hook/caption experiments and Issue #149 stay
behind that operational gate. No empirical growth improvement is established.
