"""Tests for the bounded deployment readiness wait used by the social workflows."""

import sys
from urllib.error import URLError

import pytest

from scripts.automation import wait_for_deploy as wait_module


class FakeClock:
    """Deterministic clock: time only advances through the injected sleep."""

    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


def _index(*ids):
    return [{"id": post_id, "title": post_id, "url": f"https://leonlins.com/writing/{post_id}/"} for post_id in ids]


def _waiter(clock, indexes=None, fetch_error=None, live=None, **overrides):
    """Build a wait call with a scripted sequence of deployed index states."""
    states = list(indexes or [])
    calls = {"fetch": 0, "live": []}

    def fetch(site_url):
        calls["fetch"] += 1
        if fetch_error is not None:
            raise fetch_error
        if not states:
            return []
        return states.pop(0) if len(states) > 1 else states[0]

    def is_live(url):
        calls["live"].append(url)
        return url in live if live is not None else True

    def log(_message):
        return None

    return wait_module.wait_for_post_urls, {
        "fetch": fetch,
        "is_live": is_live,
        "sleep": clock.sleep,
        "monotonic": clock.monotonic,
        "log": log,
        **overrides,
    }, calls


# --- id normalization ---------------------------------------------------------

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("src/content/blog/2016_03_17_excel/index.md", "2016_03_17_excel/index.md"),
        ("2016_03_17_excel/index.md", "2016_03_17_excel/index.md"),
        ("  ./src/content/blog/notes.md\n", "notes.md"),
        ("", ""),
    ],
)
def test_normalize_post_id_accepts_repo_paths_and_index_ids(raw, expected):
    assert wait_module.normalize_post_id(raw) == expected


def test_read_post_ids_ignores_blank_lines(tmp_path):
    path = tmp_path / "ids.txt"
    path.write_text("src/content/blog/a/index.md\n\n  \nb/index.md\n", encoding="utf-8")

    assert wait_module.read_post_ids(str(path)) == ["a/index.md", "b/index.md"]


# --- wait behavior -----------------------------------------------------------

def test_wait_returns_resolved_urls_without_sleeping_when_already_deployed():
    clock = FakeClock()
    waiter, kwargs, calls = _waiter(clock, indexes=[_index("a/index.md", "b/index.md")])

    urls = waiter(["src/content/blog/a/index.md", "b/index.md"], **kwargs)

    assert urls == {
        "a/index.md": "https://leonlins.com/writing/a/index.md/",
        "b/index.md": "https://leonlins.com/writing/b/index.md/",
    }
    assert clock.sleeps == []
    assert calls["fetch"] == 1


def test_wait_without_ids_does_not_read_the_index():
    clock = FakeClock()
    waiter, kwargs, calls = _waiter(clock)

    assert waiter([], **kwargs) == {}
    assert calls["fetch"] == 0
    assert clock.sleeps == []


def test_wait_retries_until_the_deployed_index_contains_the_article():
    clock = FakeClock()
    waiter, kwargs, calls = _waiter(
        clock,
        indexes=[_index("other/index.md"), _index("other/index.md"), _index("new/index.md")],
        timeout=60,
        interval=15,
    )

    urls = waiter(["new/index.md"], **kwargs)

    assert urls == {"new/index.md": "https://leonlins.com/writing/new/index.md/"}
    assert calls["fetch"] == 3
    assert clock.sleeps == [15, 15]


def test_wait_retries_when_the_index_lists_an_article_whose_page_is_not_live_yet():
    clock = FakeClock()
    live = {"https://leonlins.com/writing/new/index.md/"}
    waiter, kwargs, calls = _waiter(clock, indexes=[_index("new/index.md")], live=set(), timeout=30, interval=10)

    with pytest.raises(wait_module.DeployTimeout):
        waiter(["new/index.md"], **kwargs)

    assert calls["live"], "the live page must be confirmed, not just the index entry"

    clock = FakeClock()
    waiter, kwargs, _ = _waiter(clock, indexes=[_index("new/index.md")], live=live, timeout=30, interval=10)
    assert waiter(["new/index.md"], **kwargs) == {
        "new/index.md": "https://leonlins.com/writing/new/index.md/"
    }
    assert clock.sleeps == []


def test_wait_fails_loudly_with_the_missing_ids_after_the_deadline():
    clock = FakeClock()
    waiter, kwargs, calls = _waiter(clock, indexes=[_index("other/index.md")], timeout=12, interval=5)

    with pytest.raises(wait_module.DeployTimeout) as error:
        waiter(["new/index.md"], **kwargs)

    message = str(error.value)
    assert "new/index.md" in message
    assert "12s" in message
    assert "workflow_dispatch" in message
    assert clock.sleeps == [5, 5, 2]
    assert calls["fetch"] == 4


def test_wait_reports_the_last_index_read_failure_when_it_gives_up():
    clock = FakeClock()
    waiter, kwargs, _ = _waiter(clock, fetch_error=URLError("connection refused"), timeout=5, interval=5)

    with pytest.raises(wait_module.DeployTimeout) as error:
        waiter(["new/index.md"], **kwargs)

    assert "Last index read failed with" in str(error.value)
    assert "connection refused" in str(error.value)


def test_wait_deduplicates_ids_that_name_the_same_article_twice():
    clock = FakeClock()
    waiter, kwargs, _ = _waiter(clock, indexes=[_index("a/index.md")])

    urls = waiter(["a/index.md", "src/content/blog/a/index.md"], **kwargs)

    assert list(urls) == ["a/index.md"]


# --- CLI ---------------------------------------------------------------------

def test_cli_writes_resolved_urls_for_later_steps(tmp_path, monkeypatch):
    ids_file = tmp_path / "ids.txt"
    ids_file.write_text("src/content/blog/a/index.md\n", encoding="utf-8")
    urls_file = tmp_path / "urls.tsv"

    monkeypatch.setattr(
        wait_module,
        "wait_for_post_urls",
        lambda post_ids, **kwargs: {"a/index.md": "https://leonlins.com/writing/a/"},
    )

    exit_code = wait_module.main(
        ["--post-id-file", str(ids_file), "--urls-file", str(urls_file)]
    )

    assert exit_code == 0
    assert urls_file.read_text(encoding="utf-8") == "a/index.md\thttps://leonlins.com/writing/a/\n"


def test_cli_fails_with_an_annotation_when_the_deployment_never_arrives(monkeypatch, capsys):
    def raise_timeout(post_ids, **kwargs):
        raise wait_module.DeployTimeout("Deployment is not serving these articles after 600s:\n  - a/index.md")

    monkeypatch.setattr(wait_module, "wait_for_post_urls", raise_timeout)

    exit_code = wait_module.main(["--post-id", "a/index.md"])

    assert exit_code == 1
    output = capsys.readouterr().out.strip()
    assert output.startswith("::error::")
    assert "a/index.md" in output
    assert "\n" not in output


def test_cli_fails_when_the_post_id_file_cannot_be_read(tmp_path, capsys):
    exit_code = wait_module.main(["--post-id-file", str(tmp_path / "missing.txt")])

    assert exit_code == 1
    assert "::error::" in capsys.readouterr().out


def test_cli_is_a_no_op_when_the_push_added_no_articles(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["wait_for_deploy"])

    assert wait_module.main([]) == 0
    assert "nothing to do" in capsys.readouterr().out.lower()
