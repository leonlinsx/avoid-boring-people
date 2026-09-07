# Newsletter migration status

## Current phase

**Phase 1 — Subscriber ownership: in progress.**

This status file is the handoff record for the current newsletter migration phase. Update it at the end of every phase or when an external/human gate prevents safe progress. Do not advance phases by implication.

## Completed in Phase 0

- Created the repository operating guide in `AGENTS.md`.
- Recorded the detailed migration design and phased gates in `docs/newsletter-migration-plan.md`.
- Confirmed current behavior: Astro 5.13.7 static site; content under `src/content/blog`; `/writing/[slug]` uses `BlogPost.astro`; `SubscribeForm.astro` and `src/pages/api/subscribe.ts` use Substack; `/newsletter` redirects to `/#subscribe`.
- Confirmed there is no existing Vercel adapter, managed database, owned newsletter endpoint, newsletter CLI, privacy-policy page, or deployment configuration in the repository.
- Identified co-located relative article image assets as an email-rendering risk that must be designed before Phase 2 implementation.

## Phase 1 progress

- Created a portable initial Postgres migration for subscribers, campaigns, campaign recipients, database-backed rate-limit buckets, and event-receipt deduplication.
- Added pure subscriber status, email normalization, and Substack-row mapping rules with tests.
- Added a CSV dry-run inspection command. It reports source rows, Author exclusions, active/suppressed outcomes, and duplicate normalized emails without connecting to a database or changing subscriber data.
- Linked the Neon `leonlins.com` project production branch and initialized `neon.ts`; its deploy plan and deploy were no-ops because the policy declares no new infrastructure.
- The Neon connection values are in ignored `.env.local`; the SQL migration has not been applied to production.
- No endpoint, current subscription flow, deployment configuration, external resource, or email behavior has changed yet.

## Not started

- Phase 2 — Email renderer.
- Phase 3 — SES/AWS production plumbing.
- Phase 4 — Controlled infrastructure validation.
- Phase 4.5 — Warm-up.
- Phase 5 — Cutover.

## Current production behavior

- Substack remains the only production signup and newsletter-sending system.
- The current form posts to `https://avoidboringpeople.substack.com/api/v1/free`.
- `src/pages/api/subscribe.ts` remains untouched.
- No newsletter implementation, external resource creation, DNS change, or email sending has occurred.

## Next human/external gate

Before applying the migration or testing database-backed Phase 1 routes, obtain or confirm:

1. A disposable Neon child branch, created from production, to test the SQL migration before any production application.
2. An SES sandbox identity plus verified test recipient before sending any confirmation email.
3. The Substack export when importer validation begins.

DNS authority, production SES access, a compliant postal address, mailbox confirmation, and privacy-policy approval remain later launch gates; they do not block local Phase 1 development.

## Locked decisions

- Canonical archive: `/writing`; canonical source: repository Markdown/MDX.
- Newsletter brand: `Avoid Boring People by Leon Lin`.
- Owned database: Neon managed Postgres.
- Delivery: Amazon SES; start with shared IPs.
- Runtime boundary: static Astro site plus narrowly scoped Vercel/Astro newsletter endpoints; campaign sends from a local CLI only.
- New subscribers use double opt-in. Legitimate uncancelled legacy subscribers import active; cancelled/suppressed subscribers never reactivate automatically.
- Visible From: `Leon Lin <newsletter@leonlins.com>`; Reply-To: `contact@leonlins.com`; preferred SES MAIL FROM: `mail.leonlins.com` subject to DNS validation.

## Safety reminders

- Never send production mail from an install, test, build, push, CI job, or deployment.
- Never replace the Substack route/form before Phase 5 and a successful warm-up.
- Never treat `Expiration date = Paused` as lost consent; never import a cancellation as active.
- Never mutate subscriber state from unauthenticated SNS traffic.
