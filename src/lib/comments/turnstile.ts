// Cloudflare Turnstile is the primary anti-automation control. Verification is
// always server-side: the widget token the browser returns is worthless until
// Cloudflare confirms it against the secret key.

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | 'verified'
  | 'invalid'
  | 'unconfigured'
  | 'unavailable';

// Read at build time in the Astro component, because the widget site key is
// public by design and must reach the static article shell. A missing site key
// disables the form rather than submitting comments that could never be
// verified. This module stays free of `import.meta.env` so it can be exercised
// by the Node test suite like the rest of the comment library.
export function turnstileSiteKey(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

let warnedAboutMissingSiteKey = false;

// A missing site key disables the form on every article at once, and nothing
// else reports it: the build still succeeds and readers only see the section as
// temporarily unavailable. The build log is the one place an operator would
// notice, so the warning is emitted once per build rather than once per page.
export function warnIfSiteKeyMissing(siteKey: string | null): void {
  if (siteKey || warnedAboutMissingSiteKey) return;
  warnedAboutMissingSiteKey = true;
  console.warn(
    '[discussion] PUBLIC_TURNSTILE_SITE_KEY is not set: article pages will show the comment form as temporarily unavailable.',
  );
}

// `remoteip` is intentionally not sent: the discussion system stores no IP
// addresses and derives no identifiers from them.
export async function verifyTurnstile(
  token: unknown,
  options: {
    secret?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<TurnstileResult> {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return 'unconfigured';
  if (typeof token !== 'string' || !token.trim()) return 'invalid';

  const fetchImpl = options.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });

  let response: Response;
  try {
    response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
  } catch {
    return 'unavailable';
  }

  if (!response.ok) return 'unavailable';
  try {
    const payload = (await response.json()) as { success?: unknown };
    return payload?.success === true ? 'verified' : 'invalid';
  } catch {
    return 'unavailable';
  }
}
