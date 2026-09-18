/**
 * Link checking policy for `scripts/link-report.js`.
 *
 * The internal check serves the just-built site on localhost, so same-site
 * absolute links (https://leonlins.com/...) used to be treated as external and
 * skipped: a real 404 such as /writing/2020_12_02_kelly/ could ship unnoticed.
 * Those hosts are therefore rewritten to the local server and checked like any
 * other internal link, while genuinely external hosts stay out of the
 * deterministic gate.
 */
const LOCAL_HOSTNAME = 'localhost';
const SITE_HOSTNAMES = ['leonlins.com', 'www.leonlins.com'];
/** Apex/www stay listed as a fallback for runs where the rewrite is disabled. */
const INTERNAL_HOSTNAMES = new Set([
  LOCAL_HOSTNAME,
  '127.0.0.1',
  ...SITE_HOSTNAMES,
]);

export const localOrigin = (port) => `http://${LOCAL_HOSTNAME}:${port}`;

/** Rewrites same-site absolute URLs onto the local static server. */
export function urlRewriteExpressions(port) {
  return SITE_HOSTNAMES.map((hostname) => ({
    pattern: new RegExp(`^https?://${hostname.replace(/\./g, '\\.')}(?=/|$)`),
    replacement: localOrigin(port),
  }));
}

export function isInternalLink(link) {
  try {
    return INTERNAL_HOSTNAMES.has(new URL(link).hostname);
  } catch {
    return false;
  }
}

/** External mode checks every host (manual run); internal mode only same-site. */
export function shouldSkipLink(link, mode) {
  return mode === 'internal' && !isInternalLink(link);
}
