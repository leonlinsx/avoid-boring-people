"""Tests for the Jev shadow experiment: off by default, never authoritative.

Nothing here reaches the network. The SDK is replaced at its one seam
(`jev._client`) by a fake that records what it was asked, and the package itself
is not installed in the test environment — which is also how the scheduled
workflow runs, so the import path is exercised the way CI exercises it.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Tuple

import pytest

from scripts.scout import cli, filtering, jev, state
from scripts.scout.discovery import Candidate, DiscoveryResult, SourceReport
from scripts.scout.inventory import ContentItem
from scripts.scout.matching import Match

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
PUBLISHED = (NOW - timedelta(days=1)).isoformat()
DRAFT = (
    "The incentive to look busy is usually stronger than the incentive to be right, which is "
    "why the failure shows up as confident ritual rather than as an obvious error."
)
# A value that must never appear in a log line, a record, or the committed state.
API_KEY = "ts_shadow_key_that_must_never_be_written"


class TypeSafeAPITimeoutError(Exception):
    """A stand-in for the SDK's own error class, name included."""


class TypeSafeAPIError(Exception):
    """A stand-in for the SDK's own error class, name included."""


class _NoulAnswer:
    def __init__(self, noul: float) -> None:
        self.noul = noul


class _ScoreAnswer:
    def __init__(self, score: float, confidence: float = 0.9) -> None:
        self.score = score
        self.confidence = confidence
        self.legend = {0: "not worth it", 1: "reasonable", 2: "unusually good"}
        self.probabilities = {0: 0.1, 1: 0.2, 2: 0.7}


class _Usage:
    input_tokens = 380
    output_tokens = 42


class _Response:
    """The shape `SystemOneResponse` exposes: whatever answered, keyed by question."""

    def __init__(self, *, nouls=None, scores=None, model: str = "jev-latest") -> None:
        self.model = model
        self.usage = _Usage()
        self.nouls = {name: _NoulAnswer(value) for name, value in (nouls or {}).items()}
        self.scores = {name: _ScoreAnswer(value) for name, value in (scores or {}).items()}


class _FakeClient:
    def __init__(self, calls, *, response=None, error=None) -> None:
        self.calls = calls
        self.response = response
        self.error = error

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def system_one(self, *, state, questions):
        self.calls.append({"state": state, "questions": questions})
        if self.error is not None:
            raise self.error
        return self.response


def _answers(**overrides) -> dict:
    values = {
        "content_fit": 0.8,
        "substantive_conversation": 0.9,
        "relationship_value": 0.6,
        "natural_contribution": 0.7,
    }
    values.update(overrides)
    return values


def _response(*, score: float = 1.8, **overrides) -> _Response:
    return _Response(nouls=_answers(**overrides), scores={jev.SCORE_DIMENSION: score})


def _install_jev(monkeypatch, *, response=None, error=None, sdk_available: bool = True, factory=None):
    calls = []
    monkeypatch.setattr(jev, "_sdk_available", lambda: sdk_available)
    monkeypatch.setattr(
        jev,
        "_client",
        factory or (lambda: _FakeClient(calls, response=response, error=error)),
    )
    return calls


def _use_paths(monkeypatch, directory: Path) -> Tuple[Path, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    state_path = directory / "scout-state.json"
    shadow_path = directory / "scout-shadow.jsonl"
    monkeypatch.setattr(state, "STATE_FILE", state_path)
    monkeypatch.setattr(jev, "SHADOW_FILE", shadow_path)
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    return state_path, shadow_path


def _item(content_id="market-failure", *, body="Risk hides in the parts of a market nobody prices."):
    return ContentItem(
        content_id=content_id,
        title="When markets fail quietly",
        url=f"https://leonlins.com/writing/{content_id}",
        published_at="2021-01-01",
        category="Investing",
        tags=("investing", "risk"),
        summary=body[:400],
        body=body,
    )


def _candidate(url="https://news.ycombinator.com/item?id=1", *, activity=12, published_at=PUBLISHED):
    return Candidate(
        source="hacker-news",
        external_url=url,
        title="Investing risk nobody prices",
        author="someone",
        community="Hacker News",
        published_at=published_at,
        body="Nobody here has named what the mispricing actually pays for.",
        activity=activity,
    )


def _match(url="https://news.ycombinator.com/item?id=1", *, activity=12):
    return Match(candidate=_candidate(url, activity=activity), item=_item(), score=6, matched_terms=("investing",))


def _discovery_result(urls=("https://news.ycombinator.com/item?id=1",), *, candidates=None):
    found = tuple(candidates) if candidates is not None else tuple(_candidate(url) for url in urls)
    return DiscoveryResult(
        candidates=found,
        sources=(
            SourceReport("hacker-news", attempted=True, ok=True, found=len(found)),
            SourceReport("bluesky", attempted=False, ok=False, found=0, note="not configured"),
        ),
        queries=("investing",),
    )


def _install_run(
    monkeypatch,
    *,
    urls=("https://news.ycombinator.com/item?id=1",),
    candidates=None,
    verdict="STRONG",
):
    monkeypatch.setattr(cli, "load_inventory", lambda: [_item()])
    monkeypatch.setattr(cli.discovery, "discover", lambda queries, **kwargs: _discovery_result(urls, candidates=candidates))
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


def _run_scout(
    monkeypatch,
    directory: Path,
    *,
    enabled: bool,
    response=None,
    error=None,
    sdk_available: bool = True,
    factory=None,
    argv=("run",),
):
    """One full Scout run with the shadow either switched on or left alone."""
    state_path, shadow_path = _use_paths(monkeypatch, directory)
    calls = _install_jev(monkeypatch, response=response, error=error, sdk_available=sdk_available, factory=factory)
    if enabled:
        monkeypatch.setenv(jev.FLAG_ENV, "1")
        monkeypatch.setenv(jev.KEY_ENV, API_KEY)
    else:
        monkeypatch.delenv(jev.FLAG_ENV, raising=False)
        monkeypatch.delenv(jev.KEY_ENV, raising=False)
    code = cli.main(list(argv))
    return code, calls, state_path, shadow_path


def _shadow_lines(path: Path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _without_timestamps(path: Path) -> dict:
    """Scout's committed state with the run's clock fields neutralized."""
    data = json.loads(path.read_text(encoding="utf-8"))
    for entry in (data.get("opportunities") or {}).values():
        for key in ("discovered_at", "surfaced_at"):
            if entry.get(key):
                entry[key] = "<when the run happened>"
    return data


def _added_lines(before, after) -> list:
    return [line for line in after if line not in before]


def _without_run_clock(text: str) -> list:
    """The run's own header carries the minute it started, which no two runs share."""
    return [line for line in text.splitlines() if not line.startswith("Lin Scout — ")]


# --- the switch -------------------------------------------------------------


@pytest.mark.parametrize("value", ["", "0", "false", "no", "off", "FALSE"])
def test_the_shadow_is_off_unless_it_is_switched_on(monkeypatch, value):
    monkeypatch.setenv(jev.FLAG_ENV, value)
    monkeypatch.setenv(jev.KEY_ENV, API_KEY)

    assert jev.blocker() == jev.NOT_ENABLED


@pytest.mark.parametrize("value", ["1", "true", "yes", "on", "TRUE"])
def test_the_shadow_is_ready_when_switched_on_with_a_key(monkeypatch, value):
    monkeypatch.setenv(jev.FLAG_ENV, value)
    monkeypatch.setenv(jev.KEY_ENV, API_KEY)
    monkeypatch.setattr(jev, "_sdk_available", lambda: True)

    assert jev.blocker() is None


def test_an_unusable_switch_value_is_reported_rather_than_guessed(monkeypatch):
    monkeypatch.setenv(jev.FLAG_ENV, "sure")
    monkeypatch.setenv(jev.KEY_ENV, API_KEY)

    assert "SCOUT_JEV_SHADOW" in jev.blocker()


def test_no_switch_at_all_is_a_silent_skip(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv(jev.KEY_ENV, API_KEY)
    _install_run(monkeypatch)

    code, calls, _, shadow_path = _run_scout(monkeypatch, tmp_path / "off", enabled=False)

    output = capsys.readouterr().out
    assert code == 0
    assert calls == []
    assert not shadow_path.exists()
    assert "jev" not in output


# --- a disabled shadow costs nothing and changes nothing --------------------


def test_a_disabled_run_never_constructs_a_client(monkeypatch, tmp_path, capsys):
    def explode():
        raise AssertionError("the shadow constructed a Jev client while it was switched off")

    _install_run(monkeypatch)
    code, _, state_path, shadow_path = _run_scout(monkeypatch, tmp_path / "off", enabled=False, factory=explode)

    output = capsys.readouterr().out
    assert code == 0
    assert "🔬" not in output
    assert not shadow_path.exists()
    assert state_path.exists()


def test_a_missing_key_skips_cleanly_and_says_so(monkeypatch, tmp_path, capsys):
    _install_run(monkeypatch)
    monkeypatch.setenv(jev.FLAG_ENV, "1")
    monkeypatch.setenv(jev.KEY_ENV, "   ")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    state_path, shadow_path = _use_paths(monkeypatch, tmp_path / "nokey")
    calls = _install_jev(monkeypatch, response=_response())

    code = cli.main(["run"])

    output = capsys.readouterr().out
    assert code == 0
    assert calls == []
    assert "scout_jev_shadow_unavailable" in output
    assert jev.MISSING_KEY in output
    assert not shadow_path.exists()
    assert _without_timestamps(state_path)["opportunities"]


def test_a_missing_sdk_skips_cleanly_and_says_so(monkeypatch, tmp_path, capsys):
    _install_run(monkeypatch)

    code, calls, state_path, shadow_path = _run_scout(
        monkeypatch, tmp_path / "nosdk", enabled=True, sdk_available=False
    )

    output = capsys.readouterr().out
    assert code == 0
    assert calls == []
    assert "scout_jev_shadow_unavailable" in output
    assert jev.MISSING_SDK in output
    assert not shadow_path.exists()
    assert _without_timestamps(state_path)["opportunities"]


# --- what a run with the shadow on records ----------------------------------


def test_each_judged_candidate_is_evaluated_once_and_recorded(monkeypatch, tmp_path, capsys):
    urls = ("https://news.ycombinator.com/item?id=1", "https://news.ycombinator.com/item?id=2")
    _install_run(monkeypatch, urls=urls)

    code, calls, _, shadow_path = _run_scout(
        monkeypatch, tmp_path / "on", enabled=True, response=_response(content_fit=0.42)
    )

    output = capsys.readouterr().out
    assert code == 0
    assert [call["state"]["conversation"]["title"] for call in calls] == ["Investing risk nobody prices"] * 2
    records = _shadow_lines(shadow_path)
    assert {record["candidate_id"] for record in records} == set(urls)
    assert output.count("🔬 scout_jev_shadow") == 2

    record = records[0]
    assert record["existing"] == {"selected": True, "verdict": filtering.VERDICT_STRONG}
    assert record["source"] == "hacker-news"
    assert record["title"] == "Investing risk nobody prices"
    assert record["content_id"] == "market-failure"
    assert record["error"] is None
    assert record["latency_ms"] >= 0
    assert record["usage"] == {"input_tokens": 380, "output_tokens": 42}
    assert record["jev"]["model"] == "jev-latest"
    assert set(record["jev"]) == {"model", *jev.DIMENSIONS}
    assert record["jev"]["content_fit"] == {"noul": 0.42}
    assert record["jev"][jev.SCORE_DIMENSION] == {
        "score": 1.8,
        "confidence": 0.9,
        "probabilities": {"0": 0.1, "1": 0.2, "2": 0.7},
    }


def test_a_gate_rejected_candidate_is_never_sent_to_jev(monkeypatch, tmp_path, capsys):
    """Only what Scout asked the model about: a gate rejection is not a Scout rejection."""
    fresh = "https://news.ycombinator.com/item?id=1"
    stale = "https://news.ycombinator.com/item?id=2"
    _install_run(
        monkeypatch,
        candidates=(
            _candidate(fresh),
            _candidate(stale, published_at=(NOW - timedelta(days=30)).isoformat()),
        ),
    )
    asked = []
    judged = cli.filtering.judge_match

    def recording_judge(match, *, items, items_by_id):
        asked.append(match.key)
        return judged(match, items=items, items_by_id=items_by_id)

    monkeypatch.setattr(cli.filtering, "judge_match", recording_judge)

    code, calls, _, shadow_path = _run_scout(monkeypatch, tmp_path / "gated", enabled=True, response=_response())

    output = capsys.readouterr().out
    assert code == 0
    assert "1 gated before judgment" in output
    assert asked == [fresh]
    assert len(calls) == 1
    assert [record["candidate_id"] for record in _shadow_lines(shadow_path)] == [fresh]


def test_candidates_scout_never_judged_are_not_sent_to_jev(monkeypatch, tmp_path, capsys):
    _install_run(monkeypatch)

    code, calls, _, shadow_path = _run_scout(
        monkeypatch, tmp_path / "nojudge", enabled=True, response=_response(), argv=("run", "--dry-run", "--no-llm")
    )

    assert code == 0
    assert calls == []
    assert not shadow_path.exists()
    assert "🔬" not in capsys.readouterr().out


def test_a_dry_run_evaluates_and_prints_but_records_nothing(monkeypatch, tmp_path, capsys):
    _install_run(monkeypatch)

    code, calls, _, shadow_path = _run_scout(
        monkeypatch, tmp_path / "dry", enabled=True, response=_response(), argv=("run", "--dry-run")
    )

    output = capsys.readouterr().out
    assert code == 0
    assert len(calls) == 1
    assert "🔬 scout_jev_shadow" in output
    assert not shadow_path.exists()


# --- failures are data, never interruptions ---------------------------------


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (TypeSafeAPITimeoutError("request timed out"), "TypeSafeAPITimeoutError"),
        (TypeSafeAPIError("HTTP 502 from the model host"), "TypeSafeAPIError"),
        (ValueError("unexpected protocol state"), "ValueError"),
    ],
)
def test_a_failed_evaluation_is_recorded_and_the_run_continues(monkeypatch, tmp_path, capsys, error, expected):
    _install_run(monkeypatch)

    code, calls, state_path, shadow_path = _run_scout(monkeypatch, tmp_path / "fail", enabled=True, error=error)

    output = capsys.readouterr().out
    assert code == 0
    assert len(calls) == 1
    assert "scout_jev_shadow_failure" in output
    records = _shadow_lines(shadow_path)
    assert len(records) == 1
    assert records[0]["jev"] is None
    assert records[0]["error"].startswith(expected)
    assert records[0]["latency_ms"] >= 0
    # Scout's own work is untouched by the shadow's failure.
    assert _without_timestamps(state_path)["opportunities"]


def test_an_answer_with_none_of_the_expected_dimensions_is_a_recorded_failure(monkeypatch, tmp_path):
    _install_run(monkeypatch)

    code, _, _, shadow_path = _run_scout(
        monkeypatch, tmp_path / "empty", enabled=True, response=_Response(nouls={}, scores={})
    )

    assert code == 0
    records = _shadow_lines(shadow_path)
    assert records[0]["jev"] is None
    assert records[0]["error"].startswith("ValueError")


def test_evaluate_never_raises_when_the_client_itself_cannot_be_built(monkeypatch):
    def explode():
        raise RuntimeError("the SDK refused to start")

    monkeypatch.setattr(jev, "_sdk_available", lambda: True)
    monkeypatch.setattr(jev, "_client", explode)

    record = jev.evaluate(
        filtering.Judgment(
            match=_match(),
            verdict=filtering.VERDICT_STRONG,
            reason="because",
            why_now="live",
            why_fits="fits",
            draft=DRAFT,
            link=False,
            link_reason="none",
        ),
        now=NOW,
    )

    assert record["error"].startswith("RuntimeError")
    assert record["jev"] is None


def test_a_write_failure_is_reported_and_never_raised(tmp_path, capsys):
    assert jev.append_record({"candidate_id": "x"}, path=tmp_path / "missing" / "shadow.jsonl") is False

    assert "scout_jev_shadow_write_failure" in capsys.readouterr().out


# --- Jev cannot change what Scout does --------------------------------------


def test_jev_answers_cannot_change_what_scout_records(monkeypatch, tmp_path, capsys):
    """The strongest form of the isolation claim: opposite Jev verdicts, same Scout run."""
    _install_run(monkeypatch)

    code_off, calls_off, state_off, _ = _run_scout(monkeypatch, tmp_path / "off", enabled=False)
    output_off = capsys.readouterr().out
    code_low, _, state_low, _ = _run_scout(
        monkeypatch,
        tmp_path / "low",
        enabled=True,
        response=_response(content_fit=0.0, substantive_conversation=0.0, relationship_value=0.0, natural_contribution=0.0, score=0.0),
    )
    output_low = capsys.readouterr().out
    code_high, _, state_high, _ = _run_scout(
        monkeypatch,
        tmp_path / "high",
        enabled=True,
        response=_response(content_fit=1.0, substantive_conversation=1.0, relationship_value=1.0, natural_contribution=1.0, score=2.0),
    )
    output_high = capsys.readouterr().out

    assert (code_off, code_low, code_high) == (0, 0, 0)
    assert calls_off == []
    assert _without_timestamps(state_off) == _without_timestamps(state_low) == _without_timestamps(state_high)
    for output in (output_low, output_high):
        added = _added_lines(_without_run_clock(output_off), _without_run_clock(output))
        assert all(line.startswith("🔬 scout_jev_shadow") for line in added)
    # And the answers really did differ, so the sameness above is not vacuous.
    assert "content_fit=0.00" in output_low
    assert "content_fit=1.00" in output_high


# --- what is sent, and what is not ------------------------------------------


def test_the_state_sent_to_jev_leaves_out_scouts_verdict_and_draft(monkeypatch, tmp_path):
    _install_run(monkeypatch)

    _, calls, _, _ = _run_scout(monkeypatch, tmp_path / "state", enabled=True, response=_response())

    sent = calls[0]["state"]
    assert set(sent) == {"conversation", "existing_writing"}
    assert set(sent["conversation"]) == {
        "source",
        "community",
        "title",
        "author",
        "published_at",
        "replies",
        "excerpt",
    }
    assert set(sent["existing_writing"]) == {"title", "category", "tags", "summary"}
    serialized = json.dumps(sent)
    assert DRAFT not in serialized
    assert filtering.VERDICT_STRONG not in serialized
    assert "https://leonlins.com/writing/market-failure" not in serialized


def test_the_conversation_excerpt_and_the_article_summary_are_clipped():
    long_body = "mispricing " * 400
    judgment = filtering.Judgment(
        match=Match(candidate=_candidate(), item=_item(body=long_body), score=6, matched_terms=("investing",)),
        verdict=filtering.VERDICT_STRONG,
        reason="because",
        why_now="live",
        why_fits="fits",
        draft=DRAFT,
        link=False,
        link_reason="none",
    )

    sent = jev.build_state(judgment)

    assert len(sent["conversation"]["excerpt"]) <= jev.EXCERPT_CHARS
    assert len(sent["existing_writing"]["summary"]) <= jev.SUMMARY_CHARS


def test_the_five_questions_are_the_documented_dimensions():
    asked = jev.questions()

    assert list(asked) == list(jev.DIMENSIONS)
    assert [asked[name]["type"] for name in jev.NOUL_DIMENSIONS] == ["noul"] * 4
    assert asked[jev.SCORE_DIMENSION]["type"] == "score"
    assert len(asked[jev.SCORE_DIMENSION]["criteria"]) == 3
    for name in jev.NOUL_DIMENSIONS:
        assert set(asked[name]["criteria"]) == {"true", "false"}
    for name, question in asked.items():
        assert question["instructions"].endswith(jev.UNTRUSTED_NOTE), name


# --- the key is never written down ------------------------------------------


def test_the_api_key_never_reaches_the_log_the_records_or_the_state(monkeypatch, tmp_path, capsys):
    _install_run(monkeypatch)

    _, _, state_path, shadow_path = _run_scout(monkeypatch, tmp_path / "key", enabled=True, response=_response())
    logged = capsys.readouterr().out
    _run_scout(
        monkeypatch,
        tmp_path / "key-failed",
        enabled=True,
        error=TypeSafeAPIError(f"authentication failed for key {API_KEY}"),
    )
    failed_log = capsys.readouterr().out

    exposed = "".join(
        [
            logged,
            failed_log,
            shadow_path.read_text(encoding="utf-8"),
            state_path.read_text(encoding="utf-8"),
        ]
    )
    assert API_KEY not in exposed
    # The failure was reported, which is what a real one has to do.
    assert "scout_jev_shadow_failure" in failed_log


def test_the_key_is_scrubbed_from_every_answered_field_and_not_only_the_error(monkeypatch, tmp_path, capsys):
    """A response is server-controlled text, so the key cannot survive anywhere in it."""
    _install_run(monkeypatch)
    response = _Response(nouls=_answers(), scores={jev.SCORE_DIMENSION: 1.8}, model=API_KEY)
    response.scores[jev.SCORE_DIMENSION].probabilities = {API_KEY: 0.7}

    _, _, _, shadow_path = _run_scout(monkeypatch, tmp_path / "echoed", enabled=True, response=response)

    output = capsys.readouterr().out
    written = shadow_path.read_text(encoding="utf-8")
    assert API_KEY not in output
    assert API_KEY not in written
    record = _shadow_lines(shadow_path)[0]
    assert record["jev"]["model"] == "[redacted]"
    assert record["jev"][jev.SCORE_DIMENSION]["probabilities"] == {"[redacted]": 0.7}


# --- reading the records back -----------------------------------------------


def _record(**overrides) -> dict:
    record = {
        "candidate_id": "https://news.ycombinator.com/item?id=1",
        "evaluated_at": NOW.isoformat(),
        "source": "hacker-news",
        "title": "Investing risk nobody prices",
        "content_id": "market-failure",
        "existing": {"selected": True, "verdict": filtering.VERDICT_STRONG},
        "jev": {
            "model": "jev-latest",
            **{name: {"noul": 0.9} for name in jev.NOUL_DIMENSIONS},
            jev.SCORE_DIMENSION: {"score": 1.5, "confidence": 0.8, "probabilities": {"2": 0.7}},
        },
        "usage": {"input_tokens": 380, "output_tokens": 42},
        "latency_ms": 900,
        "error": None,
    }
    record.update(overrides)
    return record


def test_load_records_skips_unreadable_lines_and_a_missing_file(tmp_path):
    missing, unreadable = jev.load_records(tmp_path / "nothing.jsonl")
    assert (missing, unreadable) == ([], 0)

    path = tmp_path / "shadow.jsonl"
    path.write_text(json.dumps(_record()) + "\n\n" + "{not json\n", encoding="utf-8")

    records, unreadable = jev.load_records(path)
    assert len(records) == 1
    assert unreadable == 1


def test_load_records_counts_a_line_that_is_not_even_text(tmp_path):
    """A corrupted byte costs one line, not the report the command exists to print."""
    path = tmp_path / "shadow.jsonl"
    path.write_bytes(json.dumps(_record()).encode("utf-8") + b"\n\xff\xfe corrupt\n")

    records, unreadable = jev.load_records(path)

    assert len(records) == 1
    assert unreadable == 1


def test_the_report_shows_distributions_and_both_disagreements():
    selected = _record()
    selected["jev"]["content_fit"] = {"noul": 0.05}
    selected["jev"]["natural_contribution"] = {"noul": 0.1}
    missed = _record(
        candidate_id="https://news.ycombinator.com/item?id=2",
        title="A thread Scout passed on",
        existing={"selected": False, "verdict": filtering.VERDICT_REJECT},
    )
    failed = _record(
        candidate_id="https://news.ycombinator.com/item?id=3",
        jev=None,
        error="TypeSafeAPITimeoutError: request timed out",
    )

    report = jev.render_report([selected, missed, failed], unreadable=0, path=Path("scout-shadow.jsonl"))

    assert "Evaluations: 3 across 3 candidate(s) | with answers: 2 | failed: 1" in report
    assert "Scout decisions: 1 selected | 1 not selected" in report
    assert "Jev means" in report
    assert "content_fit" in report and "selected 0.05 (n=1) | not selected 0.90 (n=1)" in report
    assert "Scout selected, Jev saw little to add" in report
    assert "https://news.ycombinator.com/item?id=1" in report
    assert "Scout not selected, Jev saw something worth adding" in report
    assert "https://news.ycombinator.com/item?id=2" in report
    assert "Failed evaluations (1)" in report
    assert "TypeSafeAPITimeoutError" in report


def test_the_report_says_so_when_nothing_has_been_recorded(tmp_path):
    report = jev.render_report([], path=tmp_path / "scout-shadow.jsonl")

    assert "No Jev shadow evaluations recorded yet" in report


def test_the_report_tolerates_records_missing_dimensions():
    partial = _record()
    partial["jev"] = {"model": "jev-latest", "content_fit": {"noul": 0.4}}
    partial["usage"] = None

    report = jev.render_report([partial], unreadable=2, path=Path("scout-shadow.jsonl"))

    assert "content_fit" in report and "0.40 (n=1)" in report
    assert "unreadable lines: 2" in report
    assert "asymmetric_value" in report
    assert "— (n=0)" in report


def test_the_jev_command_prints_the_comparison_and_writes_nothing(monkeypatch, tmp_path, capsys):
    _, shadow_path = _use_paths(monkeypatch, tmp_path / "report")
    disagreement = _record()
    disagreement["jev"]["content_fit"] = {"noul": 0.05}
    shadow_path.write_text(json.dumps(disagreement) + "\n", encoding="utf-8")
    before = shadow_path.read_text(encoding="utf-8")

    assert cli.main(["jev"]) == 0

    output = capsys.readouterr().out
    assert "Jev shadow evaluations" in output
    assert "https://news.ycombinator.com/item?id=1" in output
    assert "Scout selected, Jev saw little to add" in output
    assert shadow_path.read_text(encoding="utf-8") == before


def test_the_jev_command_says_so_before_anything_has_run(monkeypatch, tmp_path, capsys):
    _use_paths(monkeypatch, tmp_path / "empty")

    assert cli.main(["jev"]) == 0

    assert "No Jev shadow evaluations recorded yet" in capsys.readouterr().out
