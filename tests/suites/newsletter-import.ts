import assert from 'node:assert/strict';
import {
  assertImportApproval,
  parseImportArguments,
  planSubstackImport,
  importTimestamp,
  assertCancellationEvidence,
  type SubstackImportPlan,
} from '../../src/lib/newsletter/importer.ts';
import { mapSubstackRow } from '../../src/lib/newsletter/domain.ts';

export const importFixture = `Email,Name,Type,Start date,Cancel date,Expiration date,Subscription source (free),Subscription source (paid)
author@example.test,Author,Author,2020-01-01,,,contributor,
free@example.test,Free,Free,2020-02-01,,Paused,import,
paid@example.test,Paid,Yearly Subscriber,2020-03-01,,Paused,subscription-transfer,direct
monthly@example.test,Monthly,Monthly Subscriber,2020-04-01,,Paused,,direct
comp@example.test,Comp,Comp,2020-05-01,,Paused,external,comp
gift@example.test,Gift,Yearly Gift,2020-06-01,,Paused,gift,gift
cancel@example.test,Cancelled,Free,2020-07-01,2024-01-01,Paused,direct,`;

export function planFor(csv: string, evidence = importFixture) {
  return planSubstackImport(csv, evidence);
}

export function approvalFor(plan: SubstackImportPlan) {
  return {
    ...plan.summary,
    rosterFingerprint: plan.rosterFingerprint,
    fileFingerprint: plan.fileFingerprint,
    evidenceFileFingerprint: plan.evidenceFileFingerprint!,
  };
}

export function testSubstackImportSafety() {
  const plan = planFor(importFixture);
  assert.equal(
    importTimestamp('2020-02-01T10:00:00+08:00'),
    '2020-02-01T02:00:00.000Z',
  );
  assert.equal(plan.summary.active, 5);
  assert.equal(plan.summary.cancelled, 1);
  assert.equal(plan.summary.authorRows, 1);
  assert.equal(plan.summary.invalidDates, 0);
  assert.equal(plan.summary.missingSubscriptionDates, 0);
  assert.equal(
    plan.subscribers.find((s) => s.email === 'free@example.test')
      ?.originalSubscribedAt,
    '2020-02-01',
  );
  assert.equal(
    plan.subscribers.find((s) => s.email === 'paid@example.test')
      ?.historicalMetadata.subscriptionSourceFree,
    'subscription-transfer',
  );
  assertImportApproval(plan, approvalFor(plan));
  const lines = importFixture.split('\n');
  const reordered = planFor([lines[0], ...lines.slice(1).reverse()].join('\n'));
  assert.equal(plan.rosterFingerprint, reordered.rosterFingerprint);
  assert.notEqual(plan.fileFingerprint, reordered.fileFingerprint);
  const changedRoster = planFor(
    importFixture.replace('free@example.test', 'different@example.test'),
  );
  assert.equal(changedRoster.summary.active, plan.summary.active);
  assert.throws(
    () => assertImportApproval(changedRoster, approvalFor(plan)),
    /fingerprint/,
  );
  const changedStatus = planFor(
    importFixture.replace('2020-02-01,,Paused', '2020-02-01,2024-01-01,Paused'),
  );
  assert.notEqual(plan.rosterFingerprint, changedStatus.rosterFingerprint);
  assert.throws(
    () => assertImportApproval(changedStatus, approvalFor(plan)),
    /counts/,
  );
  const changedMetadata = planFor(
    importFixture.replace('2020-02-01', '2020-02-02'),
  );
  assert.equal(plan.rosterFingerprint, changedMetadata.rosterFingerprint);
  assert.throws(
    () => assertImportApproval(changedMetadata, approvalFor(plan)),
    /fingerprint/,
  );
  for (const key of [
    'sourceRows',
    'authorRows',
    'active',
    'cancelled',
    'evidenceCancelled',
  ] as const)
    assert.throws(() =>
      assertImportApproval(plan, { ...approvalFor(plan), [key]: -1 }),
    );
  for (const csv of [
    importFixture +
      '\nFREE@example.test,Repeat,Free,2020-01-01,2024-01-01,Paused,direct,',
    importFixture.replace('free@example.test', 'invalid'),
    importFixture.replace('2020-02-01', 'bad-date'),
    importFixture.replace('2020-02-01', ''),
    importFixture.replace('2024-01-01', 'bad-cancellation'),
    importFixture.split('\n')[0],
  ]) {
    const bad = planFor(csv);
    assert.throws(
      () => assertImportApproval(bad, approvalFor(bad)),
      /invalid, duplicate, undated/,
    );
  }
  assert.throws(
    () => planFor('Email,Type\nprivate@example.test,Free'),
    /unsupported/,
  );
  assert.throws(
    () => planFor(importFixture + '\n"private@example.test'),
    (error) => {
      assert.equal(String(error).includes('private@example.test'), false);
      return true;
    },
  );
  assert.equal(
    mapSubstackRow({
      Email: 'source@example.test',
      Type: 'Free',
      'Start date': '2020-01-01',
      'Subscribed at': '2021-01-01',
    })?.originalSubscribedAt,
    '2020-01-01',
  );
  assert.equal(
    plan.subscribers.some((s) => s.email === 'cancel@example.test'),
    false,
  );
  assert.equal(plan.summary.excludedRows, 2);
  assert.equal(plan.summary.evidenceCancelled, 1);
  for (const email of ['cancel@example.test', ' CANCEL@EXAMPLE.TEST ']) {
    const revived = planFor(
      importFixture
        .replace('2024-01-01', '')
        .replace('cancel@example.test', email),
    );
    assert.equal(revived.summary.cancellationEvidenceConflicts, 1);
    assert.equal(
      revived.subscribers.some((s) => s.email === 'cancel@example.test'),
      false,
    );
    assert.throws(
      () => assertImportApproval(revived, approvalFor(revived)),
      /cancelled-conflict/,
    );
  }
  assert.throws(
    () => assertCancellationEvidence(plan, '0'.repeat(64)),
    /evidence fingerprint/,
  );
  assert.throws(
    () =>
      planFor(
        importFixture,
        importFixture.replace('2024-01-01', 'bad-cancellation'),
      ),
    /evidence is invalid/,
  );
  const evidenceFlags = [
    'fixture.csv',
    '--cancellation-evidence',
    'evidence.csv',
    '--expect-evidence-file-sha256',
    plan.evidenceFileFingerprint!,
  ];
  assert.equal(
    parseImportArguments(evidenceFlags, false).evidencePath,
    'evidence.csv',
  );
  assert.throws(() => parseImportArguments(['fixture.csv'], false));
  const flags = [
    'fixture.csv',
    '--expect-source-rows',
    '7',
    '--expect-author',
    '1',
    '--expect-active',
    '5',
    '--expect-cancelled',
    '1',
    '--expect-evidence-cancelled',
    '1',
    '--cancellation-evidence',
    'evidence.csv',
    '--expect-evidence-file-sha256',
    plan.evidenceFileFingerprint!,
    '--expect-roster-sha256',
    plan.rosterFingerprint,
    '--expect-file-sha256',
    plan.fileFingerprint,
    '--confirm-import',
  ];
  assertImportApproval(plan, parseImportArguments(flags, true).approval!);
  for (const args of [
    flags.slice(0, -1),
    [...flags, '--unknown'],
    [...flags, '--confirm-import'],
    [...flags, '--expect-active', '5'],
    flags.filter((v) => v !== '--expect-author'),
    flags.map((v) => (v === '7' ? '7.0' : v)),
  ])
    assert.throws(() => parseImportArguments(args, true));
  assert.throws(() =>
    parseImportArguments(['fixture.csv', '--confirm-import'], false),
  );
}
