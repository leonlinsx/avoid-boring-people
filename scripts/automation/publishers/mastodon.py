# scripts/automation/publishers/mastodon.py
"""Mastodon adapter: one suitable toot by default, real replies when threading."""

from __future__ import annotations

import os
import requests

MASTODON_STATUS_LIMIT = 500


def _get_config() -> tuple[str, str]:
    instance = (os.getenv("MASTODON_INSTANCE") or "").rstrip("/")
    token = (os.getenv("MASTODON_ACCESS_TOKEN") or "").strip()
    if not instance or not token:
        raise RuntimeError("❌ MASTODON_INSTANCE or MASTODON_ACCESS_TOKEN missing")
    return instance, token


def _auth_headers(token: str, idempotency_key: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def verify_credentials() -> dict:
    """Validate the token once per operation, not once per threaded post."""
    instance, token = _get_config()
    resp = requests.get(
        f"{instance}/api/v1/accounts/verify_credentials",
        headers=_auth_headers(token),
        timeout=20,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"❌ Failed to verify Mastodon token: {resp.status_code} {resp.text}"
        )
    user = resp.json()
    print(f"✅ Authenticated as: {user.get('username')} (@{user.get('acct')})")
    return user


def _validate_length(text: str) -> None:
    if len(text) > MASTODON_STATUS_LIMIT:
        raise ValueError(
            f"Mastodon status exceeds its {MASTODON_STATUS_LIMIT}-character limit "
            f"({len(text)} characters)"
        )


def _post_status(instance: str, token: str, text: str, in_reply_to_id: str | None = None, idempotency_key: str | None = None) -> dict:
    _validate_length(text)
    payload: dict = {"status": text}
    if in_reply_to_id is not None:
        payload["in_reply_to_id"] = in_reply_to_id
    resp = requests.post(
        f"{instance}/api/v1/statuses",
        headers=_auth_headers(token, idempotency_key),
        json=payload,
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"❌ Mastodon API error: {resp.status_code} {resp.text}")
    data = resp.json()
    print(f"✅ Mastodon post created: {data.get('url')}")
    return data


def post_single_to_mastodon(text: str, idempotency_key: str | None = None):
    """Post a single status update to Mastodon."""
    instance, token = _get_config()
    verify_credentials()
    return _post_status(instance, token, text, idempotency_key=idempotency_key)


def post_thread_to_mastodon(posts: list[str], idempotency_key: str | None = None):
    """Post a real reply-thread via in_reply_to_id with a single auth check."""
    if not posts:
        print("⚠️ No posts to publish.")
        return []
    instance, token = _get_config()
    verify_credentials()
    results = []
    in_reply_to_id: str | None = None
    for index, text in enumerate(posts):
        key = f"{idempotency_key}:{index}" if idempotency_key else None
        result = _post_status(instance, token, text, in_reply_to_id=in_reply_to_id, idempotency_key=key)
        in_reply_to_id = result.get("id")
        results.append(result)
    print("✅ Mastodon thread posted")
    return results
