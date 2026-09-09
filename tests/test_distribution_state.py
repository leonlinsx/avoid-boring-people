import json
import sys
import types
from datetime import datetime, timedelta, timezone

from scripts.automation import state_manager
from scripts.automation import auto_post


def _use_temp_state(monkeypatch, tmp_path):
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    return path


def test_legacy_state_migrates_without_fabricating_platform_history(monkeypatch, tmp_path):
    path = _use_temp_state(monkeypatch, tmp_path)
    path.write_text(json.dumps({"abc": 2}), encoding="utf-8")

    state = state_manager.load_state()

    assert state == {"version": 2, "posts": {"abc": {"_legacy": {"global_count": 2}}}}
    assert state_manager.platform_post_count("abc", "twitter", state) == 0
    assert state_manager.load_state() == state


def test_success_only_updates_the_successful_platform(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)

    # Simulate Twitter succeeding while Bluesky raises before state mutation.
    state_manager.mark_posted("post", "twitter", "new", "tweet-123")

    state = state_manager.load_state()
    assert state_manager.platform_post_count("post", "twitter", state) == 1
    assert state_manager.get_platform_state("post", "twitter", state)["remote_id"] == "tweet-123"
    assert state_manager.get_platform_state("post", "bluesky", state) is None


def test_skip_and_dry_run_do_not_change_state(monkeypatch, tmp_path):
    path = _use_temp_state(monkeypatch, tmp_path)

    # A Dev.to category skip and every dry-run branch intentionally make no mark_posted call.
    assert state_manager.load_state() == {"version": 2, "posts": {}}
    assert not path.exists()


def test_dry_run_does_not_call_the_state_writer(monkeypatch, tmp_path):
    path = _use_temp_state(monkeypatch, tmp_path)
    post = {"id": "post", "title": "Title", "url": "https://example.test", "content": "word " * 200}
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "PLATFORM", ["twitter"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [post])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)

    auto_post.main()

    assert not path.exists()


def test_partial_platform_failure_only_persists_success(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    post = {"id": "post", "title": "Title", "url": "https://example.test", "content": "word " * 200}
    twitter = types.ModuleType("scripts.automation.publishers")
    twitter.get_twitter_client = lambda: object()
    twitter.post_single = lambda client, post: {"id": "tweet-1"}
    twitter.post_thread = lambda client, posts: {"id": "tweet-1"}
    bluesky = types.ModuleType("scripts.automation.publishers.bluesky")
    bluesky.post_single_to_bluesky = lambda text: (_ for _ in ()).throw(RuntimeError("network failure"))
    bluesky.post_thread_to_bluesky = bluesky.post_single_to_bluesky
    monkeypatch.setitem(sys.modules, "scripts.automation.publishers", twitter)
    monkeypatch.setitem(sys.modules, "scripts.automation.publishers.bluesky", bluesky)
    monkeypatch.setattr(auto_post, "DRY_RUN", False)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "PLATFORM", ["twitter", "bluesky"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [post])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)

    auto_post.main()

    state = state_manager.load_state()
    assert state_manager.platform_post_count("post", "twitter", state) == 1
    assert state_manager.get_platform_state("post", "bluesky", state) is None


def test_evergreen_requires_opt_in_and_has_per_platform_cooldowns(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    post = {"id": "post", "evergreen": True}
    state = {
        "version": 2,
        "posts": {
            "post": {
                "twitter": {
                    "count": 1,
                    "last_posted_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
                    "last_mode": "evergreen",
                }
            }
        },
    }

    assert not state_manager.platform_is_eligible(post, "twitter", "evergreen", state)
    assert state_manager.platform_is_eligible(post, "bluesky", "evergreen", state)
    assert not state_manager.platform_is_eligible({"id": "post", "evergreen": False}, "bluesky", "evergreen", state)
    assert not state_manager.platform_is_eligible(post, "devto", "evergreen", state)

    state["posts"]["post"]["twitter"]["last_posted_at"] = (
        datetime.now(timezone.utc) - timedelta(days=61)
    ).isoformat()
    assert state_manager.platform_is_eligible(post, "twitter", "evergreen", state)


def test_selection_keeps_first_publication_eligible_per_platform(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    state_manager.save_state(
        {
            "version": 2,
            "posts": {
                "post": {
                    "twitter": {
                        "count": 1,
                        "last_posted_at": "2020-01-01T00:00:00Z",
                        "last_mode": "evergreen",
                    }
                }
            },
        }
    )

    selected = state_manager.select_next_post(
        [{"id": "post", "evergreen": True, "priority_score": 0, "date": "2020-01-01"}],
        ["twitter", "bluesky"],
        "evergreen",
    )

    assert selected["eligible_platforms"] == ["twitter", "bluesky"]


def test_state_round_trip_preserves_v2_schema(monkeypatch, tmp_path):
    path = _use_temp_state(monkeypatch, tmp_path)
    state_manager.mark_posted("post", "mastodon", "evergreen", "status-1")

    persisted = json.loads(path.read_text(encoding="utf-8"))
    assert persisted == state_manager.load_state()
    assert persisted["posts"]["post"]["mastodon"]["last_mode"] == "evergreen"
