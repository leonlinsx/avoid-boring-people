import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { newsletterDb } from '../../src/lib/newsletter/db.ts';
import {
  collectNewsletterMetrics,
  DEFAULT_REPORT_WINDOW_DAYS,
  renderNewsletterReport,
  validateReportWindow,
} from '../../src/lib/newsletter/analytics.ts';
import { assertAllowedTestRecipient } from '../../src/lib/newsletter/test-send.ts';
import {
  NEWSLETTER_FROM,
  NEWSLETTER_REPLY_TO,
} from '../../src/lib/newsletter/email.ts';

// Deliberately separate from `newsletter:analytics`: producing the report is
// read-only, while emailing it needs its own explicit confirmation and goes
// only to an address on the existing author allowlist. Subscribers never
// receive this report.
const usage =
  'Usage: npm run newsletter:analytics:email -- --to <allowlisted-address> --confirm-send [--days <1-365>]';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(usage);
  return value;
}

const recipient = option('--to');
if (!recipient || !process.argv.includes('--confirm-send'))
  throw new Error(usage);
const to = assertAllowedTestRecipient(
  recipient,
  process.env.NEWSLETTER_TEST_RECIPIENTS,
);

const rawDays = option('--days');
const days = validateReportWindow(
  rawDays === undefined ? DEFAULT_REPORT_WINDOW_DAYS : Number(rawDays),
);

const configurationSet = process.env.SES_CONFIGURATION_SET;
if (!configurationSet || !process.env.AWS_REGION)
  throw new Error(
    'Report email requires SES_CONFIGURATION_SET and AWS_REGION. No email was sent.',
  );

const metrics = await collectNewsletterMetrics(newsletterDb(), { days });
const report = renderNewsletterReport(metrics);
console.log(report);

const result = await new SESv2Client({
  region: process.env.AWS_REGION,
}).send(
  new SendEmailCommand({
    FromEmailAddress: NEWSLETTER_FROM,
    ReplyToAddresses: [NEWSLETTER_REPLY_TO],
    Destination: { ToAddresses: [to] },
    ConfigurationSetName: configurationSet,
    Content: {
      Simple: {
        Subject: {
          Data: `Newsletter analytics — last ${days} days`,
          Charset: 'UTF-8',
        },
        Body: { Text: { Data: report, Charset: 'UTF-8' } },
      },
    },
  }),
);

console.log(
  `Analytics report emailed to ${to}; message id: ${result.MessageId ?? 'unavailable'}`,
);
