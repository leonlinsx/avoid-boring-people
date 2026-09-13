"""Category-based distribution policy, kept separate from provider code."""
from __future__ import annotations

PLATFORMS = ("twitter", "linkedin", "bluesky", "mastodon", "farcaster", "devto", "reddit", "weibo", "nostr", "threads")
SOCIAL_PLATFORMS = ("twitter", "linkedin", "bluesky", "mastodon", "farcaster", "weibo", "nostr", "threads")

# The normal automation destinations. Keep disabled, unapproved, or unusable
# providers out of this list; PLATFORM remains available as an explicit
# local/test override.
# X is excluded until its API credit balance is restored: X API v2 posting is
# credit-based, and a depleted balance returns 402 "credits depleted" for the
# whole destination, which fails the run. Re-add it once credits exist.
# Weibo stays out until its open-platform app gains write scope, which needs a
# Chinese mobile-verified account and is parked as a TODO.
# Threads stays out until a verified live run confirms the access token, user id,
# and publish flow. Post to it explicitly with PLATFORM=threads until then.
DEFAULT_PLATFORMS = ("bluesky", "mastodon", "devto", "farcaster", "nostr")

# DEV is intentionally restricted to technical writing. Risk is a deliberate,
# per-article opt-in through the `devto` frontmatter flag.
CATEGORY_PLATFORM_RULES = {
    "investing": set(SOCIAL_PLATFORMS + ("reddit",)),
    "technology": set(PLATFORMS),
    "system design": set(PLATFORMS),
    "risk & decision making": set(SOCIAL_PLATFORMS + ("reddit",)),
    "culture": set(("twitter", "linkedin", "bluesky", "mastodon", "reddit")),
}


def eligible_for_category(post: dict, platform: str) -> bool:
    category = str(post.get("category") or "").strip().lower()
    allowed = CATEGORY_PLATFORM_RULES.get(category, set(SOCIAL_PLATFORMS + ("reddit",)))
    if platform == "devto" and bool(post.get("devto", False)):
        return True
    return platform in allowed
