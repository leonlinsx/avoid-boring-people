import json
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote
from types import SimpleNamespace

import pytest

from scripts.scout import discovery
from scripts.scout.errors import ScoutError

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)


def candidate_urls(candidates):
    return [candidate.external_url for candidate in candidates]


def _hn_hit(**overrides):
    hit = {
        "objectID": "12345",
        "title": "Why prediction markets are badly calibrated",
        "story_text": "",
        "url": "https://example.test/post",
        "author": "someone",
        "created_at": (NOW - timedelta(days=1)).isoformat(),
        "num_comments": 42,
    }
    hit.update(overrides)
    return hit


def test_clean_text_resolves_entities_and_strips_markup():
    assert discovery.clean_text("<p>hello&nbsp;<b>world</b>\n\nagain</p>") == "hello world again"


def test_hacker_news_candidate_names_the_link_when_a_story_has_no_text():
    candidate = discovery.hacker_news_candidate(_hn_hit(story_text=""))

    assert candidate.external_url == "https://news.ycombinator.com/item?id=12345"
    assert candidate.body == "Link post to https://example.test/post"
    assert candidate.activity == 42
    assert candidate.community == "Hacker News"


def test_hacker_news_candidate_is_none_when_there_is_nothing_to_read():
    assert discovery.hacker_news_candidate(_hn_hit(objectID="")) is None
    assert discovery.hacker_news_candidate(_hn_hit(title="", story_text="", url="")) is None


def test_hacker_news_candidate_leaves_an_undateable_story_undated():
    candidate = discovery.hacker_news_candidate(_hn_hit(created_at="not a date"))

    # An empty timestamp is what the age gate refuses, so a story Scout cannot
    # date can never be presented as fresh.
    assert candidate.published_at == ""
    assert not discovery._fresh_enough(candidate.published_at, NOW, 7)


def test_search_hacker_news_reads_both_rankings_and_dedupes_the_overlap(monkeypatch):
    requested = []

    def fake_fetch(url, timeout):
        requested.append(url)
        if "search_by_date" in url:
            return {"hits": [_hn_hit(), _hn_hit(objectID="99999", title="A fresh thread", num_comments=0)]}
        return {"hits": [_hn_hit()]}

    monkeypatch.setattr(discovery, "_fetch_json", fake_fetch)

    candidates = discovery.search_hacker_news("prediction markets", now=NOW, max_age_days=7)

    assert [candidate.external_url for candidate in candidates] == [
        "https://news.ycombinator.com/item?id=12345",
        "https://news.ycombinator.com/item?id=99999",
    ]
    assert len(requested) == 2
    assert all("created_at_i>" in unquote(url) for url in requested)
    assert all("tags=story" in unquote(url) for url in requested)


def test_search_hacker_news_drops_candidates_older_than_the_window(monkeypatch):
    old = (NOW - timedelta(days=30)).isoformat()
    monkeypatch.setattr(
        discovery, "_fetch_json", lambda url, timeout: {"hits": [_hn_hit(created_at=old), _hn_hit(objectID="2")]}
    )

    candidates = discovery.search_hacker_news("q", now=NOW, max_age_days=7)

    assert [candidate.external_url for candidate in candidates] == ["https://news.ycombinator.com/item?id=2"]


def test_search_hacker_news_drops_stories_it_cannot_date(monkeypatch):
    monkeypatch.setattr(discovery, "_fetch_json", lambda url, timeout: {"hits": [_hn_hit(created_at=None)]})

    # The recency prefilter needs a date, so a story without one is not "new".
    assert discovery.search_hacker_news("q", now=NOW, max_age_days=7) == []


def test_a_source_body_that_is_not_json_is_rejected_with_its_reason(monkeypatch):
    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b"<html>upstream is moving</html>"

    monkeypatch.setattr(discovery, "urlopen", lambda request, timeout: _Response())

    with pytest.raises(ScoutError) as error:
        discovery._fetch_json("https://hn.test/api", 5)

    assert "did not answer with JSON" in str(error.value)


def test_search_hacker_news_survives_one_ranking_failing(monkeypatch):
    def fake_fetch(url, timeout):
        if "search_by_date" in url:
            raise ScoutError("❌ boom")
        return {"hits": [_hn_hit()]}

    monkeypatch.setattr(discovery, "_fetch_json", fake_fetch)

    assert len(discovery.search_hacker_news("q", now=NOW, max_age_days=7)) == 1


def test_search_hacker_news_raises_only_when_both_rankings_fail(monkeypatch):
    monkeypatch.setattr(discovery, "_fetch_json", lambda url, timeout: (_ for _ in ()).throw(ScoutError("❌ boom")))

    with pytest.raises(ScoutError):
        discovery.search_hacker_news("q", now=NOW, max_age_days=7)


def test_bluesky_candidate_skips_replies_and_builds_the_public_url():
    reply = SimpleNamespace(
        uri="at://did:plc:x/app.bsky.feed.post/abc",
        author=SimpleNamespace(handle="alice.test"),
        record=SimpleNamespace(text="I agree", created_at=(NOW - timedelta(hours=2)).isoformat(), reply=object()),
        reply_count=3,
    )
    root = SimpleNamespace(
        uri="at://did:plc:x/app.bsky.feed.post/abc",
        author=SimpleNamespace(handle="alice.test"),
        record=SimpleNamespace(text="A measured claim about indexing", created_at=(NOW - timedelta(hours=2)).isoformat()),
        reply_count=3,
    )

    assert discovery.bluesky_candidate(reply) is None
    candidate = discovery.bluesky_candidate(root)
    assert candidate.external_url == "https://bsky.app/profile/alice.test/post/abc"
    assert candidate.activity == 3
    assert candidate.published_at.startswith("2026-09-18")


def test_bluesky_candidate_is_none_without_a_handle_or_text():
    empty = SimpleNamespace(uri="at://x/1", author=SimpleNamespace(handle=""), record=SimpleNamespace(text="hi"))
    assert discovery.bluesky_candidate(empty) is None


def test_discovery_reports_each_source_and_keeps_going_when_one_fails(monkeypatch):
    monkeypatch.setattr(
        discovery, "search_hacker_news", lambda query, **kwargs: [discovery.hacker_news_candidate(_hn_hit())]
    )

    def broken_bluesky(query, **kwargs):
        raise ScoutError("❌ bluesky search failed")

    monkeypatch.setattr(discovery, "search_bluesky", broken_bluesky)
    monkeypatch.setattr(discovery, "bluesky_configured", lambda: True)

    result = discovery.discover(("q1", "q2"), now=NOW, per_query_limit=5, max_age_days=7, timeout=5)

    assert result.any_source_ok
    assert [report.source for report in result.sources] == ["hacker-news", "bluesky"]
    assert [report.found for report in result.sources] == [1, 0]
    assert result.sources[1].attempted and not result.sources[1].ok
    assert "ScoutError" in result.sources[1].note
    assert len(result.candidates) == 1


def test_discovery_skips_an_unconfigured_source_without_failing(monkeypatch):
    monkeypatch.setattr(discovery, "search_hacker_news", lambda query, **kwargs: [])
    monkeypatch.setattr(discovery, "bluesky_configured", lambda: False)

    result = discovery.discover(("q",), now=NOW, per_query_limit=5, max_age_days=7, timeout=5)

    bluesky_report = result.sources[1]
    assert bluesky_report.attempted is False and bluesky_report.ok is False
    assert "BLUESKY_HANDLE" in bluesky_report.note
    # A source that was never asked contributes nothing but must not fail the run.
    assert result.any_source_ok and result.candidates == ()


def test_discovery_reports_every_source_failing(monkeypatch):
    def broken(query, **kwargs):
        raise ScoutError("❌ down")

    monkeypatch.setattr(discovery, "search_hacker_news", broken)
    monkeypatch.setattr(discovery, "search_bluesky", broken)
    monkeypatch.setattr(discovery, "bluesky_configured", lambda: True)

    result = discovery.discover(("q",), now=NOW, per_query_limit=5, max_age_days=7, timeout=5)

    assert not result.any_source_ok
    assert all(report.attempted for report in result.sources)


def test_discovery_dedupes_the_same_conversation_across_queries(monkeypatch):
    monkeypatch.setattr(
        discovery,
        "search_hacker_news",
        lambda query, **kwargs: [discovery.hacker_news_candidate(_hn_hit())],
    )
    monkeypatch.setattr(discovery, "bluesky_configured", lambda: False)

    result = discovery.discover(("a", "b"), now=NOW, per_query_limit=5, max_age_days=7, timeout=5)

    assert len(result.candidates) == 1
    assert result.queries == ("a", "b")


def test_environment_overrides_are_read_or_rejected(monkeypatch):
    monkeypatch.delenv("SCOUT_PER_QUERY_LIMIT", raising=False)
    monkeypatch.delenv("SCOUT_TIMEOUT_SECONDS", raising=False)
    assert discovery.per_query_limit() == discovery.DEFAULT_PER_QUERY_LIMIT
    assert discovery.timeout_seconds() == discovery.DEFAULT_TIMEOUT_SECONDS

    monkeypatch.setenv("SCOUT_PER_QUERY_LIMIT", "3")
    monkeypatch.setenv("SCOUT_TIMEOUT_SECONDS", "5")
    assert (discovery.per_query_limit(), discovery.timeout_seconds()) == (3, 5)

    monkeypatch.setenv("SCOUT_PER_QUERY_LIMIT", "lots")
    with pytest.raises(ScoutError):
        discovery.per_query_limit()


def test_search_bluesky_uses_the_authenticated_client(monkeypatch):
    posts = [
        SimpleNamespace(
            uri="at://did:plc:x/app.bsky.feed.post/abc123",
            author=SimpleNamespace(handle="alice.test"),
            record=SimpleNamespace(text="A claim about prediction markets", created_at=NOW.isoformat()),
            reply_count=4,
        )
    ]
    calls = {}

    class FakeFeed:
        def search_posts(self, params):
            calls["params"] = params
            return SimpleNamespace(posts=posts)

    class FakeApp:
        bsky = SimpleNamespace(feed=FakeFeed())

    class FakeClient:
        def __init__(self, request=None):
            calls["request"] = request

        def login(self, handle, password):
            calls["login"] = (handle, password)

        app = FakeApp()

    fake_atproto = SimpleNamespace(Client=FakeClient)
    fake_request = SimpleNamespace(Request=lambda **kwargs: ("request", kwargs))
    monkeypatch.setitem(__import__("sys").modules, "atproto", fake_atproto)
    monkeypatch.setitem(__import__("sys").modules, "atproto_client.request", fake_request)
    monkeypatch.setenv("BLUESKY_HANDLE", "leon.test")
    monkeypatch.setenv("BLUESKY_PASSWORD", "app-password")

    candidates = discovery.search_bluesky("prediction markets", now=NOW, limit=5, max_age_days=7, timeout=9)

    assert calls["login"] == ("leon.test", "app-password")
    assert calls["request"] == ("request", {"timeout": 9})
    assert calls["params"] == {"q": "prediction markets", "limit": 5, "sort": "latest"}
    assert candidate_urls(candidates) == ["https://bsky.app/profile/alice.test/post/abc123"]


def test_search_bluesky_refuses_to_run_unconfigured(monkeypatch):
    monkeypatch.delenv("BLUESKY_HANDLE", raising=False)
    monkeypatch.delenv("BLUESKY_PASSWORD", raising=False)

    with pytest.raises(ScoutError):
        discovery.search_bluesky("q", now=NOW, limit=5, max_age_days=7, timeout=5)


def test_fetch_json_error_is_a_scout_error(monkeypatch):
    import urllib.error

    def raise_http(*args, **kwargs):
        raise urllib.error.HTTPError("https://example.test", 403, "Forbidden", {}, None)

    monkeypatch.setattr(discovery, "urlopen", raise_http)

    with pytest.raises(ScoutError) as error:
        discovery._fetch_json("https://example.test", 5)
    assert "403" in str(error.value)


def test_candidate_payloads_are_serializable_for_logging():
    candidate = discovery.hacker_news_candidate(_hn_hit())

    assert json.loads(json.dumps(candidate.__dict__))["source"] == "hacker-news"
