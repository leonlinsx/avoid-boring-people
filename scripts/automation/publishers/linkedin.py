"""LinkedIn Posts API adapter for text-only personal or organization posts.

LinkedIn deprioritizes posts carrying external links (roughly 60% less reach),
so the canonical article URL never goes in the commentary: the post carries the
native argument and the link follows as the first comment, where readers who
want the full piece still find it without taxing the post's distribution.
"""
from __future__ import annotations

import os
from urllib.parse import quote

import requests

from scripts.automation.content import PublishResult

LINKEDIN_API_BASE = "https://api.linkedin.com/rest"
LINK_COMMENT_MAX = 1250


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Linkedin-Version": os.getenv("LINKEDIN_VERSION", "202604"),
        "X-Restli-Protocol-Version": "2.0.0",
    }


def _create_post(token: str, author: str, text: str) -> str:
    response = requests.post(
        f"{LINKEDIN_API_BASE}/posts",
        headers=_headers(token),
        json={
            "author": author,
            "commentary": text,
            "visibility": "PUBLIC",
            "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        },
        timeout=20,
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"LinkedIn API error: {response.status_code} {response.text}")
    try:
        body = response.json()
    except ValueError:
        body = {}
    remote_id = response.headers.get("x-restli-id") or (body.get("id") if isinstance(body, dict) else None)
    if not remote_id:
        raise RuntimeError("LinkedIn accepted the request without returning a post id")
    return str(remote_id)


def _create_first_comment(token: str, author: str, post_urn: str, link_url: str) -> None:
    """Drop the canonical link as the first comment, where it costs no reach.

    A failed comment never fails the publish: the post is already live and
    retrying would duplicate it, so the miss is reported loudly in the logs
    instead of raising.
    """
    comment = f"Full piece: {link_url}".strip()
    if len(comment) > LINK_COMMENT_MAX:
        comment = link_url
    response = requests.post(
        f"{LINKEDIN_API_BASE}/socialActions/{quote(post_urn, safe='')}/comments",
        headers=_headers(token),
        json={"actor": author, "object": post_urn, "message": {"text": comment}},
        timeout=20,
    )
    if response.status_code not in (200, 201):
        print(
            f"⚠️ LinkedIn post {post_urn} is live but the link comment failed "
            f"({response.status_code} {response.text[:200]}); add the link by hand: {link_url}"
        )
    else:
        print(f"✅ LinkedIn link comment posted on {post_urn}")


def post_to_linkedin(text: str, link_url: str | None = None) -> PublishResult:
    """Publish a link-free native post, then place the article link in a reply.

    `link_url` is the canonical article URL; omit it only for link-free posts.
    """
    token = os.getenv("LINKEDIN_ACCESS_TOKEN")
    author = os.getenv("LINKEDIN_AUTHOR_URN")
    if not token or not author:
        raise RuntimeError("LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN missing")

    remote_id = _create_post(token, author, text)
    print(f"✅ LinkedIn post published: {remote_id}")
    if (link_url or "").strip():
        _create_first_comment(token, author, remote_id, link_url.strip())
    return PublishResult("linkedin", remote_id=remote_id)
