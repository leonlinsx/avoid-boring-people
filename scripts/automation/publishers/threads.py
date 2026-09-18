"""Meta Threads adapter: text posts published through the Threads Graph API.

Threads publishes in two steps: create a media container, then publish that
container. A multi-post unit is chained with `reply_to_id`, which is how the
canonical article link stays a self-reply instead of the main post.

Container processing is asynchronous on Meta's side, so a unit waits for the
container to reach a terminal status and still retries `threads_publish` when
Meta answers as if the media did not exist (error code 24, subcode 4279009):
a container can be readable on the create path before the publish path
replicates it, which is how a run fails with "The requested resource does not
exist" for a container that was created moments earlier.

Threads has no idempotency key, so a retry after a lost publish response can
duplicate a post; distribution state is written only after a confirmed publish,
which keeps a retry from repeating work that Threads has already accepted.
"""
from __future__ import annotations

import os
import time

import requests

from scripts.automation.content import PublishResult

THREADS_API_BASE = "https://graph.threads.net/v1.0"
THREADS_TEXT_LIMIT = 500
REQUEST_TIMEOUT_SECONDS = 20
# Meta advises giving a container about 30 seconds to process before publishing it.
CONTAINER_READY_TIMEOUT_SECONDS = 30
CONTAINER_POLL_SECONDS = 1
CONTAINER_READY_STATUS = "FINISHED"
CONTAINER_PUBLISHED_STATUS = "PUBLISHED"
CONTAINER_FAILED_STATUSES = frozenset({"EXPIRED", "ERROR"})
# Not-yet-replicated containers become publishable within seconds, so a bounded
# retry covers the propagation race without masking a genuinely broken container.
PUBLISH_ATTEMPTS = 5
PUBLISH_RETRY_SECONDS = 3


def _get_config() -> str:
    token = (os.getenv("THREADS_ACCESS_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("❌ THREADS_ACCESS_TOKEN missing")
    return token


def _auth_headers(token: str) -> dict:
    """Send the token as a header so it can never appear in a request URL or log."""
    return {"Authorization": f"Bearer {token}"}


def _error_payload(response) -> dict:
    """Meta's `error` object from a failed response, or an empty dict."""
    try:
        body = response.json()
    except ValueError:
        return {}
    if isinstance(body, dict) and isinstance(body.get("error"), dict):
        return body["error"]
    return {}


def _api_error(response, operation: str) -> RuntimeError:
    """Build an error that names the failed call and carries its diagnostic codes.

    The human-readable message alone is ambiguous: "The requested resource does
    not exist" is returned both for a container that the publish path cannot see
    yet and for one that never became publishable, so the code, subcode, and
    user-facing title are kept for the operator. The access token never reaches
    this message: Meta echoes it only into the request URL, which is not logged.
    """
    error = _error_payload(response)
    detail = str(error.get("message") or error.get("type") or "").strip()
    detail = detail or (response.text or "").strip()[:200]
    diagnostics = [
        f"code {error['code']}" if error.get("code") is not None else "",
        f"subcode {error['error_subcode']}" if error.get("error_subcode") is not None else "",
        str(error.get("error_user_title") or "").strip(),
    ]
    context = ", ".join(part for part in diagnostics if part)
    return RuntimeError(
        f"❌ Threads API error {response.status_code} ({operation}): {detail}"
        + (f" [{context}]" if context else "")
    )


def verify_credentials(token: str) -> dict:
    """Validate the token once per run, not once per post in a threaded unit."""
    response = requests.get(
        f"{THREADS_API_BASE}/me",
        params={"fields": "id,username"},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response, "read profile")
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


def _create_container(token: str, text: str, reply_to_id: str | None = None) -> str:
    payload = {"media_type": "TEXT", "text": text}
    if reply_to_id is not None:
        payload["reply_to_id"] = reply_to_id
    response = requests.post(
        f"{THREADS_API_BASE}/me/threads",
        data=payload,
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response, "create container")
    container_id = response.json().get("id")
    if not container_id:
        raise RuntimeError("❌ Threads created a media container without returning an id")
    return str(container_id)


def _container_status(token: str, container_id: str) -> tuple[str, str | None]:
    response = requests.get(
        f"{THREADS_API_BASE}/{container_id}",
        params={"fields": "status,error_message"},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response, f"read status of container {container_id}")
    body = response.json()
    return str(body.get("status") or "UNKNOWN"), body.get("error_message")


def wait_for_container(
    token: str,
    container_id: str,
    *,
    sleep=time.sleep,
    clock=time.monotonic,
    poll_seconds: int = CONTAINER_POLL_SECONDS,
    timeout_seconds: int = CONTAINER_READY_TIMEOUT_SECONDS,
) -> str:
    """Poll a container until Meta reports it is ready to publish.

    Publishing before the media is available is one of the documented ways to
    fail with "The requested resource does not exist", and Meta advises giving a
    container about 30 seconds to process. Unlike Instagram, the wait is
    advisory rather than fatal: an unfinished or unreadable container still goes
    to `threads_publish`, which is the authority and retries the propagation
    race itself, so a slow status read must never be why a publish is skipped.
    """
    deadline = clock() + timeout_seconds
    while True:
        try:
            status, detail = _container_status(token, container_id)
        except Exception as error:  # noqa: BLE001 - the publish call decides
            print(f"⚠️ Could not read the status of Threads container {container_id} ({error}); publishing anyway")
            return "UNKNOWN"
        if status == CONTAINER_READY_STATUS:
            return status
        if status in CONTAINER_FAILED_STATUSES:
            message = f"❌ Threads container {container_id} is {status}"
            raise RuntimeError(f"{message}: {detail}" if detail else message)
        if clock() >= deadline:
            print(
                f"⚠️ Threads container {container_id} was still {status} after {timeout_seconds}s; publishing anyway"
            )
            return status
        print(f"⏳ Threads container {container_id} is {status}; waiting {poll_seconds}s")
        sleep(poll_seconds)


def _is_unreadable_container(response) -> bool:
    """Whether a failed publish reports Meta's not-yet-replicated container race.

    Code 24 with subcode 4279009 ("Media Not Found") means the container is not
    visible on the publish path yet, so nothing was published and the same
    container is safe to publish again. `is_transient` in that payload is false,
    which is why the retry has to be decided here rather than by HTTP status.
    """
    error = _error_payload(response)
    return error.get("code") == 24 or error.get("error_subcode") == 4279009


def _container_reports_published(token: str, container_id: str) -> bool:
    """Whether the container is already live, so a publish retry could duplicate it.

    `threads_publish` has no idempotency key, so code 24 is only retried after
    Meta says the container is still unpublished. An unreadable status counts as
    unpublished: refusing to retry would lose the post, and a status read that
    fails says nothing about whether the publish landed.
    """
    try:
        status, _ = _container_status(token, container_id)
    except Exception:  # noqa: BLE001 - the status read only guards the retry
        return False
    return status == CONTAINER_PUBLISHED_STATUS


def _publish_container(token: str, container_id: str) -> str:
    """Publish one container, retrying only the failures that published nothing."""
    attempt = 0
    while True:
        attempt += 1
        response = requests.post(
            f"{THREADS_API_BASE}/me/threads_publish",
            data={"creation_id": container_id},
            headers=_auth_headers(token),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            media_id = response.json().get("id")
            if media_id:
                return str(media_id)
            # Meta documents this failure mode; report the container status rather
            # than an opaque "publish returned nothing".
            try:
                status, status_error = _container_status(token, container_id)
            except Exception:  # noqa: BLE001 - diagnostics must not mask the failure
                status, status_error = "unknown", None
            detail = f"{status}: {status_error}" if status_error else status
            error = RuntimeError(f"❌ Threads published container {container_id} without a media id ({detail})")
            # Threads has no idempotency key, so an accepted-but-unreported publish
            # must never be retried: a blind retry could post the item twice.
            error.status_code = response.status_code
            raise error
        error = _api_error(response, f"publish container {container_id}")
        if not _is_unreadable_container(response) or attempt >= PUBLISH_ATTEMPTS:
            raise error
        if _container_reports_published(token, container_id):
            # A container Meta calls PUBLISHED is live, so this failure may have
            # landed after all and a retry could post the item twice.
            print(
                f"⚠️ Threads container {container_id} reports PUBLISHED after a failed publish; "
                "not retrying it"
            )
            error.retryable = False
            raise error
        print(
            f"⚠️ Threads container {container_id} is not readable on the publish path yet "
            f"(attempt {attempt}/{PUBLISH_ATTEMPTS}); retrying in {PUBLISH_RETRY_SECONDS}s"
        )
        time.sleep(PUBLISH_RETRY_SECONDS)


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
    token = _get_config()
    verify_credentials(token)
    root_id: str | None = None
    reply_to_id: str | None = None
    for text in posts:
        try:
            container_id = _create_container(token, text, reply_to_id=reply_to_id)
            wait_for_container(token, container_id)
            media_id = _publish_container(token, container_id)
        except Exception as error:
            if root_id is not None:
                # Part of the unit is already live, so repeating it would publish
                # the earlier posts again. Fail and let an operator decide instead.
                error.retryable = False
            raise
        if root_id is None:
            root_id = media_id
        reply_to_id = media_id
    print(f"✅ Threads post published: {root_id}")
    return PublishResult("threads", remote_id=root_id, remote_url=_permalink(token, root_id))
