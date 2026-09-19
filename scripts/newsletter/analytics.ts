import { neonDb } from '../../src/lib/neon.ts';
import type { NewsletterMetrics } from '../../src/lib/newsletter/analytics.ts';
import {
  collectNewsletterMetrics,
  DEFAULT_REPORT_WINDOW_DAYS,
  newsletterCheckExitCode,
  renderNewsletterReport,
  reportAnalyticsCollectionFailure,
  validateReportWindow,
} from '../../src/lib/newsletter/analytics.ts';

const usage =
  'Usage: npm run newsletter:analytics -- [--days <1-365>] [--json] [--check]';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(usage);
  return value;
}

const rawDays = option('--days');
const days = validateReportWindow(
  rawDays === undefined ? DEFAULT_REPORT_WINDOW_DAYS : Number(rawDays),
);

const check = process.argv.includes('--check');
let metrics: NewsletterMetrics | undefined;
try {
  metrics = await collectNewsletterMetrics(neonDb('Newsletter'), { days });
} catch (error) {
  // The report is read-only, so a failure here means the job did not run. In CI
  // the failure is reported and the run ends non-zero without the driver's
  // message, which can quote the connection string back into a public log.
  if (!reportAnalyticsCollectionFailure(error)) throw error;
}

if (metrics === undefined) {
  process.exitCode = 1;
} else {
  // The report is always printed, including when it fails the check, so the
  // failing run carries its own evidence.
  if (process.argv.includes('--json'))
    console.log(JSON.stringify(metrics, null, 2));
  else console.log(renderNewsletterReport(metrics));

  if (check) process.exitCode = newsletterCheckExitCode(metrics);
}
