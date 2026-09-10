"""Category-based distribution policy, kept separate from provider code."""
from __future__ import annotations

PLATFORMS = ("twitter", "linkedin", "bluesky", "mastodon", "farcaster", "devto", "reddit")
SOCIAL_PLATFORMS = ("twitter", "linkedin", "bluesky", "mastodon", "farcaster")

# The normal automation destinations. Keep disabled or unapproved providers out
# of this list; PLATFORM remains available as an explicit local/test override.
# Farcaster stays out of the production defaults until the Neynar signer is
# approved and NEYNAR_API_KEY/NEYNAR_SIGNER_UUID are verified; re-add it here
# once `setup_farcaster_signer --status` reports the signer as approved.
DEFAULT_PLATFORMS = ("twitter", "bluesky", "mastodon", "devto")

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
