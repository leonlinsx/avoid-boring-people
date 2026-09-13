"""Coverage for the Instagram carousel vertical slice.

Exercises the pieces the slice adds, in the order the pipeline uses them:
storyboard derivation and copy limits, the deterministic slide renderer, the
media-host boundary, the Graph API publish flow, and the registration/routing
that keeps Instagram manual-only.
"""
import json
import struct
import subprocess
import sys
import types
from dataclasses import replace
from pathlib import Path

import pytest
import requests

# tweepy/atproto are installed in CI but not in every local venv; stub them so
# the publisher submodules import, matching the other distribution tests.
sys.modules.setdefault("tweepy", types.ModuleType("tweepy"))
_atproto_stub = types.ModuleType("atproto")
_atproto_stub.Client = type("AtprotoClient", (), {})
_atproto_stub.models = types.SimpleNamespace()
sys.modules.setdefault("atproto", _atproto_stub)

from scripts.automation import auto_post, state_manager
from scripts.automation import media_host as media_host_module
from scripts.automation import retry as retry_module
from scripts.automation.content import PublishResult
from scripts.automation.formatters.instagram_storyboard import (
    ALT_TEXT_MAX,
    CAPTION_HARD_MAX,
    COVER_TEASER_MAX,
    COVER_TITLE_MAX,
    FINAL_TEXT_MAX,
    MAX_SLIDES,
    MIN_SLIDES,
    SLIDE_HEIGHT,
    SLIDE_WIDTH,
    build_storyboard,
    plain_text,
    validate_storyboard,
)
from scripts.automation.media_host import (
    BLOB_PATH_HEADER,
    ENV_BASE_URL,
    ENV_UPLOAD_SECRET,
    ENV_UPLOAD_URL,
    BlobUploadError,
    MediaHostError,
    MediaHostUnavailable,
    NullMediaHost,
    UploadEndpointMediaHost,
    UrlMappingMediaHost,
    content_digest,
    get_media_host,
    resolve_media_urls,
)
from scripts.automation.publishers import instagram as instagram_module
from scripts.automation.renderers.instagram import (
    RenderedCarousel,
    RenderedSlide,
    RendererError,
    RendererUnavailable,
    output_dir_for,
    render_job,
    render_storyboard,
    renderer_available,
    run_renderer,
)
from scripts.automation.routing import DEFAULT_PLATFORMS, PLATFORMS, eligible_for_category


REPO_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(autouse=True)
def _no_retry_delay(monkeypatch):
    monkeypatch.setattr(retry_module, "BASE_DELAY_SECONDS", 0)


@pytest.fixture(autouse=True)
def _isolate_media_host_env(monkeypatch):
    """A developer's ambient hosting configuration must not change the suite."""
    monkeypatch.delenv(ENV_BASE_URL, raising=False)
    monkeypatch.delenv(ENV_UPLOAD_URL, raising=False)
    monkeypatch.delenv(ENV_UPLOAD_SECRET, raising=False)


def _post(**overrides):
    base = {
        "id": "2019_02_18_why",
        "title": "Tell me why",
        "url": "https://leonlins.com/writing/why/",
        "content": "Body text. " * 40,
        "category": "Culture",
        "tags": ["behaviour"],
        "evergreen": True,
    }
    base.update(overrides)
    return base


def _summary(points=None):
    return {
        "teaser": "A short teaser about belief.",
        "points": points
        or [
            "There are many beliefs the mainstream would laugh at now. [Flat earthers.](https://en.wikipedia.org/wiki/Modern_flat_Earth_societies 'wiki page') [^1]",
            "Why then, do we believe in the issues that form so much of our identity?",
            "Beliefs can also change over time, depending on how many people around you have a similar point of view.",
            "However, while some experiments are easily replicable, others are not.",
            "My point here though, is not to discourage evidence-based thinking.",
        ],
    }


def _storyboard(**overrides):
    post = _post(**{key: value for key, value in overrides.items() if key != "summary"})
    return build_storyboard(post, overrides.get("summary") or _summary())


# --- Storyboard derivation ---------------------------------------------------

def test_storyboard_is_deterministic_for_the_same_input():
    assert _storyboard() == _storyboard()


def test_storyboard_has_cover_body_and_final_slides_within_limits():
    storyboard = _storyboard()

    validate_storyboard(storyboard)
    assert storyboard.slides[0].kind == "cover"
    assert storyboard.slides[-1].kind == "final"
    assert MIN_SLIDES <= len(storyboard.slides) <= MAX_SLIDES
    assert all(slide.kind == "body" for slide in storyboard.slides[1:-1])
    assert storyboard.slides[0].title == "Tell me why"
    assert storyboard.slides[0].index == 1
    assert [slide.index for slide in storyboard.slides] == list(range(1, len(storyboard.slides) + 1))
    assert len(storyboard.slides[0].title) <= COVER_TITLE_MAX
    assert len(storyboard.slides[0].body) <= COVER_TEASER_MAX
    assert storyboard.slides[-1].body == "leonlins.com/writing/why"


def test_caption_carries_the_canonical_link_and_stays_within_limits():
    storyboard = _storyboard()

    assert storyboard.canonical_url in storyboard.caption
    assert len(storyboard.caption) <= CAPTION_HARD_MAX
    assert storyboard.hashtags == ("#behaviour",)
    assert all(len(slide.alt_text) <= ALT_TEXT_MAX for slide in storyboard.slides)
    assert all(slide.alt_text for slide in storyboard.slides)


def test_plain_text_removes_markdown_link_and_citation_noise():
    text = plain_text(
        "See [Flat earthers.](https://en.wikipedia.org/wiki/X 'wiki page') and "
        "[huge experiment](<https://home.cern/science/physics/higgs-boson(v=1)> 'cern') [^4] and *emphasis*."
    )

    assert text == "See Flat earthers. and huge experiment and emphasis."


def test_plain_text_keeps_link_text_when_a_truncated_sentence_split_the_link():
    """The local summarizer cuts sentences, which can leave a link half open."""
    text = plain_text("Most people think it's crazy that [70% of Americans](http://www.pewforum.org/x/ 'religious…")

    assert text == "Most people think it's crazy that 70% of Americans…"


def test_validate_storyboard_rejects_slide_counts_outside_the_carousel_window():
    storyboard = _storyboard()

    with pytest.raises(ValueError, match="5-8 slides"):
        validate_storyboard(replace(storyboard, slides=storyboard.slides[:2]))


def test_storyboard_body_slides_never_exceed_the_body_limits():
    storyboard = _storyboard()

    for slide in storyboard.slides[1:-1]:
        assert slide.title, "every body slide needs a headline"
        assert len(slide.title) <= 60
        assert len(slide.body) <= 200


def test_two_sentence_point_keeps_a_complete_headline_and_its_support():
    """A first sentence that fits is a better headline than a truncated slice."""
    storyboard = _storyboard(
        summary={
            "teaser": "A short teaser about belief.",
            "points": [
                "There are many beliefs the mainstream would laugh at now. Flat earthers.",
                "Beliefs shift as the people around you shift, which makes evidence strangely optional.",
                "However, while some experiments are easily replicable, others are not.",
            ],
        }
    )

    first = storyboard.slides[1]
    assert first.title == "There are many beliefs the mainstream would laugh at now."
    assert first.body == "Flat earthers."


def test_point_too_short_to_split_stays_whole_on_one_slide():
    storyboard = _storyboard(
        summary={
            "teaser": "A short teaser.",
            "points": ["Beliefs are social.", "Evidence is optional.", "Identity resists revision."],
        }
    )

    for slide in storyboard.slides[1:-1]:
        assert slide.title
        assert slide.body == ""


# --- Renderer ----------------------------------------------------------------
#
# These tests run wherever `npm ci` has run: the renderer is SVG + sharp, so
# there is no browser to download and nothing to skip.

# JPEG SOF markers carry the real frame dimensions; parsing them here keeps the
# size check independent of both sharp and the renderer's own reader.
_JPEG_SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}

# Decodes the finished JPEG and reports the bounding box of every pixel that is
# not the background colour, so "is anything drawn off-canvas" is answered from
# the artefact rather than from the layout's own bookkeeping.
_INK_PROBE = """
import sharp from 'sharp';
const { data, info } = await sharp(process.argv[1]).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * channels;
    if (Math.abs(data[i] - 0xf7) > 8 || Math.abs(data[i + 1] - 0xf7) > 8 || Math.abs(data[i + 2] - 0xf5) > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
process.stdout.write(JSON.stringify({ width, height, minX, minY, maxX, maxY }));
"""

# Text must stay this far inside the frame; the renderer reserves it as a safe
# area, and Instagram UI can overlay the outer band.
SAFE_INSET = 40


def _jpeg_frame_size(data: bytes) -> tuple[int, int]:
    index = 2
    while index + 4 <= len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        if marker in _JPEG_SOF_MARKERS:
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        index += 2 + struct.unpack(">H", data[index + 2 : index + 4])[0]
    raise AssertionError("no JPEG frame header found")


def _ink_bounds(path: Path) -> dict:
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", _INK_PROBE, str(path)],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        check=True,
    )
    return json.loads(completed.stdout)


def _assert_no_ink_outside_the_canvas(path: Path) -> None:
    bounds = _ink_bounds(path)
    assert bounds["maxX"] >= 0 and bounds["maxY"] >= 0, f"{path.name} rendered no visible content"
    assert bounds["minX"] >= SAFE_INSET, f"{path.name} draws at x={bounds['minX']}, inside the safe area"
    assert bounds["maxX"] < bounds["width"] - SAFE_INSET, f"{path.name} draws past the right edge"
    assert bounds["minY"] >= SAFE_INSET, f"{path.name} draws at y={bounds['minY']}, inside the safe area"
    assert bounds["maxY"] < bounds["height"] - SAFE_INSET, f"{path.name} draws past the bottom edge"


def test_renderer_writes_one_jpeg_per_slide_at_the_instagram_size(tmp_path):
    storyboard = _storyboard()
    carousel = render_storyboard(storyboard, tmp_path / "slides")

    assert carousel.renderer == "svg-sharp"
    assert len(carousel.slides) == len(storyboard.slides)
    for rendered in carousel.slides:
        assert rendered.path.read_bytes()[:2] == b"\xff\xd8", "slides must be JPEG"
        assert (rendered.width, rendered.height) == (SLIDE_WIDTH, SLIDE_HEIGHT)
        assert rendered.size_bytes <= 8 * 1024 * 1024


def test_renderer_output_is_exactly_1080x1350_and_jpeg(tmp_path):
    """The dimensions Meta validates must be the dimensions actually encoded."""
    carousel = render_storyboard(_storyboard(), tmp_path / "slides")

    for rendered in carousel.slides:
        raw = rendered.path.read_bytes()
        assert _jpeg_frame_size(raw) == (SLIDE_WIDTH, SLIDE_HEIGHT)
        assert raw[:2] == b"\xff\xd8" and raw[-2:] == b"\xff\xd9"
        assert rendered.path.suffix == ".jpg"


def test_renderer_is_byte_stable_across_runs_in_one_environment(tmp_path):
    storyboard = _storyboard()
    first = render_storyboard(storyboard, tmp_path / "first")
    second = render_storyboard(storyboard, tmp_path / "second")

    assert [slide.sha256 for slide in first.slides] == [slide.sha256 for slide in second.slides]


def test_renderer_removes_stale_slides_from_a_previous_larger_carousel(tmp_path):
    storyboard = _storyboard()
    directory = tmp_path / "slides"
    directory.mkdir()
    (directory / "slide-99.jpg").write_bytes(b"stale")

    render_storyboard(storyboard, directory)

    assert not (directory / "slide-99.jpg").exists()
    assert len(list(directory.glob("*.jpg"))) == len(storyboard.slides)


def test_renderer_fails_loudly_when_copy_cannot_fit(tmp_path):
    """Overflow must fail visibly instead of shipping a clipped image."""
    job = {
        "outputDir": str(tmp_path / "overflow"),
        "slides": [
            {
                "index": 1,
                "kind": "cover",
                "kicker": "CULTURE",
                "title": "Overflow " * 200,
                "body": "Body " * 400,
                "footer": "leonlins.com",
            }
        ],
    }

    with pytest.raises(RendererError, match="content_overflow|overflow") as failure:
        render_job(job)

    assert "lines >" in str(failure.value), "the failure should name the line limit that was exceeded"


def test_renderer_wraps_a_long_cover_title_instead_of_clipping_it(tmp_path):
    """A title at the storyboard's own limit must still fit the canvas."""
    title = (
        "There are many beliefs the mainstream of today would laugh at, and most of "
        "them were once considered obvious facts"
    )[:COVER_TITLE_MAX]
    assert len(title) == COVER_TITLE_MAX
    job = {
        "outputDir": str(tmp_path / "long-title"),
        "slides": [
            {
                "index": 1,
                "kind": "cover",
                "kicker": "CULTURE",
                "title": title,
                "body": "",
                "footer": "leonlins.com",
            }
        ],
    }

    manifest = render_job(job)

    rendered = Path(manifest["slides"][0]["path"])
    assert rendered.exists()
    _assert_no_ink_outside_the_canvas(rendered)


def test_renderer_wraps_a_long_body_instead_of_clipping_it(tmp_path):
    body = " ".join(["Consistency compounds because the effect is invisible early on."] * 26)[:FINAL_TEXT_MAX]
    assert len(body) == FINAL_TEXT_MAX
    job = {
        "outputDir": str(tmp_path / "long-body"),
        "slides": [
            {
                "index": 1,
                "kind": "final",
                "kicker": "",
                "title": "Read the full essay",
                "body": body,
                "footer": "leonlins.com",
            }
        ],
    }

    manifest = render_job(job)

    rendered = Path(manifest["slides"][0]["path"])
    assert rendered.exists()
    _assert_no_ink_outside_the_canvas(rendered)


def test_renderer_keeps_every_slide_inside_the_canvas(tmp_path):
    """Text must never be drawn outside the 1080x1350 frame."""
    carousel = render_storyboard(_storyboard(), tmp_path / "slides")

    for rendered in carousel.slides:
        _assert_no_ink_outside_the_canvas(rendered.path)


def test_renderer_preserves_storyboard_slide_order(tmp_path):
    storyboard = _storyboard()
    carousel = render_storyboard(storyboard, tmp_path / "slides")

    assert [slide.index for slide in carousel.slides] == [slide.index for slide in storyboard.slides]
    assert [slide.kind for slide in carousel.slides] == [slide.kind for slide in storyboard.slides]
    assert [slide.path.name for slide in carousel.slides] == [
        f"slide-{slide.index:02d}.jpg" for slide in storyboard.slides
    ]


def test_renderer_output_directory_is_derived_from_the_search_index_id(tmp_path):
    """Rendered slides stay in an ignored, per-article, filesystem-safe directory."""
    assert output_dir_for("2019_02_18_why/index.md", tmp_path) == tmp_path / "2019_02_18_why"
    assert output_dir_for("notes: a/b!.md", tmp_path) == tmp_path / "notesab"
    with pytest.raises(ValueError, match="filesystem-safe"):
        output_dir_for("///", tmp_path)


def test_renderer_availability_only_needs_the_javascript_toolchain(monkeypatch):
    monkeypatch.setattr("scripts.automation.renderers.instagram.shutil.which", lambda name: None)

    available, reason = renderer_available()

    assert not available
    assert "npm ci" in reason
    assert "playwright" not in reason.lower()
    assert "chromium" not in reason.lower()


def test_renderer_surfaces_a_missing_toolchain_as_unavailable(monkeypatch):
    """A broken install must fail closed, not be reported as a rendering bug."""

    class _Completed:
        returncode = 4
        stdout = json.dumps({"error": "renderer_unavailable", "message": "sharp is not installed; run `npm ci`"})
        stderr = ""

    monkeypatch.setattr(
        "scripts.automation.renderers.instagram.subprocess.run", lambda *args, **kwargs: _Completed()
    )

    with pytest.raises(RendererUnavailable, match="sharp is not installed"):
        run_renderer({"outputDir": "/tmp", "slides": []})


# --- Media host boundary -----------------------------------------------------

def _rendered_slide(tmp_path, index=1, name="slide-01.jpg"):
    path = tmp_path / name
    path.write_bytes(b"\xff\xd8\xff\xe0" + b"0" * 32)
    return RenderedSlide(
        index=index,
        kind="cover",
        path=path,
        width=SLIDE_WIDTH,
        height=SLIDE_HEIGHT,
        size_bytes=path.stat().st_size,
        sha256="0" * 64,
    )


class _FakeResponse:
    def __init__(self, status_code=200, payload=None, headers=None, text=""):
        self.status_code = status_code
        self.payload = payload or {}
        self.headers = headers or {}
        self.text = text

    def json(self):
        return self.payload


class _FakeSession:
    def __init__(self, head=None, get=None):
        self.head_response = head or _FakeResponse(headers={"Content-Type": "image/jpeg"})
        self.get_response = get
        self.calls = []

    def head(self, url, **kwargs):
        self.calls.append(("HEAD", url, kwargs))
        return self.head_response

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return self.get_response or self.head_response


def test_unconfigured_media_host_refuses_with_actionable_message(tmp_path):
    host = NullMediaHost()

    with pytest.raises(MediaHostUnavailable, match=ENV_BASE_URL):
        host.verify(("https://example.com/slide-01.jpg",))
    with pytest.raises(MediaHostUnavailable, match=ENV_BASE_URL):
        host.resolve(_rendered_slide(tmp_path))
    assert isinstance(get_media_host(""), NullMediaHost)
    assert isinstance(get_media_host(), NullMediaHost)


@pytest.mark.parametrize("base_url", ["http://leonlins.com/social/", "s3://bucket/social/"])
def test_media_host_rejects_non_https_base_urls(base_url):
    with pytest.raises(MediaHostUnavailable, match="https"):
        UrlMappingMediaHost(base_url)


def test_media_host_maps_slides_and_verifies_they_are_fetchable_jpegs(tmp_path):
    slide = _rendered_slide(tmp_path)
    session = _FakeSession(head=_FakeResponse(headers={"Content-Type": "image/jpeg; charset=binary", "Content-Length": "40"}))
    host = UrlMappingMediaHost("https://leonlins.com/social", session=session)

    urls = resolve_media_urls([slide], host=host)

    assert urls == ("https://leonlins.com/social/slide-01.jpg",)
    assert session.calls[0][0] == "HEAD"


@pytest.mark.parametrize(
    "response, expected",
    [
        (_FakeResponse(404, headers={"Content-Type": "text/html"}), "HTTP 404"),
        (_FakeResponse(200, headers={"Content-Type": "image/png"}), "image/jpeg"),
        (_FakeResponse(200, headers={"Content-Type": "image/jpeg", "Content-Length": "9000000"}), "byte limit"),
    ],
)
def test_media_host_rejects_unreachable_or_wrong_media(tmp_path, response, expected):
    host = UrlMappingMediaHost("https://leonlins.com/social", session=_FakeSession(head=response, get=response))

    with pytest.raises(MediaHostError, match=expected):
        resolve_media_urls([_rendered_slide(tmp_path)], host=host)


def test_media_host_resolution_is_skipped_when_not_verifying(tmp_path):
    host = UrlMappingMediaHost("https://leonlins.com/social", session=_FakeSession(head=_FakeResponse(500)))

    assert resolve_media_urls([_rendered_slide(tmp_path)], host=host, verify=False) == (
        "https://leonlins.com/social/slide-01.jpg",
    )


# --- Instagram media upload endpoint -----------------------------------------

UPLOAD_SECRET = "shared-media-upload-secret-value"
UPLOAD_URL = "https://leonlins.com/api/social/instagram-media"
BLOB_PUBLIC_BASE = "https://store1.public.blob.vercel-storage.com"


def _bearer():
    """The only place the upload secret is allowed to appear as a value."""
    return "Bearer " + UPLOAD_SECRET


class _FakeUploadSession:
    """Records endpoint uploads and answers them the way the route does."""

    def __init__(self, *, status=200, payload=None, error=None, head=None, stored_path=None, response=None):
        self.status = status
        self.payload = payload
        self.error = error
        self.stored_path = stored_path
        self.response = response
        self.head_response = head or _FakeResponse(
            200, headers={"Content-Type": "image/jpeg", "Content-Length": "40"}
        )
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        if self.error is not None:
            raise self.error
        if self.response is not None:
            return self.response
        pathname = self.stored_path or kwargs["headers"][BLOB_PATH_HEADER]
        stored = {
            "url": f"{BLOB_PUBLIC_BASE}/{pathname}",
            "pathname": pathname,
            "bytes": len(kwargs["data"]),
        }
        return _FakeResponse(self.status, self.payload if self.payload is not None else stored)

    def head(self, url, **kwargs):
        self.calls.append(("HEAD", url, kwargs))
        return self.head_response

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return self.head_response

    @property
    def uploads(self):
        return [call for call in self.calls if call[0] == "POST"]


def _upload_host(session, post_id="2019_02_18_why/index.md", **kwargs):
    return UploadEndpointMediaHost(UPLOAD_URL, UPLOAD_SECRET, post_id=post_id, session=session, **kwargs)


def test_upload_host_posts_each_slide_to_the_endpoint_with_a_bearer_secret(tmp_path):
    slide = _rendered_slide(tmp_path)
    session = _FakeUploadSession()

    urls = resolve_media_urls([slide], host=_upload_host(session))

    pathname = f"instagram/2019_02_18_why/{content_digest((slide,))}/slide-01.jpg"
    assert [call[0] for call in session.calls] == ["POST", "HEAD"]
    method, url, kwargs = session.calls[0]
    assert (method, url) == ("POST", UPLOAD_URL)
    assert kwargs["data"] == slide.path.read_bytes()
    assert kwargs["headers"] == {
        "authorization": _bearer(),
        "content-type": "image/jpeg",
        BLOB_PATH_HEADER: pathname,
    }
    assert kwargs["timeout"] == media_host_module.UPLOAD_TIMEOUT_SECONDS
    assert urls == (f"{BLOB_PUBLIC_BASE}/{pathname}",)


def test_the_upload_secret_is_only_ever_sent_as_a_bearer_header(tmp_path, capsys):
    session = _FakeUploadSession()

    resolve_media_urls([_rendered_slide(tmp_path)], host=_upload_host(session))

    for method, url, kwargs in session.calls:
        assert UPLOAD_SECRET not in url
        assert UPLOAD_SECRET not in str({key: value for key, value in kwargs.items() if key != "headers"})
    assert UPLOAD_SECRET not in capsys.readouterr().out


def test_the_upload_host_requires_both_the_endpoint_and_its_secret(monkeypatch):
    monkeypatch.delenv(ENV_UPLOAD_URL, raising=False)
    monkeypatch.delenv(ENV_UPLOAD_SECRET, raising=False)

    with pytest.raises(MediaHostUnavailable, match=ENV_UPLOAD_URL):
        UploadEndpointMediaHost("   ", UPLOAD_SECRET)
    with pytest.raises(MediaHostUnavailable, match=ENV_UPLOAD_SECRET):
        UploadEndpointMediaHost(UPLOAD_URL, "   ")
    assert isinstance(get_media_host(), NullMediaHost)

    # Half a configuration fails loudly instead of silently never uploading.
    monkeypatch.setenv(ENV_UPLOAD_URL, UPLOAD_URL)
    with pytest.raises(MediaHostUnavailable, match=ENV_UPLOAD_SECRET):
        get_media_host(post_id="2019_02_18_why")

    monkeypatch.setenv(ENV_UPLOAD_SECRET, UPLOAD_SECRET)
    assert isinstance(get_media_host(post_id="2019_02_18_why"), UploadEndpointMediaHost)


@pytest.mark.parametrize(
    "endpoint", ["http://leonlins.com/api/social/instagram-media", "leonlins.com/api/social", "file:///tmp/x"]
)
def test_the_upload_host_rejects_a_non_https_endpoint(endpoint):
    with pytest.raises(MediaHostUnavailable, match="https"):
        UploadEndpointMediaHost(endpoint, UPLOAD_SECRET)


def test_an_explicit_media_base_url_wins_over_the_upload_endpoint(monkeypatch):
    monkeypatch.setenv(ENV_UPLOAD_URL, UPLOAD_URL)
    monkeypatch.setenv(ENV_UPLOAD_SECRET, UPLOAD_SECRET)

    assert isinstance(get_media_host("https://leonlins.com/social"), UrlMappingMediaHost)

    monkeypatch.setenv(ENV_BASE_URL, "https://leonlins.com/social")
    assert isinstance(get_media_host(), UrlMappingMediaHost)


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({"url": "http://store1.public.blob.vercel-storage.com/slide-01.jpg"}, "public HTTPS"),
        ({"url": UPLOAD_URL}, "public HTTPS"),
        ({"url": "https:///no-host.jpg"}, "public HTTPS"),
        ({"url": ""}, "no URL"),
        ({}, "no URL"),
    ],
)
def test_the_upload_host_rejects_a_response_that_is_not_a_public_https_url(tmp_path, payload, expected):
    session = _FakeUploadSession(payload=payload)

    with pytest.raises(BlobUploadError, match=expected):
        resolve_media_urls([_rendered_slide(tmp_path)], host=_upload_host(session), verify=False)


def test_the_upload_host_accepts_any_public_https_url_the_endpoint_returns(tmp_path):
    session = _FakeUploadSession(payload={"url": "https://cdn.example.com/instagram/slide-01.jpg"})

    urls = resolve_media_urls(
        [_rendered_slide(tmp_path)], host=_upload_host(session), verify=False
    )

    assert urls == ("https://cdn.example.com/instagram/slide-01.jpg",)


def test_the_upload_host_rejects_a_response_that_stored_a_different_path(tmp_path):
    session = _FakeUploadSession(stored_path="instagram/2019_02_18_why/aaaaaaaaaaaa/slide-01.jpg")

    with pytest.raises(BlobUploadError, match="instead of the requested"):
        _upload_host(session).resolve(_rendered_slide(tmp_path))


def test_upload_object_paths_are_deterministic_and_collision_safe(tmp_path):
    slides = _fake_slides(tmp_path, count=3)
    unused = _FakeUploadSession()
    host = _upload_host(unused)

    plan = host.upload_plan(slides)

    digest = content_digest(slides)
    assert unused.calls == [], "planning uploads must not touch the network"
    assert plan == _upload_host(_FakeUploadSession()).upload_plan(slides)
    assert [entry.split(" ", 1)[0] for entry in plan] == [
        f"instagram/2019_02_18_why/{digest}/slide-{index:02d}.jpg" for index in (1, 2, 3)
    ]
    assert all(entry.endswith(f"POST {UPLOAD_URL}") for entry in plan)
    assert all("slide-01.jpg" not in entry for entry in plan[1:]), "each slide owns one object"

    changed = (slides[0], replace(slides[1], sha256="f" * 64), slides[2])
    assert content_digest(changed) != digest
    assert host.upload_plan(changed)[1] != plan[1]


def test_upload_plan_matches_the_urls_a_live_upload_returns(tmp_path):
    slides = _fake_slides(tmp_path, count=2)
    host = _upload_host(_FakeUploadSession())

    planned = [entry.split(" ", 1)[0] for entry in host.upload_plan(slides)]
    assert [url.split(f"{BLOB_PUBLIC_BASE}/", 1)[1] for url in resolve_media_urls(slides, host=host)] == planned


def test_the_upload_host_posts_every_carousel_slide_once_in_order(tmp_path):
    slides = _fake_slides(tmp_path, count=3)
    session = _FakeUploadSession()

    urls = resolve_media_urls(slides, host=_upload_host(session))

    uploads = session.uploads
    assert len(uploads) == 3
    assert all(call[1] == UPLOAD_URL for call in uploads)
    paths = [call[2]["headers"][BLOB_PATH_HEADER] for call in uploads]
    assert [path.rsplit("/", 1)[-1] for path in paths] == ["slide-01.jpg", "slide-02.jpg", "slide-03.jpg"]
    assert [call[2]["data"] for call in uploads] == [slide.path.read_bytes() for slide in slides]
    assert urls == tuple(f"{BLOB_PUBLIC_BASE}/{path}" for path in paths)


def test_the_upload_host_refuses_to_upload_without_an_article_id(tmp_path):
    host = _upload_host(_FakeUploadSession(), post_id=None)

    with pytest.raises(BlobUploadError, match="article id"):
        host.resolve(_rendered_slide(tmp_path))


def test_upload_rejection_is_reported_without_leaking_the_secret(tmp_path):
    session = _FakeUploadSession(status=403, payload={"error": f"Invalid upload secret {UPLOAD_SECRET}"})

    with pytest.raises(BlobUploadError, match="HTTP 403") as failure:
        _upload_host(session).resolve(_rendered_slide(tmp_path))

    message = str(failure.value)
    assert "Invalid upload secret" in message
    assert UPLOAD_SECRET not in message
    assert "[redacted]" in message


def test_upload_rejection_reports_a_body_that_is_not_json(tmp_path):
    session = _FakeUploadSession(response=_FakeResponse(413, text=f"payload too large {UPLOAD_SECRET}"))

    with pytest.raises(BlobUploadError, match="HTTP 413") as failure:
        _upload_host(session).resolve(_rendered_slide(tmp_path))

    assert "payload too large" in str(failure.value)
    assert UPLOAD_SECRET not in str(failure.value)


def test_upload_transport_failure_is_reported_as_an_upload_error(tmp_path):
    session = _FakeUploadSession(error=requests.ConnectionError("connection reset"))

    with pytest.raises(BlobUploadError, match="uploading"):
        _upload_host(session).resolve(_rendered_slide(tmp_path))

# --- Publish flow ------------------------------------------------------------

class _FakeGraphApi:
    """Records Graph API traffic and replays scripted responses in order."""

    RequestException = requests.RequestException

    def __init__(self, responses=None):
        self.calls = []
        self.responses = list(responses or [])

    def _next(self, url):
        item = self.responses.pop(0) if self.responses else _FakeResponse(200, {"id": "auto"})
        if isinstance(item, Exception):
            raise item
        return item

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        return self._next(url)

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return self._next(url)


def carousel_api_responses(slides=3):
    """Scripted Graph API replies for one full carousel publish."""
    responses = [_FakeResponse(200, {"id": "17841400000000000"})]
    for index in range(1, slides + 1):
        responses.append(_FakeResponse(200, {"id": f"child-{index}"}))
        responses.append(_FakeResponse(200, {"status_code": "FINISHED"}))
    responses += [
        _FakeResponse(200, {"id": "parent-1"}),
        _FakeResponse(200, {"status_code": "FINISHED"}),
        _FakeResponse(200, {"id": "media-9"}),
        _FakeResponse(200, {"permalink": "https://www.instagram.com/p/abc/"}),
    ]
    return responses


class _StubMediaHost:
    name = "stub"

    def __init__(self, urls=None):
        self.urls = urls or ()
        self.verified = None

    def resolve_all(self, slides):
        return self.urls

    def verify(self, urls):
        self.verified = tuple(urls)
        return ()


class _Integration:
    """Everything `post_carousel` touches, so tests never hit the network."""

    def __init__(self, api, slides, urls=None):
        self.api = api
        self.host = _StubMediaHost(urls or tuple(f"https://leonlins.com/social/{Path(slide.path).name}" for slide in slides))
        self.carousel = _fake_carousel(slides)


def _fake_carousel(slides, post_id="2019_02_18_why", output_dir=None):
    return RenderedCarousel(
        post_id=post_id,
        output_dir=Path(output_dir or "/tmp/slides"),
        renderer="stub",
        slides=tuple(slides),
    )


def _fake_slides(tmp_path, count=3):
    slides = []
    for index in range(1, count + 1):
        path = tmp_path / f"slide-{index:02d}.jpg"
        path.write_bytes(b"\xff\xd8\xff\xe0" + b"0" * 16)
        slides.append(
            RenderedSlide(
                index=index,
                kind="cover" if index == 1 else "body",
                path=path,
                width=SLIDE_WIDTH,
                height=SLIDE_HEIGHT,
                size_bytes=path.stat().st_size,
                sha256=f"{index:064d}",
            )
        )
    return slides


def _install(monkeypatch, integration, token="test-token"):
    monkeypatch.setenv("INSTAGRAM_USER_ID", "17841400000000000")
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", token)
    monkeypatch.setattr(instagram_module, "requests", integration.api)
    return integration


def _publish(monkeypatch, tmp_path, storyboard=None, responses=None, slides=3):
    storyboard = storyboard or _storyboard()
    rendered = _fake_slides(tmp_path, count=slides)
    api = _FakeGraphApi(responses)
    integration = _Integration(api, rendered)
    _install(monkeypatch, integration)
    result = instagram_module.post_carousel(
        storyboard, carousel=integration.carousel, media_host=integration.host
    )
    return result, api, integration


def test_carousel_publishes_children_then_parent_then_media(monkeypatch, tmp_path):
    storyboard = _storyboard()
    # GET /{ig-user-id} (credentials), child x3, container status x4, publish, permalink.
    responses = [
        _FakeResponse(200, {"id": "17841400000000000", "username": "avoidboringpeople"}),
        _FakeResponse(200, {"id": "child-1"}),
        _FakeResponse(200, {"status_code": "FINISHED"}),
        _FakeResponse(200, {"id": "child-2"}),
        _FakeResponse(200, {"status_code": "FINISHED"}),
        _FakeResponse(200, {"id": "child-3"}),
        _FakeResponse(200, {"status_code": "FINISHED"}),
        _FakeResponse(200, {"id": "parent-1"}),
        _FakeResponse(200, {"status_code": "FINISHED"}),
        _FakeResponse(200, {"id": "media-9"}),
        _FakeResponse(200, {"permalink": "https://www.instagram.com/p/abc/"}),
    ]

    result, api, integration = _publish(monkeypatch, tmp_path, storyboard=storyboard, responses=responses)

    assert result.platform == "instagram"
    assert result.remote_id == "media-9"
    assert result.remote_url == "https://www.instagram.com/p/abc/"
    posts = [call for call in api.calls if call[0] == "POST"]
    assert [call[1].rsplit("/", 1)[-1] for call in posts] == [
        "media",
        "media",
        "media",
        "media",
        "media_publish",
    ]
    child_payloads = [call[2]["data"] for call in posts[:3]]
    assert all(payload["is_carousel_item"] == "true" for payload in child_payloads)
    assert all(payload["image_url"].startswith("https://") for payload in child_payloads)
    assert [payload["alt_text"] for payload in child_payloads] == [slide.alt_text for slide in storyboard.slides[:3]]
    parent_payload = posts[3][2]["data"]
    assert parent_payload["media_type"] == "CAROUSEL"
    assert parent_payload["children"] == "child-1,child-2,child-3"
    assert parent_payload["caption"] == storyboard.caption
    assert posts[4][2]["data"] == {"creation_id": "parent-1"}
    assert integration.host.verified == tuple(
        f"https://leonlins.com/social/slide-{index:02d}.jpg" for index in (1, 2, 3)
    )


def test_carousel_publishes_the_urls_it_uploaded_to_the_endpoint(monkeypatch, tmp_path):
    storyboard = _storyboard()
    slides = _fake_slides(tmp_path, count=3)
    api = _FakeGraphApi(carousel_api_responses())
    monkeypatch.setenv("INSTAGRAM_USER_ID", "17841400000000000")
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", "test-token")
    monkeypatch.setattr(instagram_module, "requests", api)
    session = _FakeUploadSession()

    result = instagram_module.post_carousel(
        storyboard, carousel=_fake_carousel(slides), media_host=_upload_host(session)
    )

    digest = content_digest(slides)
    child_payloads = [call[2]["data"] for call in api.calls if call[0] == "POST"][:3]
    assert result.remote_id == "media-9"
    assert len(session.uploads) == 3
    assert [payload["image_url"] for payload in child_payloads] == [
        f"{BLOB_PUBLIC_BASE}/instagram/2019_02_18_why/{digest}/slide-{index:02d}.jpg"
        for index in (1, 2, 3)
    ]
    assert [payload["alt_text"] for payload in child_payloads] == [
        slide.alt_text for slide in storyboard.slides[:3]
    ]


def test_upload_failure_stops_before_the_first_instagram_call(monkeypatch, tmp_path):
    storyboard = _storyboard()
    slides = _fake_slides(tmp_path, count=3)
    api = _FakeGraphApi()
    monkeypatch.setenv("INSTAGRAM_USER_ID", "17841400000000000")
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", "test-token")
    monkeypatch.setattr(instagram_module, "requests", api)
    session = _FakeUploadSession(status=413, payload={"error": {"message": "Payload too large"}})

    with pytest.raises(BlobUploadError, match="HTTP 413"):
        instagram_module.post_carousel(
            storyboard, carousel=_fake_carousel(slides), media_host=_upload_host(session)
        )

    assert api.calls == [], "no container may be created before every slide is hosted"


def test_access_token_is_sent_in_headers_only(monkeypatch, tmp_path):
    responses = carousel_api_responses()

    _, api, _ = _publish(monkeypatch, tmp_path, responses=responses)

    for method, url, kwargs in api.calls:
        token = kwargs["headers"]["Authorization"].removeprefix("Bearer ")
        assert token == "test-token"
        assert "test-token" not in url
        assert all("test-token" not in str(value) for key, value in kwargs.items() if key != "headers")


def test_publish_requires_credentials_before_any_container(monkeypatch, tmp_path):
    storyboard = _storyboard()
    slides = _fake_slides(tmp_path, count=3)
    api = _FakeGraphApi()
    integration = _Integration(api, slides)
    monkeypatch.delenv("INSTAGRAM_USER_ID", raising=False)
    monkeypatch.delenv("INSTAGRAM_ACCESS_TOKEN", raising=False)
    monkeypatch.setattr(instagram_module, "requests", api)

    with pytest.raises(instagram_module.InstagramConfigError, match="INSTAGRAM_USER_ID"):
        instagram_module.post_carousel(storyboard, carousel=integration.carousel, media_host=integration.host)
    assert api.calls == []


def test_over_length_caption_is_rejected_before_any_network_call(monkeypatch, tmp_path):
    storyboard = _storyboard()
    oversized = replace(storyboard, caption="x" * (CAPTION_HARD_MAX + 1))
    api = _FakeGraphApi()
    integration = _Integration(api, _fake_slides(tmp_path, count=3))
    monkeypatch.setattr(instagram_module, "requests", api)

    with pytest.raises(ValueError, match="character limit"):
        instagram_module.post_carousel(oversized, carousel=integration.carousel, media_host=integration.host)
    assert api.calls == []


def test_container_waiting_until_finished(monkeypatch):
    api = _FakeGraphApi(
        [
            _FakeResponse(200, {"status_code": "IN_PROGRESS"}),
            _FakeResponse(200, {"status_code": "IN_PROGRESS"}),
            _FakeResponse(200, {"status_code": "FINISHED"}),
        ]
    )
    monkeypatch.setattr(instagram_module, "requests", api)
    slept = []

    status = instagram_module.wait_for_container("user", "token", "parent-1", sleep=slept.append, clock=lambda: 0)

    assert status == "FINISHED"
    assert slept == [instagram_module.CONTAINER_POLL_SECONDS] * 2


@pytest.mark.parametrize("status", ["ERROR", "EXPIRED"])
def test_failed_container_stops_the_publish(monkeypatch, status):
    api = _FakeGraphApi([_FakeResponse(200, {"status_code": status, "status": "boom"})])
    monkeypatch.setattr(instagram_module, "requests", api)

    with pytest.raises(instagram_module.GraphApiError, match=status):
        instagram_module.wait_for_container("user", "token", "parent-1", sleep=lambda _: None)


def test_container_timeout_is_reported_with_recovery_advice(monkeypatch):
    api = _FakeGraphApi([_FakeResponse(200, {"status_code": "IN_PROGRESS"})] * 3)
    monkeypatch.setattr(instagram_module, "requests", api)
    times = iter([0, 1, 10_000])

    with pytest.raises(instagram_module.GraphApiError, match="containers expire"):
        instagram_module.wait_for_container(
            "user", "token", "parent-1", sleep=lambda _: None, clock=lambda: next(times)
        )


def test_error_message_from_the_graph_api_is_surfaced(monkeypatch):
    api = _FakeGraphApi(
        [_FakeResponse(400, {"error": {"message": "The image aspect ratio is not supported", "type": "OAuthException"}})]
    )
    monkeypatch.setattr(instagram_module, "requests", api)

    with pytest.raises(instagram_module.GraphApiError, match="aspect ratio") as raised:
        instagram_module.create_child_container("user", "token", "https://leonlins.com/social/slide-01.jpg", "alt")

    assert getattr(raised.value, "status_code", None) == 400
    assert not retry_module.is_transient(raised.value)


@pytest.mark.parametrize(
    "response, error_type",
    [
        (_FakeResponse(503, text="Service Unavailable"), instagram_module.AmbiguousPublishError),
        (_FakeResponse(200, {}), instagram_module.AmbiguousPublishError),
        (requests.ConnectionError("connection reset"), instagram_module.AmbiguousPublishError),
        (_FakeResponse(400, {"error": {"message": "Invalid creation_id"}}), instagram_module.GraphApiError),
    ],
)
def test_ambiguous_publish_outcomes_are_never_retried(monkeypatch, response, error_type):
    """A lost publish response may mean the carousel is already live."""
    api = _FakeGraphApi([response])
    monkeypatch.setattr(instagram_module, "requests", api)
    attempts = []

    def publish():
        attempts.append(1)
        return instagram_module.publish_container("user", "token", "parent-1", child_ids=("child-1",))

    with pytest.raises(error_type):
        retry_module.run_with_retries(publish)

    assert len(attempts) == 1
    assert len(api.calls) == 1


def test_ambiguous_publish_error_carries_reconciliation_ids(monkeypatch):
    api = _FakeGraphApi([_FakeResponse(504, text="Gateway Timeout")])
    monkeypatch.setattr(instagram_module, "requests", api)

    with pytest.raises(instagram_module.AmbiguousPublishError) as raised:
        instagram_module.publish_container("user", "token", "parent-1", child_ids=("child-1", "child-2"))

    error = raised.value
    assert error.retryable is False
    assert error.container_id == "parent-1"
    assert error.child_ids == ("child-1", "child-2")
    assert "media?fields=id,caption,timestamp" in str(error)
    assert not retry_module.is_transient(error)


def test_container_building_failures_are_retryable():
    error = instagram_module.GraphApiError("❌ Instagram API error 503: try again")
    error.status_code = 503

    assert retry_module.is_transient(error)


# --- Registration, routing, and workflow hygiene -----------------------------

def test_instagram_is_registered_but_absent_from_automation_defaults():
    assert "instagram" in PLATFORMS
    assert "instagram" in state_manager.PLATFORMS
    assert "instagram" not in DEFAULT_PLATFORMS, "Instagram must stay manual-only until a live publish succeeds"
    assert state_manager.EVERGREEN_COOLDOWN_DAYS["instagram"] == 60
    assert eligible_for_category({"category": "Culture"}, "instagram")
    assert eligible_for_category({"category": "Technology"}, "instagram")


def test_manual_run_publishes_a_carousel_and_records_state(monkeypatch, tmp_path):
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    captured = {}

    def post_carousel(storyboard, **kwargs):
        captured["storyboard"] = storyboard
        return PublishResult("instagram", remote_id="media-9", remote_url="https://www.instagram.com/p/abc/")

    fake = types.ModuleType("scripts.automation.publishers.instagram")
    fake.post_carousel = post_carousel
    monkeypatch.setitem(sys.modules, "scripts.automation.publishers.instagram", fake)
    monkeypatch.setattr(auto_post, "DRY_RUN", False)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "THREAD_MODE", "bullets")
    monkeypatch.setattr(auto_post, "USE_LLM", False)
    monkeypatch.setattr(auto_post, "PLATFORM", ["instagram"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [_post()])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: _summary())

    auto_post.main()

    assert captured["storyboard"].slides[0].title == "Tell me why"
    stored = state_manager.get_platform_state("2019_02_18_why", "instagram")
    assert stored["remote_id"] == "media-9"
    assert stored["last_mode"] == "new"


def test_instagram_dry_run_renders_locally_without_publishing_or_writing_state(monkeypatch, tmp_path, capsys):
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    carousel = _fake_carousel(_fake_slides(tmp_path, count=3), output_dir=tmp_path)
    monkeypatch.setattr("scripts.automation.renderers.instagram.render_storyboard", lambda storyboard: carousel)
    monkeypatch.delenv(ENV_BASE_URL, raising=False)
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "THREAD_MODE", "bullets")
    monkeypatch.setattr(auto_post, "USE_LLM", False)
    monkeypatch.setattr(auto_post, "PLATFORM", ["instagram"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [_post()])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: _summary())

    auto_post.main()

    output = capsys.readouterr().out
    assert "format: carousel" in output
    assert f"{SLIDE_WIDTH}x{SLIDE_HEIGHT}" in output
    assert "media host: unconfigured" in output
    assert "would publish: nothing until a media host is configured" in output
    assert not path.exists(), "a dry run must never create distribution state"


def test_instagram_dry_run_reports_an_unavailable_renderer(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(
        "scripts.automation.renderers.instagram.render_storyboard",
        lambda storyboard: (_ for _ in ()).throw(RendererError("the Playwright browser is not installed")),
    )
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "THREAD_MODE", "bullets")
    monkeypatch.setattr(auto_post, "USE_LLM", False)
    monkeypatch.setattr(auto_post, "PLATFORM", ["instagram"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [_post()])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: _summary())

    auto_post.main()

    assert "renderer: unavailable" in capsys.readouterr().out


def test_instagram_stays_out_of_the_scheduled_workflow_and_is_allowlisted_manually():
    new = (REPO_ROOT / ".github" / "workflows" / "social-new.yml").read_text(encoding="utf-8")
    evergreen = (REPO_ROOT / ".github" / "workflows" / "social-evergreen.yml").read_text(encoding="utf-8")

    assert "instagram" in new.split("allowed=", 1)[1].splitlines()[0]
    assert "INSTAGRAM_ACCESS_TOKEN" in new
    assert "instagram" not in evergreen.lower()
    assert "inputs.platforms" not in evergreen


def test_the_manual_workflow_can_host_media_without_touching_the_schedule():
    new = (REPO_ROOT / ".github" / "workflows" / "social-new.yml").read_text(encoding="utf-8")
    evergreen = (REPO_ROOT / ".github" / "workflows" / "social-evergreen.yml").read_text(encoding="utf-8")

    assert "INSTAGRAM_MEDIA_UPLOAD_URL: ${{ secrets.INSTAGRAM_MEDIA_UPLOAD_URL }}" in new
    assert "INSTAGRAM_MEDIA_UPLOAD_SECRET: ${{ secrets.INSTAGRAM_MEDIA_UPLOAD_SECRET }}" in new
    # The Blob store is authenticated with OIDC inside Vercel, so GitHub Actions
    # must not carry a Blob credential at all.
    assert "BLOB_READ_WRITE_TOKEN" not in new
    # The carousel renderer needs Node and sharp, and must never download a
    # browser while doing it.
    assert "npm ci" in new
    assert "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD" in new
    assert "INSTAGRAM_MEDIA_UPLOAD_SECRET" not in evergreen, "the unattended schedule must stay Instagram-free"
    assert "BLOB_READ_WRITE_TOKEN" not in evergreen, "the unattended schedule must stay Instagram-free"


# --- Instagram dry runs with media hosting -----------------------------------

DRY_RUN_NETWORK_CALLS: list[str] = []


class _RefusingSession:
    """Any network use at all during a dry run is a test failure."""

    def __init__(self, *args, **kwargs):
        pass

    def __getattr__(self, name):
        def refuse(*args, **kwargs):
            DRY_RUN_NETWORK_CALLS.append(name)
            raise AssertionError(f"a dry run must never use the network ({name})")

        return refuse


def _run_instagram_dry_run(monkeypatch, tmp_path):
    """Drive `auto_post.main()` for one Instagram dry run with the network sealed."""
    DRY_RUN_NETWORK_CALLS.clear()
    monkeypatch.setattr(state_manager, "STATE_FILE", tmp_path / "posted.json")
    carousel = _fake_carousel(_fake_slides(tmp_path, count=3), output_dir=tmp_path)
    monkeypatch.setattr(
        "scripts.automation.renderers.instagram.render_storyboard", lambda storyboard: carousel
    )
    monkeypatch.delenv(ENV_BASE_URL, raising=False)
    monkeypatch.setattr(
        media_host_module,
        "requests",
        types.SimpleNamespace(Session=_RefusingSession, RequestException=requests.RequestException),
    )
    monkeypatch.setattr(
        instagram_module,
        "post_carousel",
        lambda *args, **kwargs: pytest.fail("a dry run must never reach the publisher"),
    )
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "THREAD_MODE", "bullets")
    monkeypatch.setattr(auto_post, "USE_LLM", False)
    monkeypatch.setattr(auto_post, "PLATFORM", ["instagram"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [_post()])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: _summary())

    auto_post.main()
    return carousel


def test_instagram_dry_run_renders_locally_but_uploads_nothing(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv(ENV_UPLOAD_URL, UPLOAD_URL)
    monkeypatch.setenv(ENV_UPLOAD_SECRET, UPLOAD_SECRET)

    carousel = _run_instagram_dry_run(monkeypatch, tmp_path)

    output = capsys.readouterr().out
    digest = content_digest(carousel.slides)
    assert "media host: upload-endpoint" in output
    assert (
        f"would upload: instagram/2019_02_18_why/{digest}/slide-01.jpg -> POST {UPLOAD_URL}" in output
    )
    assert UPLOAD_SECRET not in output
    assert "would publish: nothing" not in output
    assert DRY_RUN_NETWORK_CALLS == [], "a dry run must not upload or call Instagram"


def test_instagram_dry_run_leaves_existing_distribution_state_unchanged(monkeypatch, tmp_path, capsys):
    state = tmp_path / "posted.json"
    state.write_text('{"platforms": {"threads": {"remote_id": "kept"}}}', encoding="utf-8")
    before = state.read_bytes()
    monkeypatch.setenv(ENV_UPLOAD_URL, UPLOAD_URL)
    monkeypatch.setenv(ENV_UPLOAD_SECRET, UPLOAD_SECRET)

    _run_instagram_dry_run(monkeypatch, tmp_path)

    capsys.readouterr()
    assert state.read_bytes() == before
    assert DRY_RUN_NETWORK_CALLS == []


def test_instagram_dry_run_without_media_hosting_reports_nothing_to_publish(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv(ENV_UPLOAD_URL, raising=False)
    monkeypatch.delenv(ENV_UPLOAD_SECRET, raising=False)

    _run_instagram_dry_run(monkeypatch, tmp_path)

    output = capsys.readouterr().out
    assert "media host: unconfigured" in output
    assert "would publish: nothing until a media host is configured" in output
    assert DRY_RUN_NETWORK_CALLS == []

