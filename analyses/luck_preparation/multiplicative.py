"""Multiplicative companion to the unchanged additive experiment.

Run: python -m analyses.luck_preparation.multiplicative [--skip-png]
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import math

import numpy as np

from .run import (
    DEFAULT_SEED, SCENARIOS, STARTING_WEALTH, TRIAL_COUNTS,
    Scenario, chart_indices, simulate as simulate_additive,
)

GROWTH_FACTORS = (1.10, 1.01, 0.99, 0.90)
LOG_FACTORS = np.log(np.asarray(GROWTH_FACTORS, dtype=np.float64))
RETURN_VALUES = np.asarray(GROWTH_FACTORS) - 1.0
LOG10 = math.log(10.0)
RESULTS_DIRECTORY = Path("analyses/luck_preparation/results/multiplicative")
CHART_DIRECTORY = Path("src/content/blog/luck_preparation/charts/multiplicative")


@dataclass(frozen=True)
class MultiplicativeSimulation:
    trials: int
    seed: int
    scenario: Scenario
    returns: np.ndarray
    log_wealth: np.ndarray

    @property
    def expected_return_per_trial(self) -> float:
        p, q = self.scenario.prepared_probability, self.scenario.good_luck_probability
        return float(0.10*p*q + 0.01*(1-p)*q - 0.01*p*(1-q) - 0.10*(1-p)*(1-q))

    @property
    def realised_mean_return_per_trial(self) -> float:
        return float(np.mean(self.returns))

    @property
    def expected_log_return_per_trial(self) -> float:
        p, q = self.scenario.prepared_probability, self.scenario.good_luck_probability
        weights = np.asarray([p*q, (1-p)*q, p*(1-q), (1-p)*(1-q)])
        return float(np.dot(weights, LOG_FACTORS))

    @property
    def realised_compound_growth_per_trial(self) -> float:
        return math.expm1(float(self.log_wealth[-1]) / self.trials)

    @property
    def final_log_wealth(self) -> float:
        return float(self.log_wealth[-1])


def simulate_multiplicative(
    trials: int,
    seed: int = DEFAULT_SEED,
    prepared_probability: float = 0.5,
    good_luck_probability: float = 0.5,
) -> MultiplicativeSimulation:
    """Reuse the exact same luck/preparation draws as the additive experiment.

    Multiplication is in log space to avoid overflow/underflow after 1m trials.
    """
    events = simulate_additive(trials, seed, prepared_probability, good_luck_probability)
    good, ready = events.luck, events.prepared
    codes = np.where(good, np.where(ready, 0, 1), np.where(ready, 2, 3))
    returns = RETURN_VALUES[codes]
    logs = np.empty(trials + 1, dtype=np.float64)
    logs[0] = math.log(STARTING_WEALTH)
    logs[1:] = logs[0] + np.cumsum(LOG_FACTORS[codes])
    scenario = Scenario(
        "base" if prepared_probability == 0.5 and good_luck_probability == 0.5 else "custom",
        f"{prepared_probability:.0%} prepared, {good_luck_probability:.0%} good luck",
        prepared_probability, good_luck_probability,
    )
    return MultiplicativeSimulation(trials, seed, scenario, returns, logs)


def format_wealth(log_amount: float) -> str:
    """Display dollars even for wealth on the order of 10^+/-thousands."""
    power_float = log_amount / LOG10
    if -2 <= power_float < 7:
        return f"${math.exp(log_amount):,.2f}"
    power = math.floor(power_float)
    mantissa = 10 ** (power_float - power)
    if mantissa >= 9.995:
        mantissa, power = 1.0, power + 1
    return f"${mantissa:.2f} × 10^{power:+,}"


def format_total_gain_percent(log_amount: float) -> str:
    if log_amount < -30:
        return "−100%"
    if log_amount < math.log(10**5):
        return f"{math.expm1(log_amount)*100:+,.0f}%".replace("-", "−")
    log10_percent = log_amount / LOG10 + 2
    exponent = math.floor(log10_percent)
    mantissa = 10 ** (log10_percent - exponent)
    if mantissa >= 9.995:
        mantissa, exponent = 1.0, exponent + 1
    return f"+{mantissa:.2f} × 10^{exponent:+,}%"


def markdown_table(sims: list[MultiplicativeSimulation]) -> str:
    if not sims:
        raise ValueError("at least one result required")
    columns = [f"{s.trials:,} trial{'s' if s.trials != 1 else ''}" for s in sims]
    rows = [
        ["Starting wealth"] + ["$1.00" for _ in sims],
        ["Final wealth"] + [format_wealth(s.final_log_wealth) for s in sims],
        ["Total gain (%)"] + [format_total_gain_percent(s.final_log_wealth) for s in sims],
        ["Realised mean return per trial (%)"]
        + [f"{s.realised_mean_return_per_trial*100:+.2f}%" for s in sims],
        ["Expected return per trial (%)"]
        + [f"{s.expected_return_per_trial*100:+.2f}%" for s in sims],
        ["Realised compound growth per trial (%)"]
        + [f"{s.realised_compound_growth_per_trial*100:+.2f}%" for s in sims],
    ]
    result = [
        "| Metric | " + " | ".join(columns) + " |",
        "| :--- | " + " | ".join("---:" for _ in sims) + " |",
    ]
    result.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(result) + "\n"


def figure_for(sim: MultiplicativeSimulation):
    """Horizontal-only grid; plot log10 dollars, not representationally unsafe wealth."""
    import plotly.graph_objects as go

    idx = chart_indices(sim.log_wealth)
    fig = go.Figure(go.Scatter(
        x=idx, y=sim.log_wealth[idx] / LOG10,
        mode="lines+markers" if sim.trials == 1 else "lines",
        line=dict(color="#2563eb", width=2),
        hovertemplate="Trial %{x:,}<br>log10 wealth: %{y:,.3f}<extra></extra>",
        name="Log wealth",
    ))
    fig.add_hline(y=0, line_dash="dot", line_color="#777", annotation_text="Initial $1")
    fig.update_layout(
        template="plotly_white",
        title=f"Multiplicative — {sim.scenario.label} — {sim.trials:,} trial{'s' if sim.trials != 1 else ''}",
        xaxis_title="Trials",
        yaxis_title="log10 wealth ($)",
        xaxis=dict(range=[0, max(sim.trials, 1)], showgrid=False,
                   dtick=1 if sim.trials == 1 else None),
        yaxis=dict(showgrid=True, gridcolor="#e5e7eb", zeroline=False),
        showlegend=False, width=1100, height=550,
        margin=dict(l=95, r=35, t=75, b=75),
        font=dict(family="Arial, sans-serif", size=14),
    )
    return fig


def chart_name(scenario: Scenario, trials: int) -> str:
    return f"wealth_{scenario.slug}_{trials}"


def run_scenarios(
    seed: int = DEFAULT_SEED,
    skip_png: bool = False,
    scenario_slugs: set[str] | None = None,
) -> str:
    if scenario_slugs is not None and not scenario_slugs.issubset({s.slug for s in SCENARIOS}):
        raise ValueError("unknown scenario")
    selected = [s for s in SCENARIOS if scenario_slugs is None or s.slug in scenario_slugs]
    if not selected:
        raise ValueError("at least one scenario must be selected")
    RESULTS_DIRECTORY.mkdir(parents=True, exist_ok=True)
    sections = [
        "# Multiplicative luck × preparation — seed " + str(seed), "",
        "Each trial multiplies current wealth by 1.10, 1.01, 0.99 or 0.90. "
        "The exact same seeded luck/preparation outcomes as the additive experiments "
        "are reused for each scenario. Initial wealth: $1.\n",
    ]
    for original in selected:
        sims = [
            simulate_multiplicative(n, seed, original.prepared_probability, original.good_luck_probability)
            for n in TRIAL_COUNTS
        ]
        sections.extend(["## " + original.label, "", markdown_table(sims)])
        for sim in sims:
            fig = figure_for(sim)
            name = chart_name(original, sim.trials)
            fig.write_html(RESULTS_DIRECTORY / (name + ".html"), include_plotlyjs="cdn", full_html=True)
            if not skip_png:
                png = CHART_DIRECTORY / (name + ".png")
                png.parent.mkdir(parents=True, exist_ok=True)
                try:
                    fig.write_image(png, width=1100, height=550, scale=2)
                except Exception as exc:
                    raise RuntimeError("PNG export requires Kaleido and Chrome; use --skip-png") from exc
    sections.append(
        "Note: Expected return is the arithmetic expectation of a single trial, "
        "not expected compound growth. Realised mean return is the arithmetic "
        "average of observed percentage payoffs. Realised compound growth is "
        "exp(sum(log factors)/trials) - 1. Total gain is shown to zero decimals; "
        "per-trial percentages are shown to two decimals. Huge/small final "
        "wealth is written in scientific notation rather than under/overflowing. "
        "Chart y-axis is log10 dollars: 0 is $1; +1 is $10; -1 is $0.10. "
        "Outcomes represent one path per scenario, not a distribution of people.\n"
    )
    output = "\n".join(sections)
    (RESULTS_DIRECTORY / "summary.md").write_text(output, encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--skip-png", action="store_true")
    parser.add_argument("--scenario", choices=[s.slug for s in SCENARIOS], action="append")
    args = parser.parse_args()
    print(run_scenarios(args.seed, args.skip_png, set(args.scenario) if args.scenario else None))


if __name__ == "__main__":
    main()
