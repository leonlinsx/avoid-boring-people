import json
from datetime import datetime, timedelta, timezone

import pytest

from scripts.scout import cli, filtering, state
from scripts.scout.discovery import Candidate, DiscoveryResult, SourceReport
from scripts.scout.errors import ScoutError
from scripts.scout.inventory import ContentItem
from scripts.scout.matching import Match

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
PUBLISHED = (NOW - timedelta(days=1)).isoformat()
DRAFT = (
    "The incentive to look busy is usually stronger than the incentive to be right, which is "
    "why the failure shows up as confident ritual rather than as an obvious error."
)


def _item(content_id="market-failure"):
    return ContentItem(
        content_id=content_id,
        title="When markets fail quietly",
        url=f"https://leonlins.com/writing/{content_id}",
        published_at="2021-01-01",
        category="Investing",
        tags=("investing", "risk"),
        summary="Risk hides in the parts of a market nobody prices.",
        body="Risk hides in the parts of a market nobody prices.",
    )


def _candidate(url="https://news.ycombinator.com/item?id=1", *, activity=12):
    return Candidate(
        source="hacker-news",
        external_url=url,
        title="Investing risk nobody prices",
        author="someone",
        community="Hacker News",
        published_at=PUBLISHED,
        body="Nobody here has named what the mispricing actually pays for.",
        activity=activity,
    )


def _match(url="https://news.ycombinator.com/item?id=1", *, activity=12):
    return Match(candidate=_candidate(url, activity=activity), item=_item(), score=6, matched_terms=("investing",))


def _discovery_result(urls=("https://news.ycombinator.com/item?id=1",)):
    return DiscoveryResult(
        candidates=tuple(_candidate(url) for url in urls),
        sources=(
            SourceReport("hacker-news", attempted=True, ok=True, found=len(urls)),
            SourceReport("bluesky", attempted=False, ok=False, found=0, note="not configured"),
        ),
        queries=("investing",),
    )


def _install_run(monkeypatch, *, urls=("https://news.ycombinator.com/item?id=1",), verdict="STRONG"):
    monkeypatch.setattr(cli, "load_inventory", lambda: [_item()])
    monkeypatch.setattr(cli.discovery, "discover", lambda queries, **kwargs: _discovery_result(urls))
    monkeypatch.setattr(cli.matching, "build_queries", lambda items, override=None, **kwargs: ["investing"])
    monkeypatch.setattr(cli.filtering, "llm_required", lambda: True)

    def fake_judge(match, *, items, items_by_id):
        return filtering.Judgment(
            match=match,
            verdict=verdict,
            reason="because",
            why_now="the thread is live",
            why_fits="the article names the mechanism",
            draft=DRAFT,
            link=False,
            link_reason="no link needed",
        )

    monkeypatch.setattr(cli.filtering, "judge_match", fake_judge)


def test_dry_run_reports_opportunities_and_writes_no_state(monkeypatch, capsys, use_temp_scout_state):
    path = use_temp_scout_state
    _install_run(monkeypatch)

    code = cli.main(["run", "--dry-run"])

    output = capsys.readouterr().out
    assert code == 0
    assert "Opportunities that would have been surfaced" in output
    assert DRAFT in output
    assert "Dry run" in output
    assert not path.exists()


def test_a_real_run_records_the_opportunity_and_can_be_read_back(monkeypatch, capsys, use_temp_scout_state):
    path = use_temp_scout_state
    _install_run(monkeypatch)

    assert cli.main(["run"]) == 0

    recorded = json.loads(path.read_text(encoding="utf-8"))["opportunities"]
    assert list(recorded) == ["https://news.ycombinator.com/item?id=1"]
    assert recorded["https://news.ycombinator.com/item?id=1"]["status"] == state.STATUS_SURFACED
    assert recorded["https://news.ycombinator.com/item?id=1"]["draft"] == DRAFT


def test_a_second_run_never_surfaces_the_same_conversation_twice(monkeypatch, capsys, use_temp_scout_state):
    path = use_temp_scout_state
    _install_run(monkeypatch)
    cli.main(["run"])

    code = cli.main(["run"])

    output = capsys.readouterr().out
    assert code == 0
    assert "Recorded 0 surfaced opportunity(ies)" in output
    assert "already recorded by an earlier run" in output
    assert len(json.loads(path.read_text(encoding="utf-8"))["opportunities"]) == 1


def test_a_live_run_surfaces_at_most_the_configured_number(monkeypatch, capsys, use_temp_scout_state):
    monkeypatch.setenv("SCOUT_MAX_OPPORTUNITIES", "1")
    _install_run(monkeypatch, urls=("https://news.ycombinator.com/item?id=1", "https://news.ycombinator.com/item?id=2"))

    assert cli.main(["run"]) == 0

    output = capsys.readouterr().out
    assert "Recorded 1 surfaced opportunity(ies)" in output
    assert state.load_state()["opportunities"].keys() == {"https://news.ycombinator.com/item?id=1"}


def test_no_opportunities_is_a_successful_run(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch, verdict="REJECT")

    assert cli.main(["run"]) == 0

    output = capsys.readouterr().out
    assert "No high-confidence Scout opportunities found." in output
    assert state.load_state()["opportunities"] == {}


def test_a_real_run_without_a_configured_model_fails_loudly(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch)
    monkeypatch.setattr(cli.filtering, "llm_required", lambda: False)
    monkeypatch.setattr(cli.discovery, "discover", lambda queries, **kwargs: pytest.fail("no search expected"))

    assert cli.main(["run"]) == 1

    assert "no judgment model is configured" in capsys.readouterr().out


def test_no_llm_is_refused_without_a_dry_run(capsys, use_temp_scout_state):
    assert cli.main(["run", "--no-llm"]) == 1

    assert "--no-llm is only available with --dry-run" in capsys.readouterr().out


def test_no_llm_dry_run_reports_decisions_without_judging(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch)
    monkeypatch.setattr(cli.filtering, "judge_match", lambda *args, **kwargs: pytest.fail("no call expected"))

    assert cli.main(["run", "--dry-run", "--no-llm"]) == 0

    output = capsys.readouterr().out
    assert "UNJUDGED" in output
    assert "none (--no-llm)" in output


def test_an_empty_archive_stops_the_run(monkeypatch, capsys, use_temp_scout_state):
    monkeypatch.setattr(cli, "load_inventory", lambda: [])
    monkeypatch.setattr(cli.filtering, "llm_required", lambda: True)

    assert cli.main(["run", "--dry-run"]) == 1

    assert "no content" in capsys.readouterr().out


def test_every_source_failing_stops_the_run(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch)
    monkeypatch.setattr(
        cli.discovery,
        "discover",
        lambda queries, **kwargs: DiscoveryResult(
            sources=(SourceReport("hacker-news", attempted=True, ok=False, found=0, note="ScoutError: down"),)
        ),
    )

    assert cli.main(["run", "--dry-run"]) == 1

    output = capsys.readouterr().out
    assert "scout_source_unavailable hacker-news" in output
    assert "every discovery source failed" in output


def test_a_reachable_source_with_no_candidates_stops_the_run(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch, urls=())
    monkeypatch.setattr(
        cli.discovery,
        "discover",
        lambda queries, **kwargs: DiscoveryResult(
            sources=(SourceReport("hacker-news", attempted=True, ok=True, found=0),)
        ),
    )

    assert cli.main(["run", "--dry-run"]) == 1

    # Answering happily with nothing is what an upstream change in query
    # semantics looks like, so it must be loud rather than a green no-op.
    assert "returned no candidates" in capsys.readouterr().out


def test_a_quiet_query_with_candidates_that_do_not_survive_still_reports(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch, verdict="MAYBE")

    # Discovery did its job, so a run whose candidates all failed the confidence
    # bar is an ordinary quiet day rather than a broken one.
    assert cli.main(["run", "--dry-run"]) == 0

    assert "No high-confidence Scout opportunities found." in capsys.readouterr().out


def test_an_unknown_llm_provider_fails_the_run_in_one_line(monkeypatch, capsys, use_temp_scout_state):
    monkeypatch.setattr(cli, "load_inventory", lambda: [_item()])
    monkeypatch.setenv("SOCIAL_LLM_PROVIDER", "openai")

    assert cli.main(["run", "--dry-run"]) == 1

    output = capsys.readouterr().out
    assert "openai" in output
    assert "Traceback" not in output


def test_explicit_queries_replace_the_derived_ones(monkeypatch, use_temp_scout_state):
    seen = {}

    def fake_discover(queries, **kwargs):
        seen["queries"] = list(queries)
        return _discovery_result()

    monkeypatch.setattr(cli, "load_inventory", lambda: [_item()])
    monkeypatch.setattr(cli.discovery, "discover", fake_discover)
    monkeypatch.setattr(cli.filtering, "llm_required", lambda: False)

    assert cli.main(["run", "--dry-run", "--no-llm", "--queries", " prediction markets , index funds "]) == 0

    assert seen["queries"] == ["prediction markets", "index funds"]


def test_the_step_summary_receives_the_same_report(monkeypatch, tmp_path, capsys, use_temp_scout_state):
    summary_file = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary_file))
    _install_run(monkeypatch)

    assert cli.main(["run"]) == 0

    written = summary_file.read_text(encoding="utf-8")
    assert "Lin Scout" in written
    assert DRAFT in written


def test_list_dismiss_and_acted_track_what_the_author_did(monkeypatch, capsys, use_temp_scout_state):
    path = use_temp_scout_state
    _install_run(monkeypatch)
    cli.main(["run"])
    capsys.readouterr()

    assert cli.main(["list"]) == 0
    assert "surfaced" in capsys.readouterr().out

    assert cli.main(["dismiss", "https://news.ycombinator.com/item?id=1"]) == 0
    capsys.readouterr()
    assert state.load_state()["opportunities"]["https://news.ycombinator.com/item?id=1"]["status"] == "dismissed"

    assert cli.main(["list", "--status", "acted"]) == 0
    assert "No scout opportunities recorded yet." in capsys.readouterr().out

    assert cli.main(["acted", "https://news.ycombinator.com/item?id=1", "--outcome", "replied"]) == 0
    entry = json.loads(path.read_text(encoding="utf-8"))["opportunities"]["https://news.ycombinator.com/item?id=1"]
    assert entry["status"] == "acted"
    assert entry["outcome"] == "replied"


def test_marking_an_unknown_url_fails_instead_of_inventing_history(capsys, use_temp_scout_state):
    assert cli.main(["dismiss", "https://news.ycombinator.com/item?id=999"]) == 1

    assert "not a recorded scout opportunity" in capsys.readouterr().out


def test_environment_overrides_are_read_at_call_time_not_import_time(monkeypatch, capsys, use_temp_scout_state):
    _install_run(monkeypatch)
    monkeypatch.setenv("SCOUT_MAX_OPPORTUNITIES", "0")

    assert cli.main(["run"]) == 0

    assert "No high-confidence Scout opportunities found." in capsys.readouterr().out


def test_a_scout_error_is_reported_with_a_non_zero_exit(monkeypatch, capsys, use_temp_scout_state):
    monkeypatch.setattr(cli, "load_inventory", lambda: (_ for _ in ()).throw(ScoutError("❌ index unreachable")))
    monkeypatch.setattr(cli.filtering, "llm_required", lambda: True)

    assert cli.main(["run", "--dry-run"]) == 1

    assert "index unreachable" in capsys.readouterr().out
