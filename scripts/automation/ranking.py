"""Ranking and filtering utilities for choosing digest-ready posts."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import os
from typing import Dict, Iterable, List, Optional, Sequence, Set

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


def score_posts(posts: Iterable[Dict], config: Optional[RankingConfig] = None) -> List[Dict]:
    """Annotate posts with a priority score for downstream selection."""
    config = config or RankingConfig()
    scored: List[Dict] = []
    now = datetime.now(timezone.utc)

    for post in posts:
        score = 0.0

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


__all__ = ["RankingConfig", "filter_posts", "score_posts"]
