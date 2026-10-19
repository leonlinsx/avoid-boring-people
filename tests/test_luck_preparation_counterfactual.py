"""Counterfactual regression checks: original experiments remain unchanged."""
import math
import numpy as np
import pytest

from analyses.luck_preparation.counterfactual import (
    ADDITIVE_SYMMETRIC, MULTIPLICATIVE_EXACT, MULTIPLICATIVE_LITERAL,
    additive_wealth, multiplicative_wealth, outcome_codes, theoretical,
)
from analyses.luck_preparation.run import simulate


@pytest.mark.parametrize("p,q,expected,new_final", [
    (.5,.5,0,-2659), (.9,.5,4,4003661), (.1,.5,-4,-3997139),
    (.5,.9,4,4002441), (.5,.1,-4,-4002429),
    (.9,.1,0,-4649), (.1,.9,0,-579),
])
def test_symmetric_additive_matches_seeded_results(p,q,expected,new_final):
    assert theoretical(ADDITIVE_SYMMETRIC,p,q) == pytest.approx(expected)
    codes = outcome_codes(1_000_000,p,q)
    assert additive_wealth(codes, 1_000_000) == new_final
    old = simulate(1_000_000, 42, p, q)
    assert np.array_equal(
        old.changes, np.array([10,1,-1,-10])[codes]
    )


def test_exact_pair_offsets_and_literal_small_difference():
    assert MULTIPLICATIVE_EXACT[0] * MULTIPLICATIVE_EXACT[3] == pytest.approx(1)
    assert MULTIPLICATIVE_EXACT[1] * MULTIPLICATIVE_EXACT[2] == pytest.approx(1)
    assert MULTIPLICATIVE_LITERAL[1] * MULTIPLICATIVE_LITERAL[2] == pytest.approx(1.001)
    arithmetic, geometric = theoretical(MULTIPLICATIVE_EXACT,.5,.5,True)
    assert arithmetic == pytest.approx(.0028030303030303)
    assert geometric == pytest.approx(0,abs=1e-14)
    literal_arithmetic,literal_geometric=theoretical(MULTIPLICATIVE_LITERAL,.5,.5,True)
    assert literal_arithmetic == pytest.approx(.0030555555555555)
    assert literal_geometric == pytest.approx(.00024990630465)


def test_geometric_outcomes_and_swapped_probabilities():
    codes = outcome_codes(10_000,.5,.5)
    amount, realised = multiplicative_wealth(codes,10_000,MULTIPLICATIVE_EXACT)
    assert amount == "$3.33 × 10^-4"
    assert realised * 100 == pytest.approx(-.08005,abs=.001)
    high_prepare=theoretical(MULTIPLICATIVE_EXACT,.9,.1,True)[1]
    high_luck=theoretical(MULTIPLICATIVE_EXACT,.1,.9,True)[1]
    assert high_prepare < 0 < high_luck
    assert high_prepare * 100 == pytest.approx(-.8008,abs=.001)
    assert high_luck * 100 == pytest.approx(.8073,abs=.001)
