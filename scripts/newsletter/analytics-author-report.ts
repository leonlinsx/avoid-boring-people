import { SESv2Client } from '@aws-sdk/client-sesv2';
import { neonDb } from '../../src/lib/neon.ts';
import {
  collectNewsletterMetrics,
  renderNewsletterReport,
  reportAnalyticsCollectionFailure,
} from '../../src/lib/newsletter/analytics.ts';
import {
  AUTHOR_REPORT_WINDOW_DAYS,
  analyticsReportSesConfig,
  authorReportRecipient,
  newsletterReportEmail,
  parseAuthorReportArgs,
} from '../../src/lib/newsletter/analytics-email.ts';

// The unattended monthly author report: the first Tuesday of each month, from a
// local user timer. It takes no recipient and no confirmation because the
// recipient is fixed configuration (NEWSLETTER_AUTHOR_REPORT_TO, validated
// against the author allowlist), so an unattended run can only ever mail that
// one address. Emailing a report anywhere else stays a manual, explicitly
// confirmed command (`newsletter:analytics:email`). No build, deploy, or CI job
// runs this, and subscribers are never addressed.
//
// A failed collection is the one way the read-only part can fail, and it is
// reported the same way as the weekly check: one `newsletter_alert` line and a
// non-zero exit. The receiver of this report is the author, so a failed run is
// visible in the journal rather than by an email that did not arrive.
const { dryRun } = parseAuthorReportArgs(process.argv.slice(2));
const recipient = authorReportRecipient();
const sesConfig = dryRun ? undefined : analyticsReportSesConfig();

let report: string | undefined;
try {
  const metrics = await collectNewsletterMetrics(neonDb('Newsletter'), {
    days: AUTHOR_REPORT_WINDOW_DAYS,
  });
  report = renderNewsletterReport(metrics);
} catch (error) {
  if (!reportAnalyticsCollectionFailure(error)) throw error;
}

if (report === undefined) {
  process.exitCode = 1;
} else {
  console.log(report);
  if (sesConfig === undefined) {
    console.log(`Dry run: no report email sent to ${recipient}.`);
  } else {
    const result = await new SESv2Client({ region: sesConfig.region }).send(
      newsletterReportEmail({
        to: recipient,
        days: AUTHOR_REPORT_WINDOW_DAYS,
        report,
        configurationSet: sesConfig.configurationSet,
      }),
    );
    console.log(
      `Author report emailed to ${recipient}; message id: ${result.MessageId ?? 'unavailable'}`,
    );
  }
}
