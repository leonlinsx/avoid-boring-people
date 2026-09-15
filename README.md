# Avoid Boring People — leonlins.com

Leon Lin's personal website and publishing platform, published under the
**Avoid Boring People** identity. An Astro 5 static site for essays, plus two
owned-distribution systems: automated social posting and a self-hosted
newsletter. This repository is public; secrets live only in ignored local
files, GitHub Secrets, and Vercel environment variables — never in git.

The repo holds three systems:

1. **Blog / site** — the Astro static site. Markdown/MDX articles under
   `src/content/blog` render at `/writing/[slug]`; `/writing` is the canonical
   archive. Search, RSS, sitemap, and static publishing are built in.
2. **Autopost** — `scripts/automation/` publishes each article to the social
   channels in `DEFAULT_PLATFORMS` (currently Bluesky, Mastodon, DEV,
   Farcaster, Nostr, Threads, Instagram). One author-voice distillation per
   article is rendered per platform: an X/Bluesky thread with the link framed
   as the final reply, single self-contained posts with inline links on
   Mastodon/Farcaster/Nostr, a standalone idea plus link self-reply on
   Threads, a full-body DEV syndication with canonical URL, and a rendered
   carousel on Instagram with a link-in-bio caption. Details and per-channel
   rationale: [docs/social-distribution.md](docs/social-distribution.md).
3. **Newsletter subscription** — an owned list (Neon Postgres + Amazon SES)
   being migrated off Substack, currently in controlled validation. Public
   signup is still Substack until the explicit cutover; no production email
   sends without a local human-confirmed CLI action. Details:
   [docs/newsletter-status.md](docs/newsletter-status.md),
   [docs/newsletter-migration-plan.md](docs/newsletter-migration-plan.md),
   [docs/newsletter-aws-runbook.md](docs/newsletter-aws-runbook.md).

## Project structure

```text
├── src/content/blog/      # canonical articles (Markdown/MDX, one dir per post)
├── src/pages/             # routes, incl. /api/newsletter/* lifecycle endpoints
├── src/components/        # shared UI, incl. SubscribeForm.astro
├── scripts/automation/    # social distribution (summarizers, renderers, publishers)
├── scripts/newsletter/    # owned-newsletter CLIs (import, preview, campaign, send)
├── migrations/            # Neon Postgres schema migrations
├── docs/                  # runbooks, evaluations, per-system documentation
├── tests/                 # Python distribution/newsletter suites + TS runner
├── posted.json            # per-article, per-platform publish ledger
└── engagement.json        # public like/repost/reply counts ledger
```

New articles go in `src/content/blog/<slug>/index.md` (see
[docs/template.md](docs/template.md) for frontmatter). Push-triggered
workflows wait for the article to be live in the deployed search index, then
run distribution; evergreen cycles republish back-catalog pieces twice weekly.

## Commands

All commands run from the repo root.

| Purpose | Command |
| --- | --- |
| Install | `npm install` |
| Run locally | `npm run dev` |
| Build | `npm run build` |
| Preview built site | `npm run preview` |
| Lint | `npm run lint` |
| Test (all JS/TS suites) | `npm test` |
| Test (Python suite) | `python -m pytest tests -q` |
| Autopost dry run (no side effects) | `DRY_RUN=true POST_MODE=thread PLATFORM=twitter,bluesky,mastodon,devto python -m scripts.automation.auto_post` |
| Substack import dry run | `npm run newsletter:import:dry-run -- <substack-export.csv>` |
| Apply verified Substack import | `npm run newsletter:import -- <file> --expect-active <n> --expect-suppressed <m> --confirm-import` |
| Newsletter preview | `npm run newsletter:preview -- <article-id> [output-file]` |
| Allowlisted newsletter test | `npm run newsletter:test -- <article-id> <recipient> --confirm-test` |
| Production campaign snapshot | `npm run newsletter:campaign -- <article-id> --expect-recipients <n> --confirm-snapshot` |
| Production newsletter send | `npm run newsletter:send -- <campaign-id> --expect-recipients <n> --confirm-production` |

The dry run prints each channel's eligibility plus the exact copy it would
publish, so voice and formatting can be judged before anything leaves the
machine. The production send commands require explicit confirmation flags and
exact recipient counts — and the send itself additionally requires explicit
human approval every time. `npm install`, tests, builds, pushes, CI, and
Vercel deploys never send email or social posts.

## Safety invariants

- `/writing` is the canonical article archive; Markdown/MDX is the canonical
  content source.
- Production email requires an explicit human local-CLI action. Nothing
  unattended (CI, deploys, builds, schedules) may send it.
- A recipient never receives a campaign twice after a retry or resume;
  scheduled/runtime work is safe to retry (`posted.json` is written only after
  a platform confirms success; campaign recipients carry unique constraints).
- Imports and automated processing never reactivate `unsubscribed`, `bounced`,
  or `complained` subscribers.
- SES/SNS event ingestion authenticates messages before changing subscriber
  state; missing email-rendering support fails visibly rather than sending
  broken mail.
- The Substack integration is preserved until the explicit cutover.

## Docs index

| Doc | What it is |
| --- | --- |
| [docs/social-distribution.md](docs/social-distribution.md) | Autopost design: copy engine, per-channel formats, link placement, token rotation, local review |
| [docs/newsletter-status.md](docs/newsletter-status.md) | Migration handoff record — current phase, gates, and what is approved |
| [docs/newsletter-migration-plan.md](docs/newsletter-migration-plan.md) | Owned-newsletter design, phased gates, data/consent rules |
| [docs/newsletter-aws-runbook.md](docs/newsletter-aws-runbook.md) | SES/SNS/Vercel setup and the local production-send workflow |
| [docs/newsletter-sns-diagnostics.md](docs/newsletter-sns-diagnostics.md) | Phase 3 transport diagnostics record |
| [docs/github-action-evaluation.md](docs/github-action-evaluation.md) | Workflow coverage, quality signals, known gaps |
| [docs/email_digest_evaluation.md](docs/email_digest_evaluation.md) | Summarizer/ranking assessment and opportunities |
| [docs/template.md](docs/template.md) | Article frontmatter template |
| [AGENTS.md](AGENTS.md) | Repository operating guide (priorities, invariants, commands, change policy) |

`TODO.md` is the author's working task list; `VERSION.md` is the version
history. Neither is load-bearing for builds.
