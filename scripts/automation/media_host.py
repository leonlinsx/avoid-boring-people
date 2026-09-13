"""Where carousel slide images live once they are rendered.

The Instagram Graph API does not accept image bytes; it accepts a *public
HTTPS URL* that Meta fetches on its side. That makes media hosting a real
dependency of live publishing, so the boundary is deliberately explicit:

* `NullMediaHost` is the default and refuses to resolve anything, with a
  message that says what would have to exist first.
* `UrlMappingMediaHost` maps already-published files onto an HTTPS base URL and
  verifies that Meta can actually fetch them before a publish begins.
* `UploadEndpointMediaHost` is the one approved uploader: it POSTs each
  rendered JPEG to the site's authenticated media endpoint, which stores it in
  the public Vercel Blob store and answers with the public HTTPS URL Meta
  should fetch. It is selected by `INSTAGRAM_MEDIA_UPLOAD_URL` plus
  `INSTAGRAM_MEDIA_UPLOAD_SECRET`.

Every host verifies reachability before a publish begins, so a hosting mistake
fails before the first Instagram container is created. Uploads are only ever
performed by the uploading hosts: a dry run renders and plans, it never sends.
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urljoin, urlparse

import requests

from .formatters.instagram_storyboard import MAX_IMAGE_BYTES
from .renderers.instagram import RenderedSlide, post_slug

ENV_BASE_URL = "INSTAGRAM_MEDIA_BASE_URL"
ENV_UPLOAD_URL = "INSTAGRAM_MEDIA_UPLOAD_URL"
ENV_UPLOAD_SECRET = "INSTAGRAM_MEDIA_UPLOAD_SECRET"
BLOB_PATH_PREFIX = "instagram"
BLOB_PATH_HEADER = "x-blob-path"
DIGEST_LENGTH = 12
REQUEST_TIMEOUT_SECONDS = 15
UPLOAD_TIMEOUT_SECONDS = 60
INSTALL_HINT = (
    f"set {ENV_BASE_URL} to an HTTPS base URL that already serves the rendered "
    f"slide files, or set {ENV_UPLOAD_URL} and {ENV_UPLOAD_SECRET} to upload them "
    "through the site's Instagram media endpoint"
)


class MediaHostError(RuntimeError):
    """Base class for media hosting failures."""


class MediaHostUnavailable(MediaHostError):
    """No media host is configured, so live publishing cannot proceed."""


class BlobUploadError(MediaHostError):
    """A slide could not be stored on, or read back from, the public media host."""


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
    #: Whether resolving actually stores bytes somewhere. A dry run plans where
    #: an uploading host would put them instead of calling it.
    uploads = False

    def resolve(self, slide: RenderedSlide) -> str:
        raise NotImplementedError

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        raise NotImplementedError

    def resolve_all(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        return tuple(self.resolve(slide) for slide in slides)

    def upload_plan(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        """Where a live upload would send each slide, without contacting the host.

        Hosts that cannot describe a destination return nothing.
        """
        return ()


def check_fetchable_jpeg(session: requests.Session, url: str) -> MediaCheck:
    """Confirm one public URL is a JPEG within Meta's size limit."""
    try:
        response = session.head(url, allow_redirects=True, timeout=REQUEST_TIMEOUT_SECONDS)
        if response.status_code != 200:
            response = session.get(
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
    return MediaCheck(
        url=url,
        status_code=response.status_code,
        content_type=content_type,
        content_length=content_length,
    )


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
        return tuple(check_fetchable_jpeg(self.session, url) for url in urls)


class UploadEndpointMediaHost(MediaHost):
    """Uploads rendered slides through the site's authenticated media endpoint.

    GitHub Actions holds no Vercel Blob credential: the store is authenticated
    with OIDC inside the Vercel project that serves this site. So the uploader
    POSTs each JPEG to that endpoint, which stores it with the Blob SDK and
    answers with the public HTTPS URL Meta should fetch. The shared secret
    travels in an `Authorization` header, never in the URL, and is never logged.

    Object paths embed the carousel's content digest:

        instagram/<article-id>/<content-hash>/slide-01.jpg

    A re-render of unchanged slides therefore lands on the exact same objects
    (a retry rewrites identical bytes at a stable URL), while a changed render
    moves to a new path and can never overwrite an asset Instagram may still be
    serving for an already-published carousel.
    """

    name = "upload-endpoint"
    uploads = True

    def __init__(
        self,
        endpoint_url: str | None = None,
        secret: str | None = None,
        *,
        post_id: str | None = None,
        session: requests.Session | None = None,
    ) -> None:
        configured_url = (
            endpoint_url if endpoint_url is not None else os.getenv(ENV_UPLOAD_URL) or ""
        ).strip()
        configured_secret = (
            secret if secret is not None else os.getenv(ENV_UPLOAD_SECRET) or ""
        ).strip()
        if not configured_url or not configured_secret:
            raise MediaHostUnavailable(
                f"uploading carousel media needs both {ENV_UPLOAD_URL} and {ENV_UPLOAD_SECRET}; "
                "set both to upload, or leave both unset to publish from an existing host"
            )
        parsed = urlparse(configured_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise MediaHostUnavailable(
                f"{ENV_UPLOAD_URL} must be an https:// URL, for example "
                "https://leonlins.com/api/social/instagram-media"
            )
        self.endpoint_url = configured_url
        self._secret = configured_secret
        self.post_id = (post_id or "").strip()
        self.session = session or requests.Session()

    def object_path(self, slide: RenderedSlide, digest: str) -> str:
        """Content-addressed destination for one slide in the Blob store."""
        if not self.post_id:
            raise BlobUploadError(
                f"{ENV_UPLOAD_URL} media hosting needs the article id to build a "
                "stable, collision-safe object path"
            )
        return f"{BLOB_PATH_PREFIX}/{post_slug(self.post_id)}/{digest}/slide-{slide.index:02d}.jpg"

    def resolve(self, slide: RenderedSlide) -> str:
        return self.upload(slide, content_digest((slide,)))

    def resolve_all(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        ordered = tuple(slides)
        digest = content_digest(ordered)
        return tuple(self.upload(slide, digest) for slide in ordered)

    def upload_plan(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        """The objects a live run would create, without uploading anything."""
        ordered = tuple(slides)
        digest = content_digest(ordered)
        return tuple(
            f"{self.object_path(slide, digest)} -> POST {self.endpoint_url}" for slide in ordered
        )

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        """Confirm the endpoint's Blob URLs are fetchable JPEGs Meta can use."""
        return tuple(check_fetchable_jpeg(self.session, url) for url in urls)

    def upload(self, slide: RenderedSlide, digest: str) -> str:
        """Store one rendered slide and return the public HTTPS URL."""
        pathname = self.object_path(slide, digest)
        try:
            payload = Path(slide.path).read_bytes()
        except OSError as error:
            raise BlobUploadError(f"could not read rendered slide {slide.path}: {error}") from error

        headers = {
            "authorization": f"Bearer {self._secret}",
            "content-type": "image/jpeg",
            BLOB_PATH_HEADER: pathname,
        }
        try:
            response = self.session.post(
                self.endpoint_url,
                data=payload,
                headers=headers,
                timeout=UPLOAD_TIMEOUT_SECONDS,
            )
        except requests.RequestException as error:
            raise BlobUploadError(
                f"uploading {pathname} to {self.endpoint_url} failed: {error}"
            ) from error
        if not 200 <= response.status_code < 300:
            raise BlobUploadError(
                f"{self.endpoint_url} rejected {pathname} with "
                f"HTTP {response.status_code}{self._rejection(response)}"
            )

        stored = _upload_response(response)
        url = str(stored.get("url") or "")
        returned_path = str(stored.get("pathname") or "")
        if not _is_usable_media_url(url, self.endpoint_url):
            raise BlobUploadError(
                f"{self.endpoint_url} returned {url or 'no URL'} for {pathname}, "
                "which is not the public HTTPS URL Meta needs"
            )
        if returned_path and returned_path != pathname:
            raise BlobUploadError(
                f"{self.endpoint_url} stored {returned_path} instead of the requested {pathname}"
            )
        return url

    def _rejection(self, response: requests.Response) -> str:
        """Server-side reason for a failed upload, with the secret stripped."""
        stored = _upload_response(response)
        detail = str(stored.get("error") or stored.get("message") or "")
        detail = detail or (getattr(response, "text", "") or "")
        detail = " ".join(str(detail).split())[:200].replace(self._secret, "[redacted]")
        return f": {detail}" if detail else ""


def content_digest(slides: Sequence[RenderedSlide]) -> str:
    """Stable digest of a rendered carousel's bytes, used as its path segment."""
    hasher = hashlib.sha256()
    for slide in slides:
        hasher.update(f"{slide.index}:{slide.sha256}\n".encode())
    return hasher.hexdigest()[:DIGEST_LENGTH]


def _upload_response(response: requests.Response) -> dict:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _is_usable_media_url(url: str, endpoint_url: str = "") -> bool:
    """A stored slide must be a public HTTPS URL that is not the endpoint itself."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    return url.split("#", 1)[0].rstrip("/") != endpoint_url.rstrip("/")


def get_media_host(
    base_url: str | None = None,
    *,
    session: requests.Session | None = None,
    post_id: str | None = None,
) -> MediaHost:
    """Return the configured media host, or the refusing default.

    An explicit `INSTAGRAM_MEDIA_BASE_URL` wins over the upload endpoint because
    it is a deliberate operator choice to serve the slides from somewhere else;
    the uploader is used when its URL and secret are present.
    """
    configured = (base_url if base_url is not None else os.getenv(ENV_BASE_URL) or "").strip()
    if configured:
        return UrlMappingMediaHost(configured, session=session)
    endpoint_url = (os.getenv(ENV_UPLOAD_URL) or "").strip()
    secret = (os.getenv(ENV_UPLOAD_SECRET) or "").strip()
    if endpoint_url or secret:
        # A half-configured uploader fails loudly instead of silently degrading.
        return UploadEndpointMediaHost(
            endpoint_url, secret, post_id=post_id, session=session
        )
    return NullMediaHost()


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
