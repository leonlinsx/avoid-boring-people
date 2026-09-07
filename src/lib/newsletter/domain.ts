export const subscriberStatuses = [
  'pending',
  'active',
  'unsubscribed',
  'bounced',
  'complained',
] as const;

export type SubscriberStatus = (typeof subscriberStatuses)[number];

const suppressedStatuses = new Set<SubscriberStatus>([
  'unsubscribed',
  'bounced',
  'complained',
]);

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function isSuppressed(status: SubscriberStatus): boolean {
  return suppressedStatuses.has(status);
}

export function canAutomaticallyTransition(
  from: SubscriberStatus,
  to: SubscriberStatus,
): boolean {
  if (from === 'pending' && to === 'active') return true;
  if (from === 'active' && suppressedStatuses.has(to)) return true;
  return false;
}

export type ImportedSubscriber = {
  email: string;
  name: string | null;
  status: 'active' | 'unsubscribed';
  originalSubscribedAt: string | null;
  legacySubstackType: string | null;
  legacySubstackCancelDate: string | null;
  consentProvenance: 'substack_export';
};

type SubstackRow = Record<string, string | undefined>;

function value(row: SubstackRow, names: string[]): string | null {
  for (const name of names) {
    const candidate = row[name]?.trim();
    if (candidate) return candidate;
  }
  return null;
}

export function mapSubstackRow(row: SubstackRow): ImportedSubscriber | null {
  const email = normalizeEmail(value(row, ['Email', 'email']) ?? '');
  const type = value(row, ['Type', 'type']);
  if (!email || type?.toLowerCase() === 'author') return null;

  const cancelDate = value(row, ['Cancel date', 'Cancel Date', 'cancel_date']);
  return {
    email,
    name: value(row, ['Name', 'name']),
    status: cancelDate ? 'unsubscribed' : 'active',
    originalSubscribedAt: value(row, [
      'Subscribed at',
      'Subscription date',
      'Created at',
    ]),
    legacySubstackType: type,
    legacySubstackCancelDate: cancelDate,
    consentProvenance: 'substack_export',
  };
}
