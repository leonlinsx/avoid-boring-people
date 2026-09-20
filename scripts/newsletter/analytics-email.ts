import { SESv2Client } from '@aws-sdk/client-sesv2';
import { neonDb } from '../../src/lib/neon.ts';
import {
  collectNewsletterMetrics,
  renderNewsletterReport,
} from '../../src/lib/newsletter/analytics.ts';
import {
  analyticsReportSesConfig,
  newsletterReportEmail,
  parseAnalyticsEmailArgs,
} from '../../src/lib/newsletter/analytics-email.ts';
import { assertAllowedTestRecipient } from '../../src/lib/newsletter/test-send.ts';

// Deliberately separate from `newsletter:analytics`: producing the report is
// read-only, while emailing it needs its own explicit confirmation and goes
// only to an address on the existing author allowlist. Subscribers never
// receive this report. The unattended monthly report is a separate entry point,
// `analytics-author-report.ts`, which takes no recipient at all.
const { to, days } = parseAnalyticsEmailArgs(process.argv.slice(2));
const recipient = assertAllowedTestRecipient(
  to,
  process.env.NEWSLETTER_TEST_RECIPIENTS,
);

const { region, configurationSet } = analyticsReportSesConfig();

const metrics = await collectNewsletterMetrics(neonDb('Newsletter'), { days });
const report = renderNewsletterReport(metrics);
console.log(report);

const result = await new SESv2Client({ region }).send(
  newsletterReportEmail({ to: recipient, days, report, configurationSet }),
);

console.log(
  `Analytics report emailed to ${recipient}; message id: ${result.MessageId ?? 'unavailable'}`,
);
