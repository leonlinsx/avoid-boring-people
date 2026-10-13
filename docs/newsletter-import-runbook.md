# Substack import operator runbook

This runbook prepares a separately authorized, local-only data migration. It does
not authorize importing, sending email, creating campaigns, changing signup,
cutover, or merging this PR. The owned newsletter is free-only. Historical paid,
comp, gift, transfer, acquisition-source and paused billing values are retained
as metadata; they do not disqualify an uncancelled subscriber. The operator has
confirmed eligibility from the complete export: 5,235 rows, one excluded Author,
5,116 eligible uncancelled subscribers to import and 118 cancelled records to
exclude entirely. Cancelled addresses are never sent to Neon, inserted, or updated,
even as unsubscribed rows. No existing cancellation-address row is modified.

## Preconditions and private approval

- Review and merge the importer PR separately; use that exact reviewed revision.
- Keep the original CSV outside Git, in an operator-only private directory.
  Do not commit it, upload it to GitHub/CI, or paste addresses into reports.
  Securely retain the original full export as immutable cancellation evidence,
  with its approved full-file SHA-256 recorded privately. Never replace it with a
  filtered roster or a later export: a future input must still be checked against
  these cancellations. The commands emit only aggregate counts and whole-file/roster
  fingerprints; no address-level evidence is stored in Neon or Git.
- Use the existing secret-management mechanism for `DATABASE_URL` (or
  `DATABASE_URL_UNPOOLED`), `NEWSLETTER_ENVIRONMENT=production`, and the existing
  `NEWSLETTER_UNSUBSCRIBE_SECRET` (at least 32 bytes). Never rotate the unsubscribe
  secret during the migration. Never paste credentials into a command or report.
- Verify existing newsletter schema migrations through `005` are already applied.
  This change needs no schema migration and must not apply one implicitly.
- **Separate prerequisite: analytics reader role.** Provision/review the dedicated
  SELECT-only analytics connection and its grants separately before operational
  cutover. Verify SELECT access to the newsletter report tables and no write/DDL
  capability; configure the existing report/health-check secret through the
  established mechanism. This PR neither modifies that role nor authorizes its
  creation or grants. Never give that reader importer write privileges. Use a
  separately authorized existing writer connection for the future import.
- Obtain explicit operator approval of the private eligible roster, input/roster/evidence fingerprints,
  exact source/Author/active/cancelled/evidence-cancelled counts and target database. Approval of
  this PR or this runbook does not constitute production-import approval.

## Read-only preflight

From the reviewed checkout, set `SUBSTACK_CSV` to the candidate full CSV and
`SUBSTACK_CANCELLATION_EVIDENCE` to the securely retained original full export.
For this migration they are the same original file. Set
`APPROVED_EVIDENCE_SHA256` from the privately approved original-file fingerprint
recorded during assessment. Do not obtain a new approval hash from a changed
evidence file or silently replace the retained original:

```sh
npm run newsletter:import:dry-run -- "$SUBSTACK_CSV" \
  --cancellation-evidence "$SUBSTACK_CANCELLATION_EVIDENCE" \
  --expect-evidence-file-sha256 "$APPROVED_EVIDENCE_SHA256"
npm run newsletter:import:preflight -- "$SUBSTACK_CSV" \
  --cancellation-evidence "$SUBSTACK_CANCELLATION_EVIDENCE" \
  --expect-evidence-file-sha256 "$APPROVED_EVIDENCE_SHA256"
```

The second command uses one SELECT in a READ ONLY transaction. It sends nothing,
creates no campaigns/recipients and writes no database rows. Prefer an existing
SELECT-only connection for this step. Do not run the analytics email commands.

Require these results for the assessed export:

| Field                                                                       |        Expected |
| --------------------------------------------------------------------------- | --------------: |
| sourceRows                                                                  |            5235 |
| authorRows                                                                  |               1 |
| cancelled / evidenceCancelled                                               |             118 |
| excludedRows                                                                |             119 |
| mappedRows / uniqueEmails (locally validated, not imported)                 |            5234 |
| active (eligible import roster)                                             |            5116 |
| invalidRows / duplicateEmails / missingSubscriptionDates / invalidDates     |               0 |
| cancellationEvidenceConflicts                                               |               0 |
| existingSubscribers                                                         |               3 |
| existingPending / existingActive / existingSuppressed                       |          1 each |
| collisions / unexpectedCollisions / pendingCollisions                       |               0 |
| newActive / newSuppressed                                                   |        5116 / 0 |
| predictedTotalSubscribers / predictedTotalActive / predictedTotalSuppressed | 5119 / 5117 / 1 |
| inputValid / ready                                                          |            true |

Stop on unexpected changes; reconcile and obtain new approval. `ready` describes
input and collision checks, not authorization, writer permissions, or sending
readiness. Every unexpected collision, including a pending or already-suppressed
website subscriber, refuses the entire import. There is no collision override.
Retries are recognized only for records with the same exact export identity,
Substack source, import timestamp and consent provenance; pending rows always
refuse. Old imports or a different export require separate review rather than
being silently merged.

The roster fingerprint is SHA-256 of UTF-8 JSON with the exact shape
`{"version":2,"roster":[["normalized-eligible-address","active"],...]}`.
Addresses are trimmed/lowercased, consolidated, sorted by JavaScript string
comparison; the Author and all cancellations are excluded. Previous version-1
approval fingerprints are invalid for this revised import. Cancellation wins during duplicate
consolidation, but production approval rejects all duplicates and invalid or
missing subscription/cancellation dates. Reordering rows or changing address
case preserves the roster fingerprint; changing an address or status changes it.
The second SHA-256 binds the exact UTF-8 CSV contents, including metadata and row
order. Save the approved fingerprints privately; do not substitute fresh hashes
without reviewing and approving the changed export. An evidence file with a
changed fingerprint refuses every CLI mode. Invalid evidence also refuses.
If a future input presents any retained cancellation as uncancelled (including
case/whitespace variants), it is excluded from the proposed roster and the entire
import fails with `cancellationEvidenceConflicts > 0`. The retained full export
and its approved fingerprint must remain available for every retry/future file;
no database suppression table or address hash store is added.

## Future import — only after separate authorization

Assign `APPROVED_ROSTER_SHA256` and `APPROVED_FILE_SHA256` from the privately
reviewed preflight, then rerun the read-only preflight immediately before import.
Only an explicitly authorized operator may execute:

```sh
npm run newsletter:import -- "$SUBSTACK_CSV" \
  --expect-source-rows 5235 \
  --expect-author 1 \
  --expect-active 5116 \
  --expect-cancelled 118 \
  --expect-evidence-cancelled 118 \
  --cancellation-evidence "$SUBSTACK_CANCELLATION_EVIDENCE" \
  --expect-evidence-file-sha256 "$APPROVED_EVIDENCE_SHA256" \
  --expect-roster-sha256 "$APPROVED_ROSTER_SHA256" \
  --expect-file-sha256 "$APPROVED_FILE_SHA256" \
  --confirm-import
```

All flags are mandatory. Unknown, duplicate, missing or malformed arguments,
changed counts/hashes, invalid records and unsupported required columns refuse
before writes. Do not execute the command in CI, a deploy hook or a scheduled job.

The command locks the subscriber table and checks collision identity inside one
READ COMMITTED transaction. The lock briefly blocks other subscriber mutations;
lock wait is bounded at five seconds and each statement at sixty seconds. Any
statement failure rolls back the entire import. A response lost after commit is
an uncertain outcome: reconcile before retrying, because all rows may already
have committed. The command never automatically retries.

## Verification and recovery

After an authorized run, repeat the SELECT-only preflight. Without intervening
subscriber activity, expect 5,116 resumable rows, zero new rows and unexpected
collisions, and an imported roster of 5,116 active / zero suppressed. The 118
cancellations remain local exclusions. The overall database would contain 5,119
subscribers: 5,117 active, one unsubscribed and one pending.
The three pre-existing subscribers remain untouched. No campaigns or campaign
recipients should have been created by the import.

If the transaction failed before commit, no partial rows remain. Rerun only the
same approved file and flags after resolving the failure. If all rows committed
but the reply was lost, the same command is safe after reconciliation: existing
IDs, unsubscribe hashes, consent, first-touch attribution and original dates
remain unchanged. Later unsubscribes, bounces and complaints remain suppressed;
therefore the input's approved active count can exceed the current resulting
active count. Never restore the input active count by reactivating readers.
Every cancellation is excluded from all SQL payloads, including read-only
queries. The import has no UPDATE path: `ON CONFLICT DO NOTHING` leaves matching
imported rows unchanged, including status and confirmation credentials. Ordinary
exact retries report `affectedRows: 0`. Unexpected collisions still refuse
atomically; this does not authorize modifying a pre-existing cancelled address.

Do not delete rows, truncate tables or reset suppressions as recovery. Investigate
unexpected collisions privately and obtain separate approval for any different
migration. Import errors intentionally omit raw parser/driver messages because
those can contain addresses; use aggregate preflight results and synthetic local
reproductions instead of logging production exception details.

Import completion does not authorize sending. Any real campaign requires
separate approval of the exact recipient roster, article and count. There are no
test-email steps in this runbook.

## Local validation without production data

Run `npm test`, `npm run lint`, `npm run build` and the repository Python suite.
The importer SQL integration test uses only synthetic addresses and a disposable
Postgres cluster. It never reads `DATABASE_URL` or invokes SES:

```sh
TASK_PG_BIN="$(pg_config --bindir)"
TASK_PG_DIR="$(mktemp -d /tmp/newsletter-lifecycle-pg-XXXXXXXX)"
"$TASK_PG_BIN/initdb" -D "$TASK_PG_DIR/data" -A trust -U "$(id -un)"
"$TASK_PG_BIN/pg_ctl" -D "$TASK_PG_DIR/data" -l "$TASK_PG_DIR/server.log" \
  -o "-k $TASK_PG_DIR -p 55439 -h ''" start
trap '"$TASK_PG_BIN/pg_ctl" -D "$TASK_PG_DIR/data" -m fast stop' EXIT
NEWSLETTER_TEST_PG_SOCKET="$TASK_PG_DIR" PGUSER="$(id -un)" \
  TS_NODE_PROJECT=tsconfig.test.json \
  node --import ./tests/register-loaders.mjs --loader ts-node/esm \
  tests/newsletter-import-postgres.ts
NEWSLETTER_TEST_PG_SOCKET="$TASK_PG_DIR" PGUSER="$(id -un)" \
  TS_NODE_PROJECT=tsconfig.test.json \
  node --import ./tests/register-loaders.mjs --loader ts-node/esm \
  tests/newsletter-lifecycle-postgres.ts
```

Coverage includes historical eligibility, dates, approval changes, cancellations,
zero cancelled-address inserts/updates (including stale credentials), retained
evidence conflicts, every existing status, an unexpected collision after
preflight, atomic rollback beyond the former batch size, uncertain commit
acknowledgment, exact retries and subsequent opt-outs. This harness is opt-in,
like the repository's existing disposable lifecycle tests.
