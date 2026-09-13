"""Evergreen-by-default selection and publication-date-aware summarization.

The Astro content schema resolves `evergreen` (defaulting to true), the
`/search-index.json` route passes it through, and `fetch_post.fetch_posts`
carries it into social distribution. These tests pin the CLI-side boundary so a
missing evergreen flag never silently excludes an article, explicit exclusions
still work, new-article distribution is unaffected, and the summarizer receives
the publication date instead of treating old facts as current.
"""
from datetime import datetime, timezone
import json
import types

from scripts.automation import fetch_post as fetch_post_module
from scripts.automation import state_manager
from scripts.automation.summarizers import llm_summarizer


def _entry(**overrides):
    entry = {
        "id": "2020_07_22_example/index.md",
        "title": "Doctor GPT-3",
        "url": "/writing/2020_07_22_example/",
        "date": "2020-07-22T00:00:00.000Z",
        "content": "Article body. " * 100,
        "category": "Technology",
        "tags": ["AI"],
    }
    entry.update(overrides)
    return entry


def _use_temp_state(monkeypatch, tmp_path):
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    return path


# --- A/B/C: default resolution, explicit exclusion, explicit inclusion ------

def test_fetch_posts_defaults_a_missing_evergreen_field_to_true(monkeypatch):
    monkeypatch.setattr(fetch_post_module, "load_search_index", lambda: [_entry()])

    posts = fetch_post_module.fetch_posts()

    assert posts[0]["evergreen"] is True


def test_fetch_posts_preserves_explicit_evergreen_flags(monkeypatch):
    monkeypatch.setattr(
        fetch_post_module,
        "load_search_index",
        lambda: [
            _entry(id="keep/index.md", evergreen=True),
            _entry(id="stale/index.md", evergreen=False),
        ],
    )

    posts = {post["id"]: post for post in fetch_post_module.fetch_posts()}

    assert posts["keep/index.md"]["evergreen"] is True
    assert posts["stale/index.md"]["evergreen"] is False


def test_resolved_default_is_eligible_while_explicit_exclusion_is_not(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    monkeypatch.setattr(
        fetch_post_module,
        "load_search_index",
        lambda: [_entry(id="default/index.md"), _entry(id="excluded/index.md", evergreen=False)],
    )
    posts = {post["id"]: post for post in fetch_post_module.fetch_posts()}

    assert state_manager.platform_is_eligible(posts["default/index.md"], "bluesky", "evergreen")
    assert not state_manager.platform_is_eligible(posts["excluded/index.md"], "bluesky", "evergreen")


# --- D: changing the default must not affect mode="new" ----------------------

def test_new_mode_ignores_the_evergreen_flag(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    excluded = {
        "id": "stale",
        "title": "Stale",
        "url": "https://leonlins.com/writing/stale/",
        "content": "body " * 100,
        "evergreen": False,
    }

    assert state_manager.platform_is_eligible(excluded, "twitter", "new")
    assert state_manager.platform_is_eligible(excluded, "devto", "new")
    # The same article stays ineligible for recycling.
    assert not state_manager.platform_is_eligible(excluded, "twitter", "evergreen")


# --- E: existing routing and cooldowns are preserved ------------------------

def test_evergreen_still_excludes_dev_and_reddit(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    post = {"id": "post", "evergreen": True}

    assert not state_manager.platform_is_eligible(post, "devto", "evergreen")
    assert not state_manager.platform_is_eligible(post, "reddit", "evergreen")
    assert state_manager.platform_is_eligible(post, "nostr", "evergreen")


def test_every_evergreen_eligible_platform_has_a_cooldown():
    eligible = [p for p in state_manager.PLATFORMS if p not in {"devto", "reddit"}]
    missing = [p for p in eligible if p not in state_manager.EVERGREEN_COOLDOWN_DAYS]

    assert missing == []


def test_previously_posted_nostr_and_weibo_articles_respect_cooldown(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    fresh = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    state = {
        "version": 2,
        "posts": {
            "post": {
                "nostr": {"count": 1, "last_posted_at": fresh, "last_mode": "new"},
                "weibo": {"count": 1, "last_posted_at": fresh, "last_mode": "new"},
            }
        },
    }
    post = {"id": "post", "evergreen": True}

    assert not state_manager.platform_is_eligible(post, "nostr", "evergreen", state)
    assert not state_manager.platform_is_eligible(post, "weibo", "evergreen", state)


def test_evergreen_cooldown_and_least_used_selection_are_preserved(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    fresh = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    state = {
        "version": 2,
        "posts": {
            "used": {
                "bluesky": {"count": 1, "last_posted_at": fresh, "last_mode": "evergreen"}
            }
        },
    }

    cooldown_active = {"id": "used", "evergreen": True, "date": "2020-01-01"}
    never_posted = {"id": "fresh", "evergreen": True, "date": "2021-01-01"}

    assert not state_manager.platform_is_eligible(cooldown_active, "bluesky", "evergreen", state)
    assert state_manager.platform_is_eligible(never_posted, "bluesky", "evergreen", state)

    # select_next_post reads persisted state, so seed it on disk before selecting.
    state_manager.save_state(state)
    selected = state_manager.select_next_post([cooldown_active, never_posted], ["bluesky"], "evergreen")
    assert selected is not None and selected["id"] == "fresh"


# --- F/G: publication date reaches the prompt and shapes the instructions ----

def _social_post(**overrides):
    post = {
        "id": "2020_07_22_doctor_gpt/index.md",
        "title": "Doctor GPT-3",
        "url": "https://leonlins.com/writing/2020_07_22_doctor_gpt/",
        "date": "2020-07-22T00:00:00.000Z",
        "content": "GPT-3 was released in 2020 and surprised observers.",
    }
    post.update(overrides)
    return post


def test_summary_prompt_contains_the_publication_date():
    prompt = llm_summarizer.build_summary_prompt(_social_post())

    assert "2020-07-22" in prompt
    assert "PUBLICATION DATE: 2020-07-22" in prompt


def test_summary_prompt_forbids_presenting_historical_facts_as_current():
    prompt = llm_summarizer.build_summary_prompt(_social_post())
    lowered = prompt.lower()

    for expected in (
        "publication-date awareness",
        "do not present historical or time-sensitive facts as current facts",
        "do not invent current conditions",
        "do not need to be date-stamped",
        "in this 2020 analysis",
    ):
        assert expected in lowered


def test_missing_publication_date_is_marked_unknown():
    prompt = llm_summarizer.build_summary_prompt(_social_post(date=""))

    assert "PUBLICATION DATE: unknown" in prompt


def test_summarize_post_sends_the_date_to_the_model(monkeypatch):
    monkeypatch.delenv("DRY_RUN", raising=False)
    monkeypatch.delenv("TEST_API", raising=False)
    captured = {}

    class _Completions:
        def create(self, **kwargs):
            captured["messages"] = kwargs["messages"]
            return types.SimpleNamespace(
                choices=[
                    types.SimpleNamespace(
                        message=types.SimpleNamespace(
                            content='{"teaser": "Hook", "points": ["Point one"]}'
                        )
                    )
                ]
            )

    class _FakeClient:
        chat = types.SimpleNamespace(completions=_Completions())

    monkeypatch.setattr(llm_summarizer, "_client", lambda: _FakeClient())

    result = llm_summarizer.summarize_post(_social_post())

    assert result == {"teaser": "Hook", "points": ["Point one"]}
    sent_prompt = captured["messages"][-1]["content"]
    assert "PUBLICATION DATE: 2020-07-22" in sent_prompt


def test_overlong_summary_text_is_truncated_at_a_word_boundary(monkeypatch):
    """A model that ignores its length budget must not yield half a word."""
    monkeypatch.delenv("DRY_RUN", raising=False)
    monkeypatch.delenv("TEST_API", raising=False)
    words = [f"segment{index:02d}" for index in range(40)]

    class _Completions:
        def create(self, **kwargs):
            return types.SimpleNamespace(
                choices=[
                    types.SimpleNamespace(
                        message=types.SimpleNamespace(
                            content=json.dumps(
                                {"teaser": " ".join(words), "points": [" ".join(words)]}
                            )
                        )
                    )
                ]
            )

    class _FakeClient:
        chat = types.SimpleNamespace(completions=_Completions())

    monkeypatch.setattr(llm_summarizer, "_client", lambda: _FakeClient())

    result = llm_summarizer.summarize_post(_social_post(), max_chars=120)

    for text in (result["teaser"], result["points"][0]):
        assert len(text) <= 200
        assert text.endswith("…")
        # Every retained token is a whole word from the model's reply.
        assert text[:-1].rstrip().split()[-1] in words
        assert words[-1] not in text
