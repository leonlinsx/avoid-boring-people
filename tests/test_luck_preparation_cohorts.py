"""Regression and plotting tests for 101-person cohort ensembles."""
import math
import numpy as np
import pytest

from analyses.luck_preparation import cohorts
from analyses.luck_preparation.run import SCENARIOS, TRIAL_COUNTS as ADD_HORIZONS
from analyses.luck_preparation.multiplicative import (
    MULTIPLICATIVE_TRIAL_COUNTS as MULT_HORIZONS,
)


@pytest.fixture(scope="module")
def ensemble():
    return cohorts.simulate_ensemble(seed=42, people=101)


def test_seven_scenarios_and_preserved_original_horizons(ensemble):
    assert len(SCENARIOS) == 7
    assert ADD_HORIZONS == (1, 1_000, 1_000_000)
    assert MULT_HORIZONS == (1, 100, 10_000)
    assert ensemble.additive_paths.shape[:2] == (7, 101)
    assert ensemble.multiplicative_paths.shape[:2] == (7, 101)
    assert sorted(ensemble.additive_endings) == list(ADD_HORIZONS)
    assert sorted(ensemble.multiplicative_endings) == list(MULT_HORIZONS)
    assert np.all(ensemble.additive_paths[:, :, 0] == 1)
    assert np.all(ensemble.multiplicative_paths[:, :, 0] == 0)
    assert np.array_equal(
        ensemble.additive_paths[:, :, -1], ensemble.additive_endings[1_000_000]
    )
    assert np.allclose(
        ensemble.multiplicative_paths[:, :, -1],
        ensemble.multiplicative_endings[10_000], atol=1e-11,
    )


def test_seed_42_additive_cohort_endings(ensemble):
    values = ensemble.additive_endings[1_000_000]
    assert np.min(values[0]) == -20298
    assert np.max(values[0]) == 21179
    assert np.median(values[0]) == -994
    assert np.median(values[1]) == 3598354
    assert np.median(values[6]) == 799822


def test_seed_42_multiplicative_cohort_endings(ensemble):
    values = ensemble.multiplicative_endings[10_000]
    assert np.median(values[0]) == pytest.approx(-25.613595093130858)
    assert np.median(values[3]) == pytest.approx(416.4952028481613)
    assert np.isfinite(values).all()


def test_median_person_is_real_and_mean_is_arithmetic_wealth(ensemble):
    for family in ("additive", "multiplicative"):
        is_mult = family == "multiplicative"
        endings = ensemble.multiplicative_endings if is_mult else ensemble.additive_endings
        for batch in endings.values():
            for people_ends in batch:
                idx = cohorts.median_person_index(people_ends)
                stats = cohorts.ending_statistics(people_ends, is_mult)
                assert people_ends[idx] == stats["median"]
                assert stats["min"] <= stats["median"] <= stats["max"]
                assert stats["min"] <= stats["mean"] <= stats["max"]
                if is_mult:
                    highest = np.max(people_ends)
                    independent_log_mean = highest + np.log(np.mean(
                        np.exp(people_ends - highest)))
                    assert stats["mean"] == pytest.approx(independent_log_mean)
                else:
                    assert stats["mean"] == pytest.approx(np.mean(people_ends))


def test_paired_uniforms_and_identical_events_across_payoff_families(ensemble):
    first_add = ensemble.additive_endings[1]
    assert np.all(first_add[1] >= first_add[2])
    assert np.all(first_add[3] >= first_add[4])
    returns = {10: math.log(1.10), 1: math.log(1.01),
               -1: math.log(.99), -10: math.log(.90)}
    for scenario in range(7):
        for person in range(101):
            payoff = int(first_add[scenario, person] - 1)
            assert ensemble.multiplicative_endings[1][scenario, person] == pytest.approx(
                returns[payoff])


def test_fourteen_charts_101_people_median_and_mean(ensemble):
    for family in ("additive", "multiplicative"):
        is_mult = family == "multiplicative"
        for i in range(7):
            fig = cohorts.figure_for(ensemble, family, i)
            assert len(fig.data) == 102  # 100 faint, 1 highlighted, 1 marker
            assert fig.layout.xaxis.showgrid is False
            assert fig.layout.yaxis.showgrid is True
            assert "Median-ending person" in fig.data[-2].name
            assert "Mean ending wealth" in fig.data[-1].name
            ends = (
                ensemble.multiplicative_endings[10_000][i]
                if is_mult else ensemble.additive_endings[1_000_000][i]
            )
            idx = cohorts.median_person_index(ends)
            expected_path = (
                ensemble.multiplicative_paths[i, idx] / cohorts.LOG10
                if is_mult else ensemble.additive_paths[i, idx]
            )
            assert np.array_equal(fig.data[-2].y, expected_path)
            mean = cohorts.ending_statistics(ends, is_mult)["mean"]
            mean_on_axis = mean / cohorts.LOG10 if is_mult else mean
            assert fig.data[-1].y[0] == pytest.approx(mean_on_axis)


def test_all_three_horizons_in_each_family(ensemble):
    add = cohorts.stat_table(ensemble, "additive")
    mult = cohorts.stat_table(ensemble, "multiplicative")
    assert len(add.splitlines()) == 23
    assert len(mult.splitlines()) == 23
    assert "1,000,000" in add and "10,000" in mult
    assert "-$20,298" in add
    assert "$7.52 × 10^-12" in mult


def test_reject_ambiguous_median_count_and_bad_chunk():
    with pytest.raises(ValueError, match="odd"):
        cohorts.simulate_ensemble(people=100)
    with pytest.raises(ValueError, match="odd"):
        cohorts.simulate_ensemble(people=0)
    with pytest.raises(ValueError, match="positive"):
        cohorts.simulate_ensemble(chunk_size=0)
