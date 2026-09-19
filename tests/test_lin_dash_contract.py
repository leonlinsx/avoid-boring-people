"""The lin-dash monitoring contract for the Evergreen campaign.

`.github/lin-dash.json` carries the one piece of scheduling intent cron cannot
express: Evergreen runs on Tue/Thu 09:37 and Sun 17:37 *America/New_York*, and
each Eastern window is listed in UTC at both DST offsets. These tests keep that
declaration honest, so the workflow crons and the contract cannot drift apart in
either direction, and they pin the fields lin-dash validates strictly
(`version`, `workflow`, `success_job`, `schedule.timezone/windows`).
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / ".github" / "lin-dash.json"
WORKFLOWS = ROOT / ".github" / "workflows"
JOB = "social-evergreen"
WORKFLOW = "social-evergreen.yml"
SUCCESS_JOB = "distribute"

# Noon local on Monday and, six months later, another Monday: one reference week
# in EST and one in EDT. Every weekday of a declared window is measured from these.
SEASON_ANCHORS = (datetime(2026, 1, 5, 12), datetime(2026, 7, 6, 12))


def _contract():
    return json.loads(CONTRACT_PATH.read_text())


def _declaration():
    return _contract()["jobs"][JOB]


def _workflow_text():
    return (WORKFLOWS / WORKFLOW).read_text()


def _workflow_crons():
    return set(re.findall(r"^\s*-\s*cron:\s*'([^']+)'(?:\s*#.*)?$", _workflow_text(), re.MULTILINE))


def _job_block(name):
    lines = _workflow_text().splitlines()
    start = next(index for index, line in enumerate(lines) if line.startswith("  ") and line.strip() == f"{name}:")
    block = [lines[start]]
    for line in lines[start + 1 :]:
        if re.match(r"^  \S", line):
            break
        block.append(line)
    return "\n".join(block)


def _job_names():
    lines = _workflow_text().splitlines()
    start = lines.index("jobs:")
    return [match.group(1) for line in lines[start + 1 :] if (match := re.match(r"^  (\S+):\s*$", line))]


def _observed_crons(window, tz):
    """UTC crons a scheduled workflow needs for one local-time window.

    Returns one `minute hour * * day` cron per distinct UTC time, with the UTC
    weekday list that time lands on, taken at both DST offsets.
    """
    hours: dict[tuple[int, int], set[int]] = {}
    for anchor in SEASON_ANCHORS:
        for weekday in window["weekdays"]:
            local = (anchor + timedelta(days=weekday)).replace(
                hour=window["hour"], minute=window["minute"], second=0, microsecond=0, tzinfo=tz
            )
            utc = local.astimezone(timezone.utc)
            hours.setdefault((utc.minute, utc.hour), set()).add((utc.weekday() + 1) % 7)
    return {
        f"{minute} {hour} * * {','.join(str(day) for day in sorted(days))}"
        for (minute, hour), days in hours.items()
    }


def test_contract_declares_only_the_evergreen_job():
    assert _contract()["version"] == 1
    assert list(_contract()["jobs"]) == [JOB]


def test_declaration_uses_only_the_fields_lin_dash_validates():
    assert set(_declaration()) == {"workflow", "success_job", "schedule"}
    assert _declaration()["workflow"] == WORKFLOW
    assert _declaration()["success_job"] == SUCCESS_JOB
    schedule = _declaration()["schedule"]
    assert set(schedule) == {"timezone", "windows"}
    ZoneInfo(schedule["timezone"])
    for window in schedule["windows"]:
        assert set(window) == {"weekdays", "hour", "minute"}
        assert all(0 <= day <= 6 for day in window["weekdays"])
        assert 0 <= window["hour"] <= 23
        assert 0 <= window["minute"] <= 59


def test_contract_omits_display_and_grace_concerns():
    # Grace windows are lin-dash's business, and presentation is nobody's config.
    text = CONTRACT_PATH.read_text().lower()
    for forbidden in ("grace", "severity", "display", "color", "leonlinsx"):
        assert forbidden not in text


def test_declared_workflow_and_success_job_exist():
    jobs = _job_names()
    assert "gate" in jobs
    assert SUCCESS_JOB in jobs
    # A job-level success check only means something if the publishing job is the
    # one skipped when the gate decides today is not this run's window.
    assert re.search(r"^\s+needs:\s*gate\s*$", _job_block(SUCCESS_JOB), re.MULTILINE)


def test_workflow_crons_are_exactly_the_declared_windows_at_both_dst_offsets():
    schedule = _declaration()["schedule"]
    tz = ZoneInfo(schedule["timezone"])
    expected = set().union(*(_observed_crons(window, tz) for window in schedule["windows"]))
    assert _workflow_crons() == expected


def test_each_declared_window_needs_two_utc_crons():
    schedule = _declaration()["schedule"]
    tz = ZoneInfo(schedule["timezone"])
    for window in schedule["windows"]:
        crons = _observed_crons(window, tz)
        assert len(crons) == 2, f"{window} should exist at both DST offsets, got {crons}"


def test_eastern_windows_round_trip_to_the_expected_utc_crons():
    crons = _workflow_crons()
    assert "37 13 * * 2,4" in crons  # Tue/Thu 09:37 EDT
    assert "37 14 * * 2,4" in crons  # Tue/Thu 09:37 EST
    assert "37 21 * * 0" in crons  # Sun 17:37 EDT
    assert "37 22 * * 0" in crons  # Sun 17:37 EST
