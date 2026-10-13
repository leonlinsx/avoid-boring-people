import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { mapSubstackRow, type ImportedSubscriber } from './domain.ts';

export type ConsolidatedSubscriber = ImportedSubscriber & {
  originalSubscribedAt: string | null;
  legacySubstackCancelDate: string | null;
};

export type SubstackImportPlan = {
  subscribers: ConsolidatedSubscriber[];
  cancellations: ConsolidatedSubscriber[];
  evidenceFileFingerprint: string | null;
  rosterFingerprint: string;
  fileFingerprint: string;
  summary: {
    sourceRows: number;
    authorRows: number;
    invalidRows: number;
    missingSubscriptionDates: number;
    invalidDates: number;
    excludedRows: number;
    mappedRows: number;
    uniqueEmails: number;
    duplicateEmails: number;
    active: number;
    cancelled: number;
    evidenceCancelled: number;
    cancellationEvidenceConflicts: number;
  };
};

function earlierTimestamp(
  first: string | null,
  second: string | null,
): string | null {
  if (!first) return second;
  if (!second) return first;
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  if (Number.isNaN(firstTime)) return second;
  if (Number.isNaN(secondTime)) return first;
  return firstTime <= secondTime ? first : second;
}

function mergeSubscriber(
  current: ConsolidatedSubscriber,
  next: ImportedSubscriber,
): ConsolidatedSubscriber {
  const suppressed =
    current.status === 'unsubscribed' || next.status === 'unsubscribed';
  return {
    ...current,
    name: current.name ?? next.name,
    status: suppressed ? 'unsubscribed' : 'active',
    originalSubscribedAt: earlierTimestamp(
      current.originalSubscribedAt,
      next.originalSubscribedAt,
    ),
    legacySubstackType: current.legacySubstackType ?? next.legacySubstackType,
    legacySubstackCancelDate:
      current.legacySubstackCancelDate ?? next.legacySubstackCancelDate,
  };
}

function parseExport(csv: string): SubstackImportPlan {
  let rows: Record<string, string>[];
  try {
    rows = parse(csv, {
      bom: true,
      columns: (headers: string[]) => {
        if (
          new Set(headers).size !== headers.length ||
          !headers.some((h) => ['Email', 'email'].includes(h)) ||
          !headers.some((h) => ['Type', 'type'].includes(h)) ||
          !headers.some((h) =>
            ['Cancel date', 'Cancel Date', 'cancel_date'].includes(h),
          ) ||
          !headers.some((h) =>
            [
              'Start date',
              'Subscribed at',
              'Subscription date',
              'Created at',
            ].includes(h),
          )
        )
          throw new Error('Unsupported export columns');
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } catch {
    throw new Error('Substack export is malformed or has unsupported columns.');
  }
  const authorRows = rows.filter(
    (row) => (row.Type ?? row.type)?.trim().toLowerCase() === 'author',
  ).length;
  const mapped = rows
    .map(mapSubstackRow)
    .filter((row): row is ImportedSubscriber => row !== null);
  const byEmail = new Map<string, ConsolidatedSubscriber>();
  for (const subscriber of mapped) {
    const current = byEmail.get(subscriber.email);
    byEmail.set(
      subscriber.email,
      current ? mergeSubscriber(current, subscriber) : subscriber,
    );
  }
  const consolidated = [...byEmail.values()].sort((left, right) =>
    left.email < right.email ? -1 : left.email > right.email ? 1 : 0,
  );
  const cancellations = consolidated.filter((s) => s.status === 'unsubscribed');
  const subscribers = consolidated.filter((s) => s.status === 'active');
  const active = subscribers.length;
  return {
    subscribers,
    cancellations,
    evidenceFileFingerprint: null,
    rosterFingerprint: createHash('sha256')
      .update(
        JSON.stringify({
          version: 2,
          roster: subscribers.map((s) => [s.email, s.status]),
        }),
      )
      .digest('hex'),
    fileFingerprint: createHash('sha256').update(csv, 'utf8').digest('hex'),
    summary: {
      sourceRows: rows.length,
      authorRows,
      invalidRows: rows.length - authorRows - mapped.length,
      missingSubscriptionDates: mapped.filter((s) => !s.originalSubscribedAt)
        .length,
      invalidDates: mapped.filter(
        (s) =>
          (s.originalSubscribedAt &&
            !importTimestamp(s.originalSubscribedAt)) ||
          (s.legacySubstackCancelDate &&
            !importTimestamp(s.legacySubstackCancelDate)),
      ).length,
      excludedRows:
        rows.length -
        mapped.length +
        mapped.filter((s) => s.status === 'unsubscribed').length,
      mappedRows: mapped.length,
      uniqueEmails: consolidated.length,
      duplicateEmails: mapped.length - consolidated.length,
      active,
      cancelled: cancellations.length,
      evidenceCancelled: 0,
      cancellationEvidenceConflicts: 0,
    },
  };
}

export function importTimestamp(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

// Both files remain private. Cancellation evidence is checked in memory and is
// never included in the database payload, including read-only reconciliation.
export function planSubstackImport(
  csv: string,
  evidenceCsv: string,
): SubstackImportPlan {
  const plan = parseExport(csv);
  const evidence = parseExport(evidenceCsv);
  if (
    evidence.summary.invalidRows ||
    evidence.summary.duplicateEmails ||
    evidence.summary.missingSubscriptionDates ||
    evidence.summary.invalidDates ||
    evidence.summary.sourceRows === 0
  )
    throw new Error(
      'Cancellation evidence is invalid or incomplete. Import refused.',
    );
  const excluded = new Set(evidence.cancellations.map((s) => s.email));
  plan.evidenceFileFingerprint = evidence.fileFingerprint;
  plan.summary.evidenceCancelled = evidence.cancellations.length;
  plan.summary.cancellationEvidenceConflicts = plan.subscribers.filter((s) =>
    excluded.has(s.email),
  ).length;
  // A conflict is excluded from the proposed roster and also refuses approval.
  plan.subscribers = plan.subscribers.filter((s) => !excluded.has(s.email));
  plan.summary.active = plan.subscribers.length;
  plan.summary.excludedRows += plan.summary.cancellationEvidenceConflicts;
  plan.rosterFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        version: 2,
        roster: plan.subscribers.map((s) => [s.email, s.status]),
      }),
    )
    .digest('hex');
  return plan;
}

export type ImportApproval = {
  sourceRows: number;
  authorRows: number;
  active: number;
  cancelled: number;
  evidenceCancelled: number;
  rosterFingerprint: string;
  fileFingerprint: string;
  evidenceFileFingerprint: string;
};

export function assertImportApproval(
  plan: SubstackImportPlan,
  approval: ImportApproval,
): void {
  if (
    plan.summary.invalidRows ||
    plan.summary.duplicateEmails ||
    plan.summary.missingSubscriptionDates ||
    plan.summary.invalidDates ||
    plan.summary.active === 0 ||
    plan.summary.cancellationEvidenceConflicts ||
    !plan.evidenceFileFingerprint
  )
    throw new Error(
      'Export has invalid, duplicate, undated, cancelled-conflict or empty subscriber records. Import refused.',
    );
  for (const key of [
    'sourceRows',
    'authorRows',
    'active',
    'cancelled',
    'evidenceCancelled',
  ] as const) {
    if (
      !Number.isSafeInteger(approval[key]) ||
      approval[key] < 0 ||
      plan.summary[key] !== approval[key]
    )
      throw new Error('Approved import counts do not match. Import refused.');
  }
  for (const key of [
    'rosterFingerprint',
    'fileFingerprint',
    'evidenceFileFingerprint',
  ] as const) {
    if (!/^[a-f0-9]{64}$/.test(approval[key]) || approval[key] !== plan[key])
      throw new Error(
        'Approved import fingerprint does not match. Import refused.',
      );
  }
}

export function parseImportArguments(
  args: string[],
  apply: boolean,
): {
  inputPath: string;
  evidencePath: string;
  expectedEvidenceFingerprint: string;
  approval?: ImportApproval;
} {
  const inputPath = args[0];
  if (!inputPath || inputPath.startsWith('--'))
    throw new Error('Private CSV path is required.');
  const names = [
    '--expect-source-rows',
    '--expect-author',
    '--expect-active',
    '--expect-cancelled',
    '--expect-evidence-cancelled',
    '--expect-roster-sha256',
    '--expect-file-sha256',
    '--cancellation-evidence',
    '--expect-evidence-file-sha256',
  ];
  const values = new Map<string, string>();
  let confirmed = false;
  for (let i = 1; i < args.length; i++) {
    const name = args[i];
    if (apply && name === '--confirm-import' && !confirmed) {
      confirmed = true;
      continue;
    }
    if (
      !names.includes(name) ||
      values.has(name) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error('Unknown, duplicate or missing import argument.');
    values.set(name, args[++i]);
  }
  const required = apply
    ? names
    : ['--cancellation-evidence', '--expect-evidence-file-sha256'];
  if (
    (apply && !confirmed) ||
    required.some((name) => !values.has(name)) ||
    (!apply && values.size !== required.length)
  )
    throw new Error(
      'Required evidence arguments, expected counts, approved fingerprints and explicit import confirmation are missing.',
    );
  const evidencePath = values.get('--cancellation-evidence')!;
  const expectedEvidenceFingerprint = values.get(
    '--expect-evidence-file-sha256',
  )!;
  if (!/^[a-f0-9]{64}$/.test(expectedEvidenceFingerprint))
    throw new Error('Approved evidence fingerprint is required.');
  if (!apply) return { inputPath, evidencePath, expectedEvidenceFingerprint };
  const count = (name: string) => {
    const value = values.get(name)!;
    if (
      !/^(0|[1-9][0-9]*)$/.test(value) ||
      !Number.isSafeInteger(Number(value))
    )
      throw new Error('Expected counts must be non-negative integers.');
    return Number(value);
  };
  return {
    inputPath,
    evidencePath,
    expectedEvidenceFingerprint,
    approval: {
      sourceRows: count(names[0]),
      authorRows: count(names[1]),
      active: count(names[2]),
      cancelled: count(names[3]),
      evidenceCancelled: count(names[4]),
      rosterFingerprint: values.get(names[5])!,
      fileFingerprint: values.get(names[6])!,
      evidenceFileFingerprint: expectedEvidenceFingerprint,
    },
  };
}

export function assertCancellationEvidence(
  plan: SubstackImportPlan,
  expected: string,
): void {
  if (plan.evidenceFileFingerprint !== expected)
    throw new Error(
      'Retained cancellation evidence fingerprint changed. Import refused.',
    );
}
