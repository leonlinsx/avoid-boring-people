"""Tests for the IndexNow submission that replaced the retired sitemap pings."""

import json
from urllib.error import HTTPError, URLError

import pytest

from scripts.automation import submit_indexnow as indexnow_module

HOST = "leonlins.com"
KEY = "a84f78d24790ed123e7a736ea0abfe64"
URL = "https://leonlins.com/writing/excel/"


@pytest.fixture
def key_file(tmp_path):
    path = tmp_path / f"{KEY}.txt"
    path.write_text(f"{KEY}\n", encoding="utf-8")
    return str(path)


def _run(argv, monkeypatch, *, verify=None, post=None):
    calls = {"verify": [], "payload": None}

    def fake_verify(key_location, key, **kwargs):
        calls["verify"].append((key_location, key))
        if verify is not None:
            verify(key_location, key)

    def fake_post(payload, **kwargs):
        calls["payload"] = payload
        return 202 if post is None else post(payload)

    monkeypatch.setattr(indexnow_module, "verify_key_location", fake_verify)
    monkeypatch.setattr(indexnow_module, "submit", fake_post)
    return indexnow_module.main(argv), calls


# --- key handling -------------------------------------------------------------

def test_read_key_accepts_a_well_formed_key_file(key_file):
    assert indexnow_module.read_key(key_file) == KEY


def test_read_key_rejects_a_key_that_indexnow_would_not_accept(tmp_path):
    path = tmp_path / "short.txt"
    path.write_text("abc\n", encoding="utf-8")

    with pytest.raises(ValueError):
        indexnow_module.read_key(str(path))


def test_committed_key_file_matches_its_served_location():
    """The key file in `public/` is what the live key location must serve."""
    from pathlib import Path

    import scripts.automation.submit_indexnow as module

    root = Path(module.__file__).resolve().parents[2]
    key_files = [
        path
        for path in sorted((root / "public").glob("*.txt"))
        if indexnow_module.KEY_PATTERN.match(path.stem)
    ]

    assert len(key_files) == 1, f"expected exactly one IndexNow key file, found {key_files}"
    assert indexnow_module.read_key(str(key_files[0])) == key_files[0].stem
    assert indexnow_module.key_location_for(HOST, KEY) == f"https://{HOST}/{KEY}.txt"


def test_verify_key_location_rejects_a_key_file_that_serves_something_else(monkeypatch):
    class FakeResponse:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b"a different key"

    monkeypatch.setattr(indexnow_module, "urlopen", lambda request, timeout=None: FakeResponse())

    with pytest.raises(RuntimeError, match="does not serve the configured key"):
        indexnow_module.verify_key_location("https://leonlins.com/key.txt", KEY)


def test_verify_key_location_fails_loudly_when_the_key_file_is_missing(monkeypatch):
    def fail(request, timeout=None):
        raise HTTPError(request.full_url, 404, "Not Found", None, None)

    monkeypatch.setattr(indexnow_module, "urlopen", fail)

    with pytest.raises(RuntimeError, match="not reachable"):
        indexnow_module.verify_key_location("https://leonlins.com/key.txt", KEY)


# --- payload ------------------------------------------------------------------

def test_build_payload_deduplicates_urls_and_sets_the_key_location():
    payload = indexnow_module.build_payload(HOST, KEY, [URL, URL])

    assert payload == {
        "host": HOST,
        "key": KEY,
        "keyLocation": f"https://{HOST}/{KEY}.txt",
        "urlList": [URL],
    }


def test_build_payload_rejects_urls_from_another_host():
    with pytest.raises(ValueError, match="does not belong to host"):
        indexnow_module.build_payload(HOST, KEY, ["https://example.com/writing/x/"])


def test_build_payload_rejects_an_empty_submission():
    with pytest.raises(ValueError, match="no URLs to submit"):
        indexnow_module.build_payload(HOST, KEY, [])


def test_read_urls_accepts_wait_for_deploy_tsv_output(tmp_path):
    path = tmp_path / "urls.tsv"
    path.write_text(f"2016_03_17_excel/index.md\t{URL}\n\n{URL}\n", encoding="utf-8")

    assert indexnow_module.read_urls(str(path)) == [URL, URL]


# --- submission ---------------------------------------------------------------

def test_submit_posts_json_and_returns_the_accepted_status(monkeypatch):
    seen = {}

    class FakeResponse:
        status = 202

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def fake_urlopen(request, timeout=None):
        seen["url"] = request.full_url
        seen["method"] = request.get_method()
        seen["body"] = json.loads(request.data.decode("utf-8"))
        seen["content_type"] = request.get_header("Content-type")
        seen["user_agent"] = request.get_header("User-agent")
        return FakeResponse()

    monkeypatch.setattr(indexnow_module, "urlopen", fake_urlopen)
    payload = indexnow_module.build_payload(HOST, KEY, [URL])

    assert indexnow_module.submit(payload) == 202
    assert seen["url"] == indexnow_module.INDEXNOW_ENDPOINT
    assert seen["method"] == "POST"
    assert seen["body"] == payload
    assert "application/json" in seen["content_type"]
    assert "avoid-boring-people" in seen["user_agent"]


@pytest.mark.parametrize(
    "status, expected",
    [
        (403, "the key is not valid for this host"),
        (422, "do not belong to the host"),
        (429, "too many submissions"),
        (400, "the request format was invalid"),
    ],
)
def test_submit_explains_each_rejection_status(monkeypatch, status, expected):
    def fail(request, timeout=None):
        raise HTTPError(request.full_url, status, "error", None, None)

    monkeypatch.setattr(indexnow_module, "urlopen", fail)

    with pytest.raises(RuntimeError, match=expected):
        indexnow_module.submit(indexnow_module.build_payload(HOST, KEY, [URL]))


def test_submit_rejects_an_unexpected_success_status(monkeypatch):
    class FakeResponse:
        status = 204

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(indexnow_module, "urlopen", lambda request, timeout=None: FakeResponse())

    with pytest.raises(RuntimeError, match="not an accepted submission"):
        indexnow_module.submit(indexnow_module.build_payload(HOST, KEY, [URL]))


def test_submit_reports_a_transport_failure(monkeypatch):
    def fail(request, timeout=None):
        raise URLError("connection refused")

    monkeypatch.setattr(indexnow_module, "urlopen", fail)

    with pytest.raises(RuntimeError, match="submission failed"):
        indexnow_module.submit(indexnow_module.build_payload(HOST, KEY, [URL]))


# --- CLI ----------------------------------------------------------------------

def test_cli_verifies_the_key_location_before_submitting(key_file, monkeypatch):
    exit_code, calls = _run(["--key-file", key_file, "--url", URL], monkeypatch)

    assert exit_code == 0
    assert calls["verify"] == [(f"https://{HOST}/{KEY}.txt", KEY)]
    assert calls["payload"]["urlList"] == [URL]


def test_cli_never_submits_when_the_key_file_is_not_served(key_file, monkeypatch):
    def reject(key_location, key):
        raise RuntimeError("IndexNow key file is not reachable")

    exit_code, calls = _run(["--key-file", key_file, "--url", URL], monkeypatch, verify=reject)

    assert exit_code == 1
    assert calls["payload"] is None, "a submission without a live key file would be rejected as spam"


def test_cli_dry_run_verifies_without_submitting(key_file, monkeypatch, capsys):
    exit_code, calls = _run(["--key-file", key_file, "--url", URL, "--dry-run"], monkeypatch)

    assert exit_code == 0
    assert calls["payload"] is None
    assert "would submit" in capsys.readouterr().out


def test_cli_reads_urls_from_a_file(key_file, monkeypatch, tmp_path):
    urls_file = tmp_path / "urls.tsv"
    urls_file.write_text(f"excel/index.md\t{URL}\n", encoding="utf-8")

    exit_code, calls = _run(
        ["--key-file", key_file, "--urls-file", str(urls_file)], monkeypatch
    )

    assert exit_code == 0
    assert calls["payload"]["urlList"] == [URL]


def test_cli_fails_when_there_is_nothing_to_submit(key_file, monkeypatch, capsys):
    exit_code = indexnow_module.main(["--key-file", key_file])

    assert exit_code == 1
    assert "::error::" in capsys.readouterr().out


def test_cli_fails_when_the_key_file_is_missing(tmp_path, capsys):
    exit_code = indexnow_module.main(["--key-file", str(tmp_path / "missing.txt"), "--url", URL])

    assert exit_code == 1
    assert "::error::" in capsys.readouterr().out
