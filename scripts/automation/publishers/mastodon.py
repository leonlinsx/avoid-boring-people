# scripts/automation/publishers/mastodon.py

import os
import requests

MASTODON_INSTANCE = os.getenv("MASTODON_INSTANCE")   # e.g. https://mastodon.social
MASTODON_ACCESS_TOKEN = os.getenv("MASTODON_ACCESS_TOKEN")


def _get_auth_headers() -> dict:
    if not MASTODON_INSTANCE or not MASTODON_ACCESS_TOKEN:
        raise RuntimeError("❌ MASTODON_INSTANCE or MASTODON_ACCESS_TOKEN missing")

    return {
        "Authorization": f"Bearer {MASTODON_ACCESS_TOKEN.strip()}",
        "Content-Type": "application/json",
    }


def _check_token_valid():
    """Quick validation to ensure the token works."""
    url = f"{MASTODON_INSTANCE}/api/v1/accounts/verify_credentials"
    resp = requests.get(url, headers=_get_auth_headers())
    if resp.status_code != 200:
        raise RuntimeError(
            f"❌ Failed to verify Mastodon token: {resp.status_code} {resp.text}"
        )
    user = resp.json()
    print(f"✅ Authenticated as: {user.get('username')} (@{user.get('acct')})")
    return user


def post_single_to_mastodon(text: str):
    """Post a single status update to Mastodon"""
    _check_token_valid()

    url = f"{MASTODON_INSTANCE}/api/v1/statuses"
    payload = {"status": text}

    resp = requests.post(url, headers=_get_auth_headers(), json=payload)
    if resp.status_code != 200:
        raise RuntimeError(f"❌ Mastodon API error: {resp.status_code} {resp.text}")

    data = resp.json()
    print(f"✅ Mastodon post created: {data.get('url')}")
    return data


def post_thread_to_mastodon(posts: list[str]):
    """
    Post a series of updates as a thread.
    Mastodon doesn't have native threading like Bluesky/Twitter,
    so we just post sequentially and return the list of responses.
    """
    _check_token_valid()

    results = []
    for text in posts:
        result = post_single_to_mastodon(text)
        results.append(result)
    print("✅ Mastodon thread posted")
    return results
