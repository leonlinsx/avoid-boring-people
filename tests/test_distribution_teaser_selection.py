"""Teaser candidates and deterministic specificity selection.

The model offers up to two alternate hooks; a deterministic rubric picks the
most specific usable one. Specificity (numbers, proper nouns, concrete
length) is the structural opposite of clickbait, and selection is never a
second model call. Ties keep the model's own first choice, and nothing
unusable is ever repaired: the strict gate still fails closed.
"""
import json
import types

import pytest

from scripts.automation.summarizers import llm_summarizer
from scripts.automation.summarizers.llm_summarizer import (
    build_summary_prompt,
    select_teaser,
    summarize_post,
)


def _post(**overrides):
    post = {
        "id": "2020_07_22_ergodicity/index.md",
        "title": "Ergodicity and the cost of ruin",
        "url": "https://leonlins.com/writing/ergodicity/",
        "date": "2020-07-22T00:00:00.000Z",
        "content": "Average outcomes mislead when you only live one path. " * 200,
    }
    post.update(overrides)
    return post


def _reply(payload):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(payload)))]
    )


def _fake_client(monkeypatch, payload):
    class _Completions:
        def create(self, **kwargs):
            return _reply(payload)

    class _FakeClient:
        chat = types.SimpleNamespace(completions=_Completions())

    monkeypatch.setattr(llm_summarizer, "_client", lambda: _FakeClient())


def _live(monkeypatch):
    monkeypatch.setenv("TEST_API", "true")
    monkeypatch.delenv("DRY_RUN", raising=False)


def test_prompt_requests_alternates_with_different_angles():
    prompt = build_summary_prompt(_post())
    assert "teaser_alternates" in prompt
    assert "different angle" in prompt


def test_specificity_prefers_numbers_then_names():
    vague = "Investing well matters more than you think and rewards patience."
    numbered = "A 4% withdrawal rate survived every 30-year window since 1926."
    assert select_teaser(vague, [numbered]) == numbered
    named = "The optimal bet sizes follow the Kelly criterion exactly."
    assert select_teaser(vague, [named]) == named
    assert select_teaser(numbered, [named]) == numbered


def test_ties_and_duplicates_keep_the_primary():
    teaser = "Average outcomes mislead when you only live one path."
    assert select_teaser(teaser, []) == teaser
    assert select_teaser(teaser, [teaser]) == teaser
    twin_a = "Markets reward patience over clever timing every single decade."
    twin_b = "Patience beats clever timing in markets across every decade here."
    assert select_teaser(twin_a, [twin_b]) in (twin_a, twin_b)


def test_unusable_alternates_are_skipped_never_repaired():
    teaser = "Ruin changes the math completely for every single investor."
    bait = "The author argues you must read this now"
    assert select_teaser(teaser, [bait]) == teaser
    assert select_teaser("", [""]) == ""


def test_summarize_selects_and_reports_candidates(monkeypatch):
    _live(monkeypatch)
    _fake_client(
        monkeypatch,
        {
            "teaser": "Investing well matters more than you think and rewards patience.",
            "teaser_alternates": [
                "A 4% withdrawal rate survived every 30-year window since 1926.",
                "The author argues you must read this now",
                "A 4% withdrawal rate survived every 30-year window since 1926.",
            ],
            "points": ["Average outcomes mislead when you only live one path."],
        },
    )
    result = summarize_post(_post())
    assert result["teaser"] == "A 4% withdrawal rate survived every 30-year window since 1926."
    # Candidates report everything the model offered (duplicate dropped);
    # the unusable bait is listed but never selected.
    assert result["teaser_candidates"][0].startswith("Investing well matters")
    assert len(result["teaser_candidates"]) == 3


def test_summarize_still_fails_closed_when_nothing_is_usable(monkeypatch):
    _live(monkeypatch)
    _fake_client(
        monkeypatch,
        {
            "teaser": "The author argues things",
            "teaser_alternates": ["check out my new post"],
            "points": ["Average outcomes mislead when you only live one path."],
        },
    )
    with pytest.raises(llm_summarizer.SocialCopyError):
        summarize_post(_post())
