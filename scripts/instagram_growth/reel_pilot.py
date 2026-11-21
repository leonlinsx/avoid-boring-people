"""Separate, opt-in ABP Reel publisher and Insights sampler.

Never invoked by the existing carousel scheduler. Requires an approved manifest,
content hash equality between LOCAL MP4 and PUBLIC HOSTED MP4, a durable receipts
directory, an explicit live flag, and a confirmed @avoidboringpeople login.
No retry of media_publish or a concept with any prior receipt.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import subprocess
import tempfile
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import requests

from scripts.automation.publishers import instagram as ig
from scripts.automation.refresh_meta_tokens import PLATFORMS, _profile

ACCOUNT = "avoidboringpeople"
MAX_BYTES = 200 * 1024 * 1024
METRICS = ("views", "reach", "ig_reels_avg_watch_time", "likes", "comments",
           "shares", "saved", "reels_skip_rate")
ALLOWED_API_FORMAT = "REELS"


def load_manifest(path: Path) -> dict:
    item = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(item, dict):
        raise ValueError("manifest must be an object")
    concept = item.get("concept_id")
    if not isinstance(concept, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,63}", concept):
        raise ValueError("concept_id must be a safe, stable slug")
    src = item.get("source_url")
    if not isinstance(src, str) or not re.fullmatch(r"https://leonlins\.com/writing/[a-zA-Z0-9_/-]+/?", src):
        raise ValueError("source_url must be a leonlins.com article")
    uri = item.get("video_url")
    if not isinstance(uri, str):
        raise ValueError("video_url required")
    u = urllib.parse.urlsplit(uri)
    if (u.scheme != "https" or not u.hostname or u.username or u.password
            or not u.hostname.endswith((".public.blob.vercel-storage.com", ".leonlins.com"))
            and u.hostname != "leonlins.com"):
        raise ValueError("video_url must be an owned public HTTPS host (leonlins.com or public Vercel Blob)")
    if not u.path.lower().endswith(".mp4"):
        raise ValueError("video_url must end with .mp4 (before optional query)")
    if not isinstance(item.get("video_path"), str) or not item["video_path"].strip():
        raise ValueError("video_path required")
    digest = item.get("video_sha256")
    if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("video_sha256 must be 64 lowercase hex characters")
    caption = item.get("caption")
    if not isinstance(caption, str):
        raise ValueError("caption required")
    ig.validate_caption(caption)
    if item.get("review_status") != "approved":
        raise ValueError("only explicitly approved creative can be published")
    if not isinstance(item.get("approved_by"), str) or not item["approved_by"].strip():
        raise ValueError("approved_by must identify the reviewer")
    for field in ("ai_generated", "trial"):
        if type(item.get(field)) is not bool:
            raise ValueError(f"{field} must be explicitly true or false")
    if item.get("account") != ACCOUNT:
        raise ValueError("manifest must target @avoidboringpeople, not a personal Instagram")
    if item.get("trial") and item.get("graduation_strategy") != "MANUAL":
        raise ValueError("trial Reels require MANUAL graduation; no automatic graduation")
    if item.get("format") != ALLOWED_API_FORMAT:
        raise ValueError("only REELS are supported")
    return item


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as src:
        for part in iter(lambda: src.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def local_video_preflight(item: dict) -> dict:
    path = Path(item["video_path"]).expanduser().resolve()
    if not path.is_file() or path.stat().st_size > MAX_BYTES or path.stat().st_size < 1024:
        raise ValueError("local MP4 must exist and be within 1 KiB–200 MiB")
    if file_sha256(path) != item["video_sha256"]:
        raise ValueError("local video hash differs from the manifest")
    scan = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json",
         "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,sample_rate,r_frame_rate",
         str(path)],
        text=True, capture_output=True, check=True, timeout=30,
    )
    media = json.loads(scan.stdout)
    streams = media.get("streams") or []
    videos = [s for s in streams if s.get("codec_type") == "video"]
    sounds = [s for s in streams if s.get("codec_type") == "audio"]
    if len(videos) != 1 or not sounds:
        raise ValueError("must have exactly one video stream and an audio stream")
    video, sound = videos[0], sounds[0]
    if video.get("codec_name") != "h264" or sound.get("codec_name") != "aac":
        raise ValueError("Reels require an H.264 video + AAC audio")
    if (video.get("width"), video.get("height")) != (1080, 1920):
        raise ValueError("expected 1080x1920 portrait video")
    if str(sound.get("sample_rate")) != "48000":
        raise ValueError("expected AAC audio at 48 kHz")
    fps = video.get("r_frame_rate", "0/1")
    try:
        n, d = map(float, fps.split("/"))
        frame_rate = n / d
    except (ValueError, ZeroDivisionError):
        raise ValueError("invalid video frame rate") from None
    if not 23 <= frame_rate <= 60:
        raise ValueError("frame rate outside Instagram's supported range")
    duration = float(media["format"]["duration"])
    if not 3 <= duration <= 90:
        raise ValueError("pilot limits content to 3–90 seconds")
    return {"duration": round(duration, 3), "fps": round(frame_rate, 3),
            "bytes": path.stat().st_size, "sha256": item["video_sha256"]}


def hosted_video_preflight(item: dict, session=requests) -> int:
    """Stream the publicly hosted bytes and hash them, not just a HEAD response."""
    response = session.get(item["video_url"], stream=True, allow_redirects=False, timeout=(15, 60))
    if response.status_code != 200:
        raise ValueError(f"hosted MP4 returned HTTP {response.status_code}")
    ct = response.headers.get("Content-Type", "").split(";")[0].lower().strip()
    if ct not in {"video/mp4", "application/octet-stream"}:
        raise ValueError("hosted video does not have an MP4 content type")
    count = 0
    digest = hashlib.sha256()
    try:
        for piece in response.iter_content(chunk_size=1024 * 1024):
            count += len(piece)
            if count > MAX_BYTES:
                raise ValueError("hosted video exceeds 200 MiB")
            digest.update(piece)
    finally:
        response.close()
    if count < 1024 or digest.hexdigest() != item["video_sha256"]:
        raise ValueError("hosted MP4 differs from the reviewed local video")
    return count


def confirmed_account() -> tuple[str, str]:
    user_id, token = ig._get_config()
    # Instagram Login's id is app-scoped. The existing token-maintenance
    # verifier checks username AND professional user_id against configuration.
    if _profile(PLATFORMS["instagram"], token) != user_id:
        raise ValueError("token does not belong to @avoidboringpeople; refusing any Reel operation")
    return user_id, token


def create_reel_container(item: dict, user_id: str, token: str) -> str:
    payload = {"media_type": "REELS", "video_url": item["video_url"], "caption": item["caption"]}
    if item["trial"]:
        payload["trial_params"] = json.dumps({"graduation_strategy": "MANUAL"}, separators=(",", ":"))
    if item["ai_generated"]:
        payload["is_ai_generated"] = "true"
    response = requests.post(
        f"{ig.INSTAGRAM_API_BASE}/{user_id}/media", data=payload,
        headers=ig._auth_headers(token), timeout=ig.REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise ig._api_error(response)
    cid = response.json().get("id")
    if not cid:
        raise ig.GraphApiError("Reel container was not identified")
    return str(cid)


def write_receipt(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, encoding="utf-8") as tmp:
        json.dump(record, tmp, indent=2, sort_keys=True)
        tmp.write("\n")
        tmp.flush()
        os.fsync(tmp.fileno())
        name = tmp.name
    os.replace(name, path)


def publish(item: dict, *, state_dir: Path, receipt_sink=None) -> dict:
    """Serialize local dispatch and reject renamed or unresolved duplicates."""
    state_dir = state_dir.expanduser().resolve()
    state_dir.mkdir(parents=True, exist_ok=True)
    fd = os.open(state_dir / ".publish.lock", os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(fd, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ValueError("another publisher is active; do not retry concurrently") from exc
        for path in sorted(state_dir.glob("*.json")):
            prior = json.loads(path.read_text(encoding="utf-8"))
            if prior.get("concept_id") != path.stem:
                raise ValueError("receipt identity mismatch; reconciliation required")
            if prior["concept_id"] == item["concept_id"]:
                raise ValueError("concept has an existing receipt; reconcile it, never blindly retry")
            if prior.get("status") == "confirmed_unpublished":
                continue  # An explicit reconciled no-publish outcome, not an uncertain retry.
            if prior.get("sha256") == item["video_sha256"]:
                raise ValueError("identical video has an existing receipt under another concept")
            if prior.get("status") != "published":
                raise ValueError("unfinished receipt requires reconciliation before any new publish")
        return _publish_reserved(item, state_dir=state_dir, receipt_sink=receipt_sink)


def _publish_reserved(item: dict, *, state_dir: Path, receipt_sink=None) -> dict:
    """One-shot transaction. Any existing receipt blocks automatic retries."""
    video = local_video_preflight(item)
    hosted_video_preflight(item)
    uid, token = confirmed_account()
    state_dir = state_dir.expanduser().resolve()
    state_dir.mkdir(parents=True, exist_ok=True)
    receipt = state_dir / f"{item['concept_id']}.json"
    record = {"concept_id": item["concept_id"], "source_url": item["source_url"],
              "sha256": video["sha256"], "trial": item["trial"], "ai_generated": item["ai_generated"],
              "status": "reserved", "created_at": datetime.now(timezone.utc).isoformat()}
    try:
        fd = os.open(receipt, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValueError("concept has an existing receipt; reconcile it, never blindly retry") from exc
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(record, handle, sort_keys=True)
        handle.flush()
        os.fsync(handle.fileno())
    def persist():
        write_receipt(receipt, record)
        if receipt_sink is not None:
            receipt_sink(dict(record))
    try:
        persist()  # Remote durability is mandatory before any Meta write.
        cid = create_reel_container(item, uid, token)
        record.update(status="container_created", container_id=cid)
        persist()
        ig.wait_for_container(uid, token, cid)
        record["status"] = "publish_attempted"
        persist()  # acknowledged remotely BEFORE the irreversible request
        mid = ig.publish_container(uid, token, cid)
        record.update(status="published", media_id=mid, permalink=ig._permalink(token, mid),
                      published_at=datetime.now(timezone.utc).isoformat())
        persist()
    except Exception as exc:
        record["status"] = "reconciliation_required"
        record["error_type"] = type(exc).__name__
        persist()
        raise
    return record


def fetch_insights(media_id: str) -> dict:
    if not re.fullmatch(r"\d{5,30}", media_id):
        raise ValueError("invalid Instagram media id")
    _, token = confirmed_account()
    output = {"media_id": media_id, "captured_at": datetime.now(timezone.utc).isoformat(),
              "metrics": {}, "availability": {}}
    for key in METRICS:
        try:
            response = requests.get(
                f"{ig.INSTAGRAM_API_BASE}/{media_id}/insights",
                params={"metric": key},
                headers=ig._auth_headers(token), timeout=ig.REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code != 200:
                output["metrics"][key] = None
                code = response.json().get("error", {}).get("code")
                output["availability"][key] = {"http_status": response.status_code,
                                               "api_code": code if type(code) is int else None}
                continue
            data = response.json().get("data") or []
            values = (data[0].get("values") or []) if data else []
            output["metrics"][key] = values[-1].get("value") if values else (
                data[0].get("total_value", {}).get("value") if data else None
            )
            output["availability"][key] = "available" if output["metrics"][key] is not None else "not_yet_available"
        except (requests.RequestException, ValueError, KeyError, IndexError, TypeError):
            output["metrics"][key] = None
            output["availability"][key] = "request_failed"
    # The per-Reel follows metric is not available through this endpoint.
    output["metrics"]["follows"] = None
    return output



def account_snapshot() -> dict:
    """Read only ABP's aggregate follower count; not per-Reel follow attribution."""
    uid, token = confirmed_account()
    response = requests.get(
        f"{ig.INSTAGRAM_API_BASE}/me",
        params={"fields": "id,user_id,username,followers_count,media_count"},
        headers=ig._auth_headers(token), timeout=ig.REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise ig._api_error(response)
    raw = response.json()
    if str(raw.get("user_id")) != uid or str(raw.get("username", "")).lower() != ACCOUNT:
        raise ValueError("account snapshot returned a different Instagram identity")
    follower_count = raw.get("followers_count")
    return {
        "account": ACCOUNT,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "followers_count": follower_count if type(follower_count) is int else None,
        "media_count": raw.get("media_count") if type(raw.get("media_count")) is int else None,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("check", "preflight", "publish", "measure", "account"))
    parser.add_argument("--manifest", type=Path, help="Approved JSON media manifest")
    parser.add_argument("--state-dir", type=Path, help="Persistent, private receipt directory; required to publish")
    parser.add_argument("--media-id", type=str, help="Published Reel media ID for insights")
    parser.add_argument("--yes-publish", action="store_true", help="Explicit live intent")
    args = parser.parse_args()
    if args.action == "account":
        print(json.dumps(account_snapshot(), indent=2))
        return
    if args.action == "measure":
        if not args.media_id:
            parser.error("measure requires --media-id")
        print(json.dumps(fetch_insights(args.media_id), indent=2))
        return
    if not args.manifest:
        parser.error("action requires --manifest")
    item = load_manifest(args.manifest)
    local = local_video_preflight(item)
    if args.action == "check":
        print(json.dumps({"status": "LOCAL_READY_ONLY", "concept_id": item["concept_id"],
                          "video": local}, indent=2))
        return
    hosted = hosted_video_preflight(item)
    confirmed_account()
    if args.action == "preflight":
        print(json.dumps({"status": "PREFLIGHT_PASS_NOT_PUBLISHED",
                          "concept_id": item["concept_id"], "hosted_bytes": hosted}, indent=2))
        return
    if not args.yes_publish or os.getenv("ABP_REELS_PUBLISH") != "enabled" or not args.state_dir:
        parser.error("LIVE PUBLISH BLOCKED: requires --yes-publish, ABP_REELS_PUBLISH=enabled, and --state-dir")
    print(json.dumps(publish(item, state_dir=args.state_dir), indent=2))


if __name__ == "__main__":
    main()
