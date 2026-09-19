"""Scout's memory: enough to never suggest the same conversation twice.

One small committed JSON document, written the same way the distribution state is
and for the same reason: a scheduled run can be killed mid-write. Scout keeps no
database, because the only questions it has to answer are "has this conversation
been surfaced before?" and "did anything come of it?".
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
from typing import Dict, Optional, Set
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from scripts.automation.fetch_post import SITE_URL
from scripts.automation.json_store import load_json_object, save_json_object
from scripts.scout.errors import ScoutError

STATE_FILE = Path("scout-state.json")
STATE_VERSION = 1

STATUS_SURFACED = "surfaced"
STATUS_DISMISSED = "dismissed"
STATUS_ACTED = "acted"
STATUS_EXPIRED = "expired"
STATUSES = (STATUS_SURFACED, STATUS_DISMISSED, STATUS_ACTED, STATUS_EXPIRED)

# A surfaced opportunity that nobody acted on stops being news quickly. Expiring
# it keeps the record honest without deleting it: the URL stays recorded, so an
# expired conversation is never suggested again.
DEFAULT_EXPIRE_DAYS = 14


def _expire_days() -> int:
    raw = os.getenv("SCOUT_EXPIRE_DAYS", "").strip()
    if not raw:
        return DEFAULT_EXPIRE_DAYS
    try:
        return max(1, int(raw))
    except ValueError as error:
        raise ScoutError(f"❌ SCOUT_EXPIRE_DAYS must be a number of days, got {raw!r}") from error


def parse_timestamp(value: object) -> Optional[datetime]:
    """Read a stored or source timestamp as UTC, or None when it is unusable."""
    if isinstance(value, datetime):
        stamp = value
    elif isinstance(value, str) and value.strip():
        try:
            stamp = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp.astimezone(timezone.utc)


def _serialize(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat()


def empty_state() -> Dict:
    return {"version": STATE_VERSION, "opportunities": {}}


def load_state() -> Dict:
    raw = load_json_object(STATE_FILE)
    if raw is None:
        return empty_state()
    opportunities = raw.get("opportunities")
    if not isinstance(opportunities, dict):
        raise ScoutError(f"❌ {STATE_FILE} has no opportunities object; refusing to forget past suggestions")
    return {"version": STATE_VERSION, "opportunities": dict(opportunities)}


def save_state(state: Dict) -> None:
    save_json_object(STATE_FILE, state)


def normalize_url(url: str) -> str:
    """Stable identity for one conversation, so the same thread is suggested once.

    Tracking parameters are dropped and the path is compared without a trailing
    slash, because the same thread reaches Scout through several URLs.
    """
    parsed = urlsplit(str(url).strip())
    query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.lower().startswith("utm_")
        ]
    )
    return urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/") or "/", query, "")
    )


def recorded_urls(state: Dict) -> Set[str]:
    """Every conversation Scout has already judged, in any status."""
    return set(state.get("opportunities") or {})


def get_opportunity(state: Dict, url: str) -> Optional[Dict]:
    return (state.get("opportunities") or {}).get(normalize_url(url))


def absolute_content_url(url: object) -> str:
    """A published article's URL on the public site, absolute when it is relative."""
    raw = str(url or "").strip()
    if not raw:
        return ""
    if raw.startswith(("http://", "https://")):
        return raw
    return f"{SITE_URL}{raw}" if raw.startswith("/") else f"{SITE_URL}/{raw}"


def record_surfaced(
    state: Dict,
    *,
    url: str,
    source: str,
    content_id: str,
    draft: str,
    thread_title: str = "",
    content_title: str = "",
    content_url: str = "",
    why_now: str = "",
    now: Optional[datetime] = None,
) -> bool:
    """Record one surfaced opportunity, once, under its normalized URL.

    Returns False when the conversation was already recorded, leaving the first
    record intact: what Scout said about a conversation the day it surfaced it is
    history, not something a later run may rewrite.

    The optional context — what the conversation was called, the article it
    matched, and why it was timely — is stored only when Scout had it, so rows
    written before these keys existed stay readable. Nothing decides anything
    from them; they let a reader look at one row and know what it was.
    """
    moment = now or datetime.now(timezone.utc)
    opportunities = state.setdefault("opportunities", {})
    key = normalize_url(url)
    if key in opportunities:
        return False
    entry = {
        "external_url": str(url).strip(),
        "source": source,
        "content_id": content_id,
        "status": STATUS_SURFACED,
        "draft": draft,
        "discovered_at": _serialize(moment),
        "surfaced_at": _serialize(moment),
        "acted_at": None,
        "outcome": None,
    }
    context = {
        "thread_title": str(thread_title or "").strip(),
        "content_title": str(content_title or "").strip(),
        "content_url": absolute_content_url(content_url),
        "why_now": str(why_now or "").strip(),
    }
    entry.update({name: value for name, value in context.items() if value})
    opportunities[key] = entry
    return True


def set_status(
    state: Dict,
    url: str,
    status: str,
    *,
    now: Optional[datetime] = None,
    outcome: Optional[str] = None,
) -> bool:
    """Move one recorded opportunity to a new status. False when it is unknown."""
    if status not in STATUSES:
        raise ScoutError(f"❌ Unknown scout status {status!r}")
    entry = get_opportunity(state, url)
    if entry is None:
        return False
    moment = now or datetime.now(timezone.utc)
    entry["status"] = status
    if status == STATUS_ACTED:
        entry["acted_at"] = _serialize(moment)
    if outcome is not None:
        entry["outcome"] = outcome
    return True


def expire_stale(state: Dict, *, now: Optional[datetime] = None, after_days: Optional[int] = None) -> int:
    """Expire surfaced opportunities nobody acted on, without forgetting them.

    Only `surfaced` rows are touched: a dismissal or an action is a human
    decision and stays as recorded forever. A row whose timestamp is unreadable
    is left alone rather than guessed at.
    """
    moment = now or datetime.now(timezone.utc)
    cutoff = moment - timedelta(days=after_days if after_days is not None else _expire_days())
    expired = 0
    for entry in (state.get("opportunities") or {}).values():
        if entry.get("status") != STATUS_SURFACED:
            continue
        surfaced_at = parse_timestamp(entry.get("surfaced_at"))
        if surfaced_at is None or surfaced_at > cutoff:
            continue
        entry["status"] = STATUS_EXPIRED
        expired += 1
    return expired
