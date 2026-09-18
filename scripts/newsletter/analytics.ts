import { newsletterDb } from '../../src/lib/newsletter/db.ts';
import {
  collectNewsletterMetrics,
  DEFAULT_REPORT_WINDOW_DAYS,
  renderNewsletterReport,
  validateReportWindow,
} from '../../src/lib/newsletter/analytics.ts';

const usage =
  'Usage: npm run newsletter:analytics -- [--days <1-365>] [--json]';

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

const metrics = await collectNewsletterMetrics(newsletterDb(), { days });

if (process.argv.includes('--json'))
  console.log(JSON.stringify(metrics, null, 2));
else console.log(renderNewsletterReport(metrics));
