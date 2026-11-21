"""Synthetic fixtures only: no Instagram account calls or production observations."""
import csv
import io
import json
from pathlib import Path

import pytest

from scripts.instagram_growth.experiment import PLAN, read_observations, summarize


@pytest.fixture
def plan():
    return json.loads(PLAN.read_text())


def row(**changes):
    r = dict(account="@avoidboringpeople", post_id="synthetic-post", article="ergodicity",
             format="graphics", visibility="standard", published_at="2026-11-01T12:00:00-05:00",
             observed_at="2026-11-08T12:00:00-05:00", window_hours="168", duration_seconds="20",
             accounts_reached="1000", non_follower_reach="900", views="1500",
             post_attributed_follows="2", shares="4", saves="3", profile_visits="10",
             average_watch_seconds="12", three_second_view_rate="0.7")
    r.update(changes)
    return r


def read(rows, plan):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(row()))
    writer.writeheader()
    writer.writerows(rows)
    out.seek(0)
    return read_observations(out, plan)


def test_empty_real_template_cannot_claim_a_winner(plan):
    p = Path(__file__).resolve().parents[1] / "scripts/instagram_growth/observations.example.csv"
    with p.open() as f:
        result = summarize(read_observations(f, plan), plan)
    assert result["status"] == "inconclusive"
    assert result["directional_candidate"] is None
    assert result["groups"]["graphics"]["follows_with_complete_primary"] is None
    assert result["scale_authorized"] is False


def test_missing_is_not_zero_and_loops_are_not_completion(plan):
    r = read([row(post_attributed_follows="", shares="0", average_watch_seconds="25")], plan)[0]
    assert r["rates"]["post_attributed_follows_per_1000_reached"] is None
    assert r["rates"]["shares_per_1000_reached"] == 0
    assert r["rates"]["watch_time_ratio"] == 1.25


@pytest.mark.parametrize("change", [dict(account="@leon.lin.s"), dict(accounts_reached="NaN"),
    dict(shares="-1"), dict(post_attributed_follows="1.5"), dict(three_second_view_rate="70"),
    dict(post_attributed_follows="1001"), dict(duration_seconds="0"),
    dict(published_at="2026-11-01T12:00:00"), dict(observed_at="2026-10-01T12:00:00Z")])
def test_bad_observations_are_rejected(plan, change):
    with pytest.raises(ValueError):
        read([row(**change)], plan)


def test_duplicate_and_changed_post_identity_rejected(plan):
    with pytest.raises(ValueError, match="Duplicate"):
        read([row(), row()], plan)
    early = row(window_hours="48", observed_at="2026-11-03T12:00:00-05:00")
    with pytest.raises(ValueError, match="slot changed"):
        read([early, row(post_id="different-post")], plan)


def full_pilot(plan, **changes):
    return read([row(post_id=f"synthetic-{b['article']}-{form}", article=b["article"], format=form,
                     post_attributed_follows="6" if form == "presenter" else "2", **changes)
                 for b in plan["live_plan"]["blocks"] for form in ("graphics", "presenter")], plan)


def test_valid_control_is_directional_only_never_auto_scales(plan):
    result = summarize(full_pilot(plan), plan)
    assert result["status"] == "human_review_required"
    assert result["presenter_minus_graphics_per_1000"] == 4
    assert result["directional_candidate"] == "presenter"
    assert len(result["blocks"]) == 3
    assert result["scale_authorized"] is False


def test_low_exposure_late_or_mixed_delivery_cannot_win(plan):
    for rows in [full_pilot(plan, accounts_reached="100", non_follower_reach="90"),
                 full_pilot(plan, observed_at="2026-11-10T12:00:00-05:00")]:
        result = summarize(rows, plan)
        assert result["status"] == "inconclusive"
        assert result["directional_candidate"] is None
    rows = full_pilot(plan)
    rows[0]["visibility"] = "trial"
    assert "trial and standard" in " ".join(summarize(rows, plan)["reasons"])


def test_48_hour_diagnostic_is_not_a_selection_window(plan):
    result = summarize(full_pilot(plan, window_hours="48", observed_at="2026-11-03T12:00:00-05:00"), plan)
    assert result["directional_candidate"] is None
    assert result["status"] == "inconclusive"


def test_registered_practical_effect_is_honored(plan):
    plan["live_plan"]["minimum_effect_per_1000"] = 5
    assert summarize(full_pilot(plan), plan)["directional_candidate"] is None
