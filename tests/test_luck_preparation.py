"""Basic correctness and reproducibility checks for the article experiment."""

import numpy as np
import pytest

from analyses.luck_preparation.run import markdown_table, simulate


def test_seed_is_reproducible_and_one_trial_matches_long_run_prefix():
    one = simulate(1, 42)
    many = simulate(1000, 42)
    assert one.changes.tolist() == many.changes[:1].tolist()
    assert np.array_equal(simulate(1000, 42).wealth, many.wealth)
    assert one.wealth.tolist() == [1, 0]
    assert many.final_wealth == 29


def test_four_payoffs_and_path_accounting():
    sim = simulate(1000, 42)
    expected = np.where(
        sim.luck, np.where(sim.prepared, 10, 1), np.where(sim.prepared, -1, -10)
    )
    assert np.array_equal(sim.changes, expected)
    assert set(sim.changes.tolist()) == {-10, -1, 1, 10}
    assert sim.wealth[0] == 1
    assert sim.final_wealth == 1 + sum(sim.changes)
    assert sim.gain_percent == 2800


def test_compound_rate_handling():
    assert simulate(1, 42).compound_percent_per_trial == -100.0
    assert simulate(1000, 42).compound_percent_per_trial is None
    assert "N/A" in markdown_table([simulate(1000, 42)])
    assert "-100.000%" in markdown_table([simulate(1, 42)])


def test_invalid_trial_count_rejected():
    with pytest.raises(ValueError, match="at least 1"):
        simulate(0)
