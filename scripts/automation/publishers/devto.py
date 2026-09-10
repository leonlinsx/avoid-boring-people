# scripts/automation/publishers/devto.py
"""DEV adapter: syndicates the full article body with the canonical URL."""

from __future__ import annotations

import os
import re
from urllib.parse import urlparse

import requests

from scripts.automation.content import PublishResult

DEVTO_API_KEY = os.getenv("DEVTO_API_KEY")  # generated from dev.to settings

BASE_URL = "https://dev.to/api/articles"
CANONICAL_HOST_SUFFIX = "leonlins.com"
DEVTO_TAG_LIMIT = 4

_SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script\s*>", re.IGNORECASE | re.DOTALL)
_IFRAME_RE = re.compile(r"<iframe\b[^>]*>(.*?</iframe\s*>)?", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\s+on\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", re.IGNORECASE)


def sanitize_markdown(body: str) -> str:
    """Strip active content DEV must never receive from a syndicated article."""
    cleaned = _SCRIPT_RE.sub("", body)
    cleaned = _IFRAME_RE.sub("", cleaned)
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)
    return cleaned


def validate_article(title: str, body_markdown: str, tags: list[str], canonical_url: str) -> str:
    """Validate the syndicated article; returns the sanitized body."""
    if not (title or "").strip():
        raise ValueError("DEV article title must not be empty")
    sanitized = sanitize_markdown(body_markdown or "")
    if not sanitized.strip():
        raise ValueError("DEV article body must not be empty")
    host = (urlparse(canonical_url or "").hostname or "").lower()
    if host != CANONICAL_HOST_SUFFIX and not host.endswith("." + CANONICAL_HOST_SUFFIX):
        raise ValueError(f"DEV canonical URL must stay on {CANONICAL_HOST_SUFFIX}: {canonical_url!r}")
    if len(tags) > DEVTO_TAG_LIMIT:
        raise ValueError(f"DEV accepts at most {DEVTO_TAG_LIMIT} tags ({len(tags)} given)")
    return sanitized


def post_to_devto(title: str, body_markdown: str, tags: list[str], canonical_url: str, published: bool = True):
    if not DEVTO_API_KEY:
        raise RuntimeError("❌ DEVTO_API_KEY missing")

    body_markdown = validate_article(title, body_markdown, tags, canonical_url)

    headers = {
        "api-key": DEVTO_API_KEY.strip(),
        "Content-Type": "application/json",
    }

    payload = {
        "article": {
            "title": title,
            "published": published,
            "body_markdown": body_markdown,
            "tags": tags,
            "canonical_url": canonical_url,
        }
    }

    resp = requests.post(BASE_URL, headers=headers, json=payload)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"❌ Dev.to API error: {resp.status_code} {resp.text}")

    data = resp.json()
    print(f"✅ Dev.to post created: {data.get('url')}")
    remote_id = data.get("id")
    remote_url = data.get("url")
    if remote_id is None and remote_url is None:
        return data
    return PublishResult("devto", remote_id=str(remote_id) if remote_id is not None else None, remote_url=remote_url)
