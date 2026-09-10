# Newsletter migration plan

## Objective and boundaries

Move **Avoid Boring People by Leon Lin** from Substack as its operational newsletter system to an owned system while retaining Substack as an optional manual cross-post/discovery channel during transition. `/writing` and the existing Markdown/MDX content remain canonical; every newsletter is the full article rendered for email.

The owned system is deliberately narrow: Neon managed Postgres for subscriber and campaign state, Amazon SES for delivery, short Astro/Vercel request handlers for subscriber lifecycle and SNS events, and an explicitly invoked local CLI for campaign work. It excludes paid memberships, marketing automation, generalized segmentation, custom tracking, and automated sending from builds, CI, or deployments.

## Current state and target runtime

The repository runs Astro 5.13.7 with static output. Phase 1 added the compatible Vercel adapter only to support isolated on-demand newsletter lifecycle routes; all normal pages remain static. `src/pages/newsletter.astro` is presently superseded by the `/newsletter -> /#subscribe` redirect, while `SubscribeForm.astro` and `src/pages/api/subscribe.ts` use the production Substack endpoint. Do not change signup behavior in Phases 0–4.5. One exception is recorded: `src/pages/api/subscribe.ts` carries `export const prerender = false` so the Substack fallback route deploys on the static-default site; this changes no signup behavior.

When owned endpoints are introduced, install and configure the current compatible `@astrojs/vercel` adapter, retain static output, and add `export const prerender = false` only to dynamic newsletter endpoints. Do not use Astro's removed `output: 'hybrid'` mode or convert the full site to server output without a documented framework requirement.

The future public runtime surface is intentionally isolated:

- `POST /api/newsletter/subscribe`: accepts normalized email, honeypot, and bounded source metadata; applies IP and email rate limits; always returns a generic response.
- `GET /api/newsletter/confirm`: validates a one-time confirmation token and transitions a pending subscriber to active.
- `GET /api/newsletter/unsubscribe`: renders a non-mutating confirmation page so mailbox link scanners cannot suppress a subscriber. `POST` performs the idempotent visible or RFC one-click action using the bearer token and does not require login.
- `POST /api/newsletter/ses-events`: validates SNS signatures and the expected TopicArn before idempotently recording delivery, bounce, and complaint state.

## Data and consent design

Use standard portable Postgres tables and migrations, with lowercased `email_normalized` and a unique index on it. `subscribers` contains identity, status (`pending`, `active`, `unsubscribed`, `bounced`, `complained`), source/provenance, historical Substack fields, confirmation and unsubscribe token hashes, and timestamps. `campaigns` records article slug, subject, and lifecycle. `campaign_recipients` records recipient state, SES message ID, send/event data, and has a unique `(campaign_id, subscriber_id)` index.

Only `pending -> active` is an automatic activation transition. `active` may move to `unsubscribed`, `bounced`, or `complained`; automated jobs and imports may never reactivate any suppressed status. Tokens are cryptographically random and only their hashes are stored. Raw tokens must not be logged.

The importer accepts a supplied Substack export and supports dry-run mode. It excludes the publication Author; imports rows with a cancellation date as `unsubscribed`; imports uncancelled legitimate recipients as `active`; ignores `Expiration date = Paused` and commercial type for status. It preserves source detail, original dates, cancellation evidence, and consent provenance; it does not import engagement history. Repeated imports are idempotent and never reactivate suppressions.

## Email, sending, and events

The renderer consumes content from `src/content/blog/<article>/index.md` and produces constrained email HTML and plain text—not rendered Astro page HTML. It supports the current common Markdown primitives and fails explicitly for unsupported MDX/components. It resolves internal links and relative assets to public `https://leonlins.com` URLs, rejects local/private or unresolved asset paths, and emits no relative or localhost URLs. This is material because existing posts frequently reference co-located `./*.webp` and `./*.png` files. Use conservative inline, email-safe styles and warn/fail before Gmail's approximate 100 KB clipping threshold.

Every mail includes the visible From `Leon Lin <newsletter@leonlins.com>`, Reply-To `contact@leonlins.com`, a human-readable unsubscribe link, privacy-policy link, and `List-Unsubscribe` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers. The current renderer intentionally omits a physical postal address at the author's direction and is limited to editorial editions. Do not use it for editions whose primary purpose is commercial advertising or promotion without revisiting this compliance decision; never hard-code a guessed address.

The local CLI provides `newsletter:preview`, `newsletter:test`, and guarded campaign snapshot/send commands. Preview never sends; test sends use only configured test recipients; production runs locally and defaults to no send. Before sending, it checks explicit production environment selection, campaign state/idempotency, eligible/suppressed counts, legal footer, generated unsubscribe URLs, SES configuration set, production access, quota/rate/capacity, and rate limits/batches. A crash or retry must not resend an existing campaign recipient.

SES uses a configuration set and SNS event destination. SNS handling verifies certificate/signature per AWS guidance before trusting the body, restricts processing to the expected TopicArn, safely handles `SubscriptionConfirmation`, validates message structure, deduplicates SNS MessageId values, and only then updates subscriber/campaign state. The database is canonical for mailing eligibility; SES account suppression is an additional guard.

## AWS, DNS, and privacy prerequisites

Use a new AWS account with MFA/root security and budget alerting. Configure SES identity, DKIM, SPF and DMARC alignment, a custom `mail.leonlins.com` MAIL FROM domain if DNS permits it, configuration set, account-level suppression, SNS destination, quotas, and production-access request. Start on shared IPs.

Keep separate least-privilege identities: a local sender profile with sending/quota permissions only, and Vercel-specific confirmation credentials with only required send permission. Store Vercel credentials as Vercel environment secrets; do not commit credentials or reuse the sender identity. SNS ingestion receives no AWS credentials unless truly required.

Before infrastructure work, confirm the DNS provider and record authority; existing SPF/DKIM/DMARC; availability of `mail.leonlins.com`; TXT/CNAME/MX capability; inbound-mail routing conflicts; and that `contact@leonlins.com` is monitored. Do not guess or modify DNS in Phase 0. Add a factual privacy-policy page before public owned signup, covering Substack migration, Neon storage, SES delivery, double opt-in, suppression/event processing, and consent history.

## Phases and acceptance gates

### Phase 0 — contract and audit

Create `AGENTS.md`, this plan, and `docs/newsletter-status.md`; inspect repository paths, commands, content/assets, and deployment shape. No production behavior, AWS, DNS, database, or email changes. Stop at the external-input gate.

### Phase 1 — subscriber ownership

Add Neon integration, schema/migrations, status invariants, isolated owned routes, double opt-in, unsubscribe/one-click unsubscribe, minimal rate limits and honeypot, plus dry-run importer and focused tests. Develop SES confirmation only to verified sandbox recipients. Do not expose owned signup or overwrite `src/pages/api/subscribe.ts`.

### Phase 2 — email renderer

Implement constrained HTML/plain-text rendering, URL and image strategy, legal footer configuration, privacy policy, preview, test-send-only workflow, one-click headers, and renderer tests. Production delivery remains prohibited.

### Phase 3 — production plumbing

Add SES/DNS/IAM runbooks, configuration-set and SNS integration, authenticated event ingestion, campaign/idempotency state, and local CLI batching/rate limiting/quota checks. No full-list send.

### Phase 4 — controlled validation

Validate SES production access, arbitrary-address confirmations, authentication/alignment, custom MAIL FROM, SNS lifecycle events, unsubscribe, quota and duplicate-send protection, Gmail/Outlook/Yahoo delivery, footer/privacy policy, and DNS compatibility using controlled test recipients/cohorts only.

### Phase 4.5 — warm-up

Use an explicit, transparent cohort selector. Begin with roughly 200–300 recently active recipients when reliable activity exists, otherwise most recently subscribed legitimate active recipients; grow conservatively over about 4–8 weeks. Record each cohort and results. Hold expansion and investigate when complaint rate reaches 0.1% or hard-bounce rate reaches 2%; lower is better. Do not send the whole legacy list merely because SES production access exists.

### Phase 5 — cutover

Only after successful validation and warm-up: switch canonical signup to the owned route, replace `/newsletter` with its acquisition page, and use SES/local CLI as canonical sender. Keep Substack for optional manual cross-posting and retain a rollback path until owned production operation is stable. Do not delete the legacy integration prematurely.

## Test and verification requirements

- Importer: normalization, Author exclusion, cancelled suppression, ignored Paused value, provenance, dry-run, idempotency, and no automatic reactivation.
- Subscription lifecycle: generic responses, honeypot/rate limits, token hashing, confirmation, idempotent unsubscribe, and forbidden transitions.
- Renderer: absolute internal links/assets, unchanged external HTTPS links, no relative/localhost URLs, explicit unsupported-image/component errors, HTML-size check, and HTML/plain-text output.
- Sending: required confirmation flag, test-recipient restriction, quota failure, campaign recipient uniqueness, restart/retry safety, and no production sends from test/build/deploy paths.
- Events: invalid SNS signatures/topic/schema rejected; valid notifications deduplicated and applied correctly.

After every phase, run focused tests plus `npm test` and `npm run build` when relevant, inspect the diff, update the status document, and stop at the next human or external gate.
