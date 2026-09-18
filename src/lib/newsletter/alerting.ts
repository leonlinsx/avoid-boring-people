// Failure-only operational alerts for the newsletter pipeline.
//
// One structured `newsletter_alert` line per failure, in the same log style as
// the rest of the newsletter code: greppable and machine-parseable, with no new
// service, dashboard, or paging integration. Nothing is sent and nothing is
// retried here; the mechanism that surfaces a line is whatever already watches
// the process that emitted it, and a scheduled job reports its own failures by
// exiting non-zero.
//
// Only the fields below are accepted: `kind` and `reason` come from the closed
// vocabularies declared here and `errorName` is an error's name, so an
// identifier — an email address, a confirmation token, a provider body — cannot
// reach a log by accident. What the call sites must not pass instead is the
// error's message, because messages quote the data that caused them.

export const newsletterAlertKinds = [
  /** `/api/newsletter/subscribe` failed after the request body was understood. */
  'signup_pipeline_failure',
  /** An authenticated SES/SNS event could not be turned into subscriber state. */
  'ses_event_ingestion_failure',
  /**
   * The analytics job could not collect metrics (`reason: 'collection'`) or
   * found a deliverability condition it must not report as healthy
   * (`reason: 'threshold'`).
   */
  'analytics_job_failure',
] as const;

export type NewsletterAlertKind = (typeof newsletterAlertKinds)[number];

/**
 * The closed reason vocabulary. Keeping this a union rather than a free string
 * means a new failure stage cannot reach a log line without being named here
 * first, which is what keeps the line free of identifiers.
 */
export type NewsletterAlertReason =
  /** SES/SNS ingestion is unusable because the topic ARN is unset. */
  | 'configuration'
  /** An authenticated SES event could not be turned into subscriber state. */
  | 'processing'
  /** An SES event carries no message id, so it cannot be matched to a send. */
  | 'uncorrelated'
  /** The analytics check found a condition it must not report as healthy. */
  | 'threshold'
  /** The analytics job could not collect its metrics at all. */
  | 'collection';

export type NewsletterAlertFields = {
  /** Where the failure happened, from the vocabulary above. */
  reason?: NewsletterAlertReason;
  /** The thrown error's name. Never its message: messages carry payload data. */
  errorName?: string;
};

export function newsletterAlert(
  kind: NewsletterAlertKind,
  fields: NewsletterAlertFields = {},
): void {
  console.error('newsletter_alert', {
    kind,
    ...(fields.reason === undefined ? {} : { reason: fields.reason }),
    ...(fields.errorName === undefined ? {} : { errorName: fields.errorName }),
  });
}
