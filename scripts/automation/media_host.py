"""Where carousel slide images live once they are rendered.

The Instagram Graph API does not accept image bytes; it accepts a *public
HTTPS URL* that Meta fetches on its side. That makes media hosting a real
dependency of live publishing, and this project has no approved upload service
(no S3, no CDN, no third party), so the boundary is deliberately explicit:

* `NullMediaHost` is the default and refuses to resolve anything, with a
  message that says what would have to exist first.
* `UrlMappingMediaHost` maps already-published files onto an HTTPS base URL and
  verifies that Meta can actually fetch them before a publish begins.

Nothing here uploads files. Adding an uploader means adding infrastructure, and
that is a decision for the human running this pipeline, not for a helper module.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urljoin, urlparse

import requests

from .formatters.instagram_storyboard import MAX_IMAGE_BYTES
from .renderers.instagram import RenderedSlide

ENV_BASE_URL = "INSTAGRAM_MEDIA_BASE_URL"
REQUEST_TIMEOUT_SECONDS = 15
INSTALL_HINT = (
    f"set {ENV_BASE_URL} to an HTTPS base URL that already serves the rendered "
    "slide files, or add an explicitly approved uploader before publishing"
)


class MediaHostError(RuntimeError):
    """Base class for media hosting failures."""


class MediaHostUnavailable(MediaHostError):
    """No media host is configured, so live publishing cannot proceed."""


@dataclass(frozen=True)
class MediaCheck:
    """The result of confirming that Meta can fetch one slide."""

    url: str
    status_code: int
    content_type: str
    content_length: int | None


class MediaHost:
    """Resolves rendered slides to the public URLs the Instagram API requires."""

    name = "media-host"

    def resolve(self, slide: RenderedSlide) -> str:
        raise NotImplementedError

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        raise NotImplementedError

    def resolve_all(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        return tuple(self.resolve(slide) for slide in slides)


class NullMediaHost(MediaHost):
    """Refuses to publish from local files: Meta cannot fetch a path on disk."""

    name = "unconfigured"

    def resolve(self, slide: RenderedSlide) -> str:
        raise MediaHostUnavailable(f"no public media host is configured; {INSTALL_HINT}")

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        raise MediaHostUnavailable(f"no public media host is configured; {INSTALL_HINT}")


class UrlMappingMediaHost(MediaHost):
    """Maps rendered file names onto an existing HTTPS host.

    This is a *mapping*, not an uploader: the operator is responsible for the
    files being reachable at the returned URLs, and `verify()` proves it before
    any publish call is made.
    """

    name = "url-mapping"

    def __init__(self, base_url: str, *, session: requests.Session | None = None) -> None:
        parsed = urlparse(base_url)
        if parsed.scheme != "https":
            raise MediaHostUnavailable(
                f"{ENV_BASE_URL} must be an https:// URL because Meta only fetches HTTPS media"
            )
        if not parsed.netloc:
            raise MediaHostUnavailable(
                f"{ENV_BASE_URL} must include a host, for example https://leonlins.com/social/"
            )
        self.base_url = base_url if base_url.endswith("/") else f"{base_url}/"
        self.session = session or requests.Session()

    def resolve(self, slide: RenderedSlide) -> str:
        file_name = Path(slide.path).name
        if not file_name:
            raise MediaHostError(f"rendered slide {slide.index} has no file name to publish")
        return urljoin(self.base_url, file_name)

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        """Confirm each URL is a fetchable JPEG within Meta's size limit."""
        checks = []
        for url in urls:
            try:
                response = self.session.head(url, allow_redirects=True, timeout=REQUEST_TIMEOUT_SECONDS)
                if response.status_code != 200:
                    response = self.session.get(
                        url, allow_redirects=True, stream=True, timeout=REQUEST_TIMEOUT_SECONDS
                    )
            except requests.RequestException as error:
                raise MediaHostError(f"could not reach {url}: {error}") from error

            content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            raw_length = response.headers.get("Content-Length")
            try:
                content_length = int(raw_length) if raw_length is not None else None
            except ValueError:
                content_length = None

            if response.status_code != 200:
                raise MediaHostError(f"{url} returned HTTP {response.status_code}; Meta will not fetch it")
            if content_type != "image/jpeg":
                raise MediaHostError(f"{url} served {content_type or 'no content type'} instead of image/jpeg")
            if content_length is not None and content_length > MAX_IMAGE_BYTES:
                raise MediaHostError(
                    f"{url} is {content_length} bytes, above the {MAX_IMAGE_BYTES}-byte limit for Instagram images"
                )
            checks.append(
                MediaCheck(
                    url=url,
                    status_code=response.status_code,
                    content_type=content_type,
                    content_length=content_length,
                )
            )
        return tuple(checks)


def get_media_host(base_url: str | None = None, *, session: requests.Session | None = None) -> MediaHost:
    """Return the configured media host, or the refusing default."""
    configured = (base_url if base_url is not None else os.getenv(ENV_BASE_URL) or "").strip()
    if not configured:
        return NullMediaHost()
    return UrlMappingMediaHost(configured, session=session)


def resolve_media_urls(
    slides: Sequence[RenderedSlide],
    *,
    host: MediaHost | None = None,
    verify: bool = True,
) -> tuple[str, ...]:
    """Resolve every slide to a public URL, proving reachability by default."""
    active = host or get_media_host()
    urls = active.resolve_all(slides)
    if len(urls) != len(slides):
        raise MediaHostError(f"resolved {len(urls)} URLs for {len(slides)} slides")
    if verify:
        active.verify(urls)
    return urls
