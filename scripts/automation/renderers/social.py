"""Platform presentation rules for one underlying social argument."""
from __future__ import annotations

from scripts.automation.content import SocialPost

MASTODON_STATUS_LIMIT = 500


def render_thread(post: SocialPost) -> list[str]:
    return list(post.thread) if post.thread else [f"{post.hook}\n\n{post.url}"]


def render_linkedin(post: SocialPost) -> str:
    text = f"{post.hook}\n\n{post.body}\n\nFull piece: {post.url}".strip()
    if len(text) > 3000:
        raise ValueError("LinkedIn post exceeds its 3,000-character limit")
    return text


def render_mastodon(post: SocialPost) -> list[str]:
    """Render one self-contained Mastodon toot, not a copy of the X thread.

    Mastodon readers see a single timeline post, so the preferred shape is one
    hook plus the sharpest supporting thought plus the canonical URL, kept
    within the instance 500-character limit.
    """
    supporting = post.thread[1] if len(post.thread) > 1 else post.body
    candidate = f"{post.hook}\n\n{supporting}\n\n{post.url}".strip()
    if len(candidate) <= MASTODON_STATUS_LIMIT:
        return [candidate]
    ellipsis = "…"
    fixed = f"{post.hook}\n\n\n\n{post.url}"
    budget = MASTODON_STATUS_LIMIT - len(fixed) - len(ellipsis)
    if budget < 0:
        trimmed_hook = post.hook[: MASTODON_STATUS_LIMIT - len(post.url) - len("\n\n…\n\n")]
        return [f"{trimmed_hook}…\n\n{post.url}".strip()]
    return [f"{post.hook}\n\n{supporting[:budget].rstrip()}{ellipsis}\n\n{post.url}".strip()]


def render_farcaster(post: SocialPost) -> str:
    supporting_thought = post.thread[1] if len(post.thread) > 1 else post.body
    return f"{post.hook}\n\n{supporting_thought}\n\n{post.url}".strip()
