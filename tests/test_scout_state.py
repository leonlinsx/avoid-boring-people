import json
from datetime import datetime, timedelta, timezone

import pytest

from scripts.scout import state
from scripts.scout.errors import ScoutError

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)


def test_missing_state_file_starts_empty_without_creating_one(use_temp_scout_state):
    path = use_temp_scout_state

    assert state.load_state() == {"version": 1, "opportunities": {}}
    assert not path.exists()


def test_urls_differing_only_in_tracking_are_the_same_conversation():
    assert state.normalize_url(
        "https://News.YCombinator.com/item?id=1&utm_source=mail&utm_medium=email#frag"
    ) == state.normalize_url("https://news.ycombinator.com/item?id=1")
    assert state.normalize_url("https://leonlins.com/writing/foo/") == state.normalize_url(
        "https://leonlins.com/writing/foo"
    )
    assert state.normalize_url("https://bsky.app/profile/a/post/b") != state.normalize_url(
        "https://bsky.app/profile/a/post/c"
    )


def test_recording_the_same_url_twice_keeps_one_row_and_the_first_surface_time(use_temp_scout_state):
    state_data = state.load_state()

    assert state.record_surfaced(
        state_data,
        url="https://news.ycombinator.com/item?id=1",
        source="hacker-news",
        content_id="a",
        draft="first",
        now=NOW,
    )
    assert not state.record_surfaced(
        state_data,
        url="https://news.ycombinator.com/item?id=1&utm_medium=email",
        source="hacker-news",
        content_id="b",
        draft="second",
        now=NOW + timedelta(days=1),
    )

    opportunities = state_data["opportunities"]
    assert list(opportunities) == ["https://news.ycombinator.com/item?id=1"]
    entry = opportunities["https://news.ycombinator.com/item?id=1"]
    assert entry["surfaced_at"].startswith("2026-09-18")
    assert entry["content_id"] == "a"
    assert entry["draft"] == "first"
    assert entry["status"] == state.STATUS_SURFACED


def test_recorded_urls_include_every_status(use_temp_scout_state):
    state_data = state.empty_state()
    state.record_surfaced(
        state_data, url="https://example.test/a", source="hacker-news", content_id="a", draft="d", now=NOW
    )
    assert state.set_status(state_data, "https://example.test/a", state.STATUS_ACTED, now=NOW)

    assert state.recorded_urls(state_data) == {"https://example.test/a"}


def test_status_change_on_an_unknown_url_reports_failure_instead_of_inventing_a_row():
    state_data = state.empty_state()

    assert state.set_status(state_data, "https://example.test/nope", state.STATUS_DISMISSED) is False
    assert state_data["opportunities"] == {}


def test_status_change_refuses_an_unknown_status(use_temp_scout_state):
    state_data = state.empty_state()
    state.record_surfaced(
        state_data, url="https://example.test/a", source="hacker-news", content_id="a", draft="d", now=NOW
    )

    with pytest.raises(ScoutError):
        state.set_status(state_data, "https://example.test/a", "maybe")


def test_acted_records_when_and_what_came_of_it(use_temp_scout_state):
    state_data = state.empty_state()
    state.record_surfaced(
        state_data, url="https://example.test/a", source="hacker-news", content_id="a", draft="d", now=NOW
    )

    assert state.set_status(state_data, "https://example.test/a", state.STATUS_ACTED, now=NOW, outcome="reply posted")

    entry = state_data["opportunities"]["https://example.test/a"]
    assert entry["status"] == state.STATUS_ACTED
    assert entry["acted_at"].startswith("2026-09-18")
    assert entry["outcome"] == "reply posted"


def test_expiry_touches_only_stale_surfaced_rows_and_forgets_nothing(use_temp_scout_state):
    state_data = state.empty_state()
    stale = "https://example.test/stale"
    fresh = "https://example.test/fresh"
    dismissed = "https://example.test/dismissed"
    for url, moment in ((stale, NOW - timedelta(days=30)), (fresh, NOW - timedelta(days=2)), (dismissed, NOW - timedelta(days=30))):
        state.record_surfaced(
            state_data, url=url, source="hacker-news", content_id="a", draft="d", now=moment
        )
    state.set_status(state_data, dismissed, state.STATUS_DISMISSED)

    expired = state.expire_stale(state_data, now=NOW, after_days=14)

    assert expired == 1
    assert state_data["opportunities"][stale]["status"] == state.STATUS_EXPIRED
    assert state_data["opportunities"][fresh]["status"] == state.STATUS_SURFACED
    assert state_data["opportunities"][dismissed]["status"] == state.STATUS_DISMISSED
    assert set(state_data["opportunities"]) == {stale, fresh, dismissed}


def test_expiry_leaves_a_row_whose_timestamp_cannot_be_read(use_temp_scout_state):
    state_data = state.empty_state()
    state.record_surfaced(
        state_data, url="https://example.test/a", source="hacker-news", content_id="a", draft="d", now=NOW
    )
    state_data["opportunities"]["https://example.test/a"]["surfaced_at"] = "whenever"

    assert state.expire_stale(state_data, now=NOW, after_days=14) == 0
    assert state_data["opportunities"]["https://example.test/a"]["status"] == state.STATUS_SURFACED


def test_malformed_state_is_an_error_rather_than_a_forgotten_history(use_temp_scout_state):
    path = use_temp_scout_state
    path.write_text(json.dumps({"version": 1, "opportunities": ["nope"]}), encoding="utf-8")

    with pytest.raises(ScoutError):
        state.load_state()


def test_state_round_trips_through_disk(use_temp_scout_state):
    state_data = state.load_state()
    state.record_surfaced(
        state_data, url="https://example.test/a", source="hacker-news", content_id="a", draft="d", now=NOW
    )

    state.save_state(state_data)

    assert state.load_state() == state_data


@pytest.mark.parametrize("raw", ["soon", "0", "-3"])
def test_expire_days_env_rejects_nonsense_or_clamps_it(monkeypatch, raw):
    monkeypatch.setenv("SCOUT_EXPIRE_DAYS", raw)
    if raw == "soon":
        with pytest.raises(ScoutError):
            state.expire_stale(state.empty_state(), now=NOW)
    else:
        assert state.expire_stale(state.empty_state(), now=NOW) == 0


def test_surfaced_context_is_kept_so_a_reader_can_see_what_the_row_was(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    state_data = state.empty_state()

    state.record_surfaced(
        state_data,
        url="https://news.ycombinator.com/item?id=1",
        source="hacker-news",
        content_id="2019_11_23_premortem/index.md",
        draft="draft body",
        thread_title="Anyone still doing pre-mortems?",
        content_title="The pre-mortem that saved the migration",
        content_url="/writing/premortem/",
        why_now="The thread is two days old with 120 replies and no pre-mortem answer.",
        now=NOW,
    )

    entry = state_data["opportunities"]["https://news.ycombinator.com/item?id=1"]
    assert entry["thread_title"] == "Anyone still doing pre-mortems?"
    assert entry["content_title"] == "The pre-mortem that saved the migration"
    assert entry["content_url"] == "https://leonlins.com/writing/premortem/"
    assert entry["why_now"].startswith("The thread is two days old")


def test_context_that_scout_did_not_have_is_not_written(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    state_data = state.empty_state()

    state.record_surfaced(
        state_data, url="https://example.test/a", source="hacker-news", content_id="a", draft="d", now=NOW
    )

    entry = state_data["opportunities"]["https://example.test/a"]
    assert not {"thread_title", "content_title", "content_url", "why_now"} & set(entry)


def test_absolute_content_url_keeps_a_public_url_and_builds_a_relative_one():
    assert state.absolute_content_url("https://leonlins.com/writing/foo/") == "https://leonlins.com/writing/foo/"
    assert state.absolute_content_url("/writing/foo/") == "https://leonlins.com/writing/foo/"
    assert state.absolute_content_url("writing/foo/") == "https://leonlins.com/writing/foo/"
    assert state.absolute_content_url(None) == ""


def test_rows_written_before_the_context_fields_still_read_and_expire(monkeypatch, tmp_path):
    path = _use_temp_state(monkeypatch, tmp_path)
    legacy_url = "https://example.test/legacy"
    path.write_text(
        json.dumps(
            {
                "version": 1,
                "opportunities": {
                    legacy_url: {
                        "external_url": legacy_url,
                        "source": "hacker-news",
                        "content_id": "a",
                        "status": state.STATUS_SURFACED,
                        "draft": "d",
                        "discovered_at": (NOW - timedelta(days=30)).isoformat(),
                        "surfaced_at": (NOW - timedelta(days=30)).isoformat(),
                        "acted_at": None,
                        "outcome": None,
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    state_data = state.load_state()

    assert "thread_title" not in state_data["opportunities"][legacy_url]
    assert state.expire_stale(state_data, now=NOW, after_days=14) == 1
    assert state_data["opportunities"][legacy_url]["status"] == state.STATUS_EXPIRED
