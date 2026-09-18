"""Explicit local-provider selection for the social summarizer.

Production must keep talking to DeepSeek, and `ollama` must be reachable only by
setting `SOCIAL_LLM_PROVIDER=ollama` deliberately. These tests pin that contract
plus the small amount of per-backend request shaping, so the local preview sees
the whole article instead of a silently truncated prompt.
"""
import json
import types
import urllib.error

import pytest

from scripts.automation.summarizers import llm_summarizer

URL = "https://leonlins.com/writing/ergodicity/"
GOOD_REPLY = json.dumps({"teaser": "A hook.", "points": ["A standalone point."]})
META_REPLY = json.dumps(
    {"teaser": "This essay explains ergodicity.", "points": ["The author argues for patience."]}
)


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
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))]
    )


def _live(monkeypatch):
    monkeypatch.delenv("DRY_RUN", raising=False)
    monkeypatch.delenv("TEST_API", raising=False)


def _use_ollama(monkeypatch, model="qwen3.5:9b"):
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", model)


class _FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _fake_ollama(monkeypatch, content, captured=None, error=None):
    """Capture the native Ollama request instead of calling a local server."""

    def fake_urlopen(request, timeout=None):
        if captured is not None:
            captured["url"] = request.full_url
            captured["payload"] = json.loads(request.data.decode("utf-8"))
            captured["timeout"] = timeout
        if error is not None:
            raise error
        return _FakeResponse(json.dumps({"message": {"content": content}}).encode("utf-8"))

    monkeypatch.setattr(llm_summarizer.urllib.request, "urlopen", fake_urlopen)


def _fake_deepseek(monkeypatch, content, captured=None):
    class _Completions:
        def create(self, **kwargs):
            if captured is not None:
                captured.update(kwargs)
            return _reply(content)

    class _FakeClient:
        chat = types.SimpleNamespace(completions=_Completions())

    monkeypatch.setattr(llm_summarizer, "_client", lambda: _FakeClient())


# --- selection -----------------------------------------------------------------

def test_provider_defaults_to_deepseek_without_configuration(monkeypatch):
    monkeypatch.delenv("SOCIAL_LLM_PROVIDER", raising=False)

    assert llm_summarizer.llm_provider() == "deepseek"


def test_blank_provider_setting_still_means_deepseek(monkeypatch):
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "   ")

    assert llm_summarizer.llm_provider() == "deepseek"


def test_provider_setting_is_case_and_whitespace_insensitive(monkeypatch):
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", " Ollama ")

    assert llm_summarizer.llm_provider() == "ollama"


def test_unknown_provider_fails_closed_with_the_allowed_values(monkeypatch):
    _live(monkeypatch)
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "openai")

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "openai" in str(error.value)
    assert "deepseek" in str(error.value) and "ollama" in str(error.value)


def test_a_missing_deepseek_key_never_falls_back_to_a_local_model(monkeypatch):
    """The provider is chosen by configuration, never by credential presence."""
    _live(monkeypatch)
    monkeypatch.delenv("SOCIAL_LLM_PROVIDER", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setenv("OLLAMA_MODEL", "qwen3.5:9b")
    monkeypatch.setattr(
        llm_summarizer,
        "_ollama_chat",
        lambda *a, **k: pytest.fail("ollama must not be reached without an explicit setting"),
    )

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "DEEPSEEK_API_KEY" in str(error.value)


# --- deepseek (production) -----------------------------------------------------

def test_deepseek_stays_the_default_request_shape(monkeypatch):
    _live(monkeypatch)
    monkeypatch.delenv("SOCIAL_LLM_PROVIDER", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.delenv("DEEPSEEK_MODEL", raising=False)
    captured = {}
    _fake_deepseek(monkeypatch, GOOD_REPLY, captured)
    monkeypatch.setattr(
        llm_summarizer,
        "_ollama_chat",
        lambda *a, **k: pytest.fail("the default provider must not call Ollama"),
    )

    result = llm_summarizer.summarize_post(_post())

    assert captured["model"] == "deepseek-flash"
    assert captured["extra_body"] == {"thinking": {"type": "disabled"}}
    assert captured["response_format"] == {"type": "json_object"}
    assert "num_ctx" not in json.dumps(captured)
    assert result == {"teaser": "A hook.", "points": ["A standalone point."], "teaser_candidates": ["A hook."]}


def test_deepseek_client_keeps_the_hosted_endpoint(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    client = llm_summarizer._client()

    assert str(client.base_url).rstrip("/") == "https://api.deepseek.com/v1"


def test_deepseek_client_bounds_its_own_wait(monkeypatch):
    """The SDK defaults (600s, 2 retries) outlive the job that pays for one call."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")

    client = llm_summarizer._client()

    assert client.timeout == llm_summarizer.HOSTED_TIMEOUT_SECONDS
    assert client.max_retries == llm_summarizer.HOSTED_MAX_RETRIES
    assert client.timeout * (client.max_retries + 1) < 20 * 60


def test_deepseek_model_can_still_be_overridden(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-v4-pro")

    assert llm_summarizer.llm_model("deepseek") == "deepseek-v4-pro"


# --- ollama (explicit local preview) ------------------------------------------

def test_ollama_request_uses_the_native_endpoint_with_its_own_context(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
    monkeypatch.delenv("OLLAMA_NUM_CTX", raising=False)
    captured = {}
    _fake_ollama(monkeypatch, GOOD_REPLY, captured)
    monkeypatch.setattr(
        llm_summarizer,
        "_client",
        lambda: pytest.fail("the local provider must not need a hosted API client"),
    )

    result = llm_summarizer.summarize_post(_post())

    assert captured["url"] == "http://localhost:11434/api/chat"
    payload = captured["payload"]
    assert payload["model"] == "qwen3.5:9b"
    assert payload["stream"] is False
    assert payload["think"] is False
    assert payload["format"] == "json"
    assert payload["options"]["num_ctx"] == llm_summarizer.DEFAULT_OLLAMA_NUM_CTX
    assert payload["options"]["num_predict"] == llm_summarizer.MAX_TOKENS
    assert "json" in payload["messages"][-1]["content"].lower()
    assert result == {"teaser": "A hook.", "points": ["A standalone point."], "teaser_candidates": ["A hook."]}


def test_ollama_endpoint_and_context_can_be_pointed_elsewhere(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:11500/")
    monkeypatch.setenv("OLLAMA_NUM_CTX", "65536")
    captured = {}
    _fake_ollama(monkeypatch, GOOD_REPLY, captured)

    llm_summarizer.summarize_post(_post())

    assert captured["url"] == "http://127.0.0.1:11500/api/chat"
    assert captured["payload"]["options"]["num_ctx"] == 65536


@pytest.mark.parametrize("value", ["many", "0", "1024"])
def test_an_unusable_context_setting_fails_closed(monkeypatch, value):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    monkeypatch.setenv("OLLAMA_NUM_CTX", value)

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "OLLAMA_NUM_CTX" in str(error.value)


def test_ollama_requires_an_explicit_installed_model(monkeypatch):
    _live(monkeypatch)
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "ollama")
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "OLLAMA_MODEL" in str(error.value)
    assert "ollama list" in str(error.value)


def test_an_unreachable_local_server_reports_how_to_start_it(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    _fake_ollama(
        monkeypatch, "", error=urllib.error.URLError(ConnectionRefusedError("refused"))
    )

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "ollama serve" in str(error.value)


def test_a_provider_rejected_local_request_fails_closed(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)

    def fake_urlopen(request, timeout=None):
        return _FakeResponse(json.dumps({"error": "model not found"}).encode("utf-8"))

    monkeypatch.setattr(llm_summarizer.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "model not found" in str(error.value)


def test_local_generation_is_allowed_a_generous_timeout(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    captured = {}
    _fake_ollama(monkeypatch, GOOD_REPLY, captured)

    llm_summarizer.summarize_post(_post())

    assert captured["timeout"] == llm_summarizer.OLLAMA_TIMEOUT_SECONDS >= 300


# --- identical contract for both backends -------------------------------------

def test_the_local_backend_passes_the_same_quality_gate(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    _fake_ollama(monkeypatch, META_REPLY)

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.summarize_post(_post())

    assert "outside-summary framing" in str(error.value)


@pytest.mark.parametrize("backend", ["deepseek", "ollama"])
def test_malformed_model_output_fails_closed_on_both_backends(monkeypatch, backend):
    _live(monkeypatch)
    if backend == "ollama":
        _use_ollama(monkeypatch)
        _fake_ollama(monkeypatch, json.dumps({"summary": "not the agreed shape"}))
    else:
        monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
        _fake_deepseek(monkeypatch, json.dumps({"summary": "not the agreed shape"}))

    with pytest.raises(llm_summarizer.SocialCopyError):
        llm_summarizer.summarize_post(_post())


def test_a_local_run_reaches_the_same_parser_and_gate(monkeypatch):
    """The local backend must not have its own copy of the JSON contract."""
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    _fake_ollama(monkeypatch, "```json\n" + GOOD_REPLY + "\n```")

    assert llm_summarizer.summarize_post(_post()) == {
        "teaser": "A hook.",
        "points": ["A standalone point."],
        "teaser_candidates": ["A hook."],
    }


def test_logged_identity_carries_no_credential(monkeypatch):
    _use_ollama(monkeypatch)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "super-secret")

    assert llm_summarizer.llm_identity() == "ollama/qwen3.5:9b"


def test_the_local_request_carries_no_hosted_credential(monkeypatch, capsys):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "super-secret")
    captured = {}
    _fake_ollama(monkeypatch, GOOD_REPLY, captured)

    llm_summarizer.summarize_post(_post())

    printed = capsys.readouterr().out
    assert "super-secret" not in json.dumps(captured)
    assert "super-secret" not in printed
    assert "LLM provider: ollama" in printed
    assert "LLM model: qwen3.5:9b" in printed


# --- shared completion seam -----------------------------------------------------

def test_an_absent_deepseek_key_is_reported_as_unconfigured(monkeypatch):
    _live(monkeypatch)
    monkeypatch.delenv("SOCIAL_LLM_PROVIDER", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    assert llm_summarizer.llm_configured() is False


def test_a_blank_deepseek_key_does_not_count_as_configuration(monkeypatch):
    _live(monkeypatch)
    monkeypatch.delenv("SOCIAL_LLM_PROVIDER", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "   ")

    assert llm_summarizer.llm_configured() is False

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    assert llm_summarizer.llm_configured() is True


def test_the_local_provider_is_configured_by_its_model_not_the_hosted_key(monkeypatch):
    _use_ollama(monkeypatch)

    assert llm_summarizer.llm_configured() is True

    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    assert llm_summarizer.llm_configured() is False


def test_an_unknown_provider_fails_closed_when_configuration_is_checked(monkeypatch):
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "openai")

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.llm_configured()

    assert "openai" in str(error.value)


def test_the_completion_seam_returns_the_parsed_object(monkeypatch):
    _live(monkeypatch)
    monkeypatch.delenv("SOCIAL_LLM_PROVIDER", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    captured = {}
    _fake_deepseek(monkeypatch, json.dumps({"verdict": "STRONG"}), captured)

    result = llm_summarizer.complete_json(
        "judge this thread", system="You judge.", temperature=0.3, max_tokens=1600
    )

    assert result == {"verdict": "STRONG"}
    assert captured["temperature"] == 0.3
    assert captured["max_tokens"] == 1600
    assert captured["response_format"] == {"type": "json_object"}
    assert captured["messages"] == [
        {"role": "system", "content": "You judge."},
        {"role": "user", "content": "judge this thread"},
    ]


def test_the_completion_seam_tolerates_a_fenced_object(monkeypatch):
    _live(monkeypatch)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    _fake_deepseek(monkeypatch, '```json\n{"verdict": "REJECT"}\n```', {})

    assert llm_summarizer.complete_json("judge", system="You judge.") == {"verdict": "REJECT"}


def test_the_completion_seam_uses_the_selected_local_provider(monkeypatch):
    _live(monkeypatch)
    _use_ollama(monkeypatch)
    captured = {}
    _fake_ollama(monkeypatch, json.dumps({"verdict": "MAYBE"}), captured)

    assert llm_summarizer.complete_json("judge", system="You judge.") == {"verdict": "MAYBE"}
    assert captured["url"] == "http://localhost:11434/api/chat"


def test_the_completion_seam_never_fabricates_a_judgment_under_dry_run(monkeypatch):
    """`DRY_RUN` mocks the social copy, but a judgment must come from the model."""
    _live(monkeypatch)
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    _fake_deepseek(monkeypatch, json.dumps({"verdict": "STRONG"}), {})

    assert llm_summarizer.complete_json("judge", system="You judge.") == {"verdict": "STRONG"}


@pytest.mark.parametrize("reply", ["", "   "])
def test_an_empty_completion_fails_closed(monkeypatch, reply):
    _live(monkeypatch)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    _fake_deepseek(monkeypatch, reply, {})

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.complete_json("judge", system="You judge.")

    assert "empty" in str(error.value)


@pytest.mark.parametrize(
    ("reply", "expected"),
    [("not json at all", "unusable JSON"), ('["a", "b"]', "expected an object")],
)
def test_an_unusable_completion_fails_closed(monkeypatch, reply, expected):
    _live(monkeypatch)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    _fake_deepseek(monkeypatch, reply, {})

    with pytest.raises(llm_summarizer.SocialCopyError) as error:
        llm_summarizer.complete_json("judge", system="You judge.")

    assert expected in str(error.value)
