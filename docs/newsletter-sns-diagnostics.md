# Phase 3 SNS transport diagnostics — 2026-09-08

Scope: diagnose only. No SES destination attachment, email, confirmation-token logging, or database changes. The real SNS authentication code is unchanged.

## Reproduced findings

- At 12:24:05 UTC, a control POST containing `{}` with `Content-Type: text/plain; charset=UTF-8` and no Origin to `https://leonlins.com/api/newsletter/ses-events` returned 403 with `Cross-site POST form submissions are forbidden`. Response headers included Cloudflare (`cf-ray: a37ded95e972b544-EWR`) and Vercel (`x-vercel-id: iad1::iad1::dwfn6-1788870244826-0eedb3df93a5`). This control reached both providers.
- At 12:25:13 UTC, the same control to the public `avoid-boring-people.vercel.app` alias returned the identical 403 directly from Vercel. Cloudflare is not required to reproduce the rejection.
- The installed Astro `dist/core/app/middlewares.js` origin-check middleware rejects unsafe methods with a form-like content type (including `text/plain`) unless Origin matches the request URL origin. This happens before route code. Earlier `application/json` tests did not exercise this condition.
- At 12:23:45 UTC, an unauthenticated control POST to the staged deployment hostname returned 302 to Vercel sign-in. The deployment hostname has an additional access gate, separate from Astro. Protection was not disabled.
- An authenticated CLI control at 12:24:12 UTC reached the staged probe and returned 204 for an eight-byte non-JSON body under `application/json`. The runtime log contained exactly content-type, user-agent, the two allowed SNS headers (null for this control), and bodyBytes=8. No body was logged. The CLI automatically generated a deployment-protection bypass token; its value was not printed or committed. A further authenticated control was blocked by automatic approval review; no retry or workaround was attempted.

The controls above are distinguished from actual SNS tests below. Absence of handler logs does not prove an AWS-side delivery failure. The external capture and custom-domain request record establish SNS delivery; Astro's pre-route origin check explains the custom-domain rejection.

## Temporary probe

- Source: `src/pages/api/newsletter/sns-probe.ts`. Streams and counts bytes, performs no parsing, logs only the five requested metadata fields with bounded header values, and returns 204. It has no database or SNS confirmation dependencies.
- Staged deployment: `dpl_8dD7cLGS9BiHZYmox37asC2TvxEA`, Ready, normal remote build, deployed with `--prod --skip-domain`.
- Host: `https://avoid-boring-people-6btq9sdj8-leons-projects-b248d9a2.vercel.app`.
- The probe was temporarily promoted for test 3, then baseline `dpl_AhSw3dofJejuQ995JZs2AQs1VzmT` was successfully restored. The probe source and disposable deployment have now been removed. After the usage-limit pause, production had independently advanced to Ready deployment `dpl_5Lj4BLR9bCiaDFUzEUASr152hpZH`; it was left untouched. Final public checks: homepage 200, probe GET 404.
- Full tests, build, diff check, and a focused direct probe invocation passed. The focused check covered non-JSON input, multibyte body length, 204, and exclusion of the body and Authorization header from logs.

## Sequential SNS tests

| Test | State | Actual SNS POST generated/received | Provider observation |
| --- | --- | --- | --- |
| 1. Controlled external request capture | Subscribed 12:33:27 UTC | Yes: captured POST at 12:33:28 UTC | 1,614 bytes; `text/plain; charset=UTF-8`; user-agent `Amazon Simple Notification Service Agent`; message type `SubscriptionConfirmation`; expected topic ARN. Neither Vercel nor Cloudflare site routing is involved. |
| 2. Exact Vercel deployment hostname `/api/newsletter/sns-probe` | Subscribed 12:34:04 UTC | Actual delivery not independently visible in available records | No application/request log found in the subsequent query. Public control returned 302 to Vercel sign-in. This establishes an access gate, but does not prove SNS's exact response or absence of delivery. No protection bypass was used for SNS. |
| 3. `leonlins.com/api/newsletter/sns-probe` | Subscribed 12:35:13 UTC | Yes, strongly correlated: Vercel recorded POST at 12:35:14.037 UTC before any control POST | Request `cklq7-1788870914037-f5e711dfbc01`, domain `leonlins.com`, path `/api/newsletter/sns-probe`, serverless response 403, no route logs. A separate 12:35:40 control returned Astro's exact origin-check error and both Cloudflare/Vercel headers. Cloudflare transit for the SNS request is inferred from the domain path; a separate Cloudflare security-event record was not retrieved. |

All three subscription requests were executed sequentially. None was confirmed by this diagnostic workflow. Their ARN suffixes are respectively `1e5bd3ee-b46b-4d81-933c-c6cd78737fdb`, `d14514df-3b19-4e45-ae5d-b6377669ccf9`, and `4f591dc5-36bc-4702-84d5-507c82644f16`. Pending SNS subscriptions cannot be removed with Unsubscribe; they were not confirmed merely to clean them up. No SES destination was attached and no email was sent.

Capture cleanup was initially blocked because automatic approval review hit a usage limit. After reset, its deletion API returned 404, consistent with the configured one-hour expiry. The disposable Vercel deployment was successfully deleted using `remove --safe`, after it no longer held a live alias. The original probe code remains recoverable in commit `41f01ff`; the disposable deployment is deleted.

The diagnostic objective is complete, with the visibility limitation for test 2 recorded above. The next implementation step is a narrowly scoped solution for the SNS text/plain webhook that preserves origin checks for browser-facing routes and all certificate/topic/signature checks. Do not globally disable origin checks as a shortcut. That fix was not implemented under the diagnostics-only authorization.

## Real-handler latency gate

Resolved in the subsequent authorized fix verification: resending the existing canonical subscription reached the live handler. Vercel logged signature verification and completed SubscribeURL confirmation in **175 ms**. AWS `get-subscription-attributes` returned `PendingConfirmation: false` for `https://leonlins.com/api/newsletter/ses-events`, subscription suffix `e07d2dc4-e685-490a-a820-2b98d1df6503`. The handler retains exact-topic/certificate/signature checks and now bounds the two HTTPS operations by a shared eight-second deadline (four seconds per operation). The previous origin-check diagnosis is confirmed. No SES attachment, newsletter email, or subscriber data mutation was performed. Earlier diagnostic subscriptions remain pending and must not be confirmed; inspect the topic's confirmed destinations again before attaching SES.

The real handler has two serial HTTPS operations with nominal ten-second timeouts. That does not guarantee completion within the approximately fifteen-second SNS request window; the Node request timeout is not a total wall-clock deadline. No real confirmation reached the handler during this run, so confirmation latency is unmeasured. Before declaring the handshake fixed, measure total latency and enforce a shared deadline comfortably below the SNS window while retaining certificate, exact-topic, and signature validation. No timeout or authentication change was made during this diagnostics-only run.
