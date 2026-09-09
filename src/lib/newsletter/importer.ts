import { parse } from 'csv-parse/sync';
import { mapSubstackRow, type ImportedSubscriber } from './domain.ts';

export type ConsolidatedSubscriber = ImportedSubscriber & {
  originalSubscribedAt: string | null;
  legacySubstackCancelDate: string | null;
};

export type SubstackImportPlan = {
  subscribers: ConsolidatedSubscriber[];
  summary: {
    sourceRows: number;
    excludedRows: number;
    mappedRows: number;
    uniqueEmails: number;
    duplicateEmails: number;
    active: number;
    suppressed: number;
  };
};

function earlierTimestamp(first: string | null, second: string | null): string | null {
  if (!first) return second;
  if (!second) return first;
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  if (Number.isNaN(firstTime)) return second;
  if (Number.isNaN(secondTime)) return first;
  return firstTime <= secondTime ? first : second;
}

function mergeSubscriber(current: ConsolidatedSubscriber, next: ImportedSubscriber): ConsolidatedSubscriber {
  const suppressed = current.status === 'unsubscribed' || next.status === 'unsubscribed';
  return {
    ...current,
    name: current.name ?? next.name,
    status: suppressed ? 'unsubscribed' : 'active',
    originalSubscribedAt: earlierTimestamp(current.originalSubscribedAt, next.originalSubscribedAt),
    legacySubstackType: current.legacySubstackType ?? next.legacySubstackType,
    legacySubstackCancelDate: current.legacySubstackCancelDate ?? next.legacySubstackCancelDate,
  };
}

export function planSubstackImport(csv: string): SubstackImportPlan {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  const mapped = rows.map(mapSubstackRow).filter((row): row is ImportedSubscriber => row !== null);
  const byEmail = new Map<string, ConsolidatedSubscriber>();
  for (const subscriber of mapped) {
    const current = byEmail.get(subscriber.email);
    byEmail.set(subscriber.email, current ? mergeSubscriber(current, subscriber) : subscriber);
  }
  const subscribers = [...byEmail.values()].sort((left, right) => left.email.localeCompare(right.email));
  const active = subscribers.filter((subscriber) => subscriber.status === 'active').length;
  return {
    subscribers,
    summary: {
      sourceRows: rows.length,
      excludedRows: rows.length - mapped.length,
      mappedRows: mapped.length,
      uniqueEmails: subscribers.length,
      duplicateEmails: mapped.length - subscribers.length,
      active,
      suppressed: subscribers.length - active,
    },
  };
}

export function importTimestamp(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
