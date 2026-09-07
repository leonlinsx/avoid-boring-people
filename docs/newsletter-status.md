# Newsletter migration status

## Current phase

**Phase 0 — Audit, repository contract, and implementation plan: complete.**

This status file is the handoff record for the current newsletter migration phase. Update it at the end of every phase or when an external/human gate prevents safe progress. Do not advance phases by implication.

## Completed in Phase 0

- Created the repository operating guide in `AGENTS.md`.
- Recorded the detailed migration design and phased gates in `docs/newsletter-migration-plan.md`.
- Confirmed current behavior: Astro 5.13.7 static site; content under `src/content/blog`; `/writing/[slug]` uses `BlogPost.astro`; `SubscribeForm.astro` and `src/pages/api/subscribe.ts` use Substack; `/newsletter` redirects to `/#subscribe`.
- Confirmed there is no existing Vercel adapter, managed database, owned newsletter endpoint, newsletter CLI, privacy-policy page, or deployment configuration in the repository.
- Identified co-located relative article image assets as an email-rendering risk that must be designed before Phase 2 implementation.

## Not started

- Phase 1 — Subscriber ownership.
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

Before beginning Phase 1, obtain or confirm:

1. DNS provider and permission to create TXT, CNAME, and MX records; current SPF, DKIM, DMARC, `mail.leonlins.com` availability, and inbound-mail conflicts.
2. That `contact@leonlins.com` exists and is monitored.
3. New AWS account ownership/security, SES region, sandbox constraints, and eventual production-access process.
4. A compliant physical postal address or PO box for the production footer.
5. Privacy-policy content approval and publication approach.
6. The Substack export, only when the Phase 1 importer is ready to be developed and tested.

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
