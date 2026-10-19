"""Reproducibility, overflow safety, and Plotly tests for multiplicative payoffs."""
import math
import numpy as np
import pytest

from analyses.luck_preparation import multiplicative as mul
from analyses.luck_preparation.run import SCENARIOS, TRIAL_COUNTS as ADDITIVE_TRIAL_COUNTS, simulate as additive_simulate


@pytest.mark.parametrize("slug,expected_100_log10", [
    ("base", -0.025425776093),
    ("prepared90_luck50", 1.713833132239),
    ("prepared10_luck50", -1.350584106362),
    ("prepared50_luck90", 1.969808750141),
    ("prepared50_luck10", -2.259954986983),
    ("prepared90_luck10", -0.562854895495),
    ("prepared10_luck90", 0.589527481679),
])
def test_seeded_scenarios_preserve_additive_events(slug, expected_100_log10):
    scenario = next(s for s in SCENARIOS if s.slug == slug)
    one, ten, hundred = [
        mul.simulate_multiplicative(n, 42, scenario.prepared_probability, scenario.good_luck_probability)
        for n in mul.MULTIPLICATIVE_TRIAL_COUNTS
    ]
    assert np.array_equal(one.log_wealth, ten.log_wealth[:2])
    assert np.allclose(ten.log_wealth, hundred.log_wealth[:11], rtol=0, atol=1e-11)
    assert hundred.final_log_wealth / mul.LOG10 == pytest.approx(expected_100_log10, abs=1e-9)
    additive = additive_simulate(100, 42, scenario.prepared_probability, scenario.good_luck_probability)
    expected_returns = np.where(additive.changes == 10, .10,
                        np.where(additive.changes == 1, .01,
                        np.where(additive.changes == -1, -.01, -.10)))
    assert np.allclose(hundred.returns, expected_returns)
    expected = .09*scenario.prepared_probability + .11*scenario.good_luck_probability - .10
    assert hundred.expected_return_per_trial == pytest.approx(expected, abs=1e-15)
    assert hundred.realised_mean_return_per_trial == pytest.approx(np.mean(expected_returns))
    assert np.isfinite(hundred.log_wealth).all()


def test_horizon_schedules_are_independent():
    assert mul.MULTIPLICATIVE_TRIAL_COUNTS == (1, 10, 100)
    assert ADDITIVE_TRIAL_COUNTS == (1, 1_000, 1_000_000)


def test_simple_returns_compound_geometrically():
    sim = mul.simulate_multiplicative(100, seed=42)
    product = np.prod(1 + sim.returns)
    assert math.exp(sim.final_log_wealth) == pytest.approx(product)
    assert sim.realised_compound_growth_per_trial == pytest.approx(
        math.expm1(math.log(product) / sim.trials)
    )
    assert sim.realised_compound_growth_per_trial < sim.realised_mean_return_per_trial
    assert mul.simulate_multiplicative(1, seed=42).returns[0] == pytest.approx(-.01)
    assert sim.expected_return_per_trial == pytest.approx(0)
    assert sim.expected_log_return_per_trial < 0


def test_extreme_wealth_and_scientific_display():
    assert mul.format_wealth(math.log(1.01)) == "$1.01"
    assert "10^" in mul.format_wealth(1000)
    assert "10^" in mul.format_wealth(-1000)
    assert mul.format_total_gain_percent(-1000) == "−100%"
    assert "10^" in mul.format_total_gain_percent(1000)
    assert mul.format_total_gain_percent(math.log(1.1)) == "+10%"
    sim = mul.simulate_multiplicative(100)
    table = mul.markdown_table([sim])
    assert "Realised compound growth per trial (%)" in table
    assert "$0.94" in table
    assert "N/A" not in table


def test_log10_chart_and_horizontal_gridlines():
    sim = mul.simulate_multiplicative(100)
    fig = mul.figure_for(sim)
    assert fig.layout.xaxis.showgrid is False
    assert fig.layout.yaxis.showgrid is True
    assert fig.layout.yaxis.title.text == "log10 wealth ($)"
    assert len(fig.data[0].x) <= 2402
    assert np.isfinite(fig.data[0].y).all()


def test_seven_tables_and_21_html_previews(tmp_path, monkeypatch):
    monkeypatch.setattr(mul, "RESULTS_DIRECTORY", tmp_path / "analysis")
    monkeypatch.setattr(mul, "CHART_DIRECTORY", tmp_path / "charts")
    output = mul.run_scenarios(skip_png=True)
    assert output.count("## ") == 7
    assert len(list((tmp_path / "analysis").glob("wealth_*.html"))) == 21
    assert not (tmp_path / "charts").exists()
    assert (tmp_path / "analysis" / "summary.md").read_text() == output
    assert "| Final wealth | $0.99 | $1.20 | $0.94 |" in output
    assert "−99%" in output
    assert "+0.00%" in output
    assert "Implied compound growth per trial" not in output
    assert "## Baseline: 50% prepared, 50% good luck" in output


def test_rejects_bad_trial_counts_and_probabilities():
    with pytest.raises(ValueError):
        mul.simulate_multiplicative(0)
    for p in (-.1, 1.1, math.nan):
        with pytest.raises(ValueError):
            mul.simulate_multiplicative(1, prepared_probability=p)
    for s in SCENARIOS:
        m = mul.simulate_multiplicative(1000, prepared_probability=s.prepared_probability,
                                         good_luck_probability=s.good_luck_probability)
        assert np.isfinite(m.log_wealth).all()
