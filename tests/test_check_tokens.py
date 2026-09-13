"""Tests for the long-lived token health probe."""

import pytest

from scripts.automation import check_tokens

PROBE = check_tokens.Probe(
    platform="Fake",
    user_id_env="FAKE_USER_ID",
    token_env="FAKE_TOKEN",
    verify=None,
    rotation="Rotate the fake token.",
)


def _probe(verify, **overrides):
    return PROBE._replace(verify=verify, **overrides)


def test_missing_credentials_are_skipped_without_calling_the_api():
    def verify(user_id, token):  # pragma: no cover - must not run
        raise AssertionError("verify must not be called without credentials")

    result = check_tokens.run_probe(_probe(verify), {})

    assert result.status == "skipped"
    assert "FAKE_USER_ID, FAKE_TOKEN" in result.detail


def test_partially_configured_credentials_are_skipped():
    result = check_tokens.run_probe(
        _probe(lambda user_id, token: {}), {"FAKE_USER_ID": "42", "FAKE_TOKEN": "  "}
    )

    assert result.status == "skipped"
    assert result.detail == "not configured (FAKE_TOKEN)"


def test_whitespace_only_credentials_are_skipped():
    result = check_tokens.run_probe(
        _probe(lambda user_id, token: {}), {"FAKE_USER_ID": " ", "FAKE_TOKEN": " "}
    )

    assert result.status == "skipped"


def test_valid_credentials_pass_the_stored_values_through():
    seen = {}

    def verify(user_id, token):
        seen["args"] = (user_id, token)
        return {"id": user_id}

    result = check_tokens.run_probe(_probe(verify), {"FAKE_USER_ID": " 42 ", "FAKE_TOKEN": "t"})

    assert result.status == "ok"
    assert seen["args"] == ("42", "t")


def test_a_rejected_token_fails_with_rotation_instructions():
    def verify(user_id, token):
        raise RuntimeError("❌ Fake API error 401: token expired")

    result = check_tokens.run_probe(_probe(verify), {"FAKE_USER_ID": "42", "FAKE_TOKEN": "t"})

    assert result.status == "failed"
    assert "token expired" in result.detail
    assert result.rotation == "Rotate the fake token."


def test_report_exits_non_zero_on_failure_without_echoing_the_token(capsys, monkeypatch):
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    token = "super-secret-token"

    def verify(user_id, secret):
        raise RuntimeError("401 rejected")

    result = check_tokens.run_probe(_probe(verify), {"FAKE_USER_ID": "42", "FAKE_TOKEN": token})
    exit_code = check_tokens.report([result])
    output = capsys.readouterr().out

    assert exit_code == 1
    assert token not in output
    assert "::error::Fake credential check failed" in output
    assert "Rotate the fake token." in output


def test_report_is_green_when_every_probe_passes(capsys, monkeypatch):
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    results = [
        check_tokens.ProbeResult("Threads", "ok", "authenticated", "rotate threads"),
        check_tokens.ProbeResult("Instagram", "skipped", "not configured (X)", "rotate ig"),
    ]

    exit_code = check_tokens.report(results)
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "✅ **Threads**: authenticated" in output
    assert "⏭️ **Instagram**: not configured (X)" in output
    assert "Not configured (skipped): Instagram" in output


def test_report_writes_the_step_summary(tmp_path, capsys, monkeypatch):
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))

    check_tokens.report(
        [check_tokens.ProbeResult("Threads", "failed", "401", "rotate threads")]
    )

    written = summary.read_text(encoding="utf-8")
    assert "### Token health" in written
    assert "rotate threads" in written
    assert capsys.readouterr().out.strip()


def test_main_runs_every_configured_probe(capsys, monkeypatch):
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    calls = []

    def fake_verify(user_id, token):
        calls.append(user_id)
        return {}

    probes = (
        _probe(fake_verify, platform="One"),
        _probe(fake_verify, platform="Two"),
    )
    monkeypatch.setattr(check_tokens, "PROBES", probes)
    monkeypatch.setenv("FAKE_USER_ID", "42")
    monkeypatch.setenv("FAKE_TOKEN", "t")

    assert check_tokens.main([]) == 0
    assert calls == ["42", "42"]
    assert "✅ **One**" in capsys.readouterr().out


def test_production_probes_cover_the_expiring_tokens():
    platforms = {probe.platform for probe in check_tokens.PROBES}
    env_names = {probe.token_env for probe in check_tokens.PROBES}

    assert platforms == {"Threads", "Instagram"}
    assert env_names == {"THREADS_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN"}


@pytest.mark.parametrize("probe", check_tokens.PROBES, ids=lambda probe: probe.platform)
def test_every_probe_reuses_a_publisher_preflight(probe):
    assert callable(probe.verify)
    assert probe.rotation
