"""Optional payoff counterfactuals; existing experiments are unchanged."""
from __future__ import annotations

import math
import numpy as np

from .run import SCENARIOS, simulate
from .multiplicative import format_wealth

ADDITIVE_SYMMETRIC = np.array([10, 0, 0, -10])
MULTIPLICATIVE_LITERAL = np.array([10 / 9, 91 / 90, .99, .90])
MULTIPLICATIVE_EXACT = np.array([10 / 9, 100 / 99, .99, .90])


def outcome_codes(trials, p, q, seed=42):
    original = simulate(trials, seed, p, q)
    return np.where(original.luck,
                    np.where(original.prepared, 0, 1),
                    np.where(original.prepared, 2, 3))


def theoretical(payoffs, p, q, multiplicative=False):
    weights = np.array([p*q, (1-p)*q, p*(1-q), (1-p)*(1-q)])
    if multiplicative:
        arithmetic = weights @ (payoffs - 1)
        geometric = math.expm1(float(weights @ np.log(payoffs)))
        return float(arithmetic), geometric
    return float(weights @ payoffs)


def additive_wealth(codes, n):
    return 1 + int(np.sum(ADDITIVE_SYMMETRIC[codes[:n]]))


def multiplicative_wealth(codes, n, factors):
    log_wealth = float(np.sum(np.log(factors[codes[:n]])))
    return format_wealth(log_wealth), math.expm1(log_wealth / n)


if __name__ == "__main__":
    for scenario in SCENARIOS:
        p, q = scenario.prepared_probability, scenario.good_luck_probability
        codes = outcome_codes(1_000_000, p, q)
        exact = theoretical(MULTIPLICATIVE_EXACT, p, q, True)
        print(scenario.label, "Additive E", theoretical(ADDITIVE_SYMMETRIC, p, q),
              "Additive wealth at 1m", additive_wealth(codes, 1_000_000),
              "Multiplicative expected arithmetic & geometric", exact,
              "Multiplicative wealth at 10k",
              multiplicative_wealth(codes, 10_000, MULTIPLICATIVE_EXACT))
