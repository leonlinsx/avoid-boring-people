"""Regression and Plotly chart tests for the seeded luck/preparation experiment."""

import numpy as np
import pytest

from analyses.luck_preparation.run import (
    chart_indices,
    figure_for,
    markdown_table,
    simulate,
)


def test_reproducibility_and_prefixes():
    one = simulate(1, 42)
    thousand = simulate(1_000, 42)
    million = simulate(1_000_000, 42)
    assert np.array_equal(simulate(1000, 42).wealth, thousand.wealth)
    assert one.wealth.tolist() == [1, 0]
    assert np.array_equal(thousand.wealth, million.wealth[:1001])
    assert thousand.final_wealth == 29
    assert million.final_wealth == -2511


def test_payoffs_expectation_and_means():
    for n in (1, 1_000, 1_000_000):
        sim = simulate(n)
        assert sim.expected_total_gain == 0
        assert sim.expected_final_wealth == 1
        assert sim.wealth[0] == 1
        assert sim.final_wealth == 1 + sum(sim.changes)
        assert sim.mean_gain_per_trial == (sim.final_wealth - 1) / n
    assert set(simulate(1000).changes.tolist()) == {-10, -1, 1, 10}
    assert simulate(1000).mean_gain_per_trial == 0.028
    assert simulate(1_000_000).mean_gain_per_trial == -0.002512


def test_endpoint_implied_rate_even_if_path_crossed_zero():
    assert simulate(1).compound_percent_per_trial == -100.0
    sim = simulate(1000)
    assert sim.wealth.min() < 0
    assert sim.compound_percent_per_trial == pytest.approx(0.33729715393993054)
    assert simulate(1_000_000).compound_percent_per_trial is None
    table = markdown_table([simulate(1), sim, simulate(1_000_000)])
    assert "Expected gain (total)" in table
    assert "Mean gain / trial" in table
    assert "+0.337297%" in table
    assert "N/A (negative ending wealth)" in table
    assert "-$2,511" in table


def test_only_horizontal_gridlines_and_preserved_extrema():
    sim = simulate(1_000_000)
    indices = chart_indices(sim.wealth)
    assert len(indices) <= 2 * 1_200 + 2
    assert indices[0] == 0 and indices[-1] == 1_000_000
    assert np.argmin(sim.wealth) in indices
    assert np.argmax(sim.wealth) in indices
    fig = figure_for(sim)
    assert fig.layout.xaxis.showgrid is False
    assert fig.layout.yaxis.showgrid is True
    assert len(fig.data[0].x) <= 2 * 1_200 + 2


def test_invalid_trial_count_rejected():
    with pytest.raises(ValueError, match="at least 1"):
        simulate(0)
