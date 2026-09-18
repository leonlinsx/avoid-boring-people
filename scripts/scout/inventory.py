"""The content inventory Scout matches against.

Derived from the same deployed `search-index.json` the social distribution
automation already consumes, so Scout has no second article database to keep in
sync and no build-time coupling to Astro.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

from scripts.automation.fetch_post import fetch_posts

# Enough article text for a judgment and a draft, far short of the whole piece:
# the judgment needs to know the argument, not to reproduce the writing.
BODY_CHARS = 2000
SUMMARY_CHARS = 400


@dataclass(frozen=True)
class ContentItem:
    """One published article, as Scout is allowed to reference it."""

    content_id: str
    title: str
    url: str
    published_at: str
    category: str
    tags: Tuple[str, ...]
    summary: str
    body: str


def build_inventory(posts: Iterable[Dict]) -> List[ContentItem]:
    """Turn index entries into matchable content items.

    Entries missing an id, title, or URL are skipped rather than matched against
    a placeholder, and the body is capped at what a judgment and a draft need.
    """
    items: List[ContentItem] = []
    for post in posts:
        content_id = str(post.get("id") or "").strip()
        title = str(post.get("title") or "").strip()
        url = str(post.get("url") or "").strip()
        if not content_id or not title or not url:
            continue
        body = str(post.get("content") or "").strip()[:BODY_CHARS]
        items.append(
            ContentItem(
                content_id=content_id,
                title=title,
                url=url,
                published_at=str(post.get("date") or "").strip(),
                category=str(post.get("category") or "").strip(),
                tags=tuple(str(tag or "").strip() for tag in (post.get("tags") or []) if str(tag or "").strip()),
                summary=body[:SUMMARY_CHARS],
                body=body,
            )
        )
    return items


def load_inventory() -> List[ContentItem]:
    """Read the published article index once."""
    return build_inventory(fetch_posts())
