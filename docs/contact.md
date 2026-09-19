# Notes from the site

The contact flow exists so that an interesting person can start a conversation
with one click instead of hunting for an address, and so that a promising
inbound is not forgotten. Those are the only two goals.

It is deliberately not lead capture, not a CRM, and not a funnel. There is no
scoring, no qualification, no sequence, no follow-up automation, and no
relationship record. A note is prose someone chose to send, stored so it can be
answered, and it never becomes anything else on its own.

## What a reader sees

`src/components/ContactNote.astro` renders one invitation and, behind it, one
small form. It is used on three surfaces:

- `/about`, inside the existing Contact section: `Email me at
contact@leonlins.com · Send a note`.
- `/now`, after the sentence inviting readers to get in touch.
- `/contact`, where the form starts open. No navigation item, footer link, or
  article template points at it; it is only reachable by direct URL or through
  the sitemap, which does list it.

Progressive disclosure is the whole design. Nothing is submitted on page load.
The invitation reads `Email me at contact@leonlins.com · Send a note`, and the
`Send a note` button is always there while the form below it stays `hidden`
until someone asks for it. The button carries `aria-expanded`/`aria-controls`
so the state is announced rather than only implied. Expanding moves focus to the
name field and
collapsing returns it to the toggle, so focus never sits inside a form that is no
longer rendered. The address is always a plain `mailto:` link first, so the
reader who never wants a form never has to see one.

The form has exactly three fields — name, email, and message — plus Turnstile
and a hidden honeypot. No subject, no company, no budget, no dropdowns, no
required telephone number. `Send` disables while a request is in flight.

The honeypot (`note_origin`, inside `aria-hidden`, `tabindex="-1"`,
`autocomplete="off"`) is deliberately not named or labelled with anything a
browser autofills. A trap filled by autofill would answer a real note with the
same success response a bot gets, and the note would be lost silently.

Two behaviors are worth knowing:

- If the build had no `PUBLIC_TURNSTILE_SITE_KEY`, the form is not rendered at
  all. The invitation and the email link stay, and the build log says why. A
  form that cannot submit is worse than no form.
- On `/contact` the form is already open, so with JavaScript disabled a reader
  sees three fields that do nothing. The email link above it is the intended
  no-JavaScript path.

Client-side feedback reuses the server's own strings, which is why the copy and
the limits live in `src/lib/contact/domain.ts` rather than in the component.

## What happens after Send

`src/pages/api/contact.ts` is the only route (`prerender = false`, `POST`), and
it calls `handleContactNote` in `src/lib/contact/handlers.ts`. The order matters:

1. **Same-origin check.** A foreign `Origin` is refused with `403 cross_site`
   before any body is read, logged as `contact_refused { reason: 'cross_site' }`
   because a mistyped origin or a preview deployment looks exactly like this.
2. **Database check.** No `DATABASE_URL` means `503 unavailable`, logged as
   `contact_refused { reason: 'db_unconfigured' }`.
3. **Body read.** A declared or actual body over 16 KB is refused with
   `413 too_large` before parsing.
4. **Turnstile verification**, through the shared
   `src/lib/turnstile.ts::verifyTurnstile`. A missing secret or a
   Cloudflare outage fails closed with `503`, so no unverified note is ever
   accepted. An invalid token is `400 verification_failed`.
5. **Honeypot.** A filled hidden field is treated as a bot and receives the same
   success response as a person, while storing nothing and sending no mail, so
   the trap leaves nothing to learn from.
6. **Validation**, in `validateContactNote`: name, then its length, then email,
   then its length and shape, then the message and its length. The browser is
   told which field to focus.
7. **Insert**, then **notification email**, then the record that the mail was
   accepted, then the optional handoff. Only the first is durable: a failed
   notification gives the reader `503 delivery_failed` and leaves an unfinished
   row behind rather than pretending the note arrived. Order matters after that:
   `notified_at` is written before the handoff runs, so a handoff that hangs or a
   request that is cut short can cost at worst a repeated handoff, never a
   delivered note that still looks unanswered.

The page a note came from is taken from the browser's own `Referer`, kept only
when it points at this site's canonical origin, reduced to its path, and recorded
as `unknown` when it is absent or untrustworthy. It is context for the reply, not
a conversion signal.

Errors the reader is shown are plain sentences with the email address in them, so
every failure path still ends with a way to reach the author.

## Notification email

`src/lib/contact/notify.ts` sends one mail per stored note through SESv2, from
the site's existing verified identity (`NEWSLETTER_FROM`), to
`contact@leonlins.com`, with the submitter in `Reply-ToAddresses` so replying to
the notification replies to the person.

The body is deliberately small: a single-column, escaped, plain-text-plus-HTML
message carrying the name, address, source page, timestamp, and the message
itself. The subject is `New note from <name> - <page>` (the page is omitted when
unknown), kept ASCII because the name is whitespace-collapsed and control
characters are stripped from it first. No image, no link, no tracking pixel.

**No configuration set is attached**, unlike newsletter subscriber mail. The
SES/SNS events a configuration set publishes are reconciled against campaign
recipients and subscriber addresses by `/api/newsletter/ses-events`, and this is
not subscriber mail; leaving the configuration set out keeps it out of the
lifecycle pipeline instead of feeding that pipeline events it cannot place.

The send is bounded by `NOTIFICATION_TIMEOUT_MS` (five seconds), which is shorter
than the browser's own fifteen-second wait: the reader stops waiting only after
the server has stopped sending, so "the form did not hear back" never means the
notification is still in flight.

## Data model

One additive migration, `migrations/contact/001_initial.sql`, creates one table:

| Column                | Notes                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`                  | `uuid`, primary key, `gen_random_uuid()`. Also the handoff's idempotency key.                                    |
| `name`                | Required, 1–100 characters.                                                                                      |
| `email`               | Required, 3–254 characters.                                                                                      |
| `message`             | Required, 1–2000 characters.                                                                                     |
| `source_page`         | `/about`, `/now`, `/contact`, or `unknown`. Defaults to `unknown`.                                               |
| `created_at`          | `timestamptz`, database clock. The timestamp in the notification email.                                          |
| `notified_at`         | Set as soon as SES accepted the notification. Null means nobody was told, and that is the only unfinished state. |
| `lin_check_synced_at` | Set only when a handoff actually happened. Forensic, not workflow state.                                         |
| `contact_submissions` | Four `CHECK` length constraints mirroring `domain.ts`, as a backstop only.                                       |

The two nullable timestamps are not the same kind of thing. `notified_at` is
workflow state: null means a reader was promised a reply and nobody was told, so
that is the only definition of "unfinished", and the migration indexes exactly
that:

```sql
SELECT id, created_at, notified_at, lin_check_synced_at
FROM contact_submissions
WHERE notified_at IS NULL
ORDER BY created_at;
```

It means "SES accepted the notification", not "the notification reached the
inbox": no configuration set is attached, so no delivery event comes back for
this mail, and a notification that bounces at the mailbox level is only visible
as notes that stopped arriving. Closing a row by hand after answering one from
the inbox is therefore part of the workflow:

```sql
UPDATE contact_submissions SET notified_at = now()
WHERE id = '<id>' AND notified_at IS NULL;
```

That statement is also what keeps the query above an inbox rather than an
archive: rows left behind by a failed notification or a failed bookkeeping write
would otherwise accumulate until a new one stopped being noticeable.

`lin_check_synced_at` is forensic. The handoff is optional and best-effort, so a
null there is the expected state while Lin Check is unwired and, once it is
wired, a failed handoff is reported by its own `lin_check_failure` alert line
rather than by making the row look like a note nobody received.

Nothing in the schema links a note to a subscriber, a comment, a Person, or an
Organization. There is no IP address column and no browser token column.

## Lin Check handoff

`src/lib/contact/lin-check.ts` is an optional, server-to-server handoff to
**Lin Check**, the separate internal system where a human reviews an unknown
sender. The site reports that a note arrived. Nothing more.

The boundary is the point of the module:

- It never reads or writes Lin Check's database, never assumes Lin Check's
  schema, and never creates a Person, an Organization, or a relationship. There
  is no shared database, no shared table, and no shared identifier beyond the
  note's own id.
- A failure is recorded and then ignored: the note was already stored and
  already emailed, so a broken handoff never tells the reader to resend. It is
  reported by the `lin_check_failure` alert line, and the row keeps
  `lin_check_synced_at` null as the forensic trace for a repeat.
- `unconfigured` is not a failure. The feature is inert until both variables are
  set, and the first note that could have been handed off logs one
  `[contact] LIN_CHECK_INBOUND_URL (an https endpoint) or
LIN_CHECK_INBOUND_TOKEN is not set…` warning per process, so an operator can
  tell "not wired up" from "refusing". An endpoint that is not `https` counts as
  unconfigured too: the handoff carries a bearer token.

### The contract

`POST` to `LIN_CHECK_INBOUND_URL`, with:

| Header            | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `authorization`   | `Bearer <LIN_CHECK_INBOUND_TOKEN>`                               |
| `content-type`    | `application/json`                                               |
| `idempotency-key` | the stored submission id, so a repeat cannot create two inbounds |

The `Idempotency-Key` header is the one required contract detail: a retried
handoff of the same note must not create a second inbound item.

```json
{
  "kind": "website_note",
  "id": "5f1d…",
  "name": "…",
  "email": "…",
  "message": "…",
  "sourcePage": "/now",
  "receivedAt": "2026-09-18T09:12:33.000Z"
}
```

Any `2xx` is `sent`; anything else, a network error, or the three-second timeout
is `failed`. `kind` keeps website notes distinguishable from everything else Lin
Check ingests. Lin Check is responsible for its own side of idempotency; until an
endpoint exists, the handoff stays unconfigured and the site behaves exactly as
it does today.

Every field in that payload except `id` and `receivedAt` is a stranger's text and
must be treated as untrusted input by Lin Check: the site has verified that a
human filled the form, not who they are. `email` is whatever was typed, and is
kept as typed so a reply goes where the sender expects — it is never an identity
key.

The timeout (`LIN_CHECK_TIMEOUT_MS`) is deliberately shorter than the reader's
patience rather than generous to Lin Check. The handoff runs after `notified_at`
was written, so a handoff that never answers costs a reported failure and a
repeated handoff — while a reader left waiting for a note that was already
emailed is the one failure this feature cannot undo. The idempotency key is what
makes the repeat safe.

## Environment variables

| Variable                                    | Where                       | Purpose                                                                                                                                      |
| ------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` (or `DATABASE_URL_UNPOOLED`) | Vercel + local `.env.local` | Neon connection. The same value the newsletter and discussion use. Absent → `503 unavailable` and a log line.                                |
| `TURNSTILE_SECRET_KEY`                      | Vercel + local `.env.local` | Server-side Turnstile verification, shared with the discussion. Read at runtime; absent → notes are refused rather than accepted unverified. |
| `PUBLIC_TURNSTILE_SITE_KEY`                 | Vercel (build time)         | Public widget site key. Absent → the form is omitted and only the email address is offered.                                                  |
| `AWS_REGION`                                | Vercel + local `.env.local` | SESv2 client region for the notification. Absent → `503 delivery_failed`, and the row is kept.                                               |
| `LIN_CHECK_INBOUND_URL`                     | optional                    | Lin Check's inbound `https` endpoint. Unset, or not `https` → the handoff is skipped (not a failure) and `lin_check_synced_at` stays null.   |
| `LIN_CHECK_INBOUND_TOKEN`                   | optional                    | Bearer token for that endpoint. Both must be set for the handoff to run.                                                                     |

`SES_CONFIGURATION_SET` is intentionally unused here; see the notification
section above. No `.env.example` exists in this repository.

The Turnstile widget is the discussion's: Managed mode, with `leonlins.com` in
its hostname list. Nothing new has to be created for the contact form.

The browser half of the widget is shared with the discussion island:
`src/lib/turnstile-client.ts` owns the script URL, the explicit-render load, and
the page-theme helper, and each caller keeps only its own widget lifecycle. A
shared loader is what keeps "fetch the script once, only after someone asks for a
form" true for both forms rather than twice-implemented.

## Applying the migration

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/contact/001_initial.sql
```

`ON_ERROR_STOP` is deliberate: without it `psql` reports an error and keeps
going, so a partly applied migration looks like success. The migration is
`IF NOT EXISTS` throughout, so re-running it is a no-op.

Apply it to a disposable Neon branch first, then to production. The order does
not matter relative to a deploy: the API answers `503` while the table is
missing, and every page renders normally regardless.

Only `contact@leonlins.com` needs to exist as a real mailbox; SES sends _to_ it
from the already-verified `newsletter@leonlins.com` identity, so no new
verification, DKIM record, or DNS change is required.

## Alerting

Failures emit one greppable line each, `contact_alert` with a closed set of
kinds (`contactAlertKinds` in `src/lib/contact/alerting.ts`):

- `submission_store_failure` — nothing was kept; the reader is told to email.
- `notification_failure` — the note is stored but nobody was told.
- `delivery_record_failure` — the note arrived; only its bookkeeping failed, and
  the reader is still thanked.
- `lin_check_failure` — the optional handoff failed. This is the only report of a
  missed handoff: the row is not counted as unfinished, because nobody is waiting
  on it.

Only a reason and an error _name_ are logged: never a name, an address, a
message body, or an error message, because messages quote the data that caused
them. `contact_refused { reason }` records refusals the same way. There is no new
monitoring service, dashboard, queue, or paging integration.

`WHERE notified_at IS NULL` is the operator's inbox for anything the flow could
not finish on its own: a row there means a reader was told a note could not be
delivered and may therefore write by email instead, so it is the one state worth
checking on a schedule. A missed Lin Check handoff is not in it — that is what
`lin_check_failure` is for.

## Tests

`npm test` covers the flow without a database: validation and normalization per
field, the source-page rules, the notification subject and rendering (including
escaping and the absence of a configuration set), the Lin Check contract and
timeout, and the whole handler surface against a fake tagged-template database —
status codes, honeypot silence, the Turnstile outcomes, the single-use-token
double submit, cross-site refusal, malformed bodies, store and notification
failures, the delivery update, and the closed alert vocabulary. The boundary
suite also asserts that no failure path logs the note's contents, that the
component is shared by all three pages, and that no page uses a hydration
directive.

`tests/contact-postgres.ts` is opt-in and is not part of `npm test`. It applies
the real migration to a real Postgres instance and exercises what no fake can:
the length constraints, the partial index, and the insert/update SQL.

```bash
CONTACT_TEST_PG_SOCKET=/tmp/contact-pg-<name> \
  node --import ./tests/register-loaders.mjs --loader ts-node/esm tests/contact-postgres.ts
```

## Limitations

- **Turnstile, SES, and Lin Check cannot be exercised from CI.** Verification is
  covered with an injected `fetch` rather than against Cloudflare; the
  notification is covered with an injected SES client rather than a real send;
  the handoff has no endpoint to call yet.
- **There is no rate limit.** The abuse controls are Turnstile, the honeypot, the
  request-size cap, and the same-origin check. That matches the discussion's
  starting point; if a flood ever appears, the discussion's per-browser limiter
  in `src/lib/comments/handlers.ts` is the precedent to copy. Deliberately not
  built now, because a contact form that a real reader cannot use is a worse
  failure than a spam note.
- **A duplicate note is possible.** Turnstile tokens are single-use and the
  handler verifies before it stores, so a double click, or an immediate repeat of
  the same rendered page, is refused rather than stored twice. A request whose
  response never arrived is the case nothing can decide: the browser cannot tell
  a send that never left from one that was stored and answered on the way back,
  so it says exactly that (`send_unconfirmed`) and tells the reader not to send
  the note again. A reader who resends anyway is stored twice, because there is
  no idempotency key on the client side; the second copy is visible as two notes
  in the inbox, not as a note that was lost.
- **The notification email is bounded but not confirmed.** The send carries a
  five-second deadline (`NOTIFICATION_TIMEOUT_MS`) so it finishes inside the
  reader's own fifteen-second wait, and a send that fails is the visible
  `notification_failure` path. Within that deadline the AWS SDK may retry, which
  can duplicate the notification in the author's inbox; the stored row, not the
  mail, is the record.
- **A blocked verification script leaves the form unusable.** If
  `challenges.cloudflare.com` cannot load — an ad blocker, a proxy — no token is
  ever issued, and every attempt reports `verification_required`. That message
  therefore names the email address too, and the check is reset on each attempt
  so an expired widget is not a dead end. There is no client-side reporting
  channel, so this is only visible to the reader who hits it.
- **Visual and interaction behavior is not covered by automated tests.** The
  expand/collapse toggle and its focus movement, the keyboard order, dark mode,
  mobile widths, the no-site-key build, and the same behavior in the built bundle
  were each checked by hand in a browser. The script-to-markup id lookups and the
  focus calls are asserted in `testContactIntegrationBoundaries` so a renamed
  element cannot silently disable the toggle again.
- **A note is stored in Neon and emailed through SES**, so both providers process
  it; the privacy policy's "Notes you send" section describes that.
- **Lin Check is not implemented in this repository.** The handoff is a documented
  contract against a system that does not exist yet, so it stays unconfigured.

## Deferred scope

Deliberately not built: a CRM or relationship record, scoring or qualification,
automated replies, a newsletter signup inside the form, attachments, a
scheduling link, a spam-mitigation queue, a dashboard, an admin API, contact
analytics, a navigation entry, and any second place to read or export notes.
Notes are answered by a person, from an inbox.
