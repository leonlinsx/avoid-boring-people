import { normalizeEmail } from './domain.ts';

export function allowedTestRecipients(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map(normalizeEmail)
      .filter((email): email is string => email !== null),
  );
}

export function assertAllowedTestRecipient(recipient: string, allowlist: string | undefined): string {
  const normalized = normalizeEmail(recipient);
  if (!normalized || !allowedTestRecipients(allowlist).has(normalized)) {
    throw new Error('Recipient is not in NEWSLETTER_TEST_RECIPIENTS. No email was sent.');
  }
  return normalized;
}
