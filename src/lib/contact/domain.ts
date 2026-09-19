// Validation, limits, and copy for a contact note.
//
// This module is imported by the API handler and by the page that renders the
// form, so it must stay free of Node-only APIs. That is also why the copy lives
// here: the browser shows the server's message verbatim rather than keeping a
// second set of strings in the script.

export const CONTACT_EMAIL = 'contact@leonlins.com';

// The acceptance copy is shared rather than duplicated in the browser: a
// response that cannot be read must still report a sent note as sent.
export const CONTACT_SUCCESS_MESSAGE = 'Thanks — your note was sent.';

export const MAX_CONTACT_NAME_LENGTH = 100;
export const MAX_CONTACT_EMAIL_LENGTH = 254;
export const MAX_CONTACT_MESSAGE_LENGTH = 2000;
export const MAX_CONTACT_SOURCE_LENGTH = 200;

// Recorded when the browser sent no usable page reference. The page a note came
// from is context for the reply, not a conversion signal, so an absent value is
// reported as unknown rather than guessed at.
export const UNKNOWN_SOURCE_PAGE = 'unknown';

export type ContactField = 'name' | 'email' | 'message';

export type ContactErrorCode =
  | 'name_required'
  | 'name_too_long'
  | 'email_required'
  | 'email_invalid'
  | 'email_too_long'
  | 'message_required'
  | 'message_too_long'
  | 'verification_required'
  | 'verification_failed'
  | 'invalid_request'
  | 'too_large'
  | 'cross_site'
  | 'unavailable'
  | 'delivery_failed'
  | 'send_unconfirmed';

// Each error names the field the browser should focus, when one applies. The
// wording stays calm and actionable: the reader is being asked to retype
// something, not accused of anything.
export const contactErrors: Record<
  ContactErrorCode,
  { message: string; field: ContactField | null; status: number }
> = {
  name_required: {
    message: 'Please add a name, so I know who I am replying to.',
    field: 'name',
    status: 400,
  },
  name_too_long: {
    message: `Please keep the name under ${MAX_CONTACT_NAME_LENGTH} characters.`,
    field: 'name',
    status: 400,
  },
  email_required: {
    message: 'Please add an email address, so I can reply.',
    field: 'email',
    status: 400,
  },
  email_invalid: {
    message: 'That email address does not look right. Please check it.',
    field: 'email',
    status: 400,
  },
  email_too_long: {
    message: 'That email address is too long to use.',
    field: 'email',
    status: 400,
  },
  message_required: {
    message: 'Please write a short message.',
    field: 'message',
    status: 400,
  },
  message_too_long: {
    message: `Please keep the message under ${MAX_CONTACT_MESSAGE_LENGTH} characters.`,
    field: 'message',
    status: 400,
  },
  // Client-only: the browser checks for a token before submitting, so the API
  // never returns this code. It lives here so the two surfaces share one string.
  // The address is named because a reader whose verification script never loads
  // would otherwise be told, forever, to wait for something that cannot finish.
  verification_required: {
    message: `Please wait for the verification check to finish, then send. If it never finishes, email me at ${CONTACT_EMAIL}.`,
    field: null,
    status: 400,
  },
  verification_failed: {
    message: `Verification did not pass. Please try again, or email me at ${CONTACT_EMAIL}.`,
    field: null,
    status: 400,
  },
  invalid_request: {
    message: `That request could not be read. Please try again, or email me at ${CONTACT_EMAIL}.`,
    field: null,
    status: 400,
  },
  too_large: {
    message: `That note is larger than this form can send. Please email me at ${CONTACT_EMAIL}.`,
    field: null,
    status: 413,
  },
  cross_site: {
    message: 'Notes are only accepted from this site.',
    field: null,
    status: 403,
  },
  unavailable: {
    message: `The note form is temporarily unavailable. Please email me at ${CONTACT_EMAIL}.`,
    field: null,
    status: 503,
  },
  delivery_failed: {
    message: `Your note could not be sent. Please email me at ${CONTACT_EMAIL}.`,
    field: null,
    status: 503,
  },
  // Client-only: what a failed fetch can mean is genuinely unknown. The request
  // may never have left, or it may have been stored and answered while the reply
  // was lost. Saying "try again" is what stores the same note twice, so the
  // reader is told not to resend and given the address instead.
  send_unconfirmed: {
    message: `The form did not hear back. Your note may already have reached me, so please do not send it again — email me at ${CONTACT_EMAIL} if you want to be sure.`,
    field: null,
    status: 503,
  },
};

export type ContactNoteInput = {
  name: string;
  email: string;
  message: string;
};

export type ContactValidation =
  | { ok: true; value: ContactNoteInput }
  | { ok: false; error: ContactErrorCode };

// Whitespace is collapsed in the name because it lands in an email subject, and
// a subject with newlines or runs of spaces reads as broken mail. Control
// characters are dropped everywhere except tab and newline: they cannot be typed
// deliberately and only ever signal a broken or hostile client. C1 controls are
// included with C0 — notably U+0085 NEL, which some mail software treats as a
// line break but JavaScript's `\s` does not cover.
const FORBIDDEN_CONTROL_CHARACTERS =
  // eslint-disable-next-line no-control-regex -- stripping C0/C1/DEL controls is exactly what this sanitizer is for.
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

export function normalizeContactName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(FORBIDDEN_CONTROL_CHARACTERS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The address is kept exactly as typed, including case: unlike a subscriber
// address, which the newsletter normalizes into a stable identity key, this one
// is only ever used to reply to one person. Rewriting it could change who
// receives the reply.
export function normalizeContactEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(FORBIDDEN_CONTROL_CHARACTERS, '').trim();
}

export function normalizeContactMessage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(FORBIDDEN_CONTROL_CHARACTERS, '')
    .trim();
}

// Deliberately conservative: a single @, no whitespace, and a dot in the domain.
// Anything cleverer rejects addresses that work.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactNote(input: {
  name: unknown;
  email: unknown;
  message: unknown;
}): ContactValidation {
  const name = normalizeContactName(input.name);
  const email = normalizeContactEmail(input.email);
  const message = normalizeContactMessage(input.message);

  if (!name) return { ok: false, error: 'name_required' };
  if (name.length > MAX_CONTACT_NAME_LENGTH)
    return { ok: false, error: 'name_too_long' };
  if (!email) return { ok: false, error: 'email_required' };
  if (email.length > MAX_CONTACT_EMAIL_LENGTH)
    return { ok: false, error: 'email_too_long' };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, error: 'email_invalid' };
  if (!message) return { ok: false, error: 'message_required' };
  if (message.length > MAX_CONTACT_MESSAGE_LENGTH)
    return { ok: false, error: 'message_too_long' };

  return { ok: true, value: { name, email, message } };
}

// Only the path is kept: the query string and the referring site are not part of
// the note, and a path that could not have come from this site's own pages is
// reported as unknown instead of being stored as if it meant something.
const SOURCE_PAGE_SHAPE = /^\/(?:[A-Za-z0-9._~%-]+\/?)*$/;

export function normalizeSourcePage(value: unknown): string {
  if (typeof value !== 'string') return UNKNOWN_SOURCE_PAGE;
  const path = value.trim();
  if (!path || path.length > MAX_CONTACT_SOURCE_LENGTH)
    return UNKNOWN_SOURCE_PAGE;
  if (!SOURCE_PAGE_SHAPE.test(path)) return UNKNOWN_SOURCE_PAGE;
  return path;
}
