from datetime import datetime, timezone

import pytest

from scripts.automation import state_manager
from scripts.automation.content import PublishResult, SocialPost
from scripts.automation.publishers import tumblr
from scripts.automation.routing import DEFAULT_PLATFORMS, PLATFORMS, SOCIAL_PLATFORMS, eligible_for_category


class Response:
    status_code = 201
    text = ""

    def json(self):
        return {"response": {"id_string": "123", "post_url": "https://avoidboringpeople.tumblr.com/post/123"}}


def test_tumblr_uses_npf_oauth1_and_returns_publish_result(monkeypatch):
    for name in (
        "TUMBLR_BLOG_IDENTIFIER", "TUMBLR_CONSUMER_KEY", "TUMBLR_CONSUMER_SECRET",
        "TUMBLR_OAUTH_TOKEN", "TUMBLR_OAUTH_TOKEN_SECRET",
    ):
        monkeypatch.setenv(name, "avoidboringpeople.tumblr.com" if name.endswith("IDENTIFIER") else "secret")
    calls = []
    monkeypatch.setattr(tumblr.requests, "post", lambda *args, **kwargs: calls.append((args, kwargs)) or Response())
    social = SocialPost("A strong hook", "A concise key idea.", "https://leonlins.com/tagged", tags=("systems", "risk"))

    result = tumblr.post_to_tumblr(social, "https://leonlins.com/writing/example/")

    assert result == PublishResult("tumblr", "123", "https://avoidboringpeople.tumblr.com/post/123")
    url = calls[0][0][0]
    payload = calls[0][1]["json"]
    assert url == "https://api.tumblr.com/v2/blog/avoidboringpeople.tumblr.com/posts"
    assert calls[0][1]["auth"].client.client_key == "secret"
    assert [block["type"] for block in payload["content"]] == ["text", "text", "link"]
    assert payload["content"][2]["url"] == "https://leonlins.com/writing/example/"
    assert payload["tags"] == "systems,risk"
    assert "full article" not in payload


def test_tumblr_is_broad_manual_ready_and_evergreen(monkeypatch, tmp_path):
    assert "tumblr" in PLATFORMS and "tumblr" in SOCIAL_PLATFORMS
    assert "tumblr" in state_manager.PLATFORMS
    assert "tumblr" not in DEFAULT_PLATFORMS
    for category in ("Investing", "Technology", "System Design", "Risk & Decision Making", "Culture"):
        assert eligible_for_category({"category": category}, "tumblr")
    monkeypatch.chdir(tmp_path)
    post = {"id": "post", "evergreen": True}
    assert state_manager.platform_is_eligible(post, "tumblr", "new")
    state_manager.mark_posted("post", "tumblr", "new", "123", "https://tumblr.example/post/123")
    assert not state_manager.platform_is_eligible(post, "tumblr", "new")
    now = datetime(2026, 9, 27, tzinfo=timezone.utc)
    assert not state_manager.platform_is_eligible(post, "tumblr", "evergreen", now=now)


def test_tumblr_missing_credentials_fails_before_http(monkeypatch):
    for name in (
        "TUMBLR_BLOG_IDENTIFIER", "TUMBLR_CONSUMER_KEY", "TUMBLR_CONSUMER_SECRET",
        "TUMBLR_OAUTH_TOKEN", "TUMBLR_OAUTH_TOKEN_SECRET",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(tumblr.requests, "post", lambda *args, **kwargs: pytest.fail("HTTP must not run"))
    with pytest.raises(RuntimeError, match="TUMBLR_BLOG_IDENTIFIER"):
        tumblr.post_to_tumblr(SocialPost("hook", "body", "url"), "https://leonlins.com/writing/x/")
