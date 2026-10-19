"""Reproducibility, overflow safety, and Plotly tests for multiplicative payoffs."""
import math
import numpy as np
import pytest

from analyses.luck_preparation import multiplicative as mul
from analyses.luck_preparation.run import SCENARIOS, simulate as additive_simulate


@pytest.mark.parametrize("slug,expected_10k_log10", [
    ("base", -14.508942),
    ("prepared90_luck50", 144.112047),
    ("prepared10_luck50", -171.274789),
    ("prepared50_luck90", 180.165190),
    ("prepared50_luck10", -204.482281),
    ("prepared90_luck10", -39.681236),
    ("prepared10_luck90", 29.652861),
])
def test_seeded_scenarios_preserve_additive_events(slug, expected_10k_log10):
    s = next(s for s in SCENARIOS if s.slug == slug)
    one, hundred, ten_thousand = [
        mul.simulate_multiplicative(n, 42, s.prepared_probability, s.good_luck_probability)
        for n in mul.MULTIPLICATIVE_TRIAL_COUNTS
    ]
    assert np.array_equal(one.log_wealth, hundred.log_wealth[:2])
    assert np.allclose(hundred.log_wealth, ten_thousand.log_wealth[:101], rtol=0, atol=1e-11)
    assert ten_thousand.final_log_wealth / mul.LOG10 == pytest.approx(expected_10k_log10, abs=1e-6)
    add = additive_simulate(100, 42, s.prepared_probability, s.good_luck_probability)
    expected_returns = np.where(add.changes == 10, .10,
                        np.where(add.changes == 1, .01,
                        np.where(add.changes == -1, -.01, -.10)))
    assert np.allclose(hundred.returns, expected_returns)
    expected = .09*s.prepared_probability + .11*s.good_luck_probability - .10
    assert ten_thousand.expected_return_per_trial == pytest.approx(expected, abs=1e-15)
    assert ten_thousand.realised_mean_return_per_trial == pytest.approx(expected, abs=.002)
    assert np.isfinite(ten_thousand.log_wealth).all()


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
    sim = mul.simulate_multiplicative(10_000)
    table = mul.markdown_table([sim])
    assert "Realised compound growth per trial (%)" in table
    assert "× 10^" in table
    assert "N/A" not in table


def test_log10_chart_and_horizontal_gridlines():
    sim = mul.simulate_multiplicative(1_000_000)
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
    assert "$3.10 × 10^-15" in output
    assert "−100%" in output
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
