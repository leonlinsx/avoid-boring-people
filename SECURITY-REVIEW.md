# Security review — contact notes

Scope: the contact / inbound-note flow (`src/lib/contact/*`,
`src/pages/api/contact.ts`, `src/components/ContactNote.astro`,
`src/pages/contact.astro`, `migrations/contact/001_initial.sql`) plus the shared
Turnstile helpers it touches.

Method: read the full diff and every new file, then read the supporting modules
the flow depends on (`src/lib/site-origin.ts`, `src/lib/turnstile.ts`,
`src/middleware.ts`, `src/lib/newsletter/request-origin.ts`,
`src/lib/newsletter/rate-limit.ts`) and executed the validation logic against
injection payloads rather than reasoning about it in the abstract.

Verdict: no critical and no high findings. One medium (missing rate limit, a
deliberate scope decision) and five low findings; three were fixed.

| #   | Severity | Location                                                            | Finding                                                                                                                                                                                                                                                                                                                                                                                                     | Confidence | Status                                                                                                                             |
| --- | -------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | `src/pages/api/contact.ts:9`, `src/lib/contact/handlers.ts:129-234` | No rate limiting on the unauthenticated send-mail endpoint. The only anti-automation controls are Turnstile, the honeypot, the 16 KB cap, and a same-origin check that any non-browser client passes (an absent `Origin` is allowed). A token farm can drive unbounded inserts and unbounded SES sends from the same verified identity as the newsletter (`NEWSLETTER_FROM`), burning shared sending quota. | 9/10       | Accepted, deliberately — see below                                                                                                 |
| 2   | Low      | `src/lib/contact/domain.ts:133,164`                                 | C1 control characters (for example `\u0085`) survived normalization and passed `EMAIL_SHAPE`, reaching the SES `ReplyToAddresses` value as a residual header-boundary character.                                                                                                                                                                                                                            | 9/10       | **Fixed** — the forbidden class now spans `\u007f-\u009f`                                                                          |
| 3   | Low      | `src/lib/contact/handlers.ts:135-156`                               | Configuration fingerprinting: `400 verification_failed` versus `503 unavailable` tells an unauthenticated caller whether `DATABASE_URL` and `TURNSTILE_SECRET_KEY` are configured. No secret value leaks.                                                                                                                                                                                                   | 9/10       | Accepted, disclosed                                                                                                                |
| 4   | Low      | `src/lib/contact/lin-check.ts:40-43,94-102`                         | No scheme validation on `LIN_CHECK_INBOUND_URL`, so an operator could send the inbound bearer token over cleartext `http`. The handoff also forwards the three attacker-controlled fields, with a privileged token, into an internal system whose behaviour is not yet defined.                                                                                                                             | 7/10       | **Fixed** — the config rejects a non-`https:` endpoint; `docs/contact.md` states that Lin Check must treat the fields as untrusted |
| 5   | Low      | `.gitignore:27-29`                                                  | `.env`, `.env.local`, and `.env.*.local` are ignored, but `.env.production` / `.env.development` are not, and this change adds `DATABASE_URL`, `TURNSTILE_SECRET_KEY`, `LIN_CHECK_INBOUND_TOKEN`, and SES credentials to the local env surface.                                                                                                                                                             | 9/10       | Accepted as pre-existing, disclosed                                                                                                |
| 6   | Low      | `src/components/ContactNote.astro:98-105`                           | The honeypot input was named `website`, a known autofill token. Autofill would make a genuine note receive "thanks" while nothing was stored and no mail was sent.                                                                                                                                                                                                                                          | 8/10       | **Fixed** — renamed to `note_origin`, with `autocomplete="off"`, `tabindex="-1"`, and `aria-hidden`                                |

## Accepted risks

- **No rate limit (finding 1).** The specification for this flow constrains abuse
  control to Turnstile, the honeypot, the request-size cap, and the same-origin
  check; the repository's rate limiter is wired to the newsletter signup, which
  must stay untouched until the Phase 5 cutover. The residual risk is that a
  solver-driven flood costs SES quota shared with the newsletter. Escalation path
  if that ever happens: reuse `takeRateLimit` from
  `src/lib/newsletter/rate-limit.ts` with a global constant subject, or disable
  the endpoint's notification send.
- **Configuration fingerprinting (finding 3).** Deliberate: the status codes are
  the flow's contract and are pinned by tests, and the information revealed is
  whether the deployment is configured, not any secret value.
- **`.gitignore` gaps (finding 5).** Pre-existing and untouched here; no `.env*`
  file is tracked today.

## Verified as already blocked (do not churn)

- Email header/address injection: `victim@x.com\r\nBcc: …`, newline variants,
  quoted display names, and `victim@x.com<attacker@evil.com>` all fail
  validation; the name collapses CRLF to one space, and the subject and
  `source_page` cannot carry control characters or arbitrary text. The message
  body is HTML-escaped and placed only in text nodes.
- The notification recipient is fixed at `contact@leonlins.com`; the submitter
  appears only as `Reply-To`.
- Turnstile fails closed: a missing secret or a Cloudflare outage refuses the
  note rather than accepting it unverified.
- Cross-origin redirects cannot leak the Lin Check bearer token (the HTTP client
  strips `Authorization` on cross-origin redirects).
- No note body, display name, email address, IP address, or browser token can
  reach a log line; failures emit a reason and an error name only.
