"""Read-only public engagement ledger for distributed articles.

Nothing in the distribution flow measures whether a post worked: ranking,
evergreen selection, and copy quality are all open-loop guesses. This module
closes the smallest useful loop: it re-reads the remote posts `posted.json`
already recorded and stores their *public* counts (likes, reposts, replies,
views where exposed) in a separate `engagement.json` ledger. No tracking
pixels, no per-user data, no authenticated scraping beyond the read-only
credentials the publishers already use.

Only platforms with a practical read API are covered: Bluesky (keyless public
API), Mastodon and DEV (existing read tokens), and Farcaster (existing Neynar
key). Threads/Instagram expose no read API without an app token the repository
deliberately does not store; Nostr has no aggregate counts endpoint; the rest
are dormant. Unsupported platforms are skipped, never failed.

Every collector is fail-soft per item: a shape change or an outage skips that
post with a warning instead of failing the run, because an observability job
must not break publishing. The shapes below were verified against the live
Bluesky public API; Mastodon/Neynar/DEV parsing is defensive (`.get` chains
with aliases) and will be confirmed by the first scheduled run against real
stored IDs.
"""
from __future__ import annotations

import json
import os
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

LEDGER_FILE = Path("engagement.json")
LEDGER_VERSION = 1

REQUEST_TIMEOUT_SECONDS = 15

BLUESKY_PUBLIC_API = "https://public.api.bsky.app/xrpc"
NEYNAR_API = "https://api.neynar.com/v2/farcaster/cast"
DEVTO_API = "https://dev.to/api/articles"

# Platforms whose remote posts expose public counts through a usable read API.
COUNTED_PLATFORMS = ("bluesky", "mastodon", "farcaster", "devto")

USER_AGENT = (
    "Mozilla/5.0 (compatible; avoid-boring-people/1.0; +https://leonlins.com)"
)


def _empty_ledger() -> Dict:
    return {"version": LEDGER_VERSION, "observations": {}}


def load_engagement(path: Path = LEDGER_FILE) -> Dict:
    """Load the ledger; a missing or legacy file yields an empty ledger."""
    if not path.exists():
        return _empty_ledger()
    with path.open("r", encoding="utf-8") as ledger_file:
        raw = json.load(ledger_file)
    if not isinstance(raw, dict) or raw.get("version") != LEDGER_VERSION:
        return _empty_ledger()
    observations = raw.get("observations")
    if not isinstance(observations, dict):
        return _empty_ledger()
    return {"version": LEDGER_VERSION, "observations": observations}


def save_engagement(ledger: Dict, path: Path = LEDGER_FILE) -> None:
    """Atomically persist the ledger so an interrupted run cannot truncate it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as ledger_file:
            json.dump(ledger, ledger_file, indent=2, sort_keys=True)
            ledger_file.write("\n")
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def _now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _as_int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _first_int(*values: Any) -> Optional[int]:
    for value in values:
        parsed = _as_int(value)
        if parsed is not None:
            return parsed
    return None


def fetch_json(
    url: str, headers: Optional[Dict[str, str]] = None
) -> Dict:
    """GET one JSON document with an honest user agent."""
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
            **(headers or {}),
        },
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return json.load(response)


def bluesky_counts(at_uri: str) -> Dict[str, int]:
    """Public counts for one Bluesky post. Keyless via the public API."""
    query = urllib.parse.urlencode({"uris": at_uri})
    data = fetch_json(f"{BLUESKY_PUBLIC_API}/app.bsky.feed.getPosts?{query}")
    posts = data.get("posts")
    if not isinstance(posts, list) or not posts:
        raise ValueError(f"Bluesky returned no post for {at_uri}")
    post = posts[0] if isinstance(posts[0], dict) else {}
    counts: Dict[str, int] = {}
    likes = _first_int(post.get("likeCount"))
    reposts = _first_int(post.get("repostCount"), post.get("repost_count"))
    replies = _first_int(post.get("replyCount"), post.get("reply_count"))
    quotes = _first_int(post.get("quoteCount"), post.get("quote_count"))
    if likes is not None:
        counts["likes"] = likes
    if reposts is not None:
        counts["reposts"] = reposts
    if replies is not None:
        counts["replies"] = replies
    if quotes is not None:
        counts["quotes"] = quotes
    return counts


def mastodon_counts(instance: str, token: str, status_id: str) -> Dict[str, int]:
    """Public counts for one Mastodon status, using the existing read token."""
    instance = instance.rstrip("/")
    data = fetch_json(
        f"{instance}/api/v1/statuses/{urllib.parse.quote(status_id)}",
        headers={"Authorization": f"Bearer {token}"},
    )
    if not isinstance(data, dict):
        raise ValueError("Mastodon returned a non-object status")
    counts: Dict[str, int] = {}
    favourites = _first_int(data.get("favourites_count"))
    reblogs = _first_int(data.get("reblogs_count"))
    replies = _first_int(data.get("replies_count"))
    if favourites is not None:
        counts["likes"] = favourites
    if reblogs is not None:
        counts["reposts"] = reblogs
    if replies is not None:
        counts["replies"] = replies
    return counts


def farcaster_counts(api_key: str, cast_hash: str) -> Dict[str, int]:
    """Public counts for one Farcaster cast via the existing Neynar key."""
    query = urllib.parse.urlencode(
        {"identifier": cast_hash, "type": "hash"}
    )
    data = fetch_json(
        f"{NEYNAR_API}?{query}", headers={"api_key": api_key}
    )
    cast = data.get("cast")
    if not isinstance(cast, dict):
        raise ValueError("Neynar returned no cast")
    reactions = cast.get("reactions")
    if not isinstance(reactions, dict):
        reactions = {}
    replies = cast.get("replies")
    replies_count = replies.get("count") if isinstance(replies, dict) else None
    counts: Dict[str, int] = {}
    likes = _first_int(reactions.get("likes_count"))
    recasts = _first_int(reactions.get("recasts_count"))
    replies_parsed = _first_int(replies_count)
    if likes is not None:
        counts["likes"] = likes
    if recasts is not None:
        counts["reposts"] = recasts
    if replies_parsed is not None:
        counts["replies"] = replies_parsed
    return counts


def devto_counts(api_key: str, article_id: str) -> Dict[str, int]:
    """Public counts for one DEV article, using the existing API key."""
    data = fetch_json(
        f"{DEVTO_API}/{urllib.parse.quote(str(article_id))}",
        headers={"api-key": api_key},
    )
    if not isinstance(data, dict):
        raise ValueError("DEV returned a non-object article")
    counts: Dict[str, int] = {}
    reactions = _first_int(
        data.get("public_reactions_count"), data.get("positive_reactions_count")
    )
    comments = _first_int(data.get("comments_count"))
    views = _first_int(data.get("page_views_count"))
    if reactions is not None:
        counts["likes"] = reactions
    if comments is not None:
        counts["replies"] = comments
    if views is not None:
        counts["views"] = views
    return counts


def total_interactions(observation: Dict) -> int:
    """One comparable number per observation: the sum of its known counts."""
    counts = observation.get("counts")
    if not isinstance(counts, dict):
        return 0
    return sum(
        value for value in counts.values() if isinstance(value, int) and value >= 0
    )


def engagement_totals(ledger: Dict) -> Dict[str, int]:
    """Post id -> summed interactions across counted platforms."""
    observations = ledger.get("observations")
    if not isinstance(observations, dict):
        return {}
    totals: Dict[str, int] = {}
    for post_id, platforms in observations.items():
        if not isinstance(platforms, dict):
            continue
        totals[post_id] = sum(
            total_interactions(observation)
            for observation in platforms.values()
            if isinstance(observation, dict)
        )
    return totals


def _mastodon_env() -> Optional[Tuple[str, str]]:
    instance = (os.getenv("MASTODON_INSTANCE") or "").strip().rstrip("/")
    token = (os.getenv("MASTODON_ACCESS_TOKEN") or "").strip()
    if not instance or not token:
        return None
    return instance, token


def collect(
    publish_state: Dict,
    ledger: Optional[Dict] = None,
) -> Tuple[Dict, Dict[str, int]]:
    """Refresh the ledger from the remote posts recorded in publish state.

    Returns the updated ledger plus outcome stats. Individual posts fail
    soft: a shape change or outage skips that post with a warning, because an
    observability pass must never break publishing.
    """
    ledger = ledger if ledger is not None else load_engagement()
    observations = ledger.setdefault("observations", {})
    stats = {"observed": 0, "skipped": 0, "failed": 0}

    mastodon = _mastodon_env()
    neynar_key = (os.getenv("NEYNAR_API_KEY") or "").strip()
    devto_key = (os.getenv("DEVTO_API_KEY") or "").strip()

    posts = publish_state.get("posts")
    if not isinstance(posts, dict):
        return ledger, stats

    for post_id, platforms in posts.items():
        if not isinstance(platforms, dict):
            continue
        for platform, entry in platforms.items():
            if platform not in COUNTED_PLATFORMS:
                continue
            if not isinstance(entry, dict):
                stats["skipped"] += 1
                continue
            remote_id = entry.get("remote_id")
            if not remote_id:
                stats["skipped"] += 1
                continue
            try:
                if platform == "bluesky":
                    counts = bluesky_counts(str(remote_id))
                elif platform == "mastodon":
                    if mastodon is None:
                        stats["skipped"] += 1
                        continue
                    counts = mastodon_counts(mastodon[0], mastodon[1], str(remote_id))
                elif platform == "farcaster":
                    if not neynar_key:
                        stats["skipped"] += 1
                        continue
                    counts = farcaster_counts(neynar_key, str(remote_id))
                elif platform == "devto":
                    if not devto_key:
                        stats["skipped"] += 1
                        continue
                    counts = devto_counts(devto_key, str(remote_id))
                else:  # pragma: no cover - guarded by COUNTED_PLATFORMS
                    stats["skipped"] += 1
                    continue
            except Exception as error:  # noqa: BLE001 - fail-soft per item
                print(f"⚠️ engagement: {platform} {post_id} skipped ({error})")
                stats["failed"] += 1
                continue
            post_observations = observations.setdefault(post_id, {})
            record: Dict = {
                "counts": counts,
                "collected_at": _now_iso(),
            }
            model = entry.get("model")
            if isinstance(model, str) and model:
                record["model"] = model
            post_observations[platform] = record
            stats["observed"] += 1
    return ledger, stats


def main() -> int:
    """Collect public engagement into engagement.json.

    `DRY_RUN=true` prints what would be recorded without writing. Exits 1
    only when eligible targets existed but nothing was observed (a total
    outage worth investigating); per-item failures merely warn.
    """
    from scripts.automation.state_manager import load_state

    dry_run = os.getenv("DRY_RUN", "false").lower() == "true"
    ledger, stats = collect(load_state())
    observed = stats["observed"]
    print(
        f"engagement: observed={observed} "
        f"skipped={stats['skipped']} failed={stats['failed']}"
    )
    if dry_run:
        print("DRY_RUN enabled - ledger not written")
        return 0
    save_engagement(ledger)
    print(f"engagement ledger stored ({len(ledger.get('observations', {}))} posts)")
    eligible_targets = observed + stats["failed"]
    if eligible_targets > 0 and observed == 0:
        print("::error::engagement collection observed nothing; investigate before relying on the ledger")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
