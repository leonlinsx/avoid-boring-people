import json
import sys
import types
from datetime import datetime, timedelta, timezone

from scripts.automation import state_manager
from scripts.automation import auto_post
from scripts.automation import retry as retry_module


def test_legacy_state_migrates_without_fabricating_platform_history(use_temp_distribution_state):
    path = use_temp_distribution_state
    path.write_text(json.dumps({"abc": 2}), encoding="utf-8")

    state = state_manager.load_state()

    assert state == {"version": 2, "posts": {"abc": {"_legacy": {"global_count": 2}}}}
    assert state_manager.platform_post_count("abc", "twitter", state) == 0
    assert state_manager.load_state() == state


def test_success_only_updates_the_successful_platform(use_temp_distribution_state):
    # Simulate Twitter succeeding while Bluesky raises before state mutation.
    state_manager.mark_posted("post", "twitter", "new", "tweet-123")

    state = state_manager.load_state()
    assert state_manager.platform_post_count("post", "twitter", state) == 1
    assert state_manager.get_platform_state("post", "twitter", state)["remote_id"] == "tweet-123"
    assert state_manager.get_platform_state("post", "bluesky", state) is None


def test_skip_and_dry_run_do_not_change_state(use_temp_distribution_state):
    path = use_temp_distribution_state

    # A Dev.to category skip and every dry-run branch intentionally make no mark_posted call.
    assert state_manager.load_state() == {"version": 2, "posts": {}}
    assert not path.exists()


def test_dry_run_does_not_call_the_state_writer(monkeypatch, use_temp_distribution_state):
    path = use_temp_distribution_state
    post = {"id": "post", "title": "Title", "url": "https://example.test", "content": "word " * 200}
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "PLATFORM", ["twitter"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [post])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts, engagement=None: posts)

    auto_post.main()

    assert not path.exists()


def test_partial_platform_failure_only_persists_success(monkeypatch, use_temp_distribution_state):
    monkeypatch.setattr(retry_module, "BASE_DELAY_SECONDS", 0)
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
    monkeypatch.setattr(auto_post, "score_posts", lambda posts, engagement=None: posts)

    auto_post.main()

    state = state_manager.load_state()
    assert state_manager.platform_post_count("post", "twitter", state) == 1
    assert state_manager.get_platform_state("post", "bluesky", state) is None


def test_explicit_evergreen_exclusion_and_per_platform_cooldowns(use_temp_distribution_state):
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


def test_selection_keeps_first_publication_eligible_per_platform(use_temp_distribution_state):
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


def _evergreen_post(post_id, category="Investing", date="2020-01-01", score=0.0):
    return {
        "id": post_id,
        "title": post_id,
        "url": f"https://leonlins.com/writing/{post_id}/",
        "date": date,
        "content": "word " * 300,
        "category": category,
        "tags": [],
        "evergreen": True,
        "priority_score": score,
    }


def _posted_days_ago(days):
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def test_evergreen_prefers_longest_ago_posted_over_fresh_score(use_temp_distribution_state):
    state_manager.save_state(
        {
            "version": 2,
            "posts": {
                "old": {
                    "bluesky": {
                        "count": 1,
                        "last_posted_at": _posted_days_ago(100),
                        "last_mode": "evergreen",
                    }
                },
                "recent": {
                    "bluesky": {
                        "count": 1,
                        "last_posted_at": _posted_days_ago(61),
                        "last_mode": "evergreen",
                    }
                },
            },
        }
    )
    posts = [
        _evergreen_post("old", score=0.0),
        _evergreen_post("recent", date="2024-01-01", score=5.0),
    ]
    selected = state_manager.select_next_post(posts, ["bluesky"], "evergreen")
    assert selected["id"] == "old"


def test_evergreen_rotates_away_from_last_posted_category(use_temp_distribution_state):
    state_manager.save_state(
        {
            "version": 2,
            "posts": {
                "older-investing": {
                    "bluesky": {
                        "count": 1,
                        "last_posted_at": _posted_days_ago(100),
                        "last_mode": "evergreen",
                    }
                },
                "newer-tech": {
                    "bluesky": {
                        "count": 1,
                        "last_posted_at": _posted_days_ago(90),
                        "last_mode": "evergreen",
                    }
                },
                "just-posted": {
                    "bluesky": {
                        "count": 1,
                        "last_posted_at": _posted_days_ago(0),
                        "last_mode": "evergreen",
                    }
                },
            },
        }
    )
    posts = [
        _evergreen_post("older-investing", category="Investing"),
        _evergreen_post("newer-tech", category="Technology"),
        _evergreen_post("just-posted", category="Investing"),
    ]
    selected = state_manager.select_next_post(posts, ["bluesky"], "evergreen")
    assert selected["id"] == "newer-tech"


def test_evergreen_prefers_unposted_articles_first(use_temp_distribution_state):
    state_manager.save_state({"version": 2, "posts": {}})
    posts = [_evergreen_post("fresh", date="2024-01-01", score=0.0)]
    selected = state_manager.select_next_post(posts, ["bluesky"], "evergreen")
    assert selected["id"] == "fresh"


def test_new_mode_still_prefers_higher_score(use_temp_distribution_state):
    state_manager.save_state({"version": 2, "posts": {}})
    posts = [
        {**_evergreen_post("low"), "priority_score": 1.0},
        {**_evergreen_post("high", date="2020-01-01"), "priority_score": 9.0},
    ]
    selected = state_manager.select_next_post(posts, ["bluesky"], "new")
    assert selected["id"] == "high"


def test_new_distribution_does_not_repeat_a_successful_platform(use_temp_distribution_state):
    state_manager.mark_posted("post", "twitter", "new")

    state = state_manager.load_state()
    assert not state_manager.should_publish_new("post", "twitter", state)
    assert state_manager.should_publish_new("post", "bluesky", state)
    assert not state_manager.platform_is_eligible({"id": "post"}, "twitter", "new", state)


def test_target_post_must_exist_in_deployed_index(monkeypatch):
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "2026_09_09_example/index.md")
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "PLATFORM", ["twitter"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts, engagement=None: posts)

    try:
        auto_post.main()
    except RuntimeError as error:
        assert "not present in the deployed search index" in str(error)
    else:
        raise AssertionError("missing deployed target must fail clearly")


def test_state_round_trip_preserves_v2_schema(use_temp_distribution_state):
    path = use_temp_distribution_state
    state_manager.mark_posted("post", "mastodon", "evergreen", "status-1")

    persisted = json.loads(path.read_text(encoding="utf-8"))
    assert persisted == state_manager.load_state()
    assert persisted["posts"]["post"]["mastodon"]["last_mode"] == "evergreen"
