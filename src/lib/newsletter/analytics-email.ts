// Author-only delivery of the newsletter analytics report.
//
// Producing the report is read-only; emailing it is not, so the send stays a
// separate action. Both entry points in `scripts/newsletter/` resolve their
// recipient and SES settings here, so the policy cannot drift: a report may
// only ever go from newsletter@leonlins.com to a single address that is already
// on the `NEWSLETTER_TEST_RECIPIENTS` allowlist. Subscribers are never
// addressed, and no entry point accepts a recipient that is off that allowlist.

import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import {
  DEFAULT_REPORT_WINDOW_DAYS,
  validateReportWindow,
} from './analytics.ts';
import { NEWSLETTER_FROM, NEWSLETTER_REPLY_TO } from './email.ts';
import { assertAllowedTestRecipient } from './test-send.ts';

/** The monthly author report covers one month of activity. */
export const AUTHOR_REPORT_WINDOW_DAYS = 30;

/**
 * The single address the scheduled author report may use. It is configuration
 * rather than an argument precisely so an unattended run has one fixed target.
 */
export const AUTHOR_REPORT_RECIPIENT_VARIABLE = 'NEWSLETTER_AUTHOR_REPORT_TO';

export const ANALYTICS_EMAIL_USAGE =
  'Usage: npm run newsletter:analytics:email -- --to <allowlisted-address> --confirm-send [--days <1-365>]';

export const AUTHOR_REPORT_USAGE =
  'Usage: npm run newsletter:analytics:author -- [--dry-run]';

function option(
  args: string[],
  name: string,
): { present: boolean; value?: string } {
  const index = args.indexOf(name);
  if (index < 0) return { present: false };
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) return { present: true };
  return { present: true, value };
}

/**
 * Parses the manual report command. `--to` and `--confirm-send` are both
 * required, so no report is emailed to anyone without the address being named
 * and the send being confirmed. A flag that is present without a usable value
 * is rejected rather than ignored.
 */
export function parseAnalyticsEmailArgs(args: string[]): {
  to: string;
  days: number;
} {
  const recipient = option(args, '--to');
  if (!recipient.value || !args.includes('--confirm-send'))
    throw new Error(ANALYTICS_EMAIL_USAGE);
  const rawDays = option(args, '--days');
  if (rawDays.present && rawDays.value === undefined)
    throw new Error(ANALYTICS_EMAIL_USAGE);
  return {
    to: recipient.value,
    days: validateReportWindow(
      rawDays.value === undefined
        ? DEFAULT_REPORT_WINDOW_DAYS
        : Number(rawDays.value),
    ),
  };
}

/**
 * Parses the scheduled author report command. It takes no recipient and no
 * confirmation: the recipient is fixed by
 * `AUTHOR_REPORT_RECIPIENT_VARIABLE`, and a flag that is not `--dry-run` is
 * rejected rather than ignored, so a `--to` argument can never redirect it.
 */
export function parseAuthorReportArgs(args: string[]): { dryRun: boolean } {
  const unknown = args.filter((arg) => arg !== '--dry-run');
  if (unknown.length > 0)
    throw new Error(
      `${AUTHOR_REPORT_USAGE}. The recipient is ${AUTHOR_REPORT_RECIPIENT_VARIABLE}, never an argument.`,
    );
  return { dryRun: args.includes('--dry-run') };
}

/**
 * The one address the scheduled report is allowed to use, resolved from
 * configuration and required to be on the existing author allowlist.
 */
export function authorReportRecipient(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env[AUTHOR_REPORT_RECIPIENT_VARIABLE] ?? '').trim();
  if (!configured)
    throw new Error(
      `${AUTHOR_REPORT_RECIPIENT_VARIABLE} is not set; the scheduled report has no fixed recipient. No email was sent.`,
    );
  return assertAllowedTestRecipient(configured, env.NEWSLETTER_TEST_RECIPIENTS);
}

/** SES settings, required before any report is sent. */
export function analyticsReportSesConfig(
  env: NodeJS.ProcessEnv = process.env,
): { region: string; configurationSet: string } {
  const configurationSet = env.SES_CONFIGURATION_SET;
  const region = env.AWS_REGION;
  if (!configurationSet || !region)
    throw new Error(
      'Report email requires SES_CONFIGURATION_SET and AWS_REGION. No email was sent.',
    );
  return { region, configurationSet };
}

/**
 * The report message itself: one text body, from the newsletter address, to the
 * single resolved recipient.
 */
export function newsletterReportEmail(options: {
  to: string;
  days: number;
  report: string;
  configurationSet: string;
}): SendEmailCommand {
  return new SendEmailCommand({
    FromEmailAddress: NEWSLETTER_FROM,
    ReplyToAddresses: [NEWSLETTER_REPLY_TO],
    Destination: { ToAddresses: [options.to] },
    ConfigurationSetName: options.configurationSet,
    Content: {
      Simple: {
        Subject: {
          Data: `Newsletter analytics — last ${options.days} days`,
          Charset: 'UTF-8',
        },
        Body: { Text: { Data: options.report, Charset: 'UTF-8' } },
      },
    },
  });
}
