"""Token-refresh safety tests: no network, no credential writes."""
from datetime import datetime, timezone
from pathlib import Path
import subprocess

import pytest

from scripts.automation import refresh_meta_tokens as mod


NOW = datetime(2026, 11, 16, tzinfo=timezone.utc)


def _tokens(monkeypatch):
    monkeypatch.setenv("THREADS_ACCESS_TOKEN", "threads-old-long-lived-token")
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", "instagram-old-long-lived-token")
    monkeypatch.setenv("INSTAGRAM_USER_ID", "instagram-account")
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)


def test_check_only_does_not_call_refresh_or_write(monkeypatch):
    _tokens(monkeypatch)
    urls = []
    monkeypatch.setattr(mod, "_get_json", lambda url, **kw: (urls.append(url) or {"id": "instagram-account"}))
    monkeypatch.setattr(mod, "_recently_updated", lambda *a: (_ for _ in ()).throw(AssertionError("read secret age")))
    monkeypatch.setattr(mod, "_persist", lambda *a: (_ for _ in ()).throw(AssertionError("secret write")))
    result = mod._refresh_one(mod.PLATFORMS["instagram"], now=NOW, check_only=True)
    assert "preview" in result
    assert urls == ["https://graph.instagram.com/v26.0/me"]


def test_refreshed_token_is_verified_before_persisting(monkeypatch):
    _tokens(monkeypatch)
    calls, writes = [], []
    def fake_get(url, *, token, params):
        calls.append((url, token, params))
        if url.endswith("refresh_access_token"):
            return {"access_token": "instagram-new-long-lived-token", "expires_in": 5184000}
        return {"id": "instagram-account"}
    monkeypatch.setattr(mod, "_get_json", fake_get)
    monkeypatch.setattr(mod, "_recently_updated", lambda *a: False)
    monkeypatch.setattr(mod, "_persist", lambda secret, token: writes.append((secret, token)))
    status = mod._refresh_one(mod.PLATFORMS["instagram"], now=NOW, check_only=False)
    assert "refreshed and saved" in status
    assert writes == [("INSTAGRAM_ACCESS_TOKEN", "instagram-new-long-lived-token")]
    assert calls[1][2] == {"grant_type": "ig_refresh_token", "access_token": "instagram-old-long-lived-token"}
    assert calls[-1][1] == "instagram-new-long-lived-token"


def test_wrong_account_never_overwrites_secret(monkeypatch):
    _tokens(monkeypatch)
    def fake_get(url, *, token, params):
        if url.endswith("refresh_access_token"):
            return {"access_token": "refreshed-long-lived-threads", "expires_in": 5184000}
        return {"id": "account-OTHER" if token.startswith("refreshed") else "account-ORIGINAL"}
    monkeypatch.setattr(mod, "_get_json", fake_get)
    monkeypatch.setattr(mod, "_recently_updated", lambda *a: False)
    monkeypatch.setattr(mod, "_persist", lambda *a: (_ for _ in ()).throw(AssertionError("wrote secret")))
    with pytest.raises(mod.RefreshError, match="different account"):
        mod._refresh_one(mod.PLATFORMS["threads"], now=NOW, check_only=False)


@pytest.mark.parametrize("response", [
    {"access_token": "tiny", "expires_in": 5184000},
    {"access_token": "new-long-lived", "expires_in": 60},
    {"access_token": "new-long-lived"},
])
def test_invalid_refresh_response_keeps_old_secret(monkeypatch, response):
    _tokens(monkeypatch)
    monkeypatch.setattr(mod, "_get_json", lambda url, **kw:
        response if url.endswith("refresh_access_token") else {"id": "threads-id"})
    monkeypatch.setattr(mod, "_recently_updated", lambda *a: False)
    monkeypatch.setattr(mod, "_persist", lambda *a: (_ for _ in ()).throw(AssertionError("wrote secret")))
    with pytest.raises(mod.RefreshError):
        mod._refresh_one(mod.PLATFORMS["threads"], now=NOW, check_only=False)


def test_recent_manual_update_is_not_refreshed_inside_minimum_age(monkeypatch):
    _tokens(monkeypatch)
    monkeypatch.setattr(mod, "_get_json", lambda url, **kw: {"id": "threads-id"})
    monkeypatch.setattr(mod, "_recently_updated", lambda *a: True)
    monkeypatch.setattr(mod, "_persist", lambda *a: (_ for _ in ()).throw(AssertionError("secret write")))
    status = mod._refresh_one(mod.PLATFORMS["threads"], now=NOW, check_only=False)
    assert "deferred" in status


def test_github_write_failure_fails_closed(monkeypatch):
    def fake_run(*args, **kwargs):
        return subprocess.CompletedProcess(args[0], 1, "", "contains a token NEVER PRINT THIS")
    monkeypatch.setattr(mod.subprocess, "run", fake_run)
    with pytest.raises(mod.RefreshError) as caught:
        mod._persist("THREADS_ACCESS_TOKEN", "new-secret-value")
    assert "NEVER PRINT THIS" not in str(caught.value)


def test_meta_failure_never_echoes_response_body_or_url(monkeypatch):
    class FakeResponse:
        status_code = 401
        text = "access_token=highly-secret-value"
        def json(self):
            return {"error": {"code": 190, "message": self.text}}
    monkeypatch.setattr(mod.requests, "get", lambda *a, **kw: FakeResponse())
    with pytest.raises(mod.RefreshError) as caught:
        mod._get_json("https://graph.threads.net/refresh_access_token",
                      token="highly-secret-value", params={"access_token": "highly-secret-value"})
    assert "highly-secret-value" not in str(caught.value)
    assert "190" in str(caught.value)



def test_untrusted_meta_error_code_cannot_echo_token(monkeypatch):
    class FakeResponse:
        status_code = 400
        def json(self):
            return {"error": {"code": "access_token=secret-leak", "message": "secret-leak"}}
    monkeypatch.setattr(mod.requests, "get", lambda *a, **kw: FakeResponse())
    with pytest.raises(mod.RefreshError) as caught:
        mod._get_json("https://graph.threads.net/refresh_access_token",
                      token="secret-leak", params={"access_token": "secret-leak"})
    assert "secret-leak" not in str(caught.value)
    assert "unknown" in str(caught.value)


def test_refresh_requires_scoped_app_before_request(monkeypatch):
    _tokens(monkeypatch)
    monkeypatch.setenv("GITHUB_REPOSITORY", mod.REPOSITORY)
    monkeypatch.delenv("GH_TOKEN", raising=False)
    monkeypatch.setattr(mod, "_get_json", lambda *a, **kw: (_ for _ in ()).throw(AssertionError("network request")))
    assert mod.main(["--refresh", "--platform", "instagram"]) == 1


def test_weekly_workflow_is_disabled_until_explicitly_enabled():
    path = Path(__file__).resolve().parents[1] / ".github/workflows/meta-token-refresh.yml"
    workflow = path.read_text()
    assert "vars.META_TOKEN_AUTO_REFRESH_ENABLED == 'true'" in workflow
    assert "permission-secrets: write" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "default: false" in workflow  # live manual refresh is opt-in
    assert "pull_request:" not in workflow
    assert "TH_RUNTIME_TOKEN" not in workflow
