"""Reddit link-submission adapter for the first-party community."""
from __future__ import annotations

import os
import requests

from scripts.automation.content import PublishResult


def _access_token() -> str:
    existing = os.getenv("REDDIT_ACCESS_TOKEN")
    if existing:
        return existing
    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    refresh_token = os.getenv("REDDIT_REFRESH_TOKEN")
    if not client_id or not client_secret or not refresh_token:
        raise RuntimeError("Set REDDIT_ACCESS_TOKEN or REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_REFRESH_TOKEN")
    response = requests.post(
        "https://www.reddit.com/api/v1/access_token",
        auth=(client_id, client_secret),
        headers={"User-Agent": os.getenv("REDDIT_USER_AGENT", "avoid-boring-people/1.0")},
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Reddit token refresh failed: {response.status_code} {response.text}")
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Reddit token response did not contain an access token")
    return token


def post_to_reddit(title: str, url: str) -> PublishResult:
    subreddit = os.getenv("REDDIT_SUBREDDIT", "AvoidBoringPeople")
    response = requests.post(
        "https://oauth.reddit.com/api/submit",
        headers={"Authorization": f"Bearer {_access_token()}", "User-Agent": os.getenv("REDDIT_USER_AGENT", "avoid-boring-people/1.0")},
        data={"sr": subreddit, "kind": "link", "title": title, "url": url, "resubmit": "false", "sendreplies": "true", "api_type": "json"},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Reddit API error: {response.status_code} {response.text}")
    data = response.json().get("json", {})
    if data.get("errors"):
        raise RuntimeError(f"Reddit rejected submission: {data['errors']}")
    remote_id = data.get("data", {}).get("id")
    if not remote_id:
        raise RuntimeError("Reddit accepted the request without returning a submission id")
    return PublishResult("reddit", remote_id=str(remote_id))
