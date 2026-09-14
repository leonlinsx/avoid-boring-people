"""Public engagement ledger: collect counts, attribute copy, inform ranking."""
import json

import pytest

from scripts.automation import engagement
from scripts.automation.engagement import (
    bluesky_counts,
    collect,
    devto_counts,
    engagement_totals,
    farcaster_counts,
    load_engagement,
    mastodon_counts,
    save_engagement,
    total_interactions,
)
from scripts.automation.ranking import score_posts
from scripts.automation.state_manager import mark_posted


def _post(post_id="post-1", **overrides):
    post = {
        "id": post_id,
        "title": "Title",
        "url": "https://leonlins.com/writing/x/",
        "date": "2024-01-01T00:00:00.000Z",
        "content": "word " * 300,
        "category": "Investing",
        "tags": [],
    }
    post.update(overrides)
    return post


def test_ledger_round_trip_and_missing_file(tmp_path):
    path = tmp_path / "engagement.json"
    assert load_engagement(path) == {"version": 1, "observations": {}}
    ledger = {
        "version": 1,
        "observations": {
            "post-1": {
                "bluesky": {
                    "counts": {"likes": 3},
                    "collected_at": "2024-02-01T00:00:00Z",
                }
            }
        },
    }
    save_engagement(ledger, path)
    assert load_engagement(path) == ledger


def test_bluesky_counts_parse(monkeypatch):
    payload = {
        "posts": [
            {
                "likeCount": 5,
                "repostCount": 2,
                "replyCount": 1,
                "quoteCount": 0,
            }
        ]
    }
    monkeypatch.setattr(engagement, "fetch_json", lambda url, headers=None: payload)
    assert bluesky_counts("at://did:plc:x/app.bsky.feed.post/abc") == {
        "likes": 5,
        "reposts": 2,
        "replies": 1,
        "quotes": 0,
    }


def test_bluesky_counts_empty_posts_raise(monkeypatch):
    monkeypatch.setattr(engagement, "fetch_json", lambda url, headers=None: {"posts": []})
    with pytest.raises(ValueError):
        bluesky_counts("at://did:plc:x/app.bsky.feed.post/abc")


def test_mastodon_counts_parse(monkeypatch):
    payload = {"favourites_count": 4, "reblogs_count": 1, "replies_count": 2}
    monkeypatch.setattr(engagement, "fetch_json", lambda url, headers=None: payload)
    assert mastodon_counts("https://instance.example", "token", "123") == {
        "likes": 4,
        "reposts": 1,
        "replies": 2,
    }


def test_farcaster_counts_parse(monkeypatch):
    payload = {
        "cast": {
            "reactions": {"likes_count": 7, "recasts_count": 3},
            "replies": {"count": 1},
        }
    }
    monkeypatch.setattr(engagement, "fetch_json", lambda url, headers=None: payload)
    assert farcaster_counts("key", "0xabc") == {"likes": 7, "reposts": 3, "replies": 1}


def test_devto_counts_parse(monkeypatch):
    payload = {
        "public_reactions_count": 9,
        "comments_count": 2,
        "page_views_count": 120,
    }
    monkeypatch.setattr(engagement, "fetch_json", lambda url, headers=None: payload)
    assert devto_counts("key", "42") == {"likes": 9, "replies": 2, "views": 120}


def test_collect_records_counts_and_skips_gracefully(monkeypatch):
    monkeypatch.setattr(
        engagement, "bluesky_counts", lambda uri: {"likes": 6, "reposts": 1}
    )

    def boom(*args, **kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(engagement, "mastodon_counts", boom)
    monkeypatch.setenv("MASTODON_INSTANCE", "https://instance.example")
    monkeypatch.setenv("MASTODON_ACCESS_TOKEN", "token")
    monkeypatch.delenv("NEYNAR_API_KEY", raising=False)
    monkeypatch.delenv("DEVTO_API_KEY", raising=False)
    state = {
        "posts": {
            "post-1": {
                "bluesky": {"remote_id": "at://x/y", "model": "deepseek/flash"},
                "mastodon": {"remote_id": "99"},
                "farcaster": {"remote_id": "0xabc"},
                "threads": {"remote_id": "123"},
                "nostr": {},
            }
        }
    }
    ledger, stats = collect(state, {"version": 1, "observations": {}})
    assert stats["observed"] == 1
    assert stats["failed"] == 1  # mastodon outage skips soft
    # farcaster without a key skips; threads/nostr have no read API and
    # exit before stats, so they stay invisible rather than noisy.
    assert stats["skipped"] == 1
    record = ledger["observations"]["post-1"]["bluesky"]
    assert record["counts"] == {"likes": 6, "reposts": 1}
    assert record["model"] == "deepseek/flash"
    assert "collected_at" in record


def test_totals_sum_across_platforms():
    ledger = {
        "version": 1,
        "observations": {
            "post-1": {
                "bluesky": {"counts": {"likes": 6, "reposts": 1}},
                "mastodon": {"counts": {"likes": 2}},
            },
            "post-2": {},
        },
    }
    assert engagement_totals(ledger) == {"post-1": 9, "post-2": 0}
    assert total_interactions({"counts": {"likes": 3, "views": "n/a"}}) == 3


def test_ranking_boost_rewards_engagement_and_ignores_absence():
    plain = _post("post-plain")
    loved = _post("post-loved")
    mega = _post("post-mega")
    scored = {
        item["id"]: item["priority_score"]
        for item in score_posts(
            [plain, loved, mega],
            engagement={"post-loved": 9, "post-mega": 10_000},
        )
    }
    assert scored["post-plain"] < scored["post-loved"] < scored["post-mega"]
    # 9 interactions ~= +0.25, and the boost caps at +0.75.
    assert scored["post-loved"] - scored["post-plain"] == pytest.approx(0.25, abs=0.01)
    assert scored["post-mega"] - scored["post-plain"] == pytest.approx(0.75, abs=0.01)


def test_mark_posted_stamps_model_and_keeps_it(tmp_path, monkeypatch):
    from scripts.automation import state_manager

    state_file = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", state_file)
    entry = mark_posted("post-1", "bluesky", "new", "uri-1", None, model="deepseek/flash")
    assert entry["model"] == "deepseek/flash"
    # A later record without a model retains the earlier stamp.
    entry = mark_posted("post-1", "bluesky", "new", "uri-1", None)
    assert entry["model"] == "deepseek/flash"
    legacy = mark_posted("post-2", "mastodon", "new", "99", None)
    assert "model" not in legacy


def test_engagement_module_json_shape_is_stable():
    ledger = {
        "version": 1,
        "observations": {
            "post-1": {
                "bluesky": {
                    "counts": {"likes": 1},
                    "collected_at": "2024-02-01T00:00:00Z",
                    "model": "deepseek/flash",
                }
            }
        },
    }
    assert json.loads(json.dumps(ledger)) == ledger
    assert engagement_totals({"version": 1, "observations": {}}) == {}
