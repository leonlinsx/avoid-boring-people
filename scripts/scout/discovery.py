"""External discovery: a few sources, each isolated from the others.

Two sources are wired for V1 because they are the ones worth reading that need no
new infrastructure and no credentials of their own: Hacker News (Algolia's public
API) and Bluesky (the repository's existing app-password credentials). Reddit was
considered and left out: its public JSON API refuses datacenter IP addresses,
which is exactly where a scheduled run executes.

Every source is fetched independently. A source that fails, is unconfigured, or
times out leaves the others untouched and is reported in the run summary instead
of aborting the run, because a run that finds nothing on one source can still find
the five conversations worth joining on the other.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import html
import json
import os
import re
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from scripts.scout.errors import ScoutError, note
from scripts.scout.state import normalize_url, parse_timestamp

SOURCE_HACKER_NEWS = "hacker-news"
SOURCE_BLUESKY = "bluesky"
SOURCES = (SOURCE_HACKER_NEWS, SOURCE_BLUESKY)

# Both Algolia rankings are read for each query. "search" ranks by traction, so
# it surfaces the threads that turned into real conversations; "search_by_date"
# ranks by recency, so it surfaces the young threads an activity gate would
# otherwise never see. One alone reliably misses the other's finds.
HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search"
HN_SEARCH_BY_DATE_URL = "https://hn.algolia.com/api/v1/search_by_date"
HN_ITEM_URL = "https://news.ycombinator.com/item?id={object_id}"
BLUESKY_POST_URL = "https://bsky.app/profile/{handle}/post/{rkey}"

# Identify honestly, as the search index fetch already does, so a source owner
# can tell what is calling them.
USER_AGENT = "Mozilla/5.0 (compatible; avoid-boring-people-scout/1.0; +https://leonlins.com)"

DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_PER_QUERY_LIMIT = 20
MAX_BODY_CHARS = 2000

_TAG_RE = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class Candidate:
    """One external conversation, exactly as the source described it."""

    source: str
    external_url: str
    title: str
    author: str
    community: str
    published_at: str
    body: str
    activity: int


@dataclass(frozen=True)
class SourceReport:
    """What one source did, including why it did nothing."""

    source: str
    attempted: bool
    ok: bool
    found: int
    note: str = ""


@dataclass(frozen=True)
class DiscoveryResult:
    candidates: Tuple[Candidate, ...] = ()
    sources: Tuple[SourceReport, ...] = ()
    queries: Tuple[str, ...] = field(default=())

    @property
    def any_source_ok(self) -> bool:
        return any(report.ok for report in self.sources)


def clean_text(raw: object) -> str:
    """Flatten untrusted source text: entities resolved, markup and newlines gone."""
    text = html.unescape(str(raw or ""))
    text = _TAG_RE.sub(" ", text)
    return " ".join(text.split())[:MAX_BODY_CHARS]


def _iso(published: object) -> str:
    """The source's own timestamp, or an empty string its gates will refuse."""
    stamp = parse_timestamp(published)
    return stamp.isoformat() if stamp else ""


def _fetch_json(url: str, timeout: int) -> Any:
    request = Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except HTTPError as error:
        raise ScoutError(f"❌ {url} returned HTTP {error.code}") from error
    except URLError as error:
        raise ScoutError(f"❌ {url} unreachable ({error.reason})") from error
    except ValueError as error:
        raise ScoutError(f"❌ {url} did not answer with JSON ({note(error)})") from error


def _fresh_enough(published_at: str, now: datetime, max_age_days: int) -> bool:
    """Recency prefilter. The authoritative age gate lives in `filtering`."""
    stamp = parse_timestamp(published_at)
    if stamp is None:
        return False
    return stamp >= now - timedelta(days=max_age_days)


def hacker_news_candidate(hit: Dict) -> Optional[Candidate]:
    """One Algolia hit as a candidate, or None when it is not a usable story."""
    object_id = str(hit.get("objectID") or "").strip()
    if not object_id:
        return None
    title = clean_text(hit.get("title"))
    story_text = clean_text(hit.get("story_text"))
    link = clean_text(hit.get("url"))
    if not title and not story_text:
        return None
    body = story_text
    if not body and link:
        # A link post carries no text of its own, so name what is being discussed.
        body = f"Link post to {link}"
    return Candidate(
        source=SOURCE_HACKER_NEWS,
        external_url=HN_ITEM_URL.format(object_id=object_id),
        title=title or story_text,
        author=clean_text(hit.get("author")),
        community="Hacker News",
        published_at=_iso(hit.get("created_at")),
        body=body,
        activity=int(hit.get("num_comments") or 0),
    )


def search_hacker_news(
    query: str,
    *,
    now: datetime,
    limit: int = DEFAULT_PER_QUERY_LIMIT,
    max_age_days: int,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> List[Candidate]:
    """Recent stories matching one query, from both of the index's rankings.

    The API does the recency filter (`created_at_i`) because it can, and the
    parse step refuses anything it cannot date. A failure of one ranking still
    returns the other's hits, so one endpoint going down does not blind the source.
    """
    cutoff = int((now - timedelta(days=max_age_days)).timestamp())
    candidates: List[Candidate] = []
    seen: set = set()
    errors: List[str] = []
    for endpoint in (HN_SEARCH_URL, HN_SEARCH_BY_DATE_URL):
        url = f"{endpoint}?" + urlencode(
            {
                "query": query,
                "tags": "story",
                "hitsPerPage": str(limit),
                "numericFilters": f"created_at_i>{cutoff}",
            }
        )
        try:
            payload = _fetch_json(url, timeout)
        except ScoutError as error:
            errors.append(str(error))
            continue
        hits = payload.get("hits") if isinstance(payload, dict) else None
        if not isinstance(hits, list):
            errors.append(f"❌ {endpoint} returned no hits list")
            continue
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            candidate = hacker_news_candidate(hit)
            if candidate is None or not _fresh_enough(candidate.published_at, now, max_age_days):
                continue
            key = normalize_url(candidate.external_url)
            if key in seen:
                continue
            seen.add(key)
            candidates.append(candidate)
    if not candidates and errors:
        raise ScoutError(errors[0])
    return candidates


def bluesky_configured() -> bool:
    """Whether the repository's existing Bluesky app credentials are present."""
    return bool(os.getenv("BLUESKY_HANDLE", "").strip() and os.getenv("BLUESKY_PASSWORD", "").strip())


def bluesky_candidate(post: Any) -> Optional[Candidate]:
    """One `search_posts` result as a candidate, or None when it is not usable.

    Kept free of SDK imports so it can be tested against plain objects.
    """
    uri = str(getattr(post, "uri", "") or "")
    record = getattr(post, "record", None)
    text = clean_text(getattr(record, "text", ""))
    if not uri or not text:
        return None
    # A reply is already part of somebody else's thread; the conversation worth
    # joining is the thread root, which the search returns on its own.
    if getattr(record, "reply", None) is not None:
        return None
    author = getattr(post, "author", None)
    handle = str(getattr(author, "handle", "") or "").strip()
    if not handle:
        return None
    return Candidate(
        source=SOURCE_BLUESKY,
        external_url=BLUESKY_POST_URL.format(handle=handle, rkey=uri.rsplit("/", 1)[-1]),
        title=text[:120],
        author=handle,
        community="Bluesky",
        published_at=_iso(getattr(record, "created_at", None)),
        body=text,
        activity=int(getattr(post, "reply_count", 0) or 0),
    )


def search_bluesky(
    query: str,
    *,
    now: datetime,
    limit: int = DEFAULT_PER_QUERY_LIMIT,
    max_age_days: int,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> List[Candidate]:
    """Recent posts matching one query.

    Search requires an authenticated session: the public unauthenticated search
    endpoint answers 403, so the repository's app password is used, and only the
    search verbs are performed with it.
    """
    # Imported here because the SDK is only needed when this source actually
    # runs, keeping the source importable (and testable) without it.
    from atproto import Client
    from atproto_client.request import Request as AtprotoRequest

    handle = os.getenv("BLUESKY_HANDLE", "").strip()
    password = os.getenv("BLUESKY_PASSWORD", "").strip()
    if not handle or not password:
        raise ScoutError("❌ BLUESKY_HANDLE and BLUESKY_PASSWORD are not both set")

    client = Client(request=AtprotoRequest(timeout=timeout))
    client.login(handle, password)
    response = client.app.bsky.feed.search_posts(
        {"q": query, "limit": limit, "sort": "latest"}
    )
    posts = getattr(response, "posts", None) or []
    candidates = [bluesky_candidate(post) for post in posts]
    return [
        candidate
        for candidate in candidates
        if candidate is not None and _fresh_enough(candidate.published_at, now, max_age_days)
    ]


def _searchers() -> Dict[str, Callable[..., List[Candidate]]]:
    """The per-source search function, resolved on each call.

    Late binding keeps substitution honest: replacing `search_hacker_news` on the
    module is what the run actually consults, rather than a copy taken at import.
    """
    return {
        SOURCE_HACKER_NEWS: search_hacker_news,
        SOURCE_BLUESKY: search_bluesky,
    }


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError as error:
        raise ScoutError(f"❌ {name} must be a whole number, got {raw!r}") from error


def per_query_limit() -> int:
    return _env_int("SCOUT_PER_QUERY_LIMIT", DEFAULT_PER_QUERY_LIMIT)


def timeout_seconds() -> int:
    return _env_int("SCOUT_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)


def discover(
    queries: Sequence[str],
    *,
    now: Optional[datetime] = None,
    per_query_limit: int = DEFAULT_PER_QUERY_LIMIT,
    max_age_days: int,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    sources: Iterable[str] = SOURCES,
) -> DiscoveryResult:
    """Query every configured source for every query, isolating each source.

    A source that raises stops contributing and is reported; the run continues.
    Duplicate conversations, including the same link found by two queries, are
    kept once, because Scout's unit of work is the conversation.
    """
    moment = now or datetime.now(timezone.utc)
    candidates: List[Candidate] = []
    reports: List[SourceReport] = []
    seen: set[str] = set()

    searchers = _searchers()
    for source in sources:
        searcher = searchers.get(source)
        if searcher is None:
            reports.append(SourceReport(source, attempted=False, ok=False, found=0, note="unknown source"))
            continue
        if source == SOURCE_BLUESKY and not bluesky_configured():
            reports.append(
                SourceReport(
                    source,
                    attempted=False,
                    ok=False,
                    found=0,
                    note="BLUESKY_HANDLE and BLUESKY_PASSWORD are not set",
                )
            )
            continue

        found = 0
        try:
            for query in queries:
                for candidate in searcher(
                    query,
                    now=moment,
                    limit=per_query_limit,
                    max_age_days=max_age_days,
                    timeout=timeout,
                ):
                    key = normalize_url(candidate.external_url)
                    if key in seen:
                        continue
                    seen.add(key)
                    candidates.append(candidate)
                    found += 1
        except Exception as error:  # noqa: BLE001 - one source must not sink the run
            reports.append(SourceReport(source, attempted=True, ok=False, found=found, note=note(error)))
            continue
        reports.append(SourceReport(source, attempted=True, ok=True, found=found))

    return DiscoveryResult(tuple(candidates), tuple(reports), tuple(queries))
