"""Small, provider-independent representations used by distribution channels."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class SocialPost:
    hook: str
    body: str
    url: str
    thread: tuple[str, ...] = ()
    # Sanitized article tags for deterministic hashtag discovery. Microblog
    # renderers append at most HASHTAG_MAX of these when they fit; the LLM
    # never generates hashtags (its brief still prohibits them).
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class ArticleSyndication:
    title: str
    markdown_body: str
    tags: tuple[str, ...]
    canonical_url: str


@dataclass(frozen=True)
class CommunityPost:
    title: str
    url: str


@dataclass(frozen=True)
class PublishResult:
    platform: str
    remote_id: Optional[str] = None
    remote_url: Optional[str] = None
