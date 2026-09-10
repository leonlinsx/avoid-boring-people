# scripts/automation/publishers/weibo.py
"""Weibo adapter: Simplified-Chinese microblog posts via the official REST API.

Publishing goes through ``statuses/update`` with a user OAuth2 access token.
That token requires a manually approved Weibo open-platform application with
write scope; nothing here can substitute for that approval. When refresh
credentials are configured, one expired-token failure triggers a single
refresh-and-retry so an unattended run degrades into an operator secret
rotation instead of a silent skip.
"""

from __future__ import annotations

import os

import requests

from scripts.automation.content import PublishResult

WEIBO_UPDATE_URL = "https://api.weibo.com/2/statuses/update.json"
WEIBO_TOKEN_URL = "https://api.weibo.com/oauth2/access_token"
# Weibo lifted the original 140-character limit platform-wide in 2016; the
# current ceiling for a text post is 2000 characters.
WEIBO_STATUS_LIMIT = 2000


def _access_token() -> str:
    token = (os.getenv("WEIBO_ACCESS_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("WEIBO_ACCESS_TOKEN is missing")
    return token


def validate_status(text: str) -> None:
    if not (text or "").strip():
        raise ValueError("Weibo status text must not be empty")
    if len(text) > WEIBO_STATUS_LIMIT:
        raise ValueError(
            f"Weibo status exceeds its {WEIBO_STATUS_LIMIT}-character limit "
            f"({len(text)} characters)"
        )


def _looks_like_expired_token(payload: object) -> bool:
    text = str(payload).lower()
    return "token" in text and ("expired" in text or "invalid" in text or "auth" in text)


def refresh_access_token() -> str:
    """Exchange the refresh credentials for a fresh access token."""
    app_key = (os.getenv("WEIBO_APP_KEY") or "").strip()
    app_secret = (os.getenv("WEIBO_APP_SECRET") or "").strip()
    refresh_token = (os.getenv("WEIBO_REFRESH_TOKEN") or "").strip()
    if not app_key or not app_secret or not refresh_token:
        raise RuntimeError("Set WEIBO_APP_KEY, WEIBO_APP_SECRET, and WEIBO_REFRESH_TOKEN to refresh the access token")
    response = requests.post(
        WEIBO_TOKEN_URL,
        data={
            "client_id": app_key,
            "client_secret": app_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Weibo token refresh failed: {response.status_code} {response.text}")
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Weibo token response did not contain an access token")
    return str(token)


def _publish(access_token: str, text: str) -> dict:
    response = requests.post(
        WEIBO_UPDATE_URL,
        data={"access_token": access_token, "status": text},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Weibo API error: {response.status_code} {response.text}")
    try:
        data = response.json()
    except ValueError:
        raise RuntimeError(f"Weibo returned a non-JSON response: {response.text[:200]}")
    if isinstance(data, dict) and ("error" in data or "error_code" in data):
        raise RuntimeError(f"Weibo rejected the post: {data}")
    if not isinstance(data, dict) or data.get("id") is None:
        raise RuntimeError(f"Weibo accepted the request without returning a post id: {data}")
    return data


def post_to_weibo(text: str) -> PublishResult:
    """Publish one Simplified-Chinese status; refreshes an expired token once."""
    validate_status(text)
    try:
        data = _publish(_access_token(), text)
    except RuntimeError as error:
        if not _looks_like_expired_token(error):
            raise
        fresh_token = refresh_access_token()
        print("Weibo access token refreshed; update WEIBO_ACCESS_TOKEN to:")
        print(fresh_token)
        data = _publish(fresh_token, text)
    remote_id = str(data["id"])
    print(f"✅ Weibo post created: id {remote_id}")
    return PublishResult("weibo", remote_id=remote_id)
