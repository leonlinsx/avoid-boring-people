#!/usr/bin/env python3
"""Offline ABP 9:16 experiment renderer. Never posts, calls an API, or sends data.

Requires ffmpeg and Pillow (install them locally only). A speech track from an
approved source is optional. The script never creates an AI voice or avatar.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

WIDTH, HEIGHT, FPS = 1080, 1920, 24
PALETTES = {
    "ink": ("#101820", "#F8F6F1", "#8EDEC8"),
    "paper": ("#F5F2E9", "#121B24", "#B95231"),
    "signal": ("#101318", "#FFFFFF", "#DAF54B"),
}


def validate_spec(spec: dict) -> None:
    if not isinstance(spec, dict):
        raise ValueError("spec must be an object")
    slug = spec.get("id")
    if not isinstance(slug, str) or not slug.replace("-", "").replace("_", "").isalnum():
        raise ValueError("unsafe id")
    if not str(spec.get("source_url", "")).startswith("https://leonlins.com/writing/"):
        raise ValueError("source_url must be a published leonlins.com article")
    if not isinstance(spec.get("narration"), str) or not spec["narration"].strip():
        raise ValueError("narration is required")
    scenes = spec.get("scenes")
    if not isinstance(scenes, list) or not 3 <= len(scenes) <= 8:
        raise ValueError("3 to 8 scenes required")
    total = 0
    for scene in scenes:
        if not isinstance(scene, dict):
            raise ValueError("scene must be an object")
        duration = scene.get("seconds")
        if not isinstance(duration, (float, int)) or not 2 <= duration <= 9:
            raise ValueError("scene seconds must be 2 through 9")
        total += duration
        for field, limit in (("label", 45), ("headline", 96), ("detail", 165)):
            value = scene.get(field, "")
            if not isinstance(value, str) or len(value) > limit:
                raise ValueError(f"invalid {field}")
        if not scene.get("headline", "").strip():
            raise ValueError("empty headline")
    if total > 60:
        raise ValueError("reel exceeds 60 seconds")


def font(bold: bool, size: int):
    from PIL import ImageFont
    paths = [
        "/usr/share/fonts/truetype/lato/Lato-Heavy.ttf" if bold else "/usr/share/fonts/truetype/lato/Lato-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for file in paths:
        if Path(file).exists():
            return ImageFont.truetype(file, size)
    raise RuntimeError("Install open-source Lato or DejaVu fonts to render")


def wrap(draw, value, selected_font, max_width):
    output, current = [], ""
    for word in value.replace("\n", " ").split():
        candidate = (current + " " + word).strip()
        if current and draw.textbbox((0, 0), candidate, font=selected_font)[2] > max_width:
            output.append(current)
            current = word
        else:
            current = candidate
    if current:
        output.append(current)
    return output


def fitted(draw, headline):
    for size in range(108, 48, -4):
        selected_font = font(True, size)
        lines = wrap(draw, headline, selected_font, 920)
        if len(lines) <= 5 and all(draw.textbbox((0, 0), line, font=selected_font)[2] <= 920 for line in lines):
            return selected_font, lines, size
    raise ValueError("headline overflow in safe area")


def draw_scene(spec, scene, index, variant, destination):
    from PIL import Image, ImageDraw
    bg, fg, accent = PALETTES[variant]
    dark = variant != "paper"
    im = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(im)
    if variant == "signal":
        for x in (76, 1004):
            draw.line((x, 170, x, 1550), fill="#293139", width=2)
    draw.text((82, 90), "AVOID BORING PEOPLE", font=font(True, 31), fill=fg)
    draw.text((82, 150), str(spec.get("pillar", "ESSAYS")).upper()[:42], font=font(False, 25), fill=accent)
    draw.line((82, 215, 998, 215), fill=accent, width=4)
    draw.rounded_rectangle((82, 232, 998, 238), radius=3, fill="#565D62" if dark else "#D0CAC1")
    end = 82 + int(916 * (index + 1) / len(spec["scenes"]))
    draw.rounded_rectangle((82, 232, end, 238), radius=3, fill=accent)
    draw.text((82, 365), scene.get("label", "").upper(), font=font(True, 36), fill=accent)
    headline_font, lines, size = fitted(draw, scene["headline"])
    y = 460
    for line in lines:
        draw.text((76, y), line, font=headline_font, fill=fg)
        y += int(size * 1.19)
    detail = scene.get("detail", "")
    if detail:
        y = max(y + 68, 1040)
        detail_font = font(False, 44)
        for line in wrap(draw, detail, detail_font, 882)[:5]:
            if y > 1400:
                raise ValueError("detail overflow")
            draw.text((82, y), line, font=detail_font, fill="#BFC9C9" if dark else "#4F5456")
            y += 67
    draw.line((82, 1498, 998, 1498), fill=accent, width=2)
    draw.text((82, 1536), spec.get("source_label", "LEONLINS.COM"), font=font(False, 29), fill=fg)
    draw.text((82, 1591), f"{index + 1:02d} / {len(spec['scenes']):02d}", font=font(True, 28), fill=accent)
    # No important content below y=1630 (Instagram bottom UI).
    im.save(destination)


def run(cmd):
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
    if proc.returncode:
        raise RuntimeError("ffmpeg error: " + proc.stderr[-1800:])


def render(spec_path: Path, output: Path, variant: str, audio: Path | None = None, preview: bool = False):
    spec_bytes = spec_path.read_bytes()
    spec = json.loads(spec_bytes)
    validate_spec(spec)
    if variant not in PALETTES:
        raise ValueError("unknown variant")
    if audio and not audio.is_file():
        raise ValueError("audio file missing")
    duration = sum(s["seconds"] for s in spec["scenes"])
    if audio:
        # Never silently cut off a synthetic or recorded narrator.
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(audio)],
            capture_output=True, text=True, check=True,
        )
        speech_seconds = float(probe.stdout.strip())
        if not duration - 4 <= speech_seconds <= duration - 0.15:
            raise ValueError(
                f"narration is {speech_seconds:.1f}s but video is {duration:.1f}s; "
                "revise narration or scene durations before rendering"
            )
    output.mkdir(parents=True, exist_ok=True)
    workspace = output / "frames"
    workspace.mkdir(exist_ok=True)
    clips = []
    for index, scene in enumerate(spec["scenes"]):
        png = workspace / f"scene-{index + 1:02d}.png"
        draw_scene(spec, scene, index, variant, png)
        clip = workspace / f"clip-{index + 1:02d}.mp4"
        seconds = float(scene["seconds"])
        zoom = "min(zoom+0.0001,1.03)" if variant == "paper" else "min(zoom+0.0002,1.06)"
        filt = f"zoompan=z='{zoom}':d=1:s={WIDTH}x{HEIGHT}:fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.22,fade=t=out:st={seconds-0.22:.2f}:d=0.22"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", str(seconds), "-i", str(png), "-vf", filt, "-t", str(seconds), "-r", str(FPS), "-an", "-c:v", "libx264", "-preset", "ultrafast" if preview else "veryfast", "-crf", "25" if preview else "20", "-pix_fmt", "yuv420p", str(clip)])
        clips.append(clip)
    manifest = workspace / "concat.txt"
    manifest.write_text("".join(f"file '{clip.resolve()}'\n" for clip in clips), encoding="utf-8")
    mp4 = output / f"{spec['id']}-{variant}.mp4"
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest)]
    if audio:
        command += ["-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,apad", "-t", str(duration), "-movflags", "+faststart"]
    else:
        command += ["-map", "0:v:0", "-c:v", "copy", "-movflags", "+faststart"]
    run(command + [str(mp4)])
    (output / "narration.txt").write_text(spec["narration"].strip() + "\n", encoding="utf-8")
    (output / "review.json").write_text(json.dumps({
        "status": "REVIEW_ONLY_NOT_PUBLISHED",
        "source_url": spec["source_url"],
        "spec_sha256": hashlib.sha256(spec_bytes).hexdigest(),
        "variant": variant,
        "audio_included": bool(audio),
        "duration_seconds": sum(s["seconds"] for s in spec["scenes"]),
        "video": str(mp4),
    }, indent=2) + "\n", encoding="utf-8")
    print(mp4)
    return mp4


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--output", type=Path, default=Path(".tmp/instagram-growth"))
    parser.add_argument("--variant", choices=list(PALETTES), default="ink")
    parser.add_argument("--audio", type=Path, help="Optional licensed voice WAV/MP3 (never generated by this script)")
    parser.add_argument("--preview", action="store_true", help="Fast render, higher CRF")
    args = parser.parse_args()
    render(args.spec, args.output, args.variant, args.audio, args.preview)


if __name__ == "__main__":
    main()
