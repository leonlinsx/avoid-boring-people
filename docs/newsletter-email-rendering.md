# Newsletter email layout and Gmail inspection

## Received Anthropic test: October 30, 2026

Inspected the operator-supplied original `.eml` locally without sending email or
loading remote content. The original and decoded message were not committed or
uploaded; no recipient, message identifier, token or private address is recorded here.

- Decoded HTML: **41,326 UTF-8 bytes**; text alternative: **20,863 bytes**.
- 14 authored `<blockquote>` elements, 10 inline image attachments.
- 23 HTML footnote references and 23 definitions; all fragment targets exist.
- No literal `[Quoted text hidden]`, `gmail_quote`/`gmail_extra`/`gmail_attr`, hidden
  elements, disclosure widgets or renderer-inserted truncation in the message.
- Full article, notes, visible identity/privacy/unsubscribe footer and both
  List-Unsubscribe headers are present. The footer is outside all quote blocks.
- No References or In-Reply-To headers; the original physical-address footer
  was absent. The old text renderer omitted the numbered reference markers.

**Finding:** the received content is not truncated by this renderer. The supplied
label is Gmail presentation, consistent with quote/repeated-content folding;
its exact matching algorithm and selected UI ranges cannot be established from
one `.eml`. The HTML is below the renderer's conservative 100 KiB limit.
[Mailchimp's operational guide](https://mailchimp.com/help/gmail-is-clipping-my-email/)
describes size clipping as a different “View entire message” symptom and recommends
changing repeated test subjects. Do not treat that guide as a guarantee about
Gmail's undocumented folding heuristics.

## Changes and verification boundaries

- 640px outer box including padding; responsive chart wrappers capped at 560px.
  Images retain original pixels/aspect ratios; small images do not upscale.
  Hosted images link to their original resolution so readers can enlarge labels
  on small screens; existing author-provided image links are preserved.
- Authored quotations use a visibly bordered note container instead of reply-like
  `<blockquote>` markup. Their substantive text is preserved, including nested
  paragraphs and footnotes. No invisible filler or randomized article text is added.
- All HTML footnote IDs/references/backreferences remain; the text alternative
  now includes numbered references and an ordered notes section. Email clients
  may strip internal anchor navigation, so the notes stay fully visible as text.
- The current editorial footer identifies Avoid Boring People by Leon Lin and
  includes per-recipient unsubscribe and privacy links, without an address.
  Existing one-click unsubscribe headers are retained. No unsubscribe behavior
  changed. The reply invitation and canonical link precede the minimal footer.
- Canonical “Read on the web” links use the site's slug helper and frontmatter
  override. Drafts omit them. Production and hosted previews require an actual
  HTTP 200 HTML page with the matching canonical URL before any SES operation or
  send-state mutation; public image preflight still applies.
- Optional escaped, short preheader derives from description; it never hides
  article/footer controls. The visible description appears once as the subtitle,
  followed by Leon Lin and the YAML publication date. Georgia headlines, Arial
  body text and website-blue links supply the editorial hierarchy. All rendered
  presentation and preheader settings remain in the approval digest.
- Hosted test previews use the production-format body and public images, a
  unique `[TEST]` subject to reduce repeat-test grouping, and the test-only
  nonfunctional unsubscribe token. The allowlist and explicit confirmation remain.

A local before/after render of the current Anthropic draft confirmed identical
article text and intact footnote targets (source versions may differ from the
received test). Its 10 charts retained their original pixels and rendered at
560px or less on desktop. No article or website image was edited.

Offline tests verify the complete article/notes/footer, matching fragment targets,
long-body tail preservation, clipping refusal, image dimensions at desktop/mobile
widths and visible opt-out controls. They mock all hosted HTTP checks and SES.

A new received-Gmail test was **not** sent. Client-side folding cannot be promised
away by HTML changes: after publication, a separately authorized hosted preview
should be inspected in Gmail with repeated-test threading distinguished from a
fresh message. Confirm quote passages, final paragraphs, all notes and the footer
unsubscribe link are visible; expand Gmail's quote disclosure if it still
appears. Use the original-message view to distinguish intact content from UI folding.

## Editorial layout follow-up

The final header starts with the YAML title in email-safe Georgia, visible
description once, and Leon Lin with the English publication date (UTC). The
publication identity stays in the footer. Published articles show a readable
“Read on the web” link directly beneath the byline; drafts omit unavailable links.
A missing description/date is omitted without blank placeholders. Disabling the
hidden preheader keeps the visible subtitle. The standard CLI body is addressless,
even if a legacy postal environment value exists; see the README's commercial-use
restriction and explicit sender-identification opt-in. The reply invitation follows
the full article/notes; published editions then show the canonical link before
the minimal identity/unsubscribe/privacy footer.

The actual Anthropic draft was checked locally at 1000px and 390px viewports:
headline “A closer look at Anthropic's IPO filing,” subtitle “Scale is all you need,”
and “Leon Lin · October 31, 2026.” All 10 unchanged images, 23 footnotes,
14 quotations, article text, links and fragment targets match the previous renderer.
The plain-text article/notes match exactly. No horizontal page overflow occurred;
charts remain centered, proportional and at most 560px wide. Before/after HTML,
plain text and desktop/mobile header/footer screenshots were produced privately
without remote requests. The draft's unavailable canonical links stay omitted.

The regression suite also rejects a known PR #114 content hash, checks YAML folded
titles and missing/invalid metadata, and keeps the existing production preflight,
CID attachment, allowlist, confirmation, suppression and idempotency checks.
No received-Gmail retest, send, campaign creation or deployment was performed.
