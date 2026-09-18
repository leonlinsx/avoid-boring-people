// First-touch acquisition attribution for owned newsletter signups.
//
// This module is imported by both the browser (SubscribeForm) and the server
// (subscriptions.ts), so it must stay free of Node and DOM-only APIs. Raw
// capture stays raw: UTM values, landing path, and referring domain are stored
// as received, and the normalized source vocabulary is derived from them so the
// vocabulary can change without a data migration.

import { SITE_URL } from '../../consts.ts';

// The site's own host. A visit referred by it says only that the reader was
// already here, so it is recorded as an uninformative source rather than an
// external channel; other hosts (previews) land on `direct`.
const SITE_HOST = new URL(SITE_URL).host;

export const acquisitionSources = [
  'direct',
  'organic_search',
  'x',
  'threads',
  'instagram',
  'bluesky',
  'reddit',
  'mastodon',
  'linkedin',
  'farcaster',
  'nostr',
  'external_newsletter',
  'referral',
  SITE_HOST,
  'imported_substack',
  'unknown',
] as const;

export type AcquisitionSource = (typeof acquisitionSources)[number];

// Sources that carry no usable acquisition information. A later visit may
// replace one of these with a real source; nothing else is ever replaced.
const uninformativeSources = new Set<AcquisitionSource>([
  'direct',
  'unknown',
  SITE_HOST,
]);

export type AttributionInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  landingPath?: string | null;
  referrerDomain?: string | null;
  siteHost?: string | null;
};

export type NormalizedAttribution = {
  source: AcquisitionSource;
  detail: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  signupPath: string | null;
  referrerDomain: string | null;
};

export const ATTRIBUTION_STORAGE_KEY = 'abp.first-touch-attribution';

const MAX_UTM_LENGTH = 100;
const MAX_MEDIUM_LENGTH = 60;
const MAX_CAMPAIGN_LENGTH = 120;
const MAX_PATH_LENGTH = 200;
const MAX_DOMAIN_LENGTH = 200;

// Campaign and link tags are lowercased for grouping; the raw values remain in
// the subscriber row for auditing.
const utmSourceMap: Record<string, AcquisitionSource> = {
  x: 'x',
  twitter: 'x',
  'twitter.com': 'x',
  'x.com': 'x',
  't.co': 'x',
  threads: 'threads',
  'threads.net': 'threads',
  'threads.com': 'threads',
  instagram: 'instagram',
  ig: 'instagram',
  'instagram.com': 'instagram',
  bluesky: 'bluesky',
  bsky: 'bluesky',
  'bsky.app': 'bluesky',
  reddit: 'reddit',
  'reddit.com': 'reddit',
  mastodon: 'mastodon',
  linkedin: 'linkedin',
  'linkedin.com': 'linkedin',
  farcaster: 'farcaster',
  warpcast: 'farcaster',
  'warpcast.com': 'farcaster',
  nostr: 'nostr',
  'nostr.com': 'nostr',
  newsletter: 'external_newsletter',
  email: 'external_newsletter',
  mail: 'external_newsletter',
  substack: 'external_newsletter',
  beehiiv: 'external_newsletter',
  ghost: 'external_newsletter',
  leonlins: 'leonlins.com',
  'leonlins.com': 'leonlins.com',
  website: 'leonlins.com',
  blog: 'leonlins.com',
  site: 'leonlins.com',
  direct: 'direct',
  none: 'direct',
  google: 'organic_search',
  bing: 'organic_search',
  duckduckgo: 'organic_search',
  yahoo: 'organic_search',
  ecosia: 'organic_search',
  brave: 'organic_search',
  search: 'organic_search',
};

const referrerSourceMap: Record<string, AcquisitionSource> = {
  'x.com': 'x',
  'twitter.com': 'x',
  't.co': 'x',
  'threads.net': 'threads',
  'threads.com': 'threads',
  'instagram.com': 'instagram',
  'bsky.app': 'bluesky',
  'reddit.com': 'reddit',
  'linkedin.com': 'linkedin',
  'warpcast.com': 'farcaster',
  'substack.com': 'external_newsletter',
  'beehiiv.com': 'external_newsletter',
  'ghost.io': 'external_newsletter',
  'mailchimp.com': 'external_newsletter',
  'google.com': 'organic_search',
  'bing.com': 'organic_search',
  'duckduckgo.com': 'organic_search',
  'search.brave.com': 'organic_search',
  'ecosia.org': 'organic_search',
  'yahoo.com': 'organic_search',
  'yandex.com': 'organic_search',
  'baidu.com': 'organic_search',
  'perplexity.ai': 'organic_search',
  'chatgpt.com': 'organic_search',
  'chat.openai.com': 'organic_search',
};

// Search engines, matched on the apex or www host only: mail.google.com and
// accounts.google.com are products, not searches.
const searchHostPattern = /^(www\.)?google\.[a-z]{2,}(\.[a-z]{2,})?$/;

function sanitized(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  // Control characters never belong in an attribution label; collapse the rest.
  const text = value
    // eslint-disable-next-line no-control-regex -- stripping C0/DEL controls is exactly what this sanitizer is for.
    .replaceAll(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .replaceAll(/\s+/g, ' ');
  if (!text) return null;
  return text.slice(0, maxLength);
}

function sanitizedPath(value: unknown): string | null {
  const path = sanitized(value, MAX_PATH_LENGTH);
  if (!path || !path.startsWith('/')) return null;
  const [withoutQuery] = path.split(/[?#]/);
  return withoutQuery || null;
}

export function referrerDomain(referrer: unknown): string | null {
  if (typeof referrer !== 'string' || !referrer.trim()) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  return host.replace(/^www\./, '').slice(0, MAX_DOMAIN_LENGTH) || null;
}

function normalizedHost(value: unknown): string | null {
  const host = sanitized(value, MAX_DOMAIN_LENGTH)?.toLowerCase();
  return host ? host.replace(/^www\./, '') : null;
}

function sourceFromUtm(
  utmSource: string,
  utmMedium: string | null,
): AcquisitionSource {
  const key = utmSource.toLowerCase();
  const mapped = utmSourceMap[key];
  if (mapped) return mapped;
  if (
    utmMedium?.toLowerCase() === 'email' ||
    utmMedium?.toLowerCase() === 'newsletter'
  )
    return 'external_newsletter';
  if (utmMedium?.toLowerCase() === 'search') return 'organic_search';
  // An unmapped utm_source is still a known external referrer, so it is
  // reported as a referral rather than as unknown, and the raw value is kept.
  return 'referral';
}

function sourceFromReferrer(domain: string): AcquisitionSource {
  if (referrerSourceMap[domain]) return referrerSourceMap[domain];
  if (searchHostPattern.test(domain)) return 'organic_search';
  return 'referral';
}

export function normalizeAttribution(
  input: AttributionInput,
): NormalizedAttribution {
  const utmSource = sanitized(input.utmSource, MAX_UTM_LENGTH);
  const utmMedium = sanitized(input.utmMedium, MAX_MEDIUM_LENGTH);
  const utmCampaign = sanitized(input.utmCampaign, MAX_CAMPAIGN_LENGTH);
  const utmContent = sanitized(input.utmContent, MAX_CAMPAIGN_LENGTH);
  const signupPath = sanitizedPath(input.landingPath);
  const siteHost = normalizedHost(input.siteHost) ?? SITE_HOST;
  const rawReferrer = normalizedHost(input.referrerDomain);
  const isSelfReferrer = rawReferrer === siteHost;
  const referrer = isSelfReferrer ? null : rawReferrer;

  let source: AcquisitionSource;
  if (utmSource) source = sourceFromUtm(utmSource, utmMedium);
  else if (isSelfReferrer) source = 'leonlins.com';
  else if (referrer) source = sourceFromReferrer(referrer);
  else source = 'direct';

  // `detail` answers "which campaign, site, or page", and stays null when the
  // source itself already names the channel. The most specific value wins.
  const detail =
    utmCampaign ??
    (source === 'referral'
      ? (utmSource ?? referrer ?? null)
      : source === 'leonlins.com' || source === 'direct'
        ? signupPath
        : null);

  return {
    source,
    detail,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    signupPath,
    referrerDomain: referrer,
  };
}

export function isInformativeSource(source: AcquisitionSource): boolean {
  return !uninformativeSources.has(source);
}

// Server-side shape check for the JSON body of an owned signup request. Values
// are only copied when they are strings; normalization happens afterwards.
export function attributionFromRequest(
  value: unknown,
): AttributionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const input: AttributionInput = {
    utmSource: typeof record.utmSource === 'string' ? record.utmSource : null,
    utmMedium: typeof record.utmMedium === 'string' ? record.utmMedium : null,
    utmCampaign:
      typeof record.utmCampaign === 'string' ? record.utmCampaign : null,
    utmContent:
      typeof record.utmContent === 'string' ? record.utmContent : null,
    landingPath:
      typeof record.landingPath === 'string' ? record.landingPath : null,
    referrerDomain:
      typeof record.referrerDomain === 'string' ? record.referrerDomain : null,
  };
  const hasValue = Object.values(input).some((field) => field !== null);
  return hasValue ? input : null;
}

// --- Browser capture --------------------------------------------------------

export type AttributionPage = {
  search?: string;
  pathname?: string;
  host?: string;
  referrer?: string;
};

export type AttributionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type StoredAttribution = {
  version: 1;
  capturedAt: string;
  capture: AttributionInput;
};

export function captureAttribution(page: AttributionPage): AttributionInput {
  const search = page.search ?? '';
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(
      search.startsWith('?') ? search : `?${search}`,
    );
  } catch {
    params = new URLSearchParams();
  }
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    utmContent: params.get('utm_content'),
    landingPath: page.pathname ?? null,
    referrerDomain: referrerDomain(page.referrer),
    siteHost: page.host ?? null,
  };
}

function parseStored(value: string | null): StoredAttribution | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredAttribution;
    if (parsed?.version !== 1 || typeof parsed.capture !== 'object')
      return null;
    const capture = attributionFromRequest(parsed.capture);
    if (!capture) return null;
    return {
      version: 1,
      capturedAt:
        typeof parsed.capturedAt === 'string' ? parsed.capturedAt : '',
      capture,
    };
  } catch {
    return null;
  }
}

export function readStoredAttribution(
  storage: AttributionStorage,
): StoredAttribution | null {
  try {
    return parseStored(storage.getItem(ATTRIBUTION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredAttribution(
  storage: AttributionStorage,
  capture: AttributionInput,
  now: Date,
): void {
  try {
    const stored: StoredAttribution = {
      version: 1,
      capturedAt: now.toISOString(),
      capture,
    };
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable (private modes, disabled cookies). A missing
    // record degrades to an unattributed signup, which is acceptable.
  }
}

// Returns the first *attributable* touch for this browser: a stored record
// wins, except that an uninformative one (direct/unknown, or a visit referred
// by this site itself) is upgraded once a real source appears. The subscriber
// row therefore keeps the earliest evidence of where the reader came from.
export function firstTouchAttribution(
  page: AttributionPage,
  storage: AttributionStorage,
  now: Date = new Date(),
): AttributionInput {
  const current = captureAttribution(page);
  const stored = readStoredAttribution(storage);
  if (stored) {
    const storedSource = normalizeAttribution({
      ...stored.capture,
      siteHost: page.host,
    }).source;
    const currentSource = normalizeAttribution({
      ...current,
      siteHost: page.host,
    }).source;
    if (
      isInformativeSource(storedSource) ||
      !isInformativeSource(currentSource)
    )
      return stored.capture;
  }
  writeStoredAttribution(storage, current, now);
  return current;
}

// Wire payload for the owned signup request. Inert until the signup form posts
// to /api/newsletter/subscribe (Phase 5 cutover); the Substack form is
// untouched and stores no attribution.
//
// This is the browser-to-server contract: field names and per-field caps must
// match the keys `attributionFromRequest` reads and the caps `normalizeAttribution`
// applies, so the value that is sent is the value that is stored.
const payloadFieldCaps = {
  utmSource: MAX_UTM_LENGTH,
  utmMedium: MAX_MEDIUM_LENGTH,
  utmCampaign: MAX_CAMPAIGN_LENGTH,
  utmContent: MAX_CAMPAIGN_LENGTH,
} as const;

export function attributionPayload(
  capture: AttributionInput,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of [
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmContent',
  ] as const) {
    const value = sanitized(capture[field], payloadFieldCaps[field]);
    if (value) payload[field] = value;
  }
  const path = sanitizedPath(capture.landingPath);
  if (path) payload.landingPath = path;
  const domain = sanitized(capture.referrerDomain, MAX_DOMAIN_LENGTH);
  if (domain) payload.referrerDomain = domain;
  return payload;
}
