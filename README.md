# Avoid Boring People — leonlins.com

Leon Lin's personal website and publishing platform, published under the
**Avoid Boring People** identity. An Astro 7 static site for essays, plus two
owned-distribution systems — automated social posting and a self-hosted
newsletter — a first-party article discussion, and a small contact flow for
inbound notes. This repository is public;
secrets live only in ignored local files, GitHub Secrets, and Vercel environment
variables — never in git.

The repo holds six systems:

1. **Blog / site** — the Astro static site. Markdown/MDX articles under
   `src/content/blog` render at `/writing/[slug]`; `/writing` is the canonical
   archive. Search, RSS, sitemap, and static publishing are built in.
2. **Autopost** — `scripts/automation/` publishes each article to the social
   channels in `scripts/automation/routing.py`’s `DEFAULT_PLATFORMS`,
   the canonical default destination set. One author-voice distillation per
   article is rendered per platform: an X/Bluesky thread with the link framed
   as the final reply, single self-contained posts with inline links on
   Mastodon/Farcaster/Nostr, a standalone idea plus link self-reply on
   Threads, a full-body DEV syndication with canonical URL, and a rendered
   carousel on Instagram with a link-in-bio caption. Tumblr is temporarily
   paused after OAuth failures, and LinkedIn drafting is manual; experimental
   and dormant adapters are not default destinations. Details and per-channel
   rationale: [docs/social-distribution.md](docs/social-distribution.md).
3. **Newsletter subscription** — an owned list (Neon Postgres + Amazon SES)
   with public signup cut over on October 14, 2026. Legacy subscriber import
   remains separately gated; no production campaign email
   sends without a local human-confirmed CLI action. First-party attribution and
   a read-only analytics report measure acquisition, growth, and deliverability
   from the owned tables. Details:
   [docs/newsletter-migration-plan.md](docs/newsletter-migration-plan.md),
   [docs/newsletter-aws-runbook.md](docs/newsletter-aws-runbook.md),
   [docs/newsletter-analytics.md](docs/newsletter-analytics.md).
4. **Article discussion** — a small first-party discussion under each article
   (Neon Postgres, accountless opaque browser token, Cloudflare Turnstile,
   local-only moderation CLI). It replaced Giscus, so no GitHub account is
   needed and no third party sees reader activity. Details:
   [docs/discussion.md](docs/discussion.md).
5. **Contact notes** — a three-field note form offered on `/about`, `/now`, and
   `/contact` (no navigation entry). A note is stored in Neon, emailed to the
   author through SES, and optionally handed off to Lin Check for human review;
   it is never scored, never a relationship record, and never an automated
   funnel. Details: [docs/contact.md](docs/contact.md).
6. **Lin Scout** — `scripts/scout/`, an internal discovery tool that finds the
   few current external conversations (Hacker News, Bluesky) where an existing
   article would be a useful contribution, and drafts the reply. It runs daily
   in its own workflow, never publishes anything, and keeps live reports and state out of
   public git in an encrypted Actions artifact. Details: [docs/scout.md](docs/scout.md).

## Draft newsletter workflow

Write `src/content/blog/<article>/index.md` with the usual frontmatter plus
`draft: true` (omitted means `false`). Keep images in that article's directory,
for example `![Chart](./chart.webp)`. Drafts and translations of draft sources
are excluded from public routes, discovery, RSS, sitemap, search, related posts,
public newsletter assets and social distribution. The source stays in Git; use
only private repositories for confidential drafts. Files placed manually in
`public/` are public regardless of article status.

```sh
# Offline browser preview, using the existing newsletter layout and embedded images.
npm run newsletter:preview:local -- <article>/index.md /tmp/newsletter-draft.html
# Open /tmp/newsletter-draft.html in a browser. No build/deploy, SES or database needed.

# Sends ONE real preview only when you deliberately run it. Uses existing .env.local
# SES credentials/configuration and NEWSLETTER_TEST_RECIPIENTS allowlist.
npm run newsletter:test -- <article>/index.md <allowlisted-email> --confirm-test
```

Private previews support PNG, JPEG, GIF and WebP files within the article
folder, including subfolders. Escaping paths/symlinks, missing/invalid files and
unsupported formats fail before sending. Repeated paths share one CID attachment;
limits are 5 MiB per image, 10 MiB total and 20 images. Test subjects start with
`[TEST]`; unsubscribe links are deliberately nonfunctional. No subscribers or
campaigns are created. Browser preview embeds data URLs; test email uses SESv2
inline CID attachments. External HTTPS images retain their existing URLs.

To publish, review the private preview, set `draft: false`, and submit the article
through the normal publishing PR. **Merging that change to main publishes the
article and queues normal social distribution** after deployment; draft-to-published
transitions now count as new publication. Ordinary edits do not trigger new-article
social distribution, and existing per-platform history still prevents duplicates.
Restart `astro dev` after content-config changes if using a running development server.

Production campaigns reject drafts, including an article made draft after snapshot.
Production email keeps public image URLs; no CID/data-URL mode is added to the sender.
After the published article's deployment is live, run the read-only check:

```sh
npm run newsletter:images:check -- <article>/index.md
```

The production sender repeats this GET-only image check before any send-state
change: public HTTPS, no redirects, successful image response and valid bytes
(up to 10 MiB each, with a 10-second request timeout). Existing production preview,
content-digest, recipient-count, SES and explicit-send approvals still apply.
A local draft preview is not production-content approval.

Verification: `npm test`, `python -m pytest tests -q`, `npm run lint`,
`npm run build`, and `npm run test:drafts:build`. The last command builds disposable
draft fixtures and checks a local browser preview with networking blocked. Received
Gmail rendering must be checked by an operator after a separately authorized
allowlisted test send: confirm inline images are visible, including a repeated image,
and that the subject has `[TEST]`. No received-mail validation is claimed without
that live check.

## Newsletter email presentation and hosted preview

The email starts with a Georgia headline from YAML `title`, a visible
`description` subtitle (when present), and
`Leon Lin · <pubDate>` metadata. Dates use English month names and UTC so date-only
YAML values do not shift with the CLI machine's timezone. The 640px container,
centered 560px charts and original website images are preserved. Links use the
website blue (`#0066cc`). Compact footnotes retain every ID and backlink.

Published editions link to the canonical article inline with the author/date and inline after
“What did I miss? Reply to this email.” Draft previews omit those links. The
hidden description-based preheader remains optional; set
`NEWSLETTER_PREHEADER_ENABLED=false` to disable only the inbox snippet, not the
visible subtitle. The plain-text edition includes the subtitle only once.

Standard non-commercial editorial previews and sends are addressless. They do
not require or display `NEWSLETTER_POSTAL_ADDRESS`, even if a legacy value exists.
The footer contains the publication identity, unsubscribe and privacy links.
**Do not repurpose addressless editorial mail for commercial advertising or
promotion without reviewing [CAN-SPAM requirements](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business),
including sender identification and a valid postal address.** Content classification
is an operator responsibility, not something this renderer determines. Explicit
`postalAddress` rendering and `newsletterPresentation(env, true)` validation are
retained for a future reviewed use; no promotional command or campaign mode is added.

The renderer changes invalidate existing approval digests. Generate and review a
fresh production preview before campaign approval; no stored campaign/recipient
records are updated or grandfathered. Preheader and any explicitly supplied sender
identification remain covered by the rendered-content digest.

After publication, this command sends **one** hosted-image preview only when
explicitly run by the operator:

```sh
npm run newsletter:test -- <article>/index.md <allowlisted-email> --hosted --confirm-test
```

It checks the canonical page and public image URLs with GET requests first,
uses the addressless production-format editorial body, prefixes the
subject with `[TEST]` plus a unique preview timestamp, and uses the existing
nonfunctional test unsubscribe token. It has no subscriber lookup or campaign
creation. The default test command still uses private CID images. Real campaign
mail retains its working per-recipient unsubscribe token and one-click headers;
the visible unsubscribe link remains in the minimal footer.

The existing `newsletter:preview` command renders the same production presentation
and approval digest locally (with the existing preview unsubscribe URL setting).
`npm run test:newsletter:layout` verifies desktop/mobile layout and footnote/footer
accessibility offline. See [the Gmail investigation](docs/newsletter-email-rendering.md)
for the received-message evidence and the remaining Gmail UI retest.

## Project structure

```text
├── src/content/blog/      # canonical articles (Markdown/MDX, one dir per post)
├── src/pages/             # routes, incl. /api/newsletter/*, /api/comments/*, /api/contact
├── src/components/        # shared UI, incl. SubscribeForm.astro, Discussion.astro
├── scripts/automation/    # social distribution (summarizers, renderers, publishers)
├── scripts/newsletter/    # owned-newsletter CLIs (import, preview, campaign, send, analytics)
├── scripts/comments/      # discussion moderation CLI (list, hide, restore, delete, reply)
├── scripts/scout/         # Lin Scout discovery tool (inventory, discovery, matching, filtering, CLI)
├── migrations/            # Neon Postgres schema migrations
├── docs/                  # runbooks, evaluations, per-system documentation
├── tests/                 # Python distribution/newsletter suites + TS runner
├── posted.json            # per-article, per-platform publish ledger
└── engagement.json        # public like/repost/reply counts ledger
```

New articles go in `src/content/blog/<slug>/index.md` (see
[docs/template.md](docs/template.md) for frontmatter). Push-triggered
workflows wait for the article to be live in the deployed search index, then
run distribution; evergreen cycles republish back-catalog pieces three times
weekly (Tuesday and Thursday mornings, Sunday evening, Eastern).

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
| Substack import dry run | See [read-only preflight commands](docs/newsletter-import-runbook.md#read-only-preflight), including retained cancellation evidence |
| Apply verified Substack import | See [the guarded import runbook](docs/newsletter-import-runbook.md#future-import--only-after-separate-authorization) for all mandatory approval flags |
| Newsletter preview | `npm run newsletter:preview -- <article-id> [output-file]` |
| Allowlisted newsletter test | `npm run newsletter:test -- <article-id> <recipient> --confirm-test` |
| Production campaign snapshot | `npm run newsletter:campaign -- <article-id> --expect-recipients <n> --confirm-snapshot` |
| Production newsletter send | `npm run newsletter:send -- <campaign-id> --expect-recipients <n> --confirm-production` |
| Newsletter analytics report | `npm run newsletter:analytics -- [--days <1-365>] [--json] [--check]` |
| Email the analytics report | `npm run newsletter:analytics:email -- --to <allowlisted-address> --confirm-send [--days <1-365>]` |
| Scheduled author report | `npm run newsletter:analytics:author -- [--dry-run]` (recipient fixed by `NEWSLETTER_AUTHOR_REPORT_TO`; installed as the first-Tuesday 11:30 ET timer in [deploy/systemd](deploy/systemd)) |
| Review discussion comments | `npm run comments:list -- [--slug <slug>] [--include-hidden]` |
| Hide a discussion comment | `npm run comments:hide -- <comment-id>` |
| Restore a hidden comment | `npm run comments:restore -- <comment-id>` |
| Delete a comment and its replies | `npm run comments:delete -- <comment-id> --confirm-delete` |
| Post an author reply | `npm run comments:reply -- --parent <comment-id> --body "..." --confirm-reply` |
| Translation status | `npm run translations:status` |
| Translate one article | `npm run translations:translate -- --locale <code> --slug <slug>` (local Google ADC only; see [docs/translations.md](docs/translations.md)) |
| Scout dry run (no side effects) | `python -m scripts.scout run --dry-run` |
| Scout run | `python -m scripts.scout run` (needs `DEEPSEEK_API_KEY`; run `--dry-run --no-llm` to inspect discovery without one) |
| Scout queue | `python -m scripts.scout list`, `python -m scripts.scout dismiss <url>`, `python -m scripts.scout acted <url> --outcome "..."` |

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
  or `complained` subscribers. Resubscription is explicit and confirmation-only:
  a signup request on an `unsubscribed` row issues a fresh token and leaves the
  row suppressed until it is confirmed, while `bounced` and `complained` rows
  are never reopened.
- SES/SNS event ingestion authenticates messages before changing subscriber
  state; missing email-rendering support fails visibly rather than sending
  broken mail.
- Failures alert with one greppable `newsletter_alert` log line for
  `signup_pipeline_failure`, `ses_event_ingestion_failure`, or
  `analytics_job_failure`, carrying only a reason and an error name; there is no
  monitoring service, no retry queue, and no paging integration.
- Signup attribution is first-touch and written only through the owned signup
  path; the
  analytics report is read-only and never estimates opens, clicks, or engaged
  readers.
- The analytics report reaches only the author: it goes from
  `newsletter@leonlins.com` to the one address fixed by
  `NEWSLETTER_AUTHOR_REPORT_TO`, which must be on the
  `NEWSLETTER_TEST_RECIPIENTS` allowlist. Subscribers are never addressed, the
  manual command keeps requiring `--to` and `--confirm-send`, and the monthly
  run is a local user timer — no build, deploy, or CI job emails a report.
- Public signup uses the owned endpoint exclusively; Substack archive/editorial links remain.
- Discussion moderation stays local and explicit; hidden comments are never
  returned publicly, and the author badge is set only by the operator CLI.
- The discussion stores no IP addresses, no email addresses, and no raw browser
  tokens — only a SHA-256 hash of the token, which is never logged.
- A note stays a note: the contact flow stores what someone wrote and emails it,
  and it never creates a Person, scores a sender, subscribes an address, or
  becomes a relationship record on its own.
- Lin Scout reports and never publishes: it has no posting path, no database,
  and no coupling to the site build. Its gitignored `scout-state.json` is restored from an
  encrypted workflow artifact and records every URL it has shown, in any status, so it never
  surfaces the same conversation twice.

## Docs index

| Doc | What it is |
| --- | --- |
| [docs/social-distribution.md](docs/social-distribution.md) | Autopost design: copy engine, per-channel formats, link placement, token rotation, local review |
| [docs/newsletter-migration-plan.md](docs/newsletter-migration-plan.md) | Migration design/history and phased acceptance gates; use the AWS runbook for operations |
| [docs/newsletter-aws-runbook.md](docs/newsletter-aws-runbook.md) | SES/SNS/Vercel setup and the local production-send workflow |
| [docs/newsletter-analytics.md](docs/newsletter-analytics.md) | First-party attribution model, metric definitions, and the local report CLI |
| [docs/discussion.md](docs/discussion.md) | First-party article discussion: data model, identity, abuse controls, API, moderation CLI |
| [docs/contact.md](docs/contact.md) | Contact notes: submission flow, notification email, schema, Lin Check handoff contract |
| [docs/translations.md](docs/translations.md) | Local Google Cloud Translation setup and resumable article CLI |
| [docs/scout.md](docs/scout.md) | Lin Scout: sources, matching and gates, judgment contract, state, scheduling |
| [docs/github-action-evaluation.md](docs/github-action-evaluation.md) | Workflow coverage, quality signals, known gaps |
| [docs/email_digest_evaluation.md](docs/email_digest_evaluation.md) | Summarizer/ranking assessment and opportunities |
| [docs/template.md](docs/template.md) | Article frontmatter template |
| [AGENTS.md](AGENTS.md) | Repository operating guide (priorities, invariants, commands, change policy) |

`TODO.md` is the author's working task list; `VERSION.md` is the version
history. Neither is load-bearing for builds.
