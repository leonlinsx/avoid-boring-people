"""Meta Instagram adapter: carousel posts published through the Instagram Graph API.

The carousel flow is three API steps (verified against Meta's Instagram
Platform documentation for Graph API v26.0):

1. one child container per slide:
   `POST /{ig-user-id}/media?image_url=...&is_carousel_item=true&alt_text=...`
2. one parent container naming the children:
   `POST /{ig-user-id}/media?media_type=CAROUSEL&caption=...&children=<ids>`
3. one publish call: `POST /{ig-user-id}/media_publish?creation_id=<parent id>`

Containers are created asynchronously, so a container is polled with
`GET /{container-id}?fields=status_code` (one of `EXPIRED`, `ERROR`,
`FINISHED`, `IN_PROGRESS`, `PUBLISHED`) before it is published.

Failure policy
--------------
Everything up to and including the parent container is safe to retry: an
unpublished container expires on its own, and a retry simply builds new ones.

`media_publish` is *not* safe to retry blindly. If the response is lost, the
carousel may already be live, and Instagram has no idempotency key, so a second
call would publish a duplicate. That case raises `AmbiguousPublishError`, which
is marked non-retryable and carries the ids needed to reconcile by hand.
"""
from __future__ import annotations

import os
import time

import requests

from scripts.automation.content import PublishResult
from scripts.automation.formatters.instagram_storyboard import (
    ALT_TEXT_MAX,
    CAPTION_HARD_MAX,
    HASHTAG_LIMIT,
    MAX_IMAGE_BYTES,
    InstagramStoryboard,
    validate_storyboard,
)
from scripts.automation.media_host import MediaHostError, resolve_media_urls
from scripts.automation.renderers.instagram import render_storyboard

INSTAGRAM_API_BASE = "https://graph.facebook.com/v26.0"
REQUEST_TIMEOUT_SECONDS = 30
CONTAINER_POLL_SECONDS = 60
CONTAINER_TIMEOUT_SECONDS = 5 * 60
CONTAINER_READY_STATUS = "FINISHED"
CONTAINER_FAILED_STATUSES = frozenset({"EXPIRED", "ERROR"})


class InstagramConfigError(RuntimeError):
    """The Instagram credentials are absent or unusable."""


class GraphApiError(RuntimeError):
    """An Instagram Graph API call failed; carries the HTTP status when known."""


class AmbiguousPublishError(RuntimeError):
    """`media_publish` may have succeeded, so repeating it could duplicate the post.

    `retryable = False` is read by `scripts.automation.retry.is_transient`, which
    stops the generic retry loop from calling publish a second time.
    """

    retryable = False

    def __init__(self, message: str, *, container_id: str, child_ids: tuple[str, ...]) -> None:
        super().__init__(message)
        self.container_id = container_id
        self.child_ids = tuple(child_ids)


def _get_config() -> tuple[str, str]:
    user_id = (os.getenv("INSTAGRAM_USER_ID") or "").strip()
    token = (os.getenv("INSTAGRAM_ACCESS_TOKEN") or "").strip()
    if not user_id or not token:
        raise InstagramConfigError("❌ INSTAGRAM_USER_ID or INSTAGRAM_ACCESS_TOKEN missing")
    return user_id, token


def _auth_headers(token: str) -> dict:
    """Send the token as a header so it can never appear in a request URL or log."""
    return {"Authorization": f"Bearer {token}"}


def _api_error(response) -> GraphApiError:
    """Build an error that carries the status code for retry classification."""
    detail = ""
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict) and isinstance(body.get("error"), dict):
        error = body["error"]
        detail = str(error.get("message") or error.get("type") or "")
        if error.get("error_user_msg"):
            detail = f"{detail} ({error['error_user_msg']})" if detail else str(error["error_user_msg"])
    detail = detail or (response.text or "").strip()[:200]
    error = GraphApiError(f"❌ Instagram API error {response.status_code}: {detail}")
    error.status_code = response.status_code
    return error


def validate_caption(caption: str) -> None:
    if not caption.strip():
        raise ValueError("Instagram caption must not be empty")
    if len(caption) > CAPTION_HARD_MAX:
        raise ValueError(
            f"Instagram caption exceeds the {CAPTION_HARD_MAX}-character limit ({len(caption)} characters)"
        )
    hashtags = [word for word in caption.split() if word.startswith("#")]
    if len(hashtags) > HASHTAG_LIMIT:
        raise ValueError(
            f"Instagram caption carries {len(hashtags)} hashtags, above the {HASHTAG_LIMIT} allowed"
        )


def validate_alt_text(alt_text: str) -> None:
    if len(alt_text) > ALT_TEXT_MAX:
        raise ValueError(f"Instagram alt text exceeds the {ALT_TEXT_MAX}-character limit ({len(alt_text)})")


def verify_credentials(user_id: str, token: str) -> dict:
    """Confirm the token works before building containers for a carousel."""
    response = requests.get(
        f"{INSTAGRAM_API_BASE}/{user_id}",
        params={"fields": "id,username"},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    profile = response.json()
    print(f"✅ Authenticated as Instagram account: {profile.get('username') or profile.get('id')}")
    return profile


def create_child_container(user_id: str, token: str, image_url: str, alt_text: str) -> str:
    """Create one carousel item container for a single slide image."""
    response = requests.post(
        f"{INSTAGRAM_API_BASE}/{user_id}/media",
        data={"image_url": image_url, "is_carousel_item": "true", "alt_text": alt_text},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    container_id = response.json().get("id")
    if not container_id:
        raise GraphApiError("❌ Instagram created a child container without returning an id")
    return str(container_id)


def create_carousel_container(user_id: str, token: str, child_ids: list[str], caption: str) -> str:
    """Create the parent carousel container that names every child in order."""
    response = requests.post(
        f"{INSTAGRAM_API_BASE}/{user_id}/media",
        data={
            "media_type": "CAROUSEL",
            "children": ",".join(child_ids),
            "caption": caption,
        },
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    container_id = response.json().get("id")
    if not container_id:
        raise GraphApiError("❌ Instagram created a carousel container without returning an id")
    return str(container_id)


def container_status(user_id: str, token: str, container_id: str) -> tuple[str, str | None]:
    """Read one container's `status_code`, which is how readiness is detected."""
    response = requests.get(
        f"{INSTAGRAM_API_BASE}/{container_id}",
        params={"fields": "status_code,status"},
        headers=_auth_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise _api_error(response)
    body = response.json()
    return str(body.get("status_code") or "UNKNOWN"), body.get("status")


def wait_for_container(
    user_id: str,
    token: str,
    container_id: str,
    *,
    sleep=time.sleep,
    clock=time.monotonic,
    poll_seconds: int = CONTAINER_POLL_SECONDS,
    timeout_seconds: int = CONTAINER_TIMEOUT_SECONDS,
) -> str:
    """Poll a container until Instagram reports it is ready to publish.

    Retrying is safe here: this only reads state. A container that reports
    `EXPIRED` or `ERROR` is a permanent failure for the current attempt and the
    caller builds a fresh container on the next try.
    """
    deadline = clock() + timeout_seconds
    while True:
        status, detail = container_status(user_id, token, container_id)
        if status == CONTAINER_READY_STATUS:
            return status
        if status in CONTAINER_FAILED_STATUSES:
            message = f"❌ Instagram container {container_id} is {status}"
            raise GraphApiError(f"{message}: {detail}" if detail else message)
        if clock() >= deadline:
            raise GraphApiError(
                f"❌ Instagram container {container_id} was still {status} after {timeout_seconds}s; "
                "re-run to build a fresh container (containers expire after 24 hours)"
            )
        print(f"⏳ Instagram container {container_id} is {status}; waiting {poll_seconds}s")
        sleep(poll_seconds)


def publish_container(user_id: str, token: str, container_id: str, *, child_ids: tuple[str, ...] = ()) -> str:
    """Publish a finished container, refusing to hide an ambiguous outcome."""
    try:
        response = requests.post(
            f"{INSTAGRAM_API_BASE}/{user_id}/media_publish",
            data={"creation_id": container_id},
            headers=_auth_headers(token),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        raise AmbiguousPublishError(
            f"❌ Instagram media_publish for container {container_id} failed without a usable response "
            f"({error}). The carousel may already be live, so it is not retried. Verify with "
            f"`GET {INSTAGRAM_API_BASE}/{user_id}/media?fields=id,caption,timestamp&limit=5` before re-running.",
            container_id=container_id,
            child_ids=child_ids,
        ) from error

    if response.status_code != 200:
        # 5xx and 429 are the retryable classes; both are ambiguous for a
        # publish call, so they are reported as such instead of being retried.
        if response.status_code in {429, 500, 502, 503, 504}:
            raise AmbiguousPublishError(
                f"❌ Instagram media_publish for container {container_id} returned HTTP "
                f"{response.status_code}. The carousel may already be live, so it is not retried. "
                f"Verify with `GET {INSTAGRAM_API_BASE}/{user_id}/media?fields=id,caption,timestamp&limit=5` "
                "before re-running.",
                container_id=container_id,
                child_ids=child_ids,
            )
        raise _api_error(response)

    media_id = response.json().get("id")
    if not media_id:
        raise AmbiguousPublishError(
            f"❌ Instagram published container {container_id} without returning a media id. "
            "The carousel may already be live, so it is not retried. Verify with "
            f"`GET {INSTAGRAM_API_BASE}/{user_id}/media?fields=id,caption,timestamp&limit=5` before re-running.",
            container_id=container_id,
            child_ids=child_ids,
        )
    return str(media_id)


def _permalink(token: str, media_id: str) -> str | None:
    """Best-effort public URL for distribution state; never fail a live publish."""
    try:
        response = requests.get(
            f"{INSTAGRAM_API_BASE}/{media_id}",
            params={"fields": "permalink"},
            headers=_auth_headers(token),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            return response.json().get("permalink")
    except requests.RequestException as error:
        print(f"⚠️ Could not read the Instagram permalink: {error}")
    return None


def post_carousel(storyboard: InstagramStoryboard, *, carousel=None, media_host=None) -> PublishResult:
    """Render, host-check, and publish one carousel.

    Renders and validates locally before the first network call so a copy or
    layout problem can never leave a partial carousel on Instagram.
    """
    validate_storyboard(storyboard)
    validate_caption(storyboard.caption)
    for slide in storyboard.slides:
        validate_alt_text(slide.alt_text)

    rendered = carousel or render_storyboard(storyboard)
    for slide in rendered.slides:
        if slide.size_bytes > MAX_IMAGE_BYTES:
            raise ValueError(
                f"rendered slide {slide.index} is {slide.size_bytes} bytes, "
                f"above the {MAX_IMAGE_BYTES}-byte limit for Instagram images"
            )

    # Meta fetches the images itself, so the URLs have to be public and
    # reachable before any container is created.
    image_urls = resolve_media_urls(rendered.slides, host=media_host)
    if len(image_urls) != len(rendered.slides):
        raise MediaHostError(
            f"media host resolved {len(image_urls)} of {len(rendered.slides)} slide URLs"
        )
    # Alt text belongs to the storyboard slide, not the rendered file, so pair
    # the two by slide index rather than by position.
    alt_texts = {slide.index: slide.alt_text for slide in storyboard.slides}

    user_id, token = _get_config()
    verify_credentials(user_id, token)

    child_ids: list[str] = []
    for slide, image_url in zip(rendered.slides, image_urls):
        alt_text = alt_texts.get(slide.index) or storyboard.title
        child_id = create_child_container(user_id, token, image_url, alt_text)
        wait_for_container(user_id, token, child_id)
        child_ids.append(child_id)
        print(f"✅ Instagram child container {len(child_ids)}/{len(rendered.slides)} ready")

    parent_id = create_carousel_container(user_id, token, child_ids, storyboard.caption)
    wait_for_container(user_id, token, parent_id)
    media_id = publish_container(user_id, token, parent_id, child_ids=tuple(child_ids))
    print(f"✅ Instagram carousel published: {media_id}")
    return PublishResult("instagram", remote_id=media_id, remote_url=_permalink(token, media_id))
