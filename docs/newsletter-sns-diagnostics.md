# Phase 3 SNS transport diagnostics — 2026-09-08

Scope: diagnose only. No SES destination attachment, email, confirmation-token logging, or database changes. The real SNS authentication code is unchanged.

## Reproduced findings

- At 12:24:05 UTC, a control POST containing `{}` with `Content-Type: text/plain; charset=UTF-8` and no Origin to `https://leonlins.com/api/newsletter/ses-events` returned 403 with `Cross-site POST form submissions are forbidden`. Response headers included Cloudflare (`cf-ray: a37ded95e972b544-EWR`) and Vercel (`x-vercel-id: iad1::iad1::dwfn6-1788870244826-0eedb3df93a5`). This control reached both providers.
- At 12:25:13 UTC, the same control to the public `avoid-boring-people.vercel.app` alias returned the identical 403 directly from Vercel. Cloudflare is not required to reproduce the rejection.
- The installed Astro `dist/core/app/middlewares.js` origin-check middleware rejects unsafe methods with a form-like content type (including `text/plain`) unless Origin matches the request URL origin. This happens before route code. Earlier `application/json` tests did not exercise this condition.
- At 12:23:45 UTC, an unauthenticated control POST to the staged deployment hostname returned 302 to Vercel sign-in. The deployment hostname has an additional access gate, separate from Astro. Protection was not disabled.
- An authenticated CLI control at 12:24:12 UTC reached the staged probe and returned 204 for an eight-byte non-JSON body under `application/json`. The runtime log contained exactly content-type, user-agent, the two allowed SNS headers (null for this control), and bodyBytes=8. No body was logged. The CLI automatically generated a deployment-protection bypass token; its value was not printed or committed. A further authenticated control was blocked by automatic approval review; no retry or workaround was attempted.

These are controlled HTTP requests, not evidence of actual SNS POST delivery. Absence of handler logs does not prove an AWS-side delivery failure. Do not open AWS Support on the strength of the earlier diagnosis alone.

## Temporary probe

- Source: `src/pages/api/newsletter/sns-probe.ts`. Streams and counts bytes, performs no parsing, logs only the five requested metadata fields with bounded header values, and returns 204. It has no database or SNS confirmation dependencies.
- Staged deployment: `dpl_8dD7cLGS9BiHZYmox37asC2TvxEA`, Ready, normal remote build, deployed with `--prod --skip-domain`.
- Host: `https://avoid-boring-people-6btq9sdj8-leons-projects-b248d9a2.vercel.app`.
- The live custom domain was not promoted to this probe deployment. Its baseline is `dpl_AhSw3dofJejuQ995JZs2AQs1VzmT`.
- Full tests, build, diff check, and a focused direct probe invocation passed. The focused check covered non-JSON input, multibyte body length, 204, and exclusion of the body and Authorization header from logs.

## Sequential SNS tests

| Test | State | Actual SNS POST generated/received | Provider observation |
| --- | --- | --- | --- |
| 1. Controlled external request capture | Not run: AWS session expired | Unknown | A disposable Webhook.site capture was created at 12:22:39 UTC with one-hour expiration, ten-request history, 204 response, and actions disabled. Recreate if expired. Never follow captured confirmation URLs. |
| 2. Exact Vercel deployment hostname `/api/newsletter/sns-probe` | Not run; must follow test 1 | Unknown | Unauthenticated control gets Vercel sign-in redirect. Do not disable protection or put bypass credentials in SNS URLs. |
| 3. `leonlins.com/api/newsletter/sns-probe` | Not run; must follow test 2 | Unknown | Probe is not promoted. Existing real-handler control reaches Cloudflare and Vercel and gets Astro 403. |

The browser is left at AWS sign-in. Resume after login, record UTC timestamps and safe metadata for each actual subscription attempt in order, and distinguish application logs from edge/provider receipt. Keep pending probe subscriptions unconfirmed. Remove the temporary probe and dispose of the external capture after the requested tests isolate the cause; do not leave the probe on the public site.

## Real-handler latency gate

The real handler has two serial HTTPS operations with nominal ten-second timeouts. That does not guarantee completion within the approximately fifteen-second SNS request window; the Node request timeout is not a total wall-clock deadline. No real confirmation reached the handler during this run, so confirmation latency is unmeasured. Before declaring the handshake fixed, measure total latency and enforce a shared deadline comfortably below the SNS window while retaining certificate, exact-topic, and signature validation. No timeout or authentication change was made during this diagnostics-only run.
