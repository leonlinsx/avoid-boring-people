"""Platform presentation rules for one underlying social argument."""
from __future__ import annotations

import re

from scripts.automation.content import SocialPost

MASTODON_STATUS_LIMIT = 500
FARCASTER_CAST_LIMIT = 320
THREADS_TEXT_LIMIT = 500

# A blockquote marker at the start of a fragment or after a space, introducing a
# capitalised quote. Comparisons such as `risk > return` keep their operator.
_MARKDOWN_QUOTE_MARKER = re.compile(r"(?:^|(?<=\s))>\s+(?=[A-Z\"'“‘])")


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
    """Render one self-contained Farcaster cast within the 320-character limit.

    A long LLM hook plus supporting thought can exceed the cast limit. Keep the
    hook and canonical URL and shorten the supporting thought, rather than
    letting the publisher reject the whole cast.
    """
    supporting = post.thread[1] if len(post.thread) > 1 else post.body
    candidate = f"{post.hook}\n\n{supporting}\n\n{post.url}".strip()
    if len(candidate) <= FARCASTER_CAST_LIMIT:
        return candidate
    ellipsis = "…"
    fixed = f"{post.hook}\n\n\n\n{post.url}"
    budget = FARCASTER_CAST_LIMIT - len(fixed) - len(ellipsis)
    if budget < 0:
        trimmed_hook = post.hook[: FARCASTER_CAST_LIMIT - len(post.url) - len("\n\n…\n\n")]
        return f"{trimmed_hook}…\n\n{post.url}".strip()
    return f"{post.hook}\n\n{supporting[:budget].rstrip()}{ellipsis}\n\n{post.url}".strip()


def _supporting_points(post: SocialPost) -> list[str]:
    """The summary arrives as blank-line separated takeaway points."""
    points: list[str] = []
    for chunk in post.body.split("\n\n"):
        point = chunk.strip()
        if point and point not in points:
            points.append(point)
    return points


def _trim_to_word(text: str, budget: int) -> str:
    """Cut to the last word boundary that fits so no word is split in half."""
    clipped = text[:budget]
    if len(text) > budget and clipped and not clipped[-1].isspace():
        clipped = clipped.rsplit(" ", 1)[0]
    return clipped.rstrip(" ,;:.-")


def _strip_markdown_quotes(text: str) -> str:
    """Remove leaked markdown blockquote markers from Threads text.

    The summarizer is asked for plain text, but quote-heavy articles still leak
    `>` markers, and Threads renders no markdown, so they reach readers as stray
    characters. Only markers that introduce a capitalised fragment are removed,
    which leaves comparisons such as `risk > return` intact.
    """
    return _MARKDOWN_QUOTE_MARKER.sub("", text)


def render_threads(post: SocialPost) -> list[str]:
    """Render one standalone Threads idea plus the canonical URL as a self-reply.

    Threads reads as a conversational surface, so a link announcement performs
    poorly there and the post must make sense without the click. The main post
    therefore carries the argument only; the article URL moves to a reply, where
    it stays the canonical pointer without framing the post as an advert.

    Supporting points are only added whole, because a paragraph cut off
    mid-sentence reads as a mistake on a conversational feed. The first point is
    trimmed as a fallback so the post is never left with a bare hook. Under
    POST_MODE=single the body is the article title, which the hook already
    carries, so that duplicate point drops out here.
    """
    hook = _strip_markdown_quotes(post.hook.strip())
    points = [_strip_markdown_quotes(point) for point in _supporting_points(post)]
    points = [point for point in points if point and point != hook]
    main = hook
    for point in points:
        candidate = f"{main}\n\n{point}"
        if len(candidate) <= THREADS_TEXT_LIMIT:
            main = candidate
            continue
        if main == hook:
            budget = THREADS_TEXT_LIMIT - len(hook) - len("\n\n…")
            if budget > 0:
                main = f"{hook}\n\n{_trim_to_word(point, budget)}…"
        break
    if len(main) > THREADS_TEXT_LIMIT:
        main = f"{_trim_to_word(hook, THREADS_TEXT_LIMIT - 1)}…"
    if not post.url:
        return [main]
    return [main, f"Full piece: {post.url}"]
