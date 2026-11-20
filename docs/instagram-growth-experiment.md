# Avoid Boring People Instagram — growth experiment (November 2026)

Status: **PROPOSED / NOT ACTIVE**. This document authorizes no automatic Reel creation or publication.

## Account boundary and objective

- Target: **@avoidboringpeople**, the editorial account serving `leonlins.com`; baseline was reported as **0 followers**, which must be rechecked at launch.
- **@leon.lin.s** is a separate personal account (the November screenshots with 418 followers and Elena Lev clips were from that account). Never combine its insights, follower counts, media rights, credentials, or publishing schedule with ABP data.
- Objective: earn qualified non-follower reach, ABP followers, owned-site visits, and newsletter signups with **$0 additional software spend**. Views alone do not establish success.
- Any cross-account collaboration requires deliberate approval; it is not part of unattended ABP posting.

## First operational gate: reliable conversion

1. On the **ABP account only**, manually check profile name, bio, professional-account status, recommendation eligibility/Account Status, link destination, and current 30-day baseline. Save date-stamped account-level and per-post metrics.
2. Configure a **stable** link in the ABP bio, e.g.:
   `https://leonlins.com/?utm_source=instagram&utm_medium=social&utm_campaign=abp_profile`
   This is an example for manual application, **not** a link that this repository changes on Instagram.
3. Confirm on a mobile browser that the link opens the public homepage and that the newsletter form works. Verify the site's attribution system records `instagram` on a test signup *only through an approved testing procedure*; do not create a real subscriber merely to claim verification.
4. Evergreen carousel captions must not promise the latest or featured essay is at the bio link. Their final slide can show the exact canonical essay URL as a **visual cue**, but the caption's CTA refers to the stable website link.
5. The existing `scripts/automation/attribution.py` tagged-link helper **does not provide a clickable Instagram post link**. Instagram's first-party browser-side attribution already understands `utm_source=instagram`; do not add an Instagram tag to the publishing logs and falsely claim it was actually presented in a clickable caption.

## Editorial positioning

**Promise:** Non-obvious ideas about investing, technology, risk, and exceptional performance.

Three repeatable pillars for the longer test (counts below are planning weights if twelve pieces are eventually published):
- **6**: What the headline missed — sourced investment, AI, business-model, or technology analysis.
- **4**: Ideas that change decisions — probability, risk, incentives, and systems.
- **2**: How exceptional people think — authentic interviews or craft/performance insights; use original footage only with permission.

Every creative begins with a concrete, article-faithful claim or problem. Write at least three candidate hooks per piece; choose for specificity, factual grounding, clarity within three seconds, and relevance to the viewer. Do not invent quotes, financial outcomes, sources, or figures to improve the hook.

**Test mix (hypothesis, not a proven recipe):** produce up to twelve *offline creative treatments* across verified articles, then publish up to six distinct human-approved pieces in the first learning wave. Compare motion graphics, original content with permission, synthetic narration, fictional-presenter experiments, and image-led posts. Do not confuse three palette colorways with three substantive growth hypotheses. Expand only after performance evidence. The offline code and GPU testing instructions live in [Instagram Creative Lab](instagram-growth-creative-lab.md). No hosted video subscription is required.

## Publishing and measurement

- The current evergreen automation publishes carousels to Instagram on the broader three-day social schedule. **This PR does not change that schedule**. Before activating the 12-piece experiment, review a separate, platform-scoped cadence change if needed to keep total ABP output manageable (prefer at most one evergreen carousel per week). Never change cadence globally for other networks to run an Instagram test.
- All new Reel templates and the Instagram video-upload path require a separate PR, dry run, content/rights review, and manual authorization before the first live publication.
- Measure each asset at a consistent **48-hour** and **7-day** window. Capture: account, publication timestamp, source article, content pillar, format, hook, media origin (original/motion/generated), view count, accounts reached, average watch time (when offered), shares, saves, profile visits, follows, tagged site sessions, and confirmed newsletter signups. Mark unavailable observations **missing**, not zero.
- Record `@leon.lin.s` collaborations as a separate source; do not pool personal-account performance into the ABP baseline.
- Existing weekly `engagement.json` does not read Instagram performance. A future collector must be limited to ABP, use permissioned read scopes, and store only aggregate counts without personal viewer data. Until then, manually record Insights and owned-site results.
- CTA testing: compare a **follow** invitation versus a **read/subscribe** invitation; avoid multiple competing CTAs in one piece. Keep Instagram view data, site sessions, and newsletter signups as distinct metrics (and do not interpret likes as conversions).

## Stage gates (not forecasts)

- **Start:** ABP account status and recommendation eligibility are checked, the stable tagged bio link is live, its baseline is recorded, and the first creative assets have passed editorial and media-rights review. Do not claim eligibility from the personal account's green checkmark.
- **After three published creatives:** inspect actual retention, non-follower reach, profile visits, creative quality, and whether anyone followed or clicked through. Revise hooks/positioning before multiplying videos.
- **At 30 days:** GO only with directional evidence of repeatable non-follower discovery **and** conversion to ABP followers or the owned site. A follower, visit, or signup threshold is a planning target, not a statistically reliable conclusion from six posts. ITERATE if reach exists but conversion does not; STOP/REDESIGN if qualified reach and conversion remain negligible after the full test and account-health checks.

## Engineering order

1. **PR 1 (this PR):** correct evergreen CTA semantics and document the account-specific growth baseline and experiment. No new publishing surface.
2. **PR 2 (creative lab):** offline source-grounded storyboards, three visual layout treatments, an optional local Qwen3-TTS helper, and the first experimental render. Further Remotion animation and GPU model tests remain gated. No paid generation APIs.
3. **PR 3 (future, if PR 2 passes):** first-party Instagram Reel uploader, video-specific hosting/validation, ambiguous-publish reconciliation, and aggregate performance measurement. Keep credentials restricted to @avoidboringpeople and preserve all other destinations.

No account edits, Instagram uploads, newsletter sends, scheduled changes, or production deployment are implied by this document.
