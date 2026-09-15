"""LinkedIn coverage: link-free posts with the article link as first comment.

Body links cost the post most of its reach, so the adapter publishes native
commentary and follows with the canonical URL as the first comment. A dead
comment endpoint must never fail (or duplicate) the already-live post, so the
miss is logged loudly and the publish still succeeds. No test touches the
network: `requests.post` is scripted per call.
"""
import sys
import types
from urllib.parse import quote

import pytest

try:
    import requests as _requests_lib  # noqa: F401
except ImportError:
    _requests_stub = types.ModuleType("requests")
    _requests_stub.RequestException = type("RequestException", (Exception,), {})
    sys.modules.setdefault("requests", _requests_stub)

from scripts.automation.publishers import linkedin as linkedin_module

URL = "https://leonlins.com/writing/sample/"
POST_URN = "urn:li:share:12345"


def _response(status_code, payload=None, headers=None, text=""):
    response = types.SimpleNamespace(
        status_code=status_code,
        headers=headers or {},
        text=text or "{}",
    )
    response.json = lambda: payload if payload is not None else {}
    return response


def _script_post(monkeypatch, responses):
    """Serve queued responses to requests.post and record every call."""
    calls = []
    queue = list(responses)

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append({"url": url, "headers": headers, "json": json})
        assert queue, f"unexpected POST {url}"
        return queue.pop(0)

    monkeypatch.setattr(linkedin_module.requests, "post", fake_post)
    return calls


def _credentials(monkeypatch):
    monkeypatch.setenv("LINKEDIN_ACCESS_TOKEN", "token-1")
    monkeypatch.setenv("LINKEDIN_AUTHOR_URN", "urn:li:person:abc")


def test_post_carries_no_link_and_comment_carries_the_url(monkeypatch):
    _credentials(monkeypatch)
    calls = _script_post(
        monkeypatch,
        [
            _response(201, {}, headers={"x-restli-id": POST_URN}),
            _response(201, {}),
        ],
    )
    result = linkedin_module.post_to_linkedin("A sharp hook\n\nA point.", link_url=URL)

    assert result.remote_id == POST_URN
    assert len(calls) == 2
    body = calls[0]["json"]["commentary"]
    assert URL not in body
    assert "A sharp hook" in body
    comment_call = calls[1]
    assert comment_call["url"] == (
        f"https://api.linkedin.com/rest/socialActions/{quote(POST_URN, safe='')}/comments"
    )
    assert comment_call["json"]["actor"] == "urn:li:person:abc"
    assert comment_call["json"]["object"] == POST_URN
    assert URL in comment_call["json"]["message"]["text"]


def test_post_id_falls_back_to_the_response_body(monkeypatch):
    _credentials(monkeypatch)
    calls = _script_post(
        monkeypatch,
        [
            _response(201, {"id": POST_URN}),
            _response(201, {}),
        ],
    )
    result = linkedin_module.post_to_linkedin("Hook\n\nPoint.", link_url=URL)
    assert result.remote_id == POST_URN
    assert len(calls) == 2


def test_failed_comment_keeps_the_live_post_and_warns(monkeypatch, capsys):
    _credentials(monkeypatch)
    calls = _script_post(
        monkeypatch,
        [
            _response(201, {}, headers={"x-restli-id": POST_URN}),
            _response(500, text="backend down"),
        ],
    )
    # Must not raise: the post is live and retrying would duplicate it.
    result = linkedin_module.post_to_linkedin("Hook\n\nPoint.", link_url=URL)
    assert result.remote_id == POST_URN
    assert len(calls) == 2
    assert "link comment failed" in capsys.readouterr().out


def test_link_free_post_skips_the_comment(monkeypatch):
    _credentials(monkeypatch)
    calls = _script_post(monkeypatch, [_response(201, {}, headers={"x-restli-id": POST_URN})])
    result = linkedin_module.post_to_linkedin("Hook\n\nPoint.")
    assert result.remote_id == POST_URN
    assert len(calls) == 1


def test_failed_post_raises_before_any_comment(monkeypatch):
    _credentials(monkeypatch)
    calls = _script_post(monkeypatch, [_response(401, text="bad token")])
    with pytest.raises(RuntimeError, match="401"):
        linkedin_module.post_to_linkedin("Hook\n\nPoint.", link_url=URL)
    assert len(calls) == 1


def test_missing_credentials_fail_before_any_call(monkeypatch):
    monkeypatch.delenv("LINKEDIN_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("LINKEDIN_AUTHOR_URN", raising=False)
    calls = _script_post(monkeypatch, [])
    with pytest.raises(RuntimeError, match="LINKEDIN_ACCESS_TOKEN"):
        linkedin_module.post_to_linkedin("Hook", link_url=URL)
    assert calls == []
