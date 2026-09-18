// Reader-side newsletter analytics: a small set of read-only aggregate queries
// over the existing subscriber, campaign, and delivery-event tables, plus a
// deterministic plain-text report.
//
// Deliberate limits: the newsletter email carries no open or click tracking, so
// engagement is reported as unavailable rather than estimated, and no paid
// membership exists, so paid conversion and paid churn are out of scope. Every
// metric below is re-derivable from stored rows.

import { newsletterAlert } from './alerting.ts';
import { newsletterDb } from './db.ts';
import { acquisitionSources, type AcquisitionSource } from './attribution.ts';

export const DEFAULT_REPORT_WINDOW_DAYS = 7;
export const MAX_REPORT_WINDOW_DAYS = 365;

// SES guidance: 2% bounce and 0.1% complaint rates warrant investigation, while
// 5% and 0.5% are the thresholds at which sending can be suspended.
export const BOUNCE_RATE_ALERT = 0.02;
export const COMPLAINT_RATE_ALERT = 0.001;
// Small-cohort suppression: percentages are withheld below this many new
// subscribers in the window, detail rows below this count, and deliverability
// rates are not compared to the account-level SES thresholds below this many
// sends.
export const MIN_SHARE_SAMPLE = 20;
export const MIN_DETAIL_SAMPLE = 5;
export const ACQUISITION_SURGE_MIN = 10;
export const ACQUISITION_SURGE_FACTOR = 2;
export const UNSUBSCRIBE_SPIKE_MIN = 5;
export const UNSUBSCRIBE_SPIKE_FACTOR = 2;

const DAY_MS = 86_400_000;
// A send must be at least this old before the absence of its SES event receipt
// is read as an ingestion failure, because SES publishes events asynchronously
// and the endpoint may still be catching up.
const DELIVERY_GRACE_MS = 3_600_000;

export type AudienceMetrics = {
  active: number;
  pending: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  total: number;
};

export type GrowthMetrics = {
  newSubscribers: number;
  newSubscribers30: number;
  unsubscribed: number;
  unsubscribed30: number;
  netChange: number;
  priorNewSubscribers: number;
  priorUnsubscribed: number;
  unsubscribeRate: number | null;
};

export type AcquisitionRow = {
  source: AcquisitionSource;
  count: number;
  share: number | null;
  priorCount: number;
};

export type DeliverabilityMetrics = {
  sends: number;
  deliveries: number;
  hardBounces: number;
  complaints: number;
  bounceRate: number | null;
  complaintRate: number | null;
};

export type NewsletterMetrics = {
  generatedAt: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  audience: AudienceMetrics;
  growth: GrowthMetrics;
  acquisition: AcquisitionRow[];
  acquisitionDetails: { detail: string; count: number }[];
  sharesWithheld: boolean;
  deliverability: DeliverabilityMetrics;
  alerts: string[];
  /**
   * The subset of {@link alerts} that a scheduled run must fail on: a
   * deliverability rate at the SES threshold, or an ingestion path that has
   * stopped producing events. Threshold-free observations stay out, so a quiet
   * publishing week does not look like an outage.
   */
  failures: string[];
  notes: string[];
};

type Row = Record<string, unknown>;

function count(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAcquisitionSource(value: unknown): value is AcquisitionSource {
  return (
    typeof value === 'string' &&
    (acquisitionSources as readonly string[]).includes(value)
  );
}

function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function validateReportWindow(days: number): number {
  if (!Number.isInteger(days) || days < 1 || days > MAX_REPORT_WINDOW_DAYS)
    throw new Error(
      `Report window must be a whole number of days between 1 and ${MAX_REPORT_WINDOW_DAYS}.`,
    );
  return days;
}

export async function collectNewsletterMetrics(
  db: ReturnType<typeof newsletterDb>,
  options: { days?: number; now?: Date } = {},
): Promise<NewsletterMetrics> {
  const days = validateReportWindow(options.days ?? DEFAULT_REPORT_WINDOW_DAYS);
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - days * DAY_MS);
  const priorWindowStart = new Date(windowStart.getTime() - days * DAY_MS);
  const monthStart = new Date(now.getTime() - 30 * DAY_MS);
  const lookbackStart = new Date(
    Math.min(monthStart.getTime(), priorWindowStart.getTime()),
  );
  const at = (date: Date) => date.toISOString();

  // Audience: the current state of the subscriber list.
  const audienceRows =
    await db`SELECT status, count(*)::int AS count FROM subscribers GROUP BY status`;

  // Growth: subscriber and unsubscribe events inside the window. A row counts
  // as a new subscriber only once it has actually become active (confirmed
  // here, or imported from Substack), so unconfirmed requests are not growth.
  // Imported rows without a recorded cancellation date were stamped with the
  // import time rather than a real unsubscribe time, so those are excluded.
  const growthRows = await db`SELECT
    (count(*) FILTER (WHERE subscribed_at >= ${at(windowStart)}::timestamptz AND subscribed_at < ${at(now)}::timestamptz))::int AS new_subscribers,
    (count(*) FILTER (WHERE subscribed_at >= ${at(priorWindowStart)}::timestamptz AND subscribed_at < ${at(windowStart)}::timestamptz))::int AS prior_new_subscribers,
    (count(*) FILTER (WHERE subscribed_at >= ${at(monthStart)}::timestamptz AND subscribed_at < ${at(now)}::timestamptz))::int AS new_subscribers_30,
    (count(*) FILTER (WHERE unsubscribed_at >= ${at(windowStart)}::timestamptz AND unsubscribed_at < ${at(now)}::timestamptz))::int AS unsubscribed,
    (count(*) FILTER (WHERE unsubscribed_at >= ${at(priorWindowStart)}::timestamptz AND unsubscribed_at < ${at(windowStart)}::timestamptz))::int AS prior_unsubscribed,
    (count(*) FILTER (WHERE unsubscribed_at >= ${at(monthStart)}::timestamptz AND unsubscribed_at < ${at(now)}::timestamptz))::int AS unsubscribed_30
    FROM (
      SELECT
        CASE
          WHEN confirmed_at IS NULL AND imported_at IS NULL THEN NULL
          ELSE COALESCE(original_subscribed_at, confirmed_at, created_at)
        END AS subscribed_at,
        CASE
          WHEN imported_at IS NOT NULL AND legacy_substack_cancel_date IS NULL AND unsubscribed_at <= imported_at THEN NULL
          ELSE unsubscribed_at
        END AS unsubscribed_at
      FROM subscribers
    ) AS subscriber_dates
    WHERE (subscribed_at >= ${at(lookbackStart)}::timestamptz AND subscribed_at < ${at(now)}::timestamptz)
      OR (unsubscribed_at >= ${at(lookbackStart)}::timestamptz AND unsubscribed_at < ${at(now)}::timestamptz)`;

  // Acquisition: grouped by normalized source and detail, with the immediately
  // preceding window of the same length as the comparison baseline.
  const acquisitionRows = await db`SELECT
    COALESCE(acquisition_source, CASE WHEN source = 'substack_import' THEN 'imported_substack' ELSE 'unknown' END) AS source,
    acquisition_detail AS detail,
    (count(*) FILTER (WHERE subscribed_at >= ${at(windowStart)}::timestamptz AND subscribed_at < ${at(now)}::timestamptz))::int AS current_count,
    (count(*) FILTER (WHERE subscribed_at >= ${at(priorWindowStart)}::timestamptz AND subscribed_at < ${at(windowStart)}::timestamptz))::int AS prior_count
    FROM (
      SELECT
        acquisition_source,
        acquisition_detail,
        source,
        CASE
          WHEN confirmed_at IS NULL AND imported_at IS NULL THEN NULL
          ELSE COALESCE(original_subscribed_at, confirmed_at, created_at)
        END AS subscribed_at
      FROM subscribers
    ) AS attributed
    WHERE subscribed_at >= ${at(priorWindowStart)}::timestamptz AND subscribed_at < ${at(now)}::timestamptz
    GROUP BY 1, 2`;

  // Deliverability: counts of deduplicated SES event receipts plus attempted
  // sends. Only receipts that belong to a campaign send are counted, so a
  // confirmation email, a test send, or the report email itself can never be
  // read as campaign deliverability; the EXISTS join is what keeps the
  // `deliveries`/`bounced`/`complained` counts comparable to `sends`. The total
  // receipt count is collected separately because a receipt of any kind proves
  // ingestion is alive, even when it is a transient bounce that maps to none of
  // the three statuses below.
  const deliveryRows = await db`SELECT
    count(*)::int AS receipts,
    (count(*) FILTER (WHERE event_status = 'sent'))::int AS deliveries,
    (count(*) FILTER (WHERE event_status = 'bounced'))::int AS bounced,
    (count(*) FILTER (WHERE event_status = 'complained'))::int AS complained
    FROM newsletter_event_receipts
    WHERE event_at >= ${at(windowStart)}::timestamptz AND event_at < ${at(now)}::timestamptz
      AND EXISTS (
        SELECT 1 FROM campaign_recipients
        WHERE campaign_recipients.provider_message_id = newsletter_event_receipts.provider_message_id
      )`;

  const deliveryGraceStart = new Date(now.getTime() - DELIVERY_GRACE_MS);
  const sendRows = await db`SELECT
    count(*)::int AS sends,
    (count(*) FILTER (WHERE sent_at < ${at(deliveryGraceStart)}::timestamptz))::int AS sends_before_delivery_grace
    FROM campaign_recipients
    WHERE sent_at >= ${at(windowStart)}::timestamptz AND sent_at < ${at(now)}::timestamptz`;

  return buildMetrics({
    days,
    now,
    windowStart,
    audienceRows: audienceRows as Row[],
    growthRows: growthRows as Row[],
    acquisitionRows: acquisitionRows as Row[],
    deliveryRows: deliveryRows as Row[],
    sendRows: sendRows as Row[],
  });
}

export function buildMetrics(input: {
  days: number;
  now: Date;
  windowStart: Date;
  audienceRows: Row[];
  growthRows: Row[];
  acquisitionRows: Row[];
  deliveryRows: Row[];
  sendRows: Row[];
}): NewsletterMetrics {
  const { days, now, windowStart } = input;

  const audience: AudienceMetrics = {
    active: 0,
    pending: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    total: 0,
  };
  for (const row of input.audienceRows) {
    const status = row.status;
    const value = count(row.count);
    if (
      status === 'active' ||
      status === 'pending' ||
      status === 'unsubscribed' ||
      status === 'bounced' ||
      status === 'complained'
    )
      audience[status] = value;
    audience.total += value;
  }

  const growthRow = input.growthRows[0] ?? {};
  const unsubscribed = count(growthRow.unsubscribed);
  const newSubscribers = count(growthRow.new_subscribers);

  const bySource = new Map<
    AcquisitionSource,
    { current: number; prior: number }
  >();
  const details = new Map<string, number>();
  for (const row of input.acquisitionRows) {
    const source = isAcquisitionSource(row.source) ? row.source : 'unknown';
    const current = count(row.current_count);
    const prior = count(row.prior_count);
    const existing = bySource.get(source) ?? { current: 0, prior: 0 };
    bySource.set(source, {
      current: existing.current + current,
      prior: existing.prior + prior,
    });
    if (current > 0 && typeof row.detail === 'string' && row.detail)
      details.set(row.detail, (details.get(row.detail) ?? 0) + current);
  }
  const attributedTotal = [...bySource.values()].reduce(
    (total, entry) => total + entry.current,
    0,
  );
  const sharesWithheld = attributedTotal < MIN_SHARE_SAMPLE;
  const acquisition: AcquisitionRow[] = [...bySource.entries()]
    .map(([source, entry]) => ({
      source,
      count: entry.current,
      share:
        entry.current > 0 && !sharesWithheld
          ? round(entry.current / attributedTotal, 4)
          : null,
      priorCount: entry.prior,
    }))
    .filter((entry) => entry.count > 0)
    .sort(
      (left, right) =>
        right.count - left.count || left.source.localeCompare(right.source),
    );

  const deliveryRow = input.deliveryRows[0] ?? {};
  const sends = count(input.sendRows[0]?.sends);
  const sendsBeforeDeliveryGrace = count(
    input.sendRows[0]?.sends_before_delivery_grace,
  );
  const receipts = count(deliveryRow.receipts);
  const hardBounces = count(deliveryRow.bounced);
  const complaints = count(deliveryRow.complained);
  const deliverability: DeliverabilityMetrics = {
    sends,
    deliveries: count(deliveryRow.deliveries),
    hardBounces,
    complaints,
    bounceRate: ratio(hardBounces, sends),
    complaintRate: ratio(complaints, sends),
  };

  const growth: GrowthMetrics = {
    newSubscribers,
    newSubscribers30: count(growthRow.new_subscribers_30),
    unsubscribed,
    unsubscribed30: count(growthRow.unsubscribed_30),
    netChange: newSubscribers - unsubscribed,
    priorNewSubscribers: count(growthRow.prior_new_subscribers),
    priorUnsubscribed: count(growthRow.prior_unsubscribed),
    unsubscribeRate: ratio(unsubscribed, sends),
  };

  const alerts: string[] = [];
  const failures: string[] = [];
  const notes: string[] = [];
  const pushAlert = (text: string, failure = false) => {
    alerts.push(text);
    if (failure) failures.push(text);
  };
  if (sends === 0) pushAlert(`No campaign was sent in the last ${days} days.`);

  // A window rate and the account-level SES thresholds only compare once the
  // window holds enough sends for the ratio to mean something.
  const ratesComparable = sends >= MIN_SHARE_SAMPLE;
  if (
    deliverability.complaintRate !== null &&
    ratesComparable &&
    deliverability.complaintRate >= COMPLAINT_RATE_ALERT
  )
    pushAlert(
      `Complaint rate ${formatRate(deliverability.complaintRate)} of ${formatNumber(sends)} sends is at or above the 0.1% SES investigation threshold.`,
      true,
    );
  if (
    deliverability.bounceRate !== null &&
    ratesComparable &&
    deliverability.bounceRate >= BOUNCE_RATE_ALERT
  )
    pushAlert(
      `Bounce rate ${formatRate(deliverability.bounceRate)} of ${formatNumber(sends)} sends is at or above the 2% SES investigation threshold.`,
      true,
    );
  // Dead-man's switch for the ingestion path: receipts only exist while the SNS
  // subscription and the event destination work, so a send that is past the
  // grace period with no correlated receipt at all means events stopped
  // arriving. A single receipt on any status clears it.
  if (sendsBeforeDeliveryGrace > 0 && receipts === 0)
    pushAlert(
      `Delivery-event ingestion may have stopped: ${formatNumber(sendsBeforeDeliveryGrace)} sends in this window are past the one-hour grace period and no SES event receipt has been correlated to them.`,
      true,
    );
  const deliveryEvents = deliverability.hardBounces + deliverability.complaints;
  // The EXISTS join above means a receipt here always matches a
  // `campaign_recipients` row, so an event in the window whose send is not is a
  // late or retried event (or a window boundary artifact), not necessarily an
  // orphan. It is reported, never escalated: the ingestion switch is the only
  // delivery signal that fails a run.
  if (sends === 0 && deliveryEvents > 0)
    pushAlert(
      `Delivery events (${deliveryEvents}) arrived in the last ${days} days for a campaign sent outside that window, so no rate could be computed.`,
    );
  if (sends > 0 && !ratesComparable)
    notes.push(
      `Deliverability rates cover ${formatNumber(sends)} sends; below ${MIN_SHARE_SAMPLE} they are not compared with the account-level SES thresholds.`,
    );
  if (deliveryEvents > 0)
    notes.push(
      `net subscriber change excludes ${deliveryEvents} bounces and complaints in this window.`,
    );

  // Every comparison below puts window counts against the same-length window,
  // so a count is never measured against a rate.
  if (
    unsubscribed >=
    Math.max(
      UNSUBSCRIBE_SPIKE_MIN,
      UNSUBSCRIBE_SPIKE_FACTOR * growth.priorUnsubscribed,
    )
  )
    pushAlert(
      `Unsubscribes rose: ${unsubscribed} in the last ${days} days vs ${growth.priorUnsubscribed} in the prior ${days} days.`,
    );

  for (const entry of acquisition) {
    if (
      entry.count >= ACQUISITION_SURGE_MIN &&
      entry.count >= ACQUISITION_SURGE_FACTOR * entry.priorCount
    )
      notes.push(
        `${entry.source} acquisition is above baseline: ${entry.count} in the last ${days} days vs ${entry.priorCount} in the prior ${days} days.`,
      );
  }

  return {
    generatedAt: now.toISOString(),
    windowDays: days,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    audience,
    growth,
    acquisition,
    acquisitionDetails: [...details.entries()]
      .filter(([, value]) => value >= MIN_DETAIL_SAMPLE)
      .map(([detail, value]) => ({ detail, count: value }))
      .sort(
        (left, right) =>
          right.count - left.count || left.detail.localeCompare(right.detail),
      )
      .slice(0, 5),
    sharesWithheld,
    deliverability,
    alerts,
    failures,
    notes,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatRate(value: number | null): string {
  if (value === null) return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 16)}Z`;
}

function labeled(label: string, value: string): string {
  return `  ${label.padEnd(22)}${value.padStart(8)}`;
}

export function renderNewsletterReport(metrics: NewsletterMetrics): string {
  const { audience, growth, deliverability } = metrics;
  const lines: string[] = [
    `Avoid Boring People — newsletter analytics (last ${metrics.windowDays} days)`,
    `Window: last ${metrics.windowDays}×24h, ${formatTimestamp(metrics.windowStart)} to ${formatTimestamp(metrics.windowEnd)} (UTC)`,
    '',
    'AUDIENCE (all subscribers)',
    labeled('active', formatNumber(audience.active)),
    labeled('pending', formatNumber(audience.pending)),
    labeled('unsubscribed', formatNumber(audience.unsubscribed)),
    labeled('bounced', formatNumber(audience.bounced)),
    labeled('complained', formatNumber(audience.complained)),
    labeled('total', formatNumber(audience.total)),
    '',
    `GROWTH (last ${metrics.windowDays} days)`,
    `${labeled('new subscribers', formatNumber(growth.newSubscribers))}   (30-day: ${formatNumber(growth.newSubscribers30)})`,
    `${labeled('unsubscribed', formatNumber(growth.unsubscribed))}   (30-day: ${formatNumber(growth.unsubscribed30)})`,
    labeled(
      'net change',
      `${growth.netChange >= 0 ? '+' : ''}${formatNumber(growth.netChange)}`,
    ),
    labeled(
      'unsubscribe rate',
      growth.unsubscribeRate === null
        ? 'n/a (no sends in window)'
        : `${formatRate(growth.unsubscribeRate)} of ${formatNumber(deliverability.sends)} sends`,
    ),
    '  (rate = every unsubscribe in the window ÷ sends, not a per-campaign rate)',
    '',
    `ACQUISITION (last ${metrics.windowDays} days)`,
  ];

  if (metrics.acquisition.length === 0)
    lines.push('  no new subscribers in this window');
  for (const entry of metrics.acquisition)
    lines.push(
      `  ${entry.source.padEnd(22)}${formatNumber(entry.count).padStart(6)}${entry.share === null ? '' : `   ${(entry.share * 100).toFixed(0)}%`}`,
    );
  if (metrics.acquisitionDetails.length)
    lines.push(
      `  top details: ${metrics.acquisitionDetails
        .map((entry) => `${entry.detail} ${entry.count}`)
        .join(' · ')}`,
    );
  if (metrics.sharesWithheld && metrics.acquisition.length > 0)
    lines.push(
      `  shares withheld: fewer than ${MIN_SHARE_SAMPLE} new subscribers in this window`,
    );

  lines.push(
    '',
    `DELIVERABILITY (last ${metrics.windowDays} days)`,
    `${labeled('sends', formatNumber(deliverability.sends))}   deliveries: ${formatNumber(deliverability.deliveries)}`,
    `${labeled('hard bounces', formatNumber(deliverability.hardBounces))}   rate: ${formatRate(deliverability.bounceRate)}`,
    `${labeled('complaints', formatNumber(deliverability.complaints))}   rate: ${formatRate(deliverability.complaintRate)}`,
    "  (rates cover this window's sends; SES events arrive asynchronously, so a",
    '  campaign sent in the last hours may still be reconciling)',
    '',
    'QUALITY',
    '  paid and gifted subscribers: none — the newsletter is free-only, so paid',
    '  conversion and paid churn are not reported.',
    '',
    'ENGAGEMENT',
    '  not tracked: newsletter email has no open or click tracking, so opens, clicks,',
    '  and per-subscriber engagement are unavailable and are not estimated.',
    '',
    'NOTABLE CHANGE',
  );

  for (const alert of metrics.alerts) lines.push(`  ⚠ ${alert}`);
  for (const note of metrics.notes) lines.push(`  • ${note}`);
  if (metrics.alerts.length === 0 && metrics.notes.length === 0)
    lines.push('  nothing outside the expected range');

  return lines.join('\n');
}

/**
 * The `--check` exit contract: the report is always printed, and only a listed
 * failure makes the run non-zero, so a red scheduled run always means a real
 * deliverability or ingestion condition rather than a quiet publishing week.
 */
export function newsletterCheckExitCode(metrics: NewsletterMetrics): number {
  if (metrics.failures.length === 0) return 0;
  newsletterAlert('analytics_job_failure', { reason: 'threshold' });
  for (const failure of metrics.failures) console.error(`  ${failure}`);
  return 1;
}

/**
 * Reports a failed collection, which is the one way the read-only report can
 * fail. The driver can quote the connection string back inside its message, and
 * a CI run publishes its log in a public repository, so under CI this returns
 * `true` to tell the caller to report the failure and exit non-zero instead of
 * rethrowing the text. Outside CI it returns `false` so the caller rethrows,
 * where the message is diagnosable and never published.
 */
export function reportAnalyticsCollectionFailure(error: unknown): boolean {
  newsletterAlert('analytics_job_failure', {
    reason: 'collection',
    errorName: error instanceof Error ? error.name : 'unknown',
  });
  if (!process.env.CI) return false;
  console.error(
    '  Analytics collection failed; run the report locally for the error text.',
  );
  return true;
}
