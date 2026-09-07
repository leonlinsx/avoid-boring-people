# Repository guide

## Project purpose

`leonlins.com` is Leon Lin's personal website and publishing platform, published under the **Avoid Boring People** identity. It is primarily a static Astro site whose writing is authored in Markdown/MDX. The planned newsletter creates an owned distribution channel with Neon Postgres and Amazon SES, without becoming a general-purpose newsletter SaaS.

## Product priorities

1. Preserve reliable publishing and site behavior.
2. Protect subscriber consent and sending reputation.
3. Prevent duplicate or accidental production sends.
4. Keep the author workflow simple.
5. Keep infrastructure understandable and portable.
6. Maintain low operating cost.
7. Preserve good site performance and SEO.

## Non-goals

- Do not turn this into a generalized newsletter SaaS, WYSIWYG CMS, analytics suite, or marketing platform.
- Do not add segmentation, A/B testing, referrals, paid memberships, or automation unless explicitly requested.
- Do not add dashboards, distributed infrastructure, queues, Redis, Kafka, worker fleets, microservices, or provider abstractions for hypothetical scale.
- Do not automate production newsletter sends from CI, Vercel deploys, builds, or deployment hooks.

## Current architecture

- Astro 5 static site, configured in `astro.config.mjs`; content schema is in `src/content/config.ts`.
- Article source is `src/content/blog`; `/writing/[slug]` renders articles through `src/layouts/BlogPost.astro`, and `/writing/[page]` provides pagination.
- Shared UI includes `src/components/SubscribeForm.astro`; the home page and article layout use it.
- The current production signup remains Substack: the form posts to `https://avoidboringpeople.substack.com/api/v1/free`, and `src/pages/api/subscribe.ts` proxies that same integration. `/newsletter` redirects to `/#subscribe`.
- Search, RSS, sitemap, and static publishing are already implemented. There is no Vercel adapter, database, owned newsletter route, or newsletter CLI yet.
- The target newsletter architecture is Neon managed Postgres, short Vercel/Astro on-demand endpoints under `/api/newsletter/*`, Amazon SES, and an explicitly run local sender CLI. Normal site pages stay static.

## Important invariants

- `/writing` is the canonical article archive and Markdown/MDX is the canonical content source.
- Production email requires an explicit human local-CLI action. `npm install`, tests, builds, pushes, CI, and Vercel deploys must never send it.
- A recipient must never receive a campaign twice after a retry or resume; scheduled/runtime work must be safe to retry.
- Imports and automated processing must never reactivate `unsubscribed`, `bounced`, or `complained` subscribers. Substack cancellation rows remain suppressed.
- Missing email-rendering support must fail visibly rather than generate broken mail.
- SES/SNS event ingestion must authenticate messages before changing subscriber state.

## Commands

| Purpose | Command |
| --- | --- |
| Install | `npm install` |
| Test | `npm test` |
| Build | `npm run build` |
| Run locally | `npm run dev` |
| Preview built site | `npm run preview` |
| Newsletter preview/test/send | Not implemented; document commands when the local CLI exists. |

## Change policy

- Prefer the smallest implementation that solves the requested problem; do not restructure unrelated code.
- Reuse existing patterns where reasonable and prefer explicit code to generic abstractions.
- Before adding a service, database, queue, framework, major dependency, recurring cost, or agent layer, establish why the current design cannot solve the need.
- Preserve the Substack integration until the explicit Phase 5 cutover.

## Verification

Before completing a change, run the narrow relevant tests, broader checks when core behavior changes, and build/type checks as applicable. Inspect the final diff. Newsletter changes additionally require verification of production-send safeguards and disclosure of anything that cannot be exercised locally.
