"""Where carousel slide images live once they are rendered.

The Instagram Graph API does not accept image bytes; it accepts a *public
HTTPS URL* that Meta fetches on its side. That makes media hosting a real
dependency of live publishing, so the boundary is deliberately explicit:

* `NullMediaHost` is the default and refuses to resolve anything, with a
  message that says what would have to exist first.
* `UrlMappingMediaHost` maps already-published files onto an HTTPS base URL and
  verifies that Meta can actually fetch them before a publish begins.
* `VercelBlobMediaHost` is the one approved uploader: it PUTs each rendered
  JPEG to Vercel Blob under a content-addressed path and returns the public
  HTTPS URL Meta should fetch. It is selected by `BLOB_READ_WRITE_TOKEN` alone.

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
ENV_BLOB_TOKEN = "BLOB_READ_WRITE_TOKEN"
BLOB_API_BASE = "https://vercel.com/api/blob"
BLOB_API_VERSION = "12"
BLOB_PUBLIC_HOST_SUFFIX = ".public.blob.vercel-storage.com"
BLOB_PATH_PREFIX = "instagram"
DIGEST_LENGTH = 12
REQUEST_TIMEOUT_SECONDS = 15
UPLOAD_TIMEOUT_SECONDS = 60
INSTALL_HINT = (
    f"set {ENV_BASE_URL} to an HTTPS base URL that already serves the rendered "
    f"slide files, or set {ENV_BLOB_TOKEN} to upload them to Vercel Blob"
)


class MediaHostError(RuntimeError):
    """Base class for media hosting failures."""


class MediaHostUnavailable(MediaHostError):
    """No media host is configured, so live publishing cannot proceed."""


class BlobUploadError(MediaHostError):
    """A slide could not be stored on, or read back from, Vercel Blob."""


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
    #: Whether resolving actually stores bytes somewhere. A dry run plans the
    #: URLs of an uploading host instead of calling it.
    uploads = False

    def resolve(self, slide: RenderedSlide) -> str:
        raise NotImplementedError

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        raise NotImplementedError

    def resolve_all(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        return tuple(self.resolve(slide) for slide in slides)

    def planned_urls(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        """Where the slides would live, without contacting the host."""
        return self.resolve_all(slides)


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


class VercelBlobMediaHost(MediaHost):
    """Uploads rendered slides to Vercel Blob and returns their public URLs.

    `put` is called over the documented HTTP API with the read-write token in an
    `Authorization` header, so the credential never appears in a URL, a query
    string, or a log line. The token must belong to a store whose access is
    public, since Meta fetches the images anonymously.

    Object paths embed the carousel's content digest:

        instagram/<article-id>/<content-hash>/slide-01.jpg

    A re-render of unchanged slides therefore lands on the exact same objects
    (a retry rewrites identical bytes at a stable URL), while a changed render
    moves to a new path and can never overwrite an asset Instagram may still be
    serving for an already-published carousel.
    """

    name = "vercel-blob"
    uploads = True

    def __init__(
        self,
        token: str | None = None,
        *,
        post_id: str | None = None,
        session: requests.Session | None = None,
        api_base: str = BLOB_API_BASE,
    ) -> None:
        configured = (token if token is not None else os.getenv(ENV_BLOB_TOKEN) or "").strip()
        if not configured:
            raise MediaHostUnavailable(
                f"no Vercel Blob token is configured; set {ENV_BLOB_TOKEN} to a "
                "read-write token for the store that will serve the carousel images"
            )
        self._token = configured
        self.store_id = blob_store_id(configured)
        self.post_id = (post_id or "").strip()
        self.session = session or requests.Session()
        self.api_base = api_base.rstrip("/")

    def object_path(self, slide: RenderedSlide, digest: str) -> str:
        """Content-addressed destination for one slide inside the store."""
        if not self.post_id:
            raise BlobUploadError(
                f"{ENV_BLOB_TOKEN} media hosting needs the article id to build a "
                "stable, collision-safe object path"
            )
        return f"{BLOB_PATH_PREFIX}/{post_slug(self.post_id)}/{digest}/slide-{slide.index:02d}.jpg"

    def public_url(self, pathname: str) -> str:
        if not self.store_id:
            raise BlobUploadError(
                f"cannot derive the public Blob URL: {ENV_BLOB_TOKEN} is not in the "
                "documented vercel_blob_rw_<store-id>_<secret> form"
            )
        return f"https://{self.store_id}{BLOB_PUBLIC_HOST_SUFFIX}/{pathname}"

    def resolve(self, slide: RenderedSlide) -> str:
        return self.upload(slide, content_digest((slide,)))

    def resolve_all(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        ordered = tuple(slides)
        digest = content_digest(ordered)
        return tuple(self.upload(slide, digest) for slide in ordered)

    def planned_urls(self, slides: Iterable[RenderedSlide]) -> tuple[str, ...]:
        """The URLs a live run would produce, without uploading anything."""
        ordered = tuple(slides)
        digest = content_digest(ordered)
        return tuple(self.public_url(self.object_path(slide, digest)) for slide in ordered)

    def verify(self, urls: Sequence[str]) -> tuple[MediaCheck, ...]:
        """Confirm Blob serves each uploaded JPEG the way Meta needs it."""
        return tuple(check_fetchable_jpeg(self.session, url) for url in urls)

    def upload(self, slide: RenderedSlide, digest: str) -> str:
        """Store one rendered slide and return the public HTTPS URL."""
        pathname = self.object_path(slide, digest)
        try:
            payload = Path(slide.path).read_bytes()
        except OSError as error:
            raise BlobUploadError(f"could not read rendered slide {slide.path}: {error}") from error

        headers = {
            "authorization": f"Bearer {self._token}",
            "x-api-version": BLOB_API_VERSION,
            "x-content-type": "image/jpeg",
            "x-vercel-blob-access": "public",
            # The path is already unique and content-addressed, so a suffix
            # would only break re-run idempotency, and overwriting is safe
            # precisely because the same path always holds the same bytes.
            "x-add-random-suffix": "0",
            "x-allow-overwrite": "1",
        }
        if self.store_id:
            headers["x-vercel-blob-store-id"] = self.store_id
        try:
            response = self.session.put(
                f"{self.api_base}/{pathname}",
                data=payload,
                headers=headers,
                timeout=UPLOAD_TIMEOUT_SECONDS,
            )
        except requests.RequestException as error:
            raise BlobUploadError(f"uploading {pathname} to Vercel Blob failed: {error}") from error
        if response.status_code != 200:
            raise BlobUploadError(
                f"Vercel Blob rejected {pathname} with HTTP {response.status_code}{self._rejection(response)}"
            )

        url = _blob_url(response)
        if not _is_public_blob_url(url):
            raise BlobUploadError(
                f"Vercel Blob returned {url or 'no URL'} for {pathname}, "
                "which is not a public HTTPS blob URL"
            )
        return url

    def _rejection(self, response: requests.Response) -> str:
        """Server-side reason for a failed upload, with the token stripped."""
        detail = ""
        try:
            payload = response.json()
        except ValueError:
            payload = None
        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                detail = str(error.get("message") or "")
            elif error:
                detail = str(error)
            detail = detail or str(payload.get("message") or "")
        detail = detail or (getattr(response, "text", "") or "")
        detail = " ".join(str(detail).split())[:200].replace(self._token, "[redacted]")
        return f": {detail}" if detail else ""


def content_digest(slides: Sequence[RenderedSlide]) -> str:
    """Stable digest of a rendered carousel's bytes, used as its path segment."""
    hasher = hashlib.sha256()
    for slide in slides:
        hasher.update(f"{slide.index}:{slide.sha256}\n".encode())
    return hasher.hexdigest()[:DIGEST_LENGTH]


def blob_store_id(token: str) -> str:
    """Read the store id out of a Vercel read-write token, or an empty string."""
    parts = token.split("_")
    return parts[3] if len(parts) > 3 and parts[:3] == ["vercel", "blob", "rw"] else ""


def _blob_url(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return ""
    if not isinstance(payload, dict):
        return ""
    return str(payload.get("url") or "")


def _is_public_blob_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname is not None and parsed.hostname.endswith(
        BLOB_PUBLIC_HOST_SUFFIX.lstrip(".")
    )


def get_media_host(
    base_url: str | None = None,
    *,
    session: requests.Session | None = None,
    post_id: str | None = None,
) -> MediaHost:
    """Return the configured media host, or the refusing default.

    An explicit `INSTAGRAM_MEDIA_BASE_URL` wins over an uploader because it is a
    deliberate operator choice to serve the slides from somewhere else; the
    uploader is used when only its token is present.
    """
    configured = (base_url if base_url is not None else os.getenv(ENV_BASE_URL) or "").strip()
    if configured:
        return UrlMappingMediaHost(configured, session=session)
    token = (os.getenv(ENV_BLOB_TOKEN) or "").strip()
    if token:
        return VercelBlobMediaHost(token, post_id=post_id, session=session)
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
