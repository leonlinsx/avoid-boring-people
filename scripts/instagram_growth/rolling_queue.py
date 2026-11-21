"""Rolling ABP Reel queue, local-only. Never activated by the existing workflows.

Designed for a persistent workstation/timer, not ephemeral GitHub Actions.
At most one Reel per invocation; 3 per 24 hours by default, 3h apart.
Only reviewed, public hosted, byte-verified MP4s are eligible.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from scripts.instagram_growth import reel_pilot as pilot

WINDOWS = {"24h": timedelta(hours=24), "48h": timedelta(hours=48),
           "7d": timedelta(days=7)}


def instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() is None:
        raise ValueError("timestamps must include UTC offset")
    return parsed.astimezone(timezone.utc)


def receipts(state_dir: Path) -> list[dict]:
    result = []
    for path in sorted(state_dir.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("concept_id") != path.stem:
            raise ValueError(f"receipt mismatch: {path.name}")
        result.append(data)
    return result


def choose(queue_dir: Path, state_dir: Path, now: datetime,
           *, max_per_24h: int = 3, min_spacing_hours: int = 3) -> tuple[dict | None, str]:
    history = receipts(state_dir)
    if any(r.get("status") in {"reconciliation_required", "reserved", "container_created", "publish_attempted"}
           for r in history):
        return None, "HALT: existing unfinished/ambiguous receipt requires human reconciliation"
    starts = []
    for r in history:
        if r.get("status") == "confirmed_unpublished":
            continue
        # Meta processing can take minutes after reservation. Throttle completed
        # posts from their publication time, not the earlier reservation time.
        ts = instant(r.get("published_at") or r["created_at"])
        if now - timedelta(hours=24) <= ts <= now:
            starts.append(ts)
    if len(starts) >= max_per_24h:
        return None, "THROTTLED: rolling 24h post limit reached"
    if starts and now - max(starts) < timedelta(hours=min_spacing_hours):
        return None, "THROTTLED: spacing interval not elapsed"
    used = {r["concept_id"] for r in history}
    due = []
    for path in sorted(queue_dir.glob("*.json")):
        entry = pilot.load_manifest(path)
        if entry["concept_id"] in used:
            continue
        if "release_after" not in entry:
            raise ValueError(f"release_after missing in {path.name}")
        release = instant(entry["release_after"])
        if release <= now:
            due.append((release, entry["concept_id"], entry))
    if not due:
        return None, "NO_DUE_APPROVED_ITEMS"
    due.sort(key=lambda v: (v[0], v[1]))
    return due[0][2], "READY"


def measure_due(state_dir: Path, now: datetime, *, max_fetch: int = 12) -> list[dict]:
    obs = state_dir / "observations"
    obs.mkdir(parents=True, exist_ok=True)
    done = []
    for receipt in receipts(state_dir):
        if receipt.get("status") != "published" or not receipt.get("media_id"):
            continue
        published_at = instant(receipt["published_at"])
        for label, age in WINDOWS.items():
            target = obs / f"{receipt['concept_id']}-{label}.json"
            if target.exists() or now < published_at + age:
                continue
            outcome = pilot.fetch_insights(str(receipt["media_id"]))
            outcome["concept_id"] = receipt["concept_id"]
            outcome["window"] = label
            outcome["published_at"] = receipt["published_at"]
            outcome["account"] = pilot.ACCOUNT
            outcome["follows_caveat"] = "Reel-level follows unavailable via current media Insights; use native Insights/account follower deltas."
            pilot.write_receipt(target, outcome)
            done.append({"concept_id": receipt["concept_id"], "window": label, "path": str(target)})
            if len(done) >= max_fetch:
                return done
    return done


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("queue", "run", "measure"))
    parser.add_argument("--queue-dir", type=Path)
    parser.add_argument("--state-dir", type=Path, required=True)
    parser.add_argument("--max-per-24h", type=int, default=3)
    parser.add_argument("--min-spacing-hours", type=int, default=3)
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    if args.max_per_24h not in (1, 2, 3):
        parser.error("bounded pilot max-per-24h must be 1, 2 or 3")
    if args.min_spacing_hours < 3:
        parser.error("minimum spacing must be at least 3 hours")
    if args.action == "measure":
        now = datetime.now(timezone.utc)
        # Account-level follower counts are crucial, but are never attributed
        # causally to any one Reel when several are published concurrently.
        account = None
        try:
            account = pilot.account_snapshot()
            target = args.state_dir / "account" / f"{now.strftime('%Y%m%dT%H%M%SZ')}.json"
            pilot.write_receipt(target, account)
        except Exception as error:
            account = {"status": "unavailable", "reason": type(error).__name__}
        print(json.dumps({"account": account,
                          "reels": measure_due(args.state_dir, now)}, indent=2))
        return
    if not args.queue_dir or not args.queue_dir.is_dir():
        parser.error("queue/run require an existing --queue-dir")
    item, reason = choose(args.queue_dir, args.state_dir, datetime.now(timezone.utc),
                          max_per_24h=args.max_per_24h,
                          min_spacing_hours=args.min_spacing_hours)
    if not item:
        print(reason)
        return
    if args.action == "queue" or not args.live:
        print(json.dumps({"status": "PREVIEW_ONLY_NOT_PUBLISHED",
                          "concept_id": item["concept_id"], "video_url": item["video_url"],
                          "source": item["source_url"], "trial": item["trial"]}, indent=2))
        return
    if os.getenv("ABP_REELS_PUBLISH") != "enabled":
        parser.error("live run requires ABP_REELS_PUBLISH=enabled")
    print(json.dumps(pilot.publish(item, state_dir=args.state_dir), indent=2))


if __name__ == "__main__":
    main()
