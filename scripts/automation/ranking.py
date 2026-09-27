"""Ranking and filtering utilities for choosing digest-ready posts."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import log10
import os
from typing import Dict, Iterable, List, Optional, Sequence, Set

from scripts.scout.errors import ScoutError
from scripts.scout.state import load_state as load_scout_state

ISO_FORMATS: Sequence[str] = (
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S.%f%z",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
)


@dataclass(frozen=True)
class RankingConfig:
    min_word_count: int = int(os.getenv("DIGEST_MIN_WORDS", "180"))
    allowed_categories: Optional[Set[str]] = None
    excluded_tags: Set[str] = None  # type: ignore[assignment]
    preferred_tags: Set[str] = None  # type: ignore[assignment]
    freshness_half_life_days: int = int(os.getenv("DIGEST_FRESHNESS_HALF_LIFE", "21"))

    def __post_init__(self):
        object.__setattr__(self, "allowed_categories", _parse_env_set("DIGEST_ALLOWED_CATEGORIES"))
        object.__setattr__(self, "excluded_tags", _parse_env_set("DIGEST_EXCLUDED_TAGS"))
        object.__setattr__(self, "preferred_tags", _parse_env_set("DIGEST_PREFERRED_TAGS"))


def _parse_env_set(name: str) -> Optional[Set[str]]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def _word_count(post: Dict) -> int:
    content = post.get("content") or ""
    return len(content.split())


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    for fmt in ISO_FORMATS:
        try:
            parsed = datetime.strptime(value, fmt)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def filter_posts(posts: Iterable[Dict], config: Optional[RankingConfig] = None) -> List[Dict]:
    """Apply lightweight hygiene filters before ranking."""
    config = config or RankingConfig()
    results: List[Dict] = []

    for post in posts:
        if _word_count(post) < config.min_word_count:
            continue

        category = (post.get("category") or "").strip().lower()
        if config.allowed_categories is not None and category not in config.allowed_categories:
            continue

        tags = {str(tag).strip().lower() for tag in post.get("tags", []) if str(tag).strip()}
        if config.excluded_tags and tags.intersection(config.excluded_tags):
            continue

        results.append(post)

    return results


# Engagement informs but never dominates: past interactions add at most 0.75
# (9 interactions ~= +0.25, 99 ~= +0.5), while freshness contributes up to
# 2.0. Absent data contributes exactly 0, so new articles are never
# penalized for having no history.
ENGAGEMENT_MAX_BOOST = 0.75
ENGAGEMENT_BOOST_RATE = 0.25

# Scout only records opportunities after its deterministic gates and STRONG
# judgment agree.  That existing `surfaced` row is therefore the confidence
# signal; keep its influence brief and smaller than any ranking component that
# is intended to dominate selection.
SCOUT_RELEVANCE_TTL_DAYS = 7
SCOUT_RELEVANCE_MAX_BOOST = 0.5


def apply_scout_relevance_boost(
    posts: Iterable[Dict], scout_state: Optional[Dict] = None, *, now: Optional[datetime] = None
) -> List[Dict]:
    """Add a bounded evergreen tie-break boost from fresh Scout opportunities.

    Scout is deliberately optional.  Missing or malformed state contributes
    nothing, and matching is limited to the exact content id or canonical URL
    already stored by Scout—never titles, terms, or fuzzy similarity.
    """
    posts = [dict(post) for post in posts]
    if scout_state is None:
        try:
            scout_state = load_scout_state()
        except (OSError, ScoutError, TypeError, ValueError):
            return posts

    opportunities = scout_state.get("opportunities") if isinstance(scout_state, dict) else None
    if not isinstance(opportunities, dict):
        return posts

    moment = now or datetime.now(timezone.utc)
    cutoff = moment - timedelta(days=SCOUT_RELEVANCE_TTL_DAYS)
    fresh_ids: Set[str] = set()
    fresh_urls: Set[str] = set()
    for entry in opportunities.values():
        if not isinstance(entry, dict) or entry.get("status") != "surfaced":
            continue
        surfaced_at = _parse_date(entry.get("surfaced_at"))
        if surfaced_at is None or surfaced_at < cutoff or surfaced_at > moment:
            continue
        content_id = entry.get("content_id")
        content_url = entry.get("content_url")
        if isinstance(content_id, str) and content_id:
            fresh_ids.add(content_id)
        if isinstance(content_url, str) and content_url:
            fresh_urls.add(content_url)

    for post in posts:
        if post.get("id") not in fresh_ids and post.get("url") not in fresh_urls:
            continue
        try:
            base = float(post.get("priority_score", 0.0) or 0.0)
        except (TypeError, ValueError):
            base = 0.0
        # One or many fresh opportunities have the same capped influence.
        post["priority_score"] = round(base + SCOUT_RELEVANCE_MAX_BOOST, 4)
    return posts


def score_posts(posts: Iterable[Dict], config: Optional[RankingConfig] = None, engagement: Optional[Dict[str, int]] = None) -> List[Dict]:
    """Annotate posts with a priority score for downstream selection."""
    config = config or RankingConfig()
    engagement = engagement or {}
    scored: List[Dict] = []
    now = datetime.now(timezone.utc)

    for post in posts:
        score = 0.0
        total = engagement.get(post.get("id", ""), 0) or 0
        if total > 0:
            score += min(ENGAGEMENT_MAX_BOOST, ENGAGEMENT_BOOST_RATE * log10(1 + total))

        # Freshness decay: newer content gets more weight.
        published = _parse_date(post.get("date"))
        if published:
            age_days = max((now - published).days, 0)
            half_life = max(config.freshness_half_life_days, 1)
            freshness = 0.5 ** (age_days / half_life)
            score += freshness * 2

        # Longer posts generally carry more signal.
        score += min(_word_count(post) / 600, 1.0)

        # Preferred tags provide an additional boost.
        if config.preferred_tags:
            tags = {str(tag).strip().lower() for tag in post.get("tags", []) if str(tag).strip()}
            if tags.intersection(config.preferred_tags):
                score += 0.75

        # Allow manual overrides via metadata.
        if "priority_score" in post:
            try:
                score += float(post["priority_score"])
            except (TypeError, ValueError):
                pass

        annotated = dict(post)
        annotated["priority_score"] = round(score, 4)
        scored.append(annotated)

    scored.sort(key=lambda item: item.get("priority_score", 0.0), reverse=True)
    return scored


__all__ = ["RankingConfig", "apply_scout_relevance_boost", "filter_posts", "score_posts"]
