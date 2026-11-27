# Automatic factory and weekly feedback verification

## Live evidence on November 27, 2026

The existing publication workflow automatically admitted and published the fixed
canary graphics Reel at 00:02 EST and its matched presenter at 11:01 EST:

- https://www.instagram.com/reel/DgO4WmdOCWL/
- https://www.instagram.com/reel/DgQDy0GB7VM/

The durable receipts identify @avoidboringpeople and bind the signed admission
envelopes to media IDs `18111970808338846` and `17993826945118782`.
The canary was independently verified before switching automatic mode from
`canary` to `enabled`. Ordinary publication limits and duplicate checks remain.
There was no individual video approval.

The installed factory service then rendered and independently verified a fresh
pair, but failed to upload because its systemd PATH lacked `node`. This is a
real operational failure, not a successful replenishment run. Its completed
media, signed upload intent and weekly reservations survived.

## Recovery and runtime changes

The launcher accepts an existing absolute `node_executable` in private local
configuration, validates it before starting work, and adds its directory only to
the child's allowlisted environment. It installs nothing and imports no shell
profiles or publishing credentials.

The worker resumes authenticated upload intents and independently admits the
untouched member of an already completed matched pair. It verifies signed
envelopes, video hashes, frozen briefs and upload receipts. Recovery shares the
invocation limit, spends no new render reservation and does not regenerate
media. Known quarantines stay excluded. A completed invocation refreshes signed
producer telemetry, including failures, in the existing feed.

Tests exercise service-style PATH resolution, interrupted pair recovery,
receipt tampering and repeat execution with disposable keys/media and mocked
provider I/O. These tests are not live storage or publication evidence.

## Actual-data feedback

Weekly attention patterns remain diagnostics. Exploitation requires a fresh,
complete observed positive follower week, attention replicated across at least
two source articles, and reproducible supported production parameters. The
worker carries those parameters to a fresh source of the same topic. Missing,
stale, partial, zero or negative follower evidence returns the planned
exploitation slots to exploration. Planned 60/25/15 weights and controls stay
unchanged.

The existing weekly report shows producer telemetry and CONTINUE/ADJUST/STOP
with reasons. An account-level follower increase permits bounded follow-up;
it does not prove a particular Reel caused growth. Qualified owned-site traffic
and conversions remain unavailable until measured evidence exists.

The observed account snapshot had zero followers. Neither the two publications
nor passing infrastructure tests establish validated growth. Structural
creative experiments and Issue #149 remain behind verification of successful
recurring replenishment and measurement. No additional paid provider, calendar,
reporting service or manual per-Reel gate is introduced.

## Live replenishment exposed a cached-feed write defect

At reviewed main `cefca7dfbf00ab743677fcc90666e6b357fc5c71`, the installed
systemd service completed successfully at 11:38 EST: two uploads recovered,
ten fresh assets rendered/verified/hosted, zero quarantines, 435.76 seconds.
Weekly reservations were 14/21 renders. The actual weekly measurement run
`46034305057` saved a fresh zero-follower account snapshot and the existing
scorecard artifact, with ADJUST and unavailable full-week growth.

Independent hosted promotion run `46035348458` succeeded but found only six
new entries, despite twelve valid hosted receipts. Read-only diagnosis found a
public feed ETag/body from an older revision than authenticated HEAD. Combining
the latest HEAD ETag with a cached public body let a CAS write lose entries.
Unique query strings and no-store did not prevent this in the observed store.
The installed SDK also only implements `get(useCache:false)` cache bypass for
private blobs; this store is public.

The fix never uses a public mutable body as the base for a write. The existing
private usage ledger checkpoints the signed feed and the ETag returned by its
successful write. A matching HEAD allows the next bounded update. Missing or
stale checkpoints trigger a bounded origin listing of immutable envelopes;
each envelope's filename hash, exact canonical signature, identity and concept
uniqueness are verified before rebuilding the feed. Both paths retain ETag CAS.
An upload failure between feed write and checkpoint is recovered by the same
registry path. The listing and envelope reads reserve the existing operation
allowance before use; >64 envelopes fail rather than truncate history.

Tests deliberately prohibit mutable CDN reads and cover old-body/new-ETag
conditions, matching/stale/tampered checkpoints, forged or altered registered
envelopes, duplicate concepts, registry overflow and a competing CAS write.
The Python-to-JavaScript bridge still exercises exact canonical floating-point
bytes. These are disposable fixtures, not additional publication evidence.

At merged main `dcddb9004503d471406cc8353346443aab9d4155`, the live data-only
repair rebuilt all 14 signed envelopes, reused media and reserved zero new
video bytes. Independent promotion run `46037492255` accepted the remaining
six entries with no quarantine: 14 automatic admissions total, including the
two published canary members, and 12 ready unpublished assets. A second live
checkpoint update retained all 14 entries using 12 operation reservations and
zero new video bytes. The factory timer was enabled for that verification. These are
infrastructure and publication proofs, not validated growth.

Subsequently, GPU bus loss occurred during an offline presenter experiment.
The factory's local service was stopped, its timer disabled, and the existing
private `PAUSE` kill switch set. Existing hosted inventory and GitHub
measurement/publication remain available. See the
[incident](instagram-growth-gpu-incident.md) and
[durable retry circuit](instagram-growth-gpu-safety.md).

At 22:50 UTC on November 27, the normal automatic queue independently published
and verified a replenished asset, `abpa-101484b319c52682a75bfdbe`, as ordinary Reel
`18136744558780274`: https://www.instagram.com/reel/DgQyg5vhprW/ .
Workflow `46078737635` succeeded on reviewed main, with the account/AI/feed flags
verified and no individual approval or local GPU work. This leaves eleven
unpublished automatic assets. It establishes normal replenishment-to-publication
behavior while GPU generation is held; it does not establish follower growth.


## Guarded GPU graphics recovery

Production infrastructure #158 separates the preserved incident record from an
unconditional operator PAUSE and explicitly authorizes the independently
validated GPU inference configuration. FlashHead remains disabled. The installed
one-Reel service completed on November 27 at 23:37:29 UTC: fresh GPU narration,
alignment and independent GPU ASR, graphics composition, automatic admission and
hosting all passed in 18.85 seconds, with no quarantines or new driver errors.
Hosted consumer run 46083566751 independently promoted its immutable MP4/envelope.

The original timer was restored and triggered unattended graphics replenishment
at 23:39:39 UTC. Publication run 46083723491 exercised the real existing pipeline
and correctly returned THROTTLED at the rolling 24-hour limit. A new restored-path
Reel is therefore not yet claimed as published; the existing schedule can publish
at a permitted future slot. Growth remains unvalidated and weekly learning keeps
its follower/qualified-owned-outcome requirements. Presenter restoration remains
a separate optional experiment, not a dependency of graphics production.
