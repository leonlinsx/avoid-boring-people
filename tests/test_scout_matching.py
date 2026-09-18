from datetime import datetime, timezone

import pytest

from scripts.scout import matching
from scripts.scout.discovery import Candidate
from scripts.scout.errors import ScoutError
from scripts.scout.inventory import ContentItem

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)


def _item(content_id, *, title, tags=(), category="", summary="", body=""):
    return ContentItem(
        content_id=content_id,
        title=title,
        url=f"https://leonlins.com/writing/{content_id}",
        published_at="2021-01-01",
        category=category,
        tags=tuple(tags),
        summary=summary,
        body=body or summary,
    )


def _candidate(url="https://news.ycombinator.com/item?id=1", *, title, body="", activity=5):
    return Candidate(
        source="hacker-news",
        external_url=url,
        title=title,
        author="someone",
        community="Hacker News",
        published_at="2026-09-17T00:00:00+00:00",
        body=body,
        activity=activity,
    )


ARCHIVE = [
    _item("incentives", title="Incentives beat advice", tags=("behaviour", "investing"), summary="Incentives explain behaviour better than instruction."),
    _item("market-failure", title="When markets fail quietly", tags=("investing", "risk"), summary="Risk hides in the parts of a market nobody prices."),
    _item("on-writing", title="Writing to think", tags=("writing",), summary="Writing is how thinking gets finished."),
]


def test_terms_are_lowercased_de_pluralized_and_stopworded():
    assert matching.terms("The Startups and the Behaviour") == {"startup", "behaviour"}
    assert matching.terms("is") == set()
    assert matching.terms("") == set()


def test_queries_come_from_recurring_tags_only():
    items = ARCHIVE + [
        _item("private", title="Niche", tags=("astrophotography",)),
        _item("almost-private", title="Also niche", tags=("astrophotography",)),
        _item("habits", title="Habits", tags=("behaviour",)),
    ]

    # A tag one article uses is that article's private label, not a theme.
    assert matching.build_queries(items) == ["astrophotography", "behaviour", "investing"]


def test_queries_honor_an_explicit_override_verbatim():
    assert matching.build_queries(ARCHIVE, override=[" prediction markets ", "", "index funds"]) == [
        "prediction markets",
        "index funds",
    ]


def test_scoring_prefers_the_article_that_shares_the_most_specific_terms():
    match = matching.match_candidate(
        _candidate(title="Why nobody prices tail risk in investing"),
        ARCHIVE,
        min_score=2,
    )

    assert match is not None
    assert match.item.content_id == "market-failure"
    assert match.score > 0
    assert "risk" in match.matched_terms


def test_prose_overlap_alone_never_qualifies_a_pairing():
    # "thinking" and "finished" appear only in the article's prose, so sharing
    # them says nothing about whether the conversation covers the same ground.
    assert matching.terms("thinking finished") & matching.terms(ARCHIVE[2].title) == set()
    assert matching.match_candidate(_candidate(title="Thinking gets finished"), ARCHIVE, min_score=3) is None


def test_candidates_below_the_threshold_are_dropped_entirely():
    assert matching.rank_candidates([_candidate(title="Thinking gets finished")], ARCHIVE, min_score=3) == []


def test_a_long_summary_cannot_outscore_a_specific_title_pairing():
    long_prose = _item(
        "verbose",
        title="Unrelated title about gardening",
        tags=("gardening",),
        summary="investing risk behaviour " * 40,
    )
    specific = _item("specific", title="Investing risk", tags=("investing",), summary="")

    generic_score, _ = matching.score_item(matching.terms("investing risk behaviour"), long_prose)
    specific_score, _ = matching.score_item(matching.terms("investing risk behaviour"), specific)

    assert generic_score == 0
    assert specific_score > generic_score


def test_ranking_is_stable_regardless_of_the_order_sources_returned():
    first = _candidate("https://news.ycombinator.com/item?id=1", title="Investing risk")
    second = _candidate("https://news.ycombinator.com/item?id=2", title="Investing risk")

    forward = matching.rank_candidates([first, second], ARCHIVE)
    backward = matching.rank_candidates([second, first], ARCHIVE)

    assert [match.key for match in forward] == [match.key for match in backward]
    assert len(forward) == 2


def test_pairing_is_repeatable_for_the_same_candidate():
    match = matching.match_candidate(_candidate(title="Investing behaviour and risk"), ARCHIVE, min_score=3)

    assert match is not None
    again = matching.match_candidate(_candidate(title="Investing behaviour and risk"), ARCHIVE, min_score=3)
    assert match.item.content_id == again.item.content_id


def test_match_score_environment_override_is_used_or_rejected(monkeypatch):
    monkeypatch.delenv("SCOUT_MIN_MATCH_SCORE", raising=False)
    assert matching.min_match_score() == matching.DEFAULT_MIN_MATCH_SCORE

    monkeypatch.setenv("SCOUT_MIN_MATCH_SCORE", "7")
    assert matching.min_match_score() == 7
    assert matching.rank_candidates([_candidate(title="Investing risk")], ARCHIVE) == []

    monkeypatch.setenv("SCOUT_MIN_MATCH_SCORE", "high")
    with pytest.raises(ScoutError):
        matching.min_match_score()


def test_query_limit_is_configurable_and_never_zero(monkeypatch):
    monkeypatch.delenv("SCOUT_QUERY_LIMIT", raising=False)
    assert matching.query_limit() == matching.DEFAULT_QUERY_LIMIT

    monkeypatch.setenv("SCOUT_QUERY_LIMIT", "2")
    assert matching.query_limit() == 2

    monkeypatch.setenv("SCOUT_QUERY_LIMIT", "0")
    assert matching.query_limit() == 1

    monkeypatch.setenv("SCOUT_QUERY_LIMIT", "many")
    with pytest.raises(ScoutError):
        matching.query_limit()
