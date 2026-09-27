"""Tumblr Neue Post Format publisher for short article-discovery posts.

Tumblr supports OAuth 1.0a for owner-authorized server-side clients.  A static
consumer/access-token pair is simpler and safer here than adding an OAuth2
callback and refresh-token service to the site.
"""
from __future__ import annotations

import os

import requests
from requests_oauthlib import OAuth1

from scripts.automation.content import PublishResult, SocialPost

API_BASE = "https://api.tumblr.com/v2"
REQUEST_TIMEOUT_SECONDS = 20
EXCERPT_LIMIT = 500


def _config() -> tuple[str, OAuth1]:
    values = {
        "TUMBLR_BLOG_IDENTIFIER": os.getenv("TUMBLR_BLOG_IDENTIFIER", "").strip(),
        "TUMBLR_CONSUMER_KEY": os.getenv("TUMBLR_CONSUMER_KEY", "").strip(),
        "TUMBLR_CONSUMER_SECRET": os.getenv("TUMBLR_CONSUMER_SECRET", "").strip(),
        "TUMBLR_OAUTH_TOKEN": os.getenv("TUMBLR_OAUTH_TOKEN", "").strip(),
        "TUMBLR_OAUTH_TOKEN_SECRET": os.getenv("TUMBLR_OAUTH_TOKEN_SECRET", "").strip(),
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError("❌ Missing Tumblr configuration: " + ", ".join(missing))
    auth = OAuth1(
        values["TUMBLR_CONSUMER_KEY"],
        values["TUMBLR_CONSUMER_SECRET"],
        values["TUMBLR_OAUTH_TOKEN"],
        values["TUMBLR_OAUTH_TOKEN_SECRET"],
    )
    return values["TUMBLR_BLOG_IDENTIFIER"], auth


def render_tumblr_post(post: SocialPost, canonical_url: str) -> dict:
    """Render discovery copy without syndicating the article body."""
    excerpt = (post.body or post.hook).strip()
    if len(excerpt) > EXCERPT_LIMIT:
        excerpt = excerpt[: EXCERPT_LIMIT + 1].rsplit(" ", 1)[0].rstrip() + "…"
    return {
        "content": [
            {"type": "text", "text": post.hook.strip(), "subtype": "heading1"},
            {"type": "text", "text": excerpt},
            {"type": "link", "url": canonical_url, "title": "Read the full article on leonlins.com"},
        ],
        "tags": ",".join(post.tags[:4]),
        "source_url": canonical_url,
        "state": "published",
    }


def post_to_tumblr(post: SocialPost, canonical_url: str) -> PublishResult:
    blog, auth = _config()
    response = requests.post(
        f"{API_BASE}/blog/{blog}/posts",
        json=render_tumblr_post(post, canonical_url),
        auth=auth,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"❌ Tumblr API error: {response.status_code} {(response.text or '')[:300]}")
    body = response.json().get("response") or {}
    remote_id = body.get("id_string") or body.get("id")
    if remote_id is None:
        raise RuntimeError("❌ Tumblr created a post without returning an id")
    remote_url = body.get("post_url") or f"https://{blog}/post/{remote_id}"
    return PublishResult("tumblr", remote_id=str(remote_id), remote_url=str(remote_url))
