# Issue #149: bounded read-only research proof

This first scope adds an optional collector and signed synthetic fixtures. It
does not change the factory, allocation, admission, publishing workflow, account
credentials or publication limits. Integration is a separate dependent PR.

## Provider and cost decision

The optional adapter uses Meta Business Discovery v27.0 with a **separate,
permissioned Facebook-Login credential** and an explicitly configured creator
scope. The existing Instagram-Login publishing token is never substituted.
[Meta documents the required permissions and nested public media fields](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).

[Monid's Instagram catalog](https://monid.ai/tools/instagram) was evaluated:
prices vary by endpoint and some searches charge per result. Advertised new
account credit is neither verified available nor authorized here. No Monid
package, external SKILL, paid model, subscription, charged call or free credit
is installed or used. The collector has no paid-provider fallback.

The pass runs at most once per ISO week in the existing private output root,
including failed/crashed attempts. Limits: four unique creators, one read-only
request each, at most 25 media rows per creator, 256 KB per response, a 60-second
collection deadline, and 20 deduplicated audited receipts. Failures and missing
credentials produce unavailable evidence. Counts expire after eight days for
new selection; archived receipts are retained as evidence, not reused as fresh
data. No new scheduler, service, database or reporting platform is introduced.

## What the evidence establishes

Each signed receipt binds creator, permalink, retrieval/post timestamps, stated
views, available follower count, five to 24 other recent creator Reels, topic,
structural label and caption hash. Candidate and baseline Reels must be seven
to 45 days old; the candidate cannot be its own baseline. Relative performance
is recomputed against the creator's recent median. A >=3x ratio and >=10,000
views screens relative outliers; it does not establish statistical significance.

Only a statement/context/question **caption** pattern currently offers a
distinct source-first treatment. The adapter does not request media URLs,
download footage/audio, infer a transcript, observe the opening three seconds,
copy text, or reuse a creator's likeness. Retrieved text is untrusted: instruction
poisoning is rejected and prose is never forwarded into trusted instructions or
rendered media. Only closed structural labels and public metadata survive.

Public `view_count` can include paid and Facebook views.
[Meta explicitly documents this limitation](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media).
Receipts retain that uncertainty. Disclosed promotion, missing follower counts,
accounts at or above 100,000 followers and unusable structures cannot select
the bounded arm. Smaller follower counts still do not prove absence of celebrity
effects. `live_eligible` means eligible to inform a bounded structural test,
**never publication permission or verified organic performance**. ABP's own
independent source, rights, ASR and technical admission remains mandatory.

## Proof and current limitation

There are **zero actual verified external receipts in this delivery**: no
separate permissioned discovery credential or creator scope is configured.
Consequently twenty audited live candidates cannot honestly be supplied. Search
hits, synthetic numbers and a provider's price listing are not substitutes.
The versioned fixture contains two synthetic signed receipts (one relative
outlier and one control), with a separate public verification key. No fixture
private key is retained. Fixture evidence can never be live eligible.

```sh
python -m scripts.instagram_growth.autonomy.research --fixture --output-root .tmp/research-proof
python -m pytest tests/test_instagram_outlier_research.py -q
```

Tests use disposable signing keys and fake HTTP responses. They cover missing or
forged statistics, self/duplicate baselines, missing permalinks, stale counts,
promotion/celebrity uncertainty, poisoned captions, duplicate hits, outages,
credential isolation, unauthorized free credit and scope limits. These are
infrastructure tests, not real public-performance evidence or validated ABP
growth. Issue #149 explicitly prohibits autonomous merge; this scope stays a
reviewable PR pending strategic review.
