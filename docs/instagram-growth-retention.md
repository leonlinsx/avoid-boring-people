# Active feed and immutable evidence retention

Issue #164 separates the bounded delivery handoff from historical evidence.
It does not modify creative compilation, admission signatures, rendering,
GPU protections, source/treatment identities, quotas, publication cadence,
measurement windows or the Monday review. Issue #160's actual reused-claim
production acceptance remains independent; Issue #150 is unchanged.

## Evidence graph and hot eligibility

An admitted asset has original public MP4 bytes, a content-addressed signed
envelope, a producer upload intent/receipt, a signed feed entry, and a CAS
inventory acknowledgment. Publication adds an intent, media ID, verified ABP
ownership and exact media hash. Measurement adds target-age observations or
explicit missed-window records; account snapshots are separate observations.
None of those forms of evidence is interchangeable with a simulated render,
an unpublished admission or a causal follower-growth result.

The hot feed remains capped at **64**, and mutable `instagram-state.json`
remains capped at **900,000 bytes**. Queued/unpublished, ambiguous, unreconciled,
recently published and measurement-incomplete records are not eviction candidates.
The original pilot and fixed automatic canary are pinned hot for their existing
verification paths.

A publication becomes an archival candidate only after **14 days**, with a
published receipt, matching verified ABP media identity, and all three windows
represented by observations or explicit gaps. Gaps are retained as gaps. No
measurement or follower value is invented to complete a record. The 14-day hot
window exceeds the seven-day observation deadline and the normal publication
recovery interval. Cooldown/saturation decisions still use the reconstructed
full history, including the existing 28-day exposure window.

## Immutable archive, then CAS compaction

Archives live on the **existing `abp-instagram-state` Git branch** under
`instagram-archives/<sha256>.json`; there is no new database, service or paid
storage. Each create-only file contains a deterministic gzip/base64 payload,
its uncompressed SHA-256 and an outer content-addressed SHA-256. The payload
has a previous-head reference, exact evidence tables and an optional weekly
review. One head reference replaces an unbounded inline index.

Signed envelopes are packed as their exact Python canonical JSON strings,
preserving signed `0.0` bytes across JavaScript and Python. Archive reads verify
both hashes, bounded decompression, account/schema, original Ed25519 signatures,
envelope identity/hash and publication/media hash association. Historical manual
manifests are copied too; their original approval/provenance remains intact.
Follower snapshots and complete historical weekly reviews are retained.

The writer creates a bounded batch (at most 24 old publications), independently
reads it back and reconstructs its evidence **before** attempting the root CAS.
It then omits only rows equal to the verified cold baseline. This runs before
the normal hot limits, at 48 hot envelopes or 550 KB compact canonical state,
and during the existing weekly review. A weekly review is itself archived so
its cumulative detail does not make the mutable file grow forever.

Every hosted operation and local factory read restores cold tables before
eligibility, deduplication, cooldown, source rotation, allocation or reporting.
Restoration retains the prior sorted CAS iteration order. A later hot observation
overlays an older archive without modifying that archive; old versions remain
recoverable. Conflicting immutable concept identities fail closed.

A failed root CAS leaves the previous root unchanged and an inert archive
orphan; it cannot evict evidence. A lost archive-create response is resolved
only by exact readback. A lost root response is resolved by reloading the root.
Replaying a stale root SHA is rejected by the existing CAS. An older immutable
checkpoint reconstructs its own history, but is **not permission to roll the
production ledger backward**. Do not revert to a pre-archive-aware reader or
upload a recovered logical snapshot as hot state; use compatible main code.

## Active registry and crash recovery

The producer freezes the pre-retention envelope registry once in a signed,
create-only `registry-bootstrap-v1.json` (at most the existing 64 legacy entries).
Future recovery does not scan the growing lifetime manifest namespace.

New uploads retain immutable canonical originals and create bounded disposable
`pending/<envelope-sha256>.json` copies before feed CAS. Feed reconstruction joins
the frozen bootstrap, current origin feed and pending entries. Origin reads use
the installed Blob SDK's `get(..., {useCache:false})`, returning body and ETag
together. A stale CDN body or mismatched local monthly checkpoint is never a
write base. The signed result still uses conditional `ifMatch`/create-only writes.

Before rotation the producer reads the exact public Git ledger through the
Contents API and verifies its referenced archive chain. Only archive-proven
terminal records may leave the active handoff. A newer hot reconciliation hold
overrides an older archive. One signed heartbeat anchor remains if the whole
queue is cold. A full still-needed working set stops visibly at 64.

After the feed commits, **only redundant pending-index copies** backed by the
verified archive can be collected. The code has no deletion path for original
envelopes, archive files or MP4s. A crash before feed CAS leaves a recoverable
pending copy; a crash after feed CAS or before local checkpoint is recovered
from coherent origin evidence. Failed cleanup is retryable without generating
or publishing again. Existing local upload intents and completed renders remain
the recovery source for a process death before the pending copy was created.

## Free-only bounds and media policy

The existing Hobby plan check, 750 MiB shared-store ceiling, 256 MiB monthly
local byte allowance and 900 reserved-operation allowance remain enforced.
Metadata storage is now included in byte reservations and safety headroom.
Additional reads/index writes consume those same allowances, without refunds
or automatic upgrades. Provider transfer usage remains unavailable, not zero.

Archive files are limited to 500 KB and decompressed payloads to 8 MB. Recovery
has a 64 MB combined evidence budget and a 90-second traversal circuit. Those
are integrity/resource limits, not evidence eviction rules; exceeding them
fails visibly. Genuine growth beyond those bounded working assumptions requires
an evidence-backed maintenance decision, not a silent cap increase.

**Original public media and signed envelopes remain retained indefinitely by
this implementation. Automated media retirement is DISABLED.** Finite free
storage cannot guarantee infinite retained video bytes. This change solves the
lifetime *active-feed* and mutable-state accumulation, not that physical limit.

A future retirement policy would require a separate reviewed change: a fixed
public retention window, verified completed publication/measurement obligations,
an independent durable copy of exact original bytes, hash/decode validation,
restoration to an empty destination and checked public rehosting when required,
plus an explicit rollback procedure. Never retire queued, unreconciled or
still-needed media. Neither a successful metadata restore nor this PR authorizes
MP4 deletion, arbitrary TTLs or spending. Reaching the free ceiling while
retirement is disabled remains a visible genuine exception.

## Runway, recovery and verification

The existing weekly scorecard includes hot envelope/state headroom, archive
recovery status, oldest queued age, unresolved receipts, stored bytes and monthly
local reservations. Existing hosted jobs warn at 56 hot envelopes, 700 KB state,
650 MiB stored, 750 reserved operations or 224 MiB reserved monthly bytes.
No scheduler, dashboard, agent or polling service is added.

Read-only recovery from an existing public ledger snapshot:

```sh
python -m scripts.instagram_growth.retention \
  --state /tmp/instagram-state.json --output /tmp/recovered-logical-history.json
python -m pytest tests/test_instagram_retention.py -q
```

The test exercises **120 actual signed fixture admissions**, source reconstruction
and normal admission QA against synthetic audio/media evidence. It compares
unarchived and restored decision/report results, then executes the real storage
helper across simulated months with provider I/O replaced. It covers archive
rotation, stale checkpoints, lost feed recovery, repeated uploads, CAS conflicts,
death after archive creation/root commit/feed commit, pending publication,
delayed measurement, unavailable/corrupt archives, forged inner signatures and
a stalled publisher that must refuse admission 65. These are not GPU or Meta
production receipts.

The bounded live proof copied existing published evidence to
[this immutable archive](https://github.com/leonlinsx/avoid-boring-people/blob/9016bf0d19a421e68716c89a3998865243bd2949/instagram-archives/a3bf7f69d6b8798de98a94aebd09f0b7faff71ef1c248f1da5b8abf54f170865.json).
Its exact readback restored four original signed admissions, 16 publication
receipts, 23 observations and 26 follower snapshots. The proof file is 20,105
bytes. It is intentionally **not installed as the live archive head**: root CAS,
feed, media, quotas, publication and measurements were not mutated by the proof.
This proves the evidence format and recovery on existing infrastructure, not a
new V2 production cycle or permission for destructive media retirement.

The same audit checked all 17 queued public MP4s (HTTP 200). A scratch restore
of the original published canary retained SHA-256
`5ce5a0ee429adbb934d51dd6414fbcac26f72bcb697a8b8f3ec3758f755feefc`,
1,002,751 bytes, 22.807 seconds, and passed full decode with the existing bundled
media tools. No public media was written or removed. This is a local recovery
check, not an independent durable video backup or authorization for retirement.
