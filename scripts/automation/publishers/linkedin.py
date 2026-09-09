"""LinkedIn Posts API adapter for text-only personal or organization posts."""
from __future__ import annotations

import os
import requests

from scripts.automation.content import PublishResult


def post_to_linkedin(text: str) -> PublishResult:
    token = os.getenv("LINKEDIN_ACCESS_TOKEN")
    author = os.getenv("LINKEDIN_AUTHOR_URN")
    if not token or not author:
        raise RuntimeError("LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN missing")

    response = requests.post(
        "https://api.linkedin.com/rest/posts",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Linkedin-Version": os.getenv("LINKEDIN_VERSION", "202604"),
            "X-Restli-Protocol-Version": "2.0.0",
        },
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
    remote_id = response.headers.get("x-restli-id") or response.json().get("id")
    if not remote_id:
        raise RuntimeError("LinkedIn accepted the request without returning a post id")
    return PublishResult("linkedin", remote_id=str(remote_id))
