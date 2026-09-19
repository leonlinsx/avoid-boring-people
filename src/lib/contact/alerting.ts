// Failure-only operational alerts for the contact flow.
//
// One structured `contact_alert` line per failure, in the same style as the
// newsletter's alerting: greppable, machine-parseable, and dependent on no new
// service, dashboard, or paging integration. Nothing here retries a note; the
// row itself is what makes an unfinished note findable later.
//
// Only the closed vocabularies below are accepted, so a name, an email address,
// or the message body cannot reach a log by accident. Call sites must never pass
// an error message either, because messages quote the data that caused them.

export const contactAlertKinds = [
  /** The note could not be stored, so nothing about it was kept. */
  'submission_store_failure',
  /** The note was stored, but the notification email could not be sent. */
  'notification_failure',
  /** The notification was sent, but the row could not be marked as delivered. */
  'delivery_record_failure',
  /** The note was stored, but the optional Lin Check handoff failed. */
  'lin_check_failure',
] as const;

export type ContactAlertKind = (typeof contactAlertKinds)[number];

export type ContactAlertFields = {
  /** The thrown error's name. Never its message: messages carry payload data. */
  errorName?: string;
};

export function contactAlert(
  kind: ContactAlertKind,
  fields: ContactAlertFields = {},
): void {
  console.error('contact_alert', {
    kind,
    ...(fields.errorName === undefined ? {} : { errorName: fields.errorName }),
  });
}
