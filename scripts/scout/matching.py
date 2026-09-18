"""Deterministic candidate generation: which article could this conversation need?

Matching decides only which candidates are worth a judgment call. Similarity is
candidate generation, never evidence: a shared term proves a conversation is
*about* something the archive covers, never that joining it would help anyone.
That judgment is the model call in `filtering.py`, and the deterministic gates
there keep that call affordable.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import os
import re
from typing import Iterable, List, Optional, Sequence, Tuple

from scripts.scout.discovery import Candidate
from scripts.scout.errors import ScoutError
from scripts.scout.inventory import ContentItem
from scripts.scout.state import normalize_url

TERM_PATTERN = re.compile(r"[a-z0-9']+")
MIN_TERM_LENGTH = 2

# Words that appear in so many titles that a shared one carries no signal. Kept
# short deliberately: a term only counts when the *article* also uses it, so the
# list only needs the vocabulary of generic headline English — including the
# short function words, which otherwise match almost every piece of prose.
STOPWORDS = frozenset(
    """
    about after again against all also am an and any anyone anything are as at be
    because been before being between both but by can could did do does doing
    done down during each even ever every everyone everything few for from
    further get gets got had has have having he here how if in into is it its
    itself just like made make many may me might more most much must my need
    needs never new no not nothing now of off often on once only or other our
    out over own same should since so some something someone still such than
    that the their them then there these they thing things this those through to
    too under until up us very want was way we were what when where which while
    who why will with without would year years you your
    """.split()
)

# Contractions survive the term pattern because it keeps apostrophes, so they are
# listed rather than stemmed away.
CONTRACTION_STOPWORDS = frozenset(
    """
    aren't can't couldn't didn't doesn't don't hadn't hasn't haven't he's i'd
    i'll i'm i've isn't it's let's mustn't she's shouldn't that's there's
    they're wasn't we're weren't what's who's won't wouldn't you're you've
    """.split()
)

STOPWORDS = STOPWORDS | CONTRACTION_STOPWORDS

DEFAULT_QUERY_LIMIT = 6
# A tag used by one article only is that article's private label, not a theme
# the archive keeps returning to, so it is not worth a search.
MIN_TAG_FREQUENCY = 2

# Matching is candidate generation, so it has to be cheap but not credulous. A
# term the article's own title or tags use is evidence the conversation is about
# something this article is about; a term only its prose uses is not, because
# enough prose overlaps with enough conversations to make everything match
# everything. So prose overlap may order candidates but can never qualify one,
# and it is capped so a long article cannot outscore a specific pairing.
_TITLE_POINTS = 3
_TAG_POINTS = 3
_SUMMARY_POINTS = 1
_SUMMARY_POINTS_CAP = 3
DEFAULT_MIN_MATCH_SCORE = _TITLE_POINTS

@dataclass(frozen=True)
class Match:
    """One candidate paired with the existing article that could speak to it."""

    candidate: Candidate
    item: ContentItem
    score: int
    matched_terms: Tuple[str, ...]

    @property
    def key(self) -> str:
        return normalize_url(self.candidate.external_url)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return max(0, int(raw))
    except ValueError as error:
        raise ScoutError(f"❌ {name} must be a whole number, got {raw!r}") from error


def min_match_score() -> int:
    return _env_int("SCOUT_MIN_MATCH_SCORE", DEFAULT_MIN_MATCH_SCORE)


def query_limit() -> int:
    """How many derived queries are searched. Each one costs a request per source."""
    return max(1, _env_int("SCOUT_QUERY_LIMIT", DEFAULT_QUERY_LIMIT))


def _singular(term: str) -> str:
    """Naive singular so "startups" and "startup" agree on being the same theme."""
    if len(term) > 4 and term.endswith("s") and not term.endswith(("ss", "is", "us")):
        return term[:-1]
    return term


def terms(text: object) -> frozenset[str]:
    """Comparable terms in one piece of text, lowercased and de-pluralized."""
    found = set()
    for token in TERM_PATTERN.findall(str(text or "").lower()):
        token = token.strip("'")
        if len(token) < MIN_TERM_LENGTH or token in STOPWORDS:
            continue
        found.add(_singular(token))
    return frozenset(found)


def build_queries(
    items: Iterable[ContentItem],
    *,
    limit: int = DEFAULT_QUERY_LIMIT,
    override: Optional[Sequence[str]] = None,
) -> List[str]:
    """Search queries derived from the archive's own metadata, deterministically.

    The recurring tags of published writing already say what the archive is
    about, so no hand-maintained keyword list has to be curated. An explicit
    override is honored as given, in order.
    """
    if override is not None:
        return [str(query).strip() for query in override if str(query).strip()][:limit]

    counts = Counter(tag.lower() for item in items for tag in item.tags)
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    return [tag for tag, count in ranked if count >= MIN_TAG_FREQUENCY][:limit]


def score_item(candidate_terms: Iterable[str], item: ContentItem) -> Tuple[int, Tuple[str, ...]]:
    """How strongly one article covers the vocabulary of one conversation.

    Zero unless the conversation shares a term with the article's title or its
    tags/category, which is the weakest pairing worth showing a model.
    """
    candidate_set = set(candidate_terms)
    title_overlap = candidate_set & terms(item.title)
    tag_overlap = candidate_set & terms(" ".join(item.tags) + " " + item.category)
    core = title_overlap | tag_overlap
    if not core:
        return 0, ()
    summary_overlap = (candidate_set & terms(item.summary)) - core
    score = _TITLE_POINTS * len(title_overlap) + _TAG_POINTS * len(tag_overlap)
    score += min(_SUMMARY_POINTS * len(summary_overlap), _SUMMARY_POINTS_CAP)
    return score, tuple(sorted(core | summary_overlap))


def match_candidate(candidate: Candidate, items: Sequence[ContentItem], *, min_score: int) -> Optional[Match]:
    """The best-matching article for one candidate, or None when nothing matches.

    Ties keep the first article in inventory order, so a fixed index always
    produces the same pairing.
    """
    candidate_terms = terms(f"{candidate.title} {candidate.body}")
    best: Optional[Match] = None
    for item in items:
        score, matched = score_item(candidate_terms, item)
        if score < min_score:
            continue
        if best is None or score > best.score:
            best = Match(candidate=candidate, item=item, score=score, matched_terms=matched)
    return best


def rank_candidates(
    candidates: Iterable[Candidate],
    items: Sequence[ContentItem],
    *,
    min_score: Optional[int] = None,
) -> List[Match]:
    """Unmatched candidates dropped, survivors ordered best first.

    The whole ranked list is returned: the deterministic gates and the cap on
    model calls happen afterwards, so a candidate that would be rejected anyway
    never occupies a judgment slot a better one could use.
    """
    threshold = min_score if min_score is not None else min_match_score()
    matches = [
        match
        for match in (match_candidate(candidate, items, min_score=threshold) for candidate in candidates)
        if match is not None
    ]
    # Least to most significant, so the result is fully determined by the data
    # rather than by the order the sources happened to return.
    matches.sort(key=lambda match: match.key)
    matches.sort(key=lambda match: match.candidate.published_at, reverse=True)
    matches.sort(key=lambda match: -match.score)
    return matches
