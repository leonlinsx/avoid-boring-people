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
  type NewsletterMetrics,
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

/** Email-only summary; CLI text, JSON, metrics and alert decisions stay unchanged. */
export function renderNewsletterReportHtml(metrics: NewsletterMetrics): string {
  const { audience, growth, deliverability } = metrics;
  const number = (value: number) => value.toLocaleString('en-US');
  const rate =
    deliverability.bounceRate === null
      ? 'n/a (no sends)'
      : `${(deliverability.bounceRate * 100).toFixed(2)}%`;
  const headingStyle =
    "font-family:Georgia,'Times New Roman',serif;color:#292929";
  const table = (title: string, rows: [string, string][]) => `
    <h2 style="${headingStyle};font-size:20px;margin:24px 0 10px">${title}</h2>
    <table aria-label="${title}" style="width:100%;border-collapse:collapse;font-size:15px">
      ${rows.map(([label, value]) => `<tr><th scope="row" style="text-align:left;font-weight:normal;padding:10px 0;border-bottom:1px solid #e8e5e0">${escapeHtml(label)}</th><td style="text-align:right;padding:10px 0 10px 16px;border-bottom:1px solid #e8e5e0;white-space:nowrap">${escapeHtml(value)}</td></tr>`).join('')}
    </table>`;
  const warnings =
    metrics.alerts.length === 0
      ? ''
      : `
    <section aria-label="Warnings" style="margin-top:24px;padding:16px;background:#f4f2ee;border-left:3px solid #aaa398">
      <h2 style="${headingStyle};font-size:20px;margin:0 0 8px">Warnings</h2>
      ${metrics.alerts.map((alert) => `<p style="margin:8px 0 0">${escapeHtml(alert)}</p>`).join('')}
    </section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Newsletter analytics</title></head>
<body style="margin:0;background:#ffffff;color:#333333;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">
  <main style="width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:28px 20px">
    <header style="padding-bottom:20px;border-bottom:1px solid #d9d5cf">
      <p style="margin:0 0 8px;font-size:12px;color:#6b655e">Avoid Boring People</p>
      <h1 style="${headingStyle};font-size:28px;line-height:1.2;margin:0 0 12px">Newsletter analytics</h1>
      <p style="margin:0;font-size:13px;color:#6b655e;overflow-wrap:anywhere">Trailing ${metrics.windowDays} days (UTC)<br>${escapeHtml(metrics.windowStart)}<br>to ${escapeHtml(metrics.windowEnd)} (end exclusive)</p>
    </header>
    ${table('Subscribers', [
      ['Active subscribers (current)', number(audience.active)],
      ['New subscribers', number(growth.newSubscribers)],
      ['Unsubscribes', number(growth.unsubscribed)],
      [
        'Net change',
        `${growth.netChange >= 0 ? '+' : ''}${number(growth.netChange)}`,
      ],
    ])}
    ${table('Email delivery', [
      ['Emails sent', number(deliverability.sends)],
      ['Recorded deliveries', number(deliverability.deliveries)],
      ['Hard bounces', number(deliverability.hardBounces)],
      ['Known hard-bounce rate', rate],
      ['Unknown bounces', number(deliverability.unknownBounces)],
      ['Complaints', number(deliverability.complaints)],
    ])}
    ${warnings}
    <footer style="margin-top:24px;padding-top:16px;border-top:1px solid #d9d5cf;font-size:12px;color:#6b655e">
      <p style="margin:0 0 8px">New subscribers may include imports; counts depend on recorded lifecycle dates. Net change is new subscribers minus unsubscribes, excluding bounces and complaints.</p>
      <p style="margin:0 0 8px">Recorded deliveries reflect received SES events, not total successful deliveries; events may arrive late. The hard-bounce rate uses this window’s sends and excludes SES suppressions and unknown bounces. Unknowns make the actual rate uncertain; below 20 sends, rates are not compared with SES thresholds.</p>
      <p style="margin:0">No open or click tracking; engagement and paid conversion are unavailable.</p>
    </footer>
  </main>
</body></html>`;
}

/** HTML with the existing text fallback, to the single resolved recipient. */
export function newsletterReportEmail(options: {
  to: string;
  days: number;
  report: string;
  html: string;
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
        Body: {
          Text: { Data: options.report, Charset: 'UTF-8' },
          Html: { Data: options.html, Charset: 'UTF-8' },
        },
      },
    },
  });
}
