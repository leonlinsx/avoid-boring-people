"""Platform presentation rules for one underlying social argument."""
from __future__ import annotations

from scripts.automation.content import SocialPost


def render_thread(post: SocialPost) -> list[str]:
    return list(post.thread) if post.thread else [f"{post.hook}\n\n{post.url}"]


def render_linkedin(post: SocialPost) -> str:
    text = f"{post.hook}\n\n{post.body}\n\nFull piece: {post.url}".strip()
    if len(text) > 3000:
        raise ValueError("LinkedIn post exceeds its 3,000-character limit")
    return text


def render_mastodon(post: SocialPost) -> list[str]:
    return render_thread(post)


def render_farcaster(post: SocialPost) -> str:
    supporting_thought = post.thread[1] if len(post.thread) > 1 else post.body
    return f"{post.hook}\n\n{supporting_thought}\n\n{post.url}".strip()
