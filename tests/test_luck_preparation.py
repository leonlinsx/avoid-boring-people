"""Regression, reproducibility, probability, and Plotly checks."""

import numpy as np
import pytest

from analyses.luck_preparation.run import (
    SCENARIOS, chart_indices, chart_name, figure_for,
    markdown_table, run_scenarios, simulate,
)


def test_baseline_remains_unchanged():
    one, thousand, million = (simulate(n, 42) for n in (1, 1000, 1_000_000))
    assert one.wealth.tolist() == [1, 0]
    assert thousand.final_wealth == 29
    assert million.final_wealth == -2511
    assert np.array_equal(thousand.wealth, million.wealth[:1001])
    table = markdown_table([one, thousand, million])
    assert "| Total gain (%) | -100% | +2,800% | -251,200% |" in table
    assert "| Realised gain per trial | -$1.00 | +$0.03 | -$0.00 |" in table
    assert "| Expected gain per trial | $0.00 | $0.00 | $0.00 |" in table
    assert "| Implied compound growth per trial | -100.00% | +0.34% | N/A (negative ending wealth) |" in table


@pytest.mark.parametrize("slug,expected,finals", [
    ("base", 0, (0, 29, -2511)),
    ("prepared90_luck50", 3.6, (0, 3680, 3604181)),
    ("prepared10_luck50", -3.6, (-9, -3601, -3596539)),
    ("prepared50_luck90", 4.4, (11, 4313, 4402395)),
    ("prepared50_luck10", -4.4, (0, -4443, -4402962)),
])
def test_seed_42_scenarios(slug, expected, finals):
    scenario = next(s for s in SCENARIOS if s.slug == slug)
    one, thousand, million = (
        simulate(n, 42, scenario.prepared_probability, scenario.good_luck_probability)
        for n in (1, 1000, 1_000_000)
    )
    assert (one.final_wealth, thousand.final_wealth, million.final_wealth) == finals
    assert one.expected_gain_per_trial == pytest.approx(expected)
    assert million.expected_total_gain == pytest.approx(1_000_000 * expected)
    assert np.array_equal(one.wealth, thousand.wealth[:2])
    assert np.array_equal(thousand.wealth, million.wealth[:1001])
    assert np.array_equal(
        million.wealth,
        simulate(1_000_000, 42, scenario.prepared_probability, scenario.good_luck_probability).wealth,
    )
    assert set(million.changes).issubset({-10, -1, 1, 10})
    assert abs(million.mean_gain_per_trial - expected) < 0.02


def test_alternative_scenarios_share_random_draws():
    high = simulate(1000, prepared_probability=.9)
    low = simulate(1000, prepared_probability=.1)
    assert np.array_equal(high.luck, low.luck)
    assert np.all(low.prepared <= high.prepared)
    lucky = simulate(1000, good_luck_probability=.9)
    unlucky = simulate(1000, good_luck_probability=.1)
    assert np.array_equal(lucky.prepared, unlucky.prepared)
    assert np.all(unlucky.luck <= lucky.luck)


def test_probability_validation():
    with pytest.raises(ValueError): simulate(0)
    for p in (-.1, 1.1, float("nan")):
        with pytest.raises(ValueError): simulate(1, prepared_probability=p)
        with pytest.raises(ValueError): simulate(1, good_luck_probability=p)
    assert simulate(5, prepared_probability=1, good_luck_probability=1).final_wealth == 51
    assert simulate(5, prepared_probability=0, good_luck_probability=0).final_wealth == -49


def test_charts_keep_horizontal_grid_and_extrema():
    for scenario in SCENARIOS:
        name = chart_name(scenario, 1000)
        expected = "wealth_1000" if scenario.slug == "base" else f"wealth_{scenario.slug}_1000"
        assert name == expected
    sim = simulate(1_000_000, prepared_probability=.9)
    idx = chart_indices(sim.wealth)
    assert idx[0] == 0 and idx[-1] == 1_000_000
    assert np.argmax(sim.wealth) in idx and np.argmin(sim.wealth) in idx
    assert len(idx) <= 2402
    fig = figure_for(sim, "90% prepared, 50% good luck")
    assert fig.layout.xaxis.showgrid is False
    assert fig.layout.yaxis.showgrid is True
    assert len(fig.data[0].x) <= 2402


def test_negative_final_wealth_is_na():
    sim = simulate(1_000_000, prepared_probability=.1)
    assert sim.compound_percent_per_trial is None
    assert "N/A (negative ending wealth)" in markdown_table([sim])


def test_all_five_tables_and_fifteen_html_outputs(tmp_path, monkeypatch):
    import analyses.luck_preparation.run as module
    monkeypatch.setattr(module, "RESULTS_DIRECTORY", tmp_path / "results")
    monkeypatch.setattr(module, "CHART_DIRECTORY", tmp_path / "charts")
    summary = run_scenarios(skip_png=True)
    assert summary.count("## ") == 5
    assert summary.count("Expected gain per trial") == 6
    assert len(list((tmp_path / "results").glob("wealth_*.html"))) == 15
    assert not (tmp_path / "charts").exists()
    assert (tmp_path / "results" / "summary.md").read_text() == summary
