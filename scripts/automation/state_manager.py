"""Small, versioned persistence for social distribution state."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import tempfile
from typing import Dict, Iterable, Optional

STATE_FILE = Path("posted.json")
STATE_VERSION = 2
PLATFORMS = ("twitter", "bluesky", "mastodon", "devto")
EVERGREEN_COOLDOWN_DAYS = {
    "twitter": int(os.getenv("TWITTER_EVERGREEN_COOLDOWN_DAYS", "60")),
    "bluesky": int(os.getenv("BLUESKY_EVERGREEN_COOLDOWN_DAYS", "60")),
    "mastodon": int(os.getenv("MASTODON_EVERGREEN_COOLDOWN_DAYS", "90")),
}


def _empty_state() -> Dict:
    return {"version": STATE_VERSION, "posts": {}}


def _migrate_state(raw: Dict) -> Dict:
    """Return v2 state, retaining ambiguous legacy counts without guessing platforms."""
    if raw.get("version") == STATE_VERSION and isinstance(raw.get("posts"), dict):
        return raw

    posts = {}
    for post_id, count in raw.items():
        if isinstance(count, int):
            posts[post_id] = {"_legacy": {"global_count": count}}
    return {"version": STATE_VERSION, "posts": posts}


def load_state() -> Dict:
    if not STATE_FILE.exists():
        return _empty_state()
    with STATE_FILE.open("r", encoding="utf-8") as state_file:
        raw = json.load(state_file)
    if not isinstance(raw, dict):
        raise ValueError("posted.json must contain a JSON object")
    return _migrate_state(raw)


def save_state(state: Dict) -> None:
    """Atomically persist deterministic JSON so interrupted writes cannot truncate state."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{STATE_FILE.name}.", dir=STATE_FILE.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as state_file:
            json.dump(state, state_file, indent=2, sort_keys=True)
            state_file.write("\n")
        os.replace(temp_name, STATE_FILE)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def get_platform_state(post_id: str, platform: str, state: Optional[Dict] = None) -> Optional[Dict]:
    state = state or load_state()
    platform_state = state["posts"].get(post_id, {}).get(platform)
    return platform_state if isinstance(platform_state, dict) else None


def mark_posted(post_id: str, platform: str, mode: str, remote_id: Optional[str] = None) -> Dict:
    if platform not in PLATFORMS:
        raise ValueError(f"Unknown distribution platform: {platform}")
    if mode not in {"new", "evergreen"}:
        raise ValueError(f"Unknown distribution mode: {mode}")

    state = load_state()
    post_state = state["posts"].setdefault(post_id, {})
    current = post_state.get(platform, {})
    platform_state = {
        "count": int(current.get("count", 0)) + 1,
        "last_posted_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "last_mode": mode,
    }
    if remote_id is not None:
        platform_state["remote_id"] = str(remote_id)
    elif current.get("remote_id") is not None:
        platform_state["remote_id"] = current["remote_id"]
    post_state[platform] = platform_state
    save_state(state)
    return platform_state


def last_posted_at(post_id: str, platform: str, state: Optional[Dict] = None) -> Optional[str]:
    platform_state = get_platform_state(post_id, platform, state)
    return platform_state.get("last_posted_at") if platform_state else None


def platform_post_count(post_id: str, platform: str, state: Optional[Dict] = None) -> int:
    platform_state = get_platform_state(post_id, platform, state)
    return int(platform_state.get("count", 0)) if platform_state else 0


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def platform_is_eligible(post: Dict, platform: str, mode: str, state: Optional[Dict] = None, now: Optional[datetime] = None) -> bool:
    """Whether one post may be sent to one platform in the requested mode."""
    if platform not in PLATFORMS:
        return False
    if mode == "new":
        return should_publish_new(post["id"], platform, state)
    if mode != "evergreen" or not post.get("evergreen", False):
        return False
    if platform == "devto":
        return False

    previous = _parse_timestamp(last_posted_at(post["id"], platform, state))
    if previous is None:
        return True
    cooldown = timedelta(days=EVERGREEN_COOLDOWN_DAYS[platform])
    return previous <= (now or datetime.now(timezone.utc)) - cooldown


def should_publish_new(post_id: str, platform: str, state: Optional[Dict] = None) -> bool:
    """New distribution is one successful publication per article and platform."""
    return platform_post_count(post_id, platform, state) == 0


def select_next_post(posts: Iterable[Dict], platforms: Iterable[str], mode: str) -> Optional[Dict]:
    """Choose the least-used eligible article, retaining the existing ranking tie-breakers."""
    state = load_state()
    candidates = []
    active_platforms = tuple(platform for platform in platforms if platform in PLATFORMS)
    for post in posts:
        eligible_platforms = [
            platform for platform in active_platforms if platform_is_eligible(post, platform, mode, state)
        ]
        if not eligible_platforms:
            continue
        candidate = dict(post)
        candidate["eligible_platforms"] = eligible_platforms
        candidate["platform_count"] = sum(platform_post_count(post["id"], platform, state) for platform in eligible_platforms)
        candidate.setdefault("priority_score", 0.0)
        candidates.append(candidate)

    return min(
        candidates,
        key=lambda post: (post["platform_count"], -float(post["priority_score"] or 0.0), post.get("date", "")),
        default=None,
    )
