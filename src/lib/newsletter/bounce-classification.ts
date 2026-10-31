// Privacy-safe bounce classification for SES Auto Validation.
// No email addresses, tokens, or raw payloads are stored; only validated
// bounceType/bounceSubType are retained.

export const VALID_BOUNCE_TYPES = [
  'Permanent',
  'Transient',
  'Undetermined',
] as const;

export type BounceType = (typeof VALID_BOUNCE_TYPES)[number];

const VALID_TYPE_SET = new Set<string>(VALID_BOUNCE_TYPES);

// SES bounceSubType vocabulary from https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
// plus EmailValidationSuppressed from Auto Validation.
//
// AWS reputation guidance (https://docs.aws.amazon.com/ses/latest/dg/best-practices-bounces.html):
// - Permanent/General, Permanent/NoEmail, Permanent/Suppressed (SES global suppression list) COUNT toward bounce rate.
// - EmailValidationSuppressed, OnAccountSuppressionList, OnTenantSuppressionList, UnsubscribedRecipient do NOT.
export const VALIDATION_SUPPRESSED = 'EmailValidationSuppressed' as const;

export const REPUTATION_HARD_BOUNCE_SUBTYPES = [
  'General',
  'NoEmail',
  'Suppressed',
] as const;

export const REPUTATION_EXCLUDED_SUPPRESSION_SUBTYPES = [
  'EmailValidationSuppressed',
  'OnAccountSuppressionList',
  'OnTenantSuppressionList',
  'UnsubscribedRecipient',
] as const;

// Back-compat aliases for tests/docs that imported the old names.
export const GENUINE_HARD_BOUNCE_SUBTYPES = REPUTATION_HARD_BOUNCE_SUBTYPES;
export const OTHER_SUPPRESSION_SUBTYPES =
  REPUTATION_EXCLUDED_SUPPRESSION_SUBTYPES;

const REPUTATION_SET = new Set<string>(REPUTATION_HARD_BOUNCE_SUBTYPES);
const EXCLUDED_SET = new Set<string>(REPUTATION_EXCLUDED_SUPPRESSION_SUBTYPES);

export type BounceCategory =
  | 'hard_bounce' // Permanent/General, NoEmail, Suppressed — counts toward SES reputation
  | 'validation_suppression' // EmailValidationSuppressed — excluded
  | 'other_suppression' // OnAccountSuppressionList, OnTenantSuppressionList, UnsubscribedRecipient — excluded
  | 'unknown'; // historical NULL subtype or unrecognized subtype — not guessed

export function normalizeBounceType(value: unknown): BounceType | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return VALID_TYPE_SET.has(trimmed) ? (trimmed as BounceType) : null;
}

export function normalizeBounceSubType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  // Conservative: letters, digits, underscore, hyphen only. Covers all AWS values
  // e.g. EmailValidationSuppressed, OnAccountSuppressionList.
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function classifyBounce(
  bounceType: string | null,
  bounceSubType: string | null,
): BounceCategory | null {
  // Only Permanent bounces map to campaign bounced state; Transient is
  // intentionally not a subscriber state change.
  if (bounceType !== 'Permanent') return null;
  if (bounceSubType === null) return 'unknown';
  if (bounceSubType === VALIDATION_SUPPRESSED) return 'validation_suppression';
  if (REPUTATION_SET.has(bounceSubType)) return 'hard_bounce';
  if (EXCLUDED_SET.has(bounceSubType)) return 'other_suppression';
  // Unrecognized subtypes remain unknown — do not guess reputation impact.
  return 'unknown';
}

export function isValidationSuppression(
  bounceType: string | null,
  bounceSubType: string | null,
): boolean {
  return classifyBounce(bounceType, bounceSubType) === 'validation_suppression';
}

export function isGenuineHardBounce(
  bounceType: string | null,
  bounceSubType: string | null,
): boolean {
  return classifyBounce(bounceType, bounceSubType) === 'hard_bounce';
}
