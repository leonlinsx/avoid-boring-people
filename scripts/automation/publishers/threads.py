"""Meta Threads adapter: text posts published through the Threads Graph API.

Threads publishes in two steps: create a media container, then publish that
container. A multi-post unit is chained with `reply_to_id`, which is how the
canonical article link stays a self-reply instead of the main post.

Threads has no idempotency key, so a retry after a lost publish response can
duplicate a post; distribution state is written only after a confirmed publish,
which keeps a retry from repeating work that Threads has already accepted.
"""
from __future__ import annotations

import os

import requests

from scripts.automation.content import PublishResult

THREADS_API_BASE = "https://graph.threads.net/v1.0"
THREADS_TEXT_LIMIT = 500
REQUEST_TIMEOUT_SECONDS = 20


def _get_config() -> tuple[str, str]:
    user_id = (os.getenv("THREADS_USER_ID") or "").strip()
    token = (os.getenv("THREADS_ACCESS_TOKEN") or "").strip()
    if not user_id or not token:
        raise RuntimeError("❌ THREADS_USER_ID or THREADS_ACCESS_TOKEN missing")
    return user_id, token


def _auth_headers(token: str) -> dict:
    """Send the token as a header so it can never appear in a request URL or log."""
    return {"Authorization": f"Bearer {token}"}


def _api_error(response) -> RuntimeError:
    """Build an error that carries the status code for retry classification."""
    detail = ""
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict) and isinstance(body.get("error"), dict):
        error = body["error"]
        detail = str(error.get("message") or error.get("type") or "")
    detail = detail or (response.text or "").strip()[:200]
    return RuntimeError(f"❌ Threads API error {response.status_code}: {detail}")


def verify_credentials(user_id: str, token: str) -> dict:
    """Validate the token once per run, not once per post in a threaded unit."""
    response = requests.get(
        f"{THREADS_API_BASE}/me",
        params={"fields": "id,username"},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    profile = response.json()
    print(f"✅ Authenticated as Threads user: {profile.get('username') or profile.get('id')}")
    return profile


def validate_text(text: str) -> None:
    if not text.strip():
        raise ValueError("Threads post text must not be empty")
    if len(text) > THREADS_TEXT_LIMIT:
        raise ValueError(
            f"Threads post exceeds the {THREADS_TEXT_LIMIT}-character limit ({len(text)} characters)"
        )


def _create_container(user_id: str, token: str, text: str, reply_to_id: str | None = None) -> str:
    payload = {"media_type": "TEXT", "text": text}
    if reply_to_id is not None:
        payload["reply_to_id"] = reply_to_id
    response = requests.post(
        f"{THREADS_API_BASE}/{user_id}/threads",
        data=payload,
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    container_id = response.json().get("id")
    if not container_id:
        raise RuntimeError("❌ Threads created a media container without returning an id")
    return str(container_id)


def _container_status(user_id: str, token: str, container_id: str) -> tuple[str, str | None]:
    response = requests.get(
        f"{THREADS_API_BASE}/{container_id}",
        params={"fields": "status,error_message"},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    body = response.json()
    return str(body.get("status") or "UNKNOWN"), body.get("error_message")


def _publish_container(user_id: str, token: str, container_id: str) -> str:
    response = requests.post(
        f"{THREADS_API_BASE}/{user_id}/threads_publish",
        data={"creation_id": container_id},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    media_id = response.json().get("id")
    if not media_id:
        # Meta documents this failure mode; report the container status rather
        # than an opaque "publish returned nothing".
        try:
            status, status_error = _container_status(user_id, token, container_id)
        except Exception:  # noqa: BLE001 - diagnostics must not mask the failure
            status, status_error = "unknown", None
        detail = f"{status}: {status_error}" if status_error else status
        error = RuntimeError(f"❌ Threads published container {container_id} without a media id ({detail})")
        # Threads has no idempotency key, so an accepted-but-unreported publish
        # must never be retried: a blind retry could post the item twice.
        error.status_code = response.status_code
        raise error
    return str(media_id)


def _permalink(token: str, media_id: str) -> str | None:
    """Best-effort public URL for distribution state; never fail a live publish."""
    try:
        response = requests.get(
            f"{THREADS_API_BASE}/{media_id}",
            params={"fields": "permalink"},
            headers=_auth_headers(token),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            return response.json().get("permalink")
    except requests.RequestException as error:
        print(f"⚠️ Could not read the Threads permalink: {error}")
    return None


def post_to_threads(posts: list[str]) -> PublishResult:
    """Publish one Threads unit, chaining each extra post as a reply.

    Every text is validated before the first API call so an over-length reply
    can never leave a half-published unit, matching the X thread adapter.
    """
    if not posts:
        raise ValueError("No Threads posts to publish")
    for text in posts:
        validate_text(text)
    user_id, token = _get_config()
    verify_credentials(user_id, token)
    root_id: str | None = None
    reply_to_id: str | None = None
    for text in posts:
        container_id = _create_container(user_id, token, text, reply_to_id=reply_to_id)
        media_id = _publish_container(user_id, token, container_id)
        if root_id is None:
            root_id = media_id
        reply_to_id = media_id
    print(f"✅ Threads post published: {root_id}")
    return PublishResult("threads", remote_id=root_id, remote_url=_permalink(token, root_id))
