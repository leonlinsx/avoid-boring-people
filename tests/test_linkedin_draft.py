"""Manual LinkedIn drafting contracts; model prose is intentionally not pinned."""
import pytest

from scripts.automation import auto_post, state_manager
from scripts.automation.attribution import tagged_url
from scripts.automation.linkedin_draft import generate_linkedin_draft, validate_linkedin_draft
from scripts.automation.routing import DEFAULT_PLATFORMS
from scripts.automation.summarizers import llm_summarizer

POST = {
    "id": "2020_07_22_ergodicity/index.md",
    "title": "Ergodicity and the cost of ruin",
    "url": "https://leonlins.com/writing/ergodicity/",
    "date": "2020-07-22T00:00:00Z",
    "content": "Average outcomes mislead when a person lives only one path. " * 90,
    "category": "Risk & Decision Making",
    "tags": ["risk", "investing"],
}
BODY = (
    "An average return can hide the chance of losing the ability to continue. "
    "A decision is only useful if you survive its bad outcomes, including the ones that seem unlikely in a spreadsheet.\n\n"
    "That changes how to think about leverage. A strategy with attractive average results "
    "may still be a poor choice if one adverse sequence ends the game.\n\n"
    "The distinction between an average across people and one path through time matters. "
    "I develop that distinction and its implications for investment decisions in the full article."
)


FIELDS = {
    "core_insight": BODY.split("\n\n")[0],
    "explanation": "That changes how to think about leverage.",
    "concrete_detail": "A strategy with attractive average results may still be a poor choice if one adverse sequence ends the game.",
    "implication": "The distinction between an average across people and one path through time matters.",
    "click_reason": "I develop that distinction and its implications for investment decisions in the full article.",
}

def test_full_article_one_provider_call_and_tagged_link(monkeypatch):
    calls = []
    def complete(prompt, **kwargs):
        calls.append((prompt, kwargs))
        return FIELDS
    monkeypatch.setattr("scripts.automation.linkedin_draft.complete_json", complete)
    result = generate_linkedin_draft(POST)
    assert len(calls) == 1
    assert POST["content"].strip() in calls[0][0]
    assert "2020-07-22" in calls[0][0]
    assert all(name in calls[0][0] for name in FIELDS)
    assert "Do not summarize the article" in calls[0][0]
    assert result == BODY + "\n" + tagged_url(POST["url"], "linkedin", "ergodicity")
    assert len(result.split("\n\n")) == 3
    assert result.count("https://") == 1
    assert "#" not in result and "FIRST COMMENT" not in result
    assert "linkedin" not in DEFAULT_PLATFORMS


def test_targeted_preview_has_no_state_or_publishing_side_effects(monkeypatch, tmp_path, capsys):
    state_file = tmp_path / "posted.json"
    state_file.write_text('{"posts":{}}')
    original = state_file.read_bytes()
    monkeypatch.setattr(state_manager, "STATE_FILE", state_file)
    for name, value in (("DRY_RUN", True), ("USE_LLM", True), ("PLATFORM", ["linkedin"]),
                        ("TARGET_POST_ID", POST["id"]), ("DISTRIBUTION_MODE", "new")):
        monkeypatch.setattr(auto_post, name, value)
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [POST])
    def forbidden(*args, **kwargs):
        pytest.fail("targeted LinkedIn preview reached state, generic summary, or publisher")
    for name in ("_summarize", "_publish", "mark_posted", "score_posts", "load_engagement"):
        monkeypatch.setattr(auto_post, name, forbidden)
    monkeypatch.setattr("scripts.automation.linkedin_draft.complete_json", lambda *a, **k: FIELDS)
    auto_post.main()
    output = capsys.readouterr().out
    assert "LINKEDIN POST\n\n" + BODY in output
    assert tagged_url(POST["url"], "linkedin", "ergodicity") in output
    assert "FIRST COMMENT" not in output
    assert state_file.read_bytes() == original


@pytest.mark.parametrize("bad", [
    "", "I wrote a new article about risk.\n\n" + BODY,
    BODY.replace("An average return", "#risk An average return"),
    BODY.replace("An average return", "**An average return"),
    BODY.replace("An average return", "https://example.com An average return"),
    BODY.replace("An average return", "example.com An average return"),
    BODY.replace("An average return", "*An average return*"),
    BODY + "\n\n" + BODY.split("\n\n")[0],
    BODY.replace("spreadsheet.", "spreadsheet…"),
    BODY.replace("full article.", "Thoughts?"),
    BODY + "\n\n" + ("An extra complete sentence. " * 150),
    BODY + "\n\nTags: risk",
    BODY + "\n\n" + ("A" * 2400) + ".",
    BODY.replace("I develop that distinction", "The analysis explores that distinction"),
    BODY.replace("I develop that distinction and its implications for investment decisions", "I explore this further"),
    BODY.replace("I develop that distinction", "The author develops that distinction"),
    BODY.replace("I develop that distinction", "The full article details that distinction"),
])
def test_validator_fails_closed(bad):
    with pytest.raises(llm_summarizer.SocialCopyError):
        validate_linkedin_draft(bad, POST)


def test_ollama_uses_shared_provider_request(monkeypatch):
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3.5:9b")
    calls = []
    def fake_chat(prompt, model, **kwargs):
        calls.append((prompt, model, kwargs))
        return __import__("json").dumps(FIELDS)
    monkeypatch.setattr(llm_summarizer, "_ollama_chat", fake_chat)
    generate_linkedin_draft(POST)
    assert len(calls) == 1
    assert calls[0][1] == "qwen3.5:9b"
    assert calls[0][2]["json_mode"] is True


def test_wrong_article_url_fails_closed():
    with pytest.raises(llm_summarizer.SocialCopyError):
        validate_linkedin_draft(BODY, {**POST, "url": "https://example.com/article"})


def test_malformed_editorial_selection_fails_closed(monkeypatch):
    monkeypatch.setattr("scripts.automation.linkedin_draft.complete_json", lambda *a, **k: {**FIELDS, "click_reason": ""})
    with pytest.raises(llm_summarizer.SocialCopyError, match="editorial selection"):
        generate_linkedin_draft(POST)
