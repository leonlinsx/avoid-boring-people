"""Instagram carousel renderer: storyboard text in, 1080x1350 JPEGs out.

The rasterizing happens in `instagram_slides.mjs`, which turns each slide into a
deterministic SVG document and passes it through sharp. There is no browser in
this path, so rendering works anywhere `npm ci` has run. This module owns
everything the rest of the pipeline depends on: the environment check, the
deterministic job payload, output paths, and the verification that each file
really is a 1080x1350 sRGB JPEG within Meta's size limit.

The renderer is intentionally not a silent fallback. If Node or sharp is
missing, `RendererUnavailable` is raised with the exact install command, so the
Instagram path fails closed instead of publishing nothing.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import struct
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from scripts.automation.formatters.instagram_storyboard import (
    MAX_IMAGE_BYTES,
    SLIDE_HEIGHT,
    SLIDE_WIDTH,
    InstagramSlide,
    InstagramStoryboard,
    validate_storyboard,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
RENDERER_SCRIPT = Path(__file__).with_name("instagram_slides.mjs")
SHARP_PACKAGE = REPO_ROOT / "node_modules" / "sharp" / "package.json"
FONT_FILES = {
    "regular": REPO_ROOT / "public" / "fonts" / "atkinson-regular.woff",
    "bold": REPO_ROOT / "public" / "fonts" / "atkinson-bold.woff",
}
DEFAULT_OUTPUT_ROOT = Path(".tmp/social/instagram")
DEFAULT_RENDERER = "svg-sharp"
JPEG_QUALITY = 92
NODE_TIMEOUT_SECONDS = 240
JPEG_SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}

INSTALL_HINT = "run `npm ci` in the repository root"


class RendererError(RuntimeError):
    """The renderer ran but could not produce usable slides."""


class RendererUnavailable(RendererError):
    """The rendering toolchain is absent, so no slide can be produced."""


@dataclass(frozen=True)
class RenderedSlide:
    index: int
    kind: str
    path: Path
    width: int
    height: int
    size_bytes: int
    sha256: str


@dataclass(frozen=True)
class RenderedCarousel:
    post_id: str
    output_dir: Path
    renderer: str
    slides: tuple[RenderedSlide, ...]


def renderer_available() -> tuple[bool, str]:
    """Whether this environment can render slides, with the reason when it cannot."""
    node = shutil.which("node")
    if not node:
        return False, f"Node.js is not on PATH; {INSTALL_HINT}"
    if not SHARP_PACKAGE.exists():
        return False, f"the sharp package is not installed; {INSTALL_HINT}"
    missing = [str(path) for path in FONT_FILES.values() if not path.exists()]
    if missing:
        return False, "brand font files are missing: " + ", ".join(missing)
    return True, ""


def output_dir_for(post_id: str, base: Path | str | None = None) -> Path:
    """Ignored working directory for one article's rendered slides."""
    root = Path(base) if base is not None else Path(os.getenv("INSTAGRAM_OUTPUT_DIR") or DEFAULT_OUTPUT_ROOT)
    # Search-index ids look like `2019_02_18_why/index.md`; the suffix is noise
    # in a directory name and in the media URL derived from it later.
    stem = re.sub(r"(?:^|/)index\.md$", "", str(post_id))
    stem = re.sub(r"\.md$", "", stem)
    safe_id = "".join(character for character in stem if character.isalnum() or character in "-_")
    if not safe_id:
        raise ValueError("Instagram renderer needs a filesystem-safe post id")
    return root / safe_id


def _job_payload(storyboard: InstagramStoryboard, output_dir: Path, quality: int) -> dict:
    # The brand fonts are not sent along: the Node renderer reads them straight
    # from `public/fonts`, so the payload stays plain copy and design tokens.
    return {
        "outputDir": str(output_dir),
        "width": SLIDE_WIDTH,
        "height": SLIDE_HEIGHT,
        "quality": quality,
        "slides": [
            {
                "index": slide.index,
                "kind": slide.kind,
                "kicker": slide.kicker,
                "title": slide.title,
                "body": slide.body,
                "footer": slide.footer,
            }
            for slide in storyboard.slides
        ],
    }


def jpeg_dimensions(data: bytes) -> tuple[int, int]:
    """Read width/height from JPEG markers, so verification needs no image library."""
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        raise RendererError("rendered slide is not a JPEG (no SOI marker)")
    offset = 2
    while offset + 9 < len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        marker = data[offset + 1]
        if marker in JPEG_SOF_MARKERS:
            height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
            return width, height
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            offset += 2
            continue
        segment_length = struct.unpack(">H", data[offset + 2 : offset + 4])[0]
        offset += 2 + segment_length
    raise RendererError("rendered slide JPEG has no start-of-frame marker")


def run_renderer(job: dict) -> dict:
    """Run the Node renderer once and return its parsed manifest."""
    available, reason = renderer_available()
    if not available:
        raise RendererUnavailable(reason)
    try:
        completed = subprocess.run(
            [shutil.which("node") or "node", str(RENDERER_SCRIPT)],
            input=json.dumps(job),
            capture_output=True,
            text=True,
            timeout=NODE_TIMEOUT_SECONDS,
            cwd=str(REPO_ROOT),
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise RendererError(f"slide rendering timed out after {NODE_TIMEOUT_SECONDS}s") from error

    stdout = (completed.stdout or "").strip()
    payload: dict = {}
    if stdout:
        try:
            payload = json.loads(stdout.splitlines()[-1])
        except ValueError as error:
            raise RendererError(
                f"slide renderer returned unreadable output: {stdout[:300]}"
            ) from error
    if payload.get("error") == "renderer_unavailable" or completed.returncode == 4:
        raise RendererUnavailable(str(payload.get("message") or f"slide renderer unavailable; {INSTALL_HINT}"))
    if payload.get("error") == "content_overflow":
        violations = payload.get("violations") or []
        details = "; ".join(
            f"slide {item.get('slide')} {item.get('field')} "
            + (
                f"{item.get('lines')} lines > {item.get('maxLines')} allowed"
                if item.get("lines") is not None and item.get("maxLines") is not None
                else str(item.get("message") or item.get("kind") or "does not fit")
            )
            for item in violations
        )
        raise RendererError(
            "content_overflow: slide copy does not fit the template"
            + (f" ({details})" if details else "")
        )
    if completed.returncode != 0 or payload.get("error"):
        message = str(payload.get("message") or (completed.stderr or "").strip()[-300:] or "unknown error")
        raise RendererError(f"slide renderer failed: {message}")
    return payload


def _verify_slide(entry: dict, output_dir: Path) -> RenderedSlide:
    path = Path(entry["path"])
    if not path.exists() or path.parent != output_dir:
        raise RendererError(f"renderer reported a slide outside {output_dir}: {path}")
    data = path.read_bytes()
    width, height = jpeg_dimensions(data)
    if (width, height) != (SLIDE_WIDTH, SLIDE_HEIGHT):
        raise RendererError(f"{path.name} is {width}x{height}, expected {SLIDE_WIDTH}x{SLIDE_HEIGHT}")
    if len(data) > MAX_IMAGE_BYTES:
        raise RendererError(f"{path.name} is {len(data)} bytes, above Meta's {MAX_IMAGE_BYTES}-byte limit")
    return RenderedSlide(
        index=int(entry["index"]),
        kind=str(entry["kind"]),
        path=path,
        width=width,
        height=height,
        size_bytes=len(data),
        sha256=str(entry["sha256"]),
    )


def render_storyboard(
    storyboard: InstagramStoryboard,
    output_dir: Path | str | None = None,
    *,
    quality: int = JPEG_QUALITY,
) -> RenderedCarousel:
    """Render every slide of a validated storyboard as a local 1080x1350 JPEG."""
    validate_storyboard(storyboard)
    directory = Path(output_dir) if output_dir is not None else output_dir_for(storyboard.post_id)
    directory.mkdir(parents=True, exist_ok=True)
    manifest = run_renderer(_job_payload(storyboard, directory, quality))
    slides = tuple(_verify_slide(entry, directory) for entry in manifest.get("slides") or ())
    if len(slides) != len(storyboard.slides):
        raise RendererError(
            f"renderer produced {len(slides)} slides for a {len(storyboard.slides)}-slide storyboard"
        )
    return RenderedCarousel(
        post_id=storyboard.post_id,
        output_dir=directory,
        renderer=str(manifest.get("renderer") or DEFAULT_RENDERER),
        slides=slides,
    )


def render_job(job: dict, output_dir: Path | str | None = None) -> dict:
    """Render an explicit job payload; the storyboard checks are bypassed on purpose.

    Only used to prove the layout's overflow guard fires for text that the
    storyboard limits would normally reject.
    """
    payload = dict(job)
    payload.setdefault("outputDir", str(output_dir) if output_dir is not None else str(DEFAULT_OUTPUT_ROOT / "job"))
    for slide in payload.get("slides", []):
        slide.setdefault("kicker", "")
        slide.setdefault("body", "")
        slide.setdefault("footer", "leonlins.com")
    return run_renderer(payload)


def render_slides(slides: Sequence[InstagramSlide], post_id: str, output_dir: Path | str | None = None) -> RenderedCarousel:
    """Render slides that already form the carousel shape a storyboard would produce."""
    storyboard = InstagramStoryboard(
        post_id=str(post_id),
        title=slides[0].title if slides else "",
        canonical_url="https://leonlins.com/",
        caption="https://leonlins.com/",
        hashtags=(),
        slides=tuple(slides),
    )
    return render_storyboard(storyboard, output_dir)
