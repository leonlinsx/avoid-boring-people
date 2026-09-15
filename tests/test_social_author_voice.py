"""Author-voice social distillation and the deterministic copy quality gate.

The transformation from long-form article to social copy is the part a reader
actually sees, so these tests pin the contract at the LLM boundary: the prompt
asks for the author's own voice, the whole article reaches the model, the
request uses the DeepSeek-V4.1-Flash alias in non-thinking JSON mode, failures
raise instead of publishing fallback text, and the quality gate rejects
outside-summary framing. Thread composition is pinned at the renderer boundary
so the shared X/Bluesky representation always fits the tighter platform.
"""
import json
import types

import pytest

from scripts.automation.formatters.thread_formatter import MAX_TWEET_LEN, format_as_thread
from scripts.automation.publishers.bluesky import BLUESKY_POST_LIMIT
from scripts.automation.publishers.twitter import TWEET_CHAR_LIMIT
from scripts.automation.summarizers import llm_summarizer

URL = "https://leonlins.com/writing/ergodicity/"


def _post(**overrides):
    post = {
        "id": "2020_07_22_ergodicity/index.md",
        "title": "Ergodicity and the cost of ruin",
        "url": URL,
        "date": "2020-07-22T00:00:00.000Z",
        "content": "Average outcomes mislead when you only live one path. " * 200,
    }
    post.update(overrides)
    return post


def _reply(content):
    """A fake completion returning `content` as the assistant message."""
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))]
    )


def _fake_client(monkeypatch, content, captured=None):
    class _Completions:
        def create(self, **kwargs):
            if captured is not None:
                captured.update(kwargs)
            if isinstance(content, Exception):
                raise content
            return _reply(content)

    class _FakeClient:
        chat = types.SimpleNamespace(completions=_Completions())

    monkeypatch.setattr(llm_summarizer, "_client", lambda: _FakeClient())


def _live(monkeypatch):
    monkeypatch.delenv("DRY_RUN", raising=False)
    monkeypatch.delenv("TEST_API", raising=False)


# --- 11.1 / 11.2: author-voice prompt over the full article ------------------

def test_prompt_asks_for_author_voice_instead_of_outside_summary():
    prompt = llm_summarizer.build_summary_prompt(_post()).lower()

    assert "you are the author of the article below" in prompt
    assert "in your own first-person voice" in prompt
    assert "never describe the article from the outside" in prompt
    for forbidden in ("the author argues", "this essay explains", "the reader", "new post"):
        assert forbidden in prompt


def test_full_article_reaches_the_model_prompt():
    """The historical 6,000-character cut must never come back."""
    content = "x" * 12_000
    prompt = llm_summarizer.build_summary_prompt(_post(content=content))

    assert content in prompt
    assert llm_summarizer.MAX_ARTICLE_CHARS > len(content)


def test_pathological_content_is_capped_by_a_documented_safety_bound():
    prompt = llm_summarizer.build_summary_prompt(_post(content="y" * 200_000))

    assert "y" * llm_summarizer.MAX_ARTICLE_CHARS in prompt
    assert "y" * (llm_summarizer.MAX_ARTICLE_CHARS + 1) not in prompt


def test_summarize_post_distills_the_full_article(monkeypatch):
    _live(monkeypatch)
    captured = {}
    pointer = "Distinctly late marker sentence."
    _fake_client(
        monkeypatch,
        json.dumps({"teaser": "A hook.", "points": ["A standalone point."]}),
        captured,
    )

    llm_summarizer.summarize_post(_post(content=("Filler. " * 2_000) + pointer))

    assert pointer in captured["messages"][-1]["content"]


# --- 11.3 / 11.4 / 11.5: model, thinking mode, JSON output -------------------

def test_default_model_is_the_deepseek_flash_alias(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_MODEL", raising=False)

    assert llm_summarizer.DEFAULT_MODEL == "deepseek-flash"


def test_api_request_disables_thinking_and_requests_json_output(monkeypatch):
    _live(monkeypatch)
    captured = {}
    _fake_client(
        monkeypatch,
        json.dumps({"teaser": "A hook.", "points": ["A standalone point."]}),
        captured,
    )

    llm_summarizer.summarize_post(_post())

    assert captured["model"] == "deepseek-flash"
    assert captured["extra_body"] == {"thinking": {"type": "disabled"}}
    assert captured["response_format"] == {"type": "json_object"}
    assert 0.4 <= captured["temperature"] <= 0.6
    assert "json" in captured["messages"][-1]["content"].lower()


# --- 11.6: production failures raise instead of publishing fallback text -----

@pytest.mark.parametrize(
    "content",
    [
        RuntimeError("DeepSeek API error: 500 boom"),
        "",
        "   ",
        "not json at all",
        '["a", "list", "instead", "of", "an", "object"]',
        json.dumps({"teaser": "A hook.", "points": "not a list"}),
    ],
    ids=["api-error", "empty", "whitespace", "unusable-json", "non-object", "malformed-points"],
)
def test_generation_failures_raise_instead_of_returning_fallback_copy(monkeypatch, content):
    _live(monkeypatch)
    _fake_client(monkeypatch, content)

    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.summarize_post(_post())


def test_no_fallback_text_remains_in_the_module():
    source = open(llm_summarizer.__file__, encoding="utf-8").read()

    assert "Fallback teaser" not in source
    assert "[No content available" not in source


def test_missing_article_content_fails_closed(monkeypatch):
    _live(monkeypatch)

    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.summarize_post(_post(content=""))


# --- 11.7 / 11.8: the deterministic quality gate -----------------------------

@pytest.mark.parametrize(
    "text",
    [
        "The author argues that specialization has hidden costs.",
        "This essay explains why averages mislead.",
        "This piece covers three lessons about risk.",
        "The reader is encouraged to think about risk differently.",
        "The writer never names the trade-off.",
        "I wrote about ergodicity last year.",
        "New post: ergodicity and ruin",
        "Check out my latest piece on path dependence.",
        "Here are my thoughts on averaging outcomes.",
        "Read the full breakdown at https://leonlins.com/writing/x/",
        "A **bold** claim about ruin.",
    ],
)
def test_quality_gate_rejects_meta_summary_framing(text):
    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.validate_social_copy(text, ["An honest standalone point."])


@pytest.mark.parametrize(
    "text",
    [
        "Average outcomes can be deeply misleading when you only get to live through one path.",
        "A strategy can have a positive expected return and still ruin you if the path contains a loss you can't survive.",
        "The authors of the 2019 study found the opposite.",
        "Risk isn't just the probability of losing; the path matters.",
    ],
)
def test_quality_gate_accepts_direct_author_statements(text):
    llm_summarizer.validate_social_copy(text, [text])


def test_quality_gate_rejects_empty_or_overlong_copy():
    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.validate_social_copy("", ["A standalone point."])
    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.validate_social_copy("A hook.", ["   "])
    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.validate_social_copy("h" * (llm_summarizer.TEASER_MAX + 1), ["A point."])
    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.validate_social_copy("A hook.", ["p" * 300], max_chars=240)


def test_generated_copy_failing_the_gate_is_not_returned(monkeypatch):
    _live(monkeypatch)
    _fake_client(
        monkeypatch,
        json.dumps(
            {
                "teaser": "A hook.",
                "points": ["The author argues that averages mislead.", "A direct claim."],
            }
        ),
    )

    with pytest.raises(llm_summarizer.SocialCopyError, match="quality gate"):
        llm_summarizer.summarize_post(_post())


def test_clean_generated_copy_still_passes(monkeypatch):
    _live(monkeypatch)
    _fake_client(
        monkeypatch,
        json.dumps(
            {
                "teaser": "Average outcomes mislead when you only live one path.",
                "points": [
                    "A positive expected return can still ruin you if the path holds a loss you can't survive.",
                    "Survivability, not expected value, decides which strategies compound.",
                ],
            }
        ),
    )

    assert llm_summarizer.summarize_post(_post()) == {
        "teaser": "Average outcomes mislead when you only live one path.",
        "points": [
            "A positive expected return can still ruin you if the path holds a loss you can't survive.",
            "Survivability, not expected value, decides which strategies compound.",
        ],
        "teaser_candidates": [
            "Average outcomes mislead when you only live one path."
        ],
    }


# --- 11.9 / 11.10 / 11.11: thread shape and platform limits -----------------

def _summary(points=None):
    return {
        "teaser": "Average outcomes mislead when you only live one path.",
        "points": points
        or [
            "A positive expected return can still ruin you if the path holds a loss you can't survive.",
            "Survivability, not expected value, decides which strategies compound.",
        ],
    }


def test_thread_root_leads_with_the_idea_and_ends_with_the_canonical_link():
    tweets = format_as_thread(_post(), _summary())

    assert tweets[0] == (
        "Average outcomes mislead when you only live one path.\n\n"
        "A positive expected return can still ruin you if the path holds a loss you can't survive."
    )
    assert tweets[-1] == f"Full piece: {URL}"
    assert tweets[1] == "Survivability, not expected value, decides which strategies compound."
    # No article-title promotion and no mechanical numbering.
    assert "Ergodicity and the cost of ruin" not in "\n".join(tweets)
    assert "(2/5)" not in "\n".join(tweets)


def test_thread_respects_x_and_bluesky_limits_without_splitting_a_point():
    tweets = format_as_thread(_post(), _summary())

    assert MAX_TWEET_LEN <= TWEET_CHAR_LIMIT
    assert MAX_TWEET_LEN <= BLUESKY_POST_LIMIT
    assert all(len(tweet) <= TWEET_CHAR_LIMIT for tweet in tweets)
    assert all(len(tweet) <= BLUESKY_POST_LIMIT for tweet in tweets)


def test_thread_keeps_the_root_to_the_hook_when_the_point_does_not_fit():
    """The strongest point moves to its own reply instead of being squeezed in."""
    hook = "h" * 200
    strongest = "p" * 250
    tweets = format_as_thread(_post(), {"teaser": hook, "points": [strongest, "A short point."]})

    assert tweets[0] == hook
    assert tweets[1] == strongest
    assert tweets[2] == "A short point."
    assert tweets[-1] == f"Full piece: {URL}"


def test_thread_skips_a_point_that_cannot_stand_as_its_own_reply():
    oversized = "p" * (MAX_TWEET_LEN + 1)
    tweets = format_as_thread(_post(), _summary(points=[oversized, "A short point."]))

    assert tweets[0] == "Average outcomes mislead when you only live one path."
    assert oversized not in tweets
    assert tweets == [
        "Average outcomes mislead when you only live one path.",
        "A short point.",
        f"Full piece: {URL}",
    ]


def test_thread_stays_within_the_maximum_reply_count():
    tweets = format_as_thread(
        _post(), _summary(points=[f"Standalone point number {index}." for index in range(1, 9)]), max_tweets=5
    )

    assert len(tweets) == 5
    assert tweets[-1] == f"Full piece: {URL}"


def test_thread_clips_an_overlong_hook_at_a_word_boundary():
    hook = " ".join(["segment"] * 60)

    tweets = format_as_thread(_post(), {"teaser": hook, "points": []})

    assert len(tweets[0]) <= MAX_TWEET_LEN
    assert tweets[0].endswith("…")
    assert "segment" in tweets[0]


@pytest.mark.parametrize(
    "post, summary, match",
    [
        ({"title": "T", "url": ""}, _summary(), "canonical article URL"),
        ({"title": "T", "url": "https://x.test/" + "a" * MAX_TWEET_LEN}, _summary(), "Canonical URL exceeds"),
        ({"title": "", "url": URL}, {"teaser": "", "points": []}, "requires a teaser"),
    ],
    ids=["missing-url", "overlong-url", "missing-hook"],
)
def test_thread_fails_loudly_when_it_cannot_guarantee_the_limits(post, summary, match):
    with pytest.raises(ValueError, match=match):
        format_as_thread(post, summary)


def test_thread_needs_a_slot_for_the_canonical_link():
    with pytest.raises(ValueError, match="max_tweets"):
        format_as_thread(_post(), _summary(), max_tweets=1)


# --- 11.12: Threads keeps its standalone-idea-plus-link-reply design ---------

def _social_post(**overrides):
    from scripts.automation.content import SocialPost

    points = _summary()["points"]
    values = {
        "hook": _summary()["teaser"],
        "body": "\n\n".join(points),
        "url": URL,
        "thread": tuple(format_as_thread(_post(), _summary())),
    }
    values.update(overrides)
    return SocialPost(**values)


def test_threads_still_renders_a_standalone_idea_plus_a_link_reply():
    from scripts.automation.renderers import render_threads

    rendered = render_threads(_social_post())

    assert len(rendered) == 2
    assert URL not in rendered[0]
    assert rendered[1] == f"Full piece: {URL}"
    assert len(rendered[0]) <= 500


def test_single_status_renderers_read_the_shared_argument_not_the_thread_replies():
    """Mastodon/Farcaster compress one idea, so they must not quote a reply."""
    from scripts.automation.renderers import render_farcaster, render_mastodon

    post = _social_post()
    leading = _summary()["points"][0]

    assert leading in render_mastodon(post)[0]
    assert leading in render_farcaster(post)
    assert render_mastodon(post)[0].endswith(URL)


def test_weibo_localization_receives_an_argument_point_not_the_link():
    """The Weibo path must never localize the thread's canonical-link reply."""
    from scripts.automation.renderers import supporting_point

    post = _social_post()

    assert supporting_point(post) == _summary()["points"][0]
    assert URL not in supporting_point(post)
