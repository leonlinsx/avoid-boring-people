"""Reproducible additive luck/preparation experiment.

Run from the repository root:
    python -m analyses.luck_preparation.run
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np

STARTING_WEALTH = 1
DEFAULT_SEED = 42
TRIAL_COUNTS = (1, 1_000, 1_000_000)
PAYOFFS = (10, 1, -1, -10)
CHART_DIRECTORY = Path("src/content/blog/luck_preparation/charts")
RESULTS_DIRECTORY = Path("analyses/luck_preparation/results")


@dataclass(frozen=True)
class Scenario:
    slug: str
    label: str
    prepared_probability: float
    good_luck_probability: float


# Preserve the baseline's exact seeded outcomes and existing chart filenames.
SCENARIOS = (
    Scenario("base", "Baseline: 50% prepared, 50% good luck", 0.5, 0.5),
    Scenario("prepared90_luck50", "90% prepared, 50% good luck", 0.9, 0.5),
    Scenario("prepared10_luck50", "10% prepared, 50% good luck", 0.1, 0.5),
    Scenario("prepared50_luck90", "50% prepared, 90% good luck", 0.5, 0.9),
    Scenario("prepared50_luck10", "50% prepared, 10% good luck", 0.5, 0.1),
)


@dataclass(frozen=True)
class Simulation:
    trials: int
    seed: int
    luck: np.ndarray  # True = good luck
    prepared: np.ndarray
    changes: np.ndarray
    wealth: np.ndarray  # Includes trial 0, before the first outcome
    prepared_probability: float = 0.5
    good_luck_probability: float = 0.5

    @property
    def final_wealth(self) -> int:
        return int(self.wealth[-1])

    @property
    def expected_gain_per_trial(self) -> float:
        # Expected additive gain from four mutually exclusive outcomes.
        p, q = self.prepared_probability, self.good_luck_probability
        return p * q * 10 + (1 - p) * q - p * (1 - q) - (1 - p) * (1 - q) * 10

    @property
    def expected_total_gain(self) -> float:
        return self.trials * self.expected_gain_per_trial

    @property
    def expected_final_wealth(self) -> float:
        return STARTING_WEALTH + self.expected_total_gain

    @property
    def mean_gain_per_trial(self) -> float:
        return (self.final_wealth - STARTING_WEALTH) / self.trials

    @property
    def gain_percent(self) -> float:
        return (self.final_wealth / STARTING_WEALTH - 1) * 100

    @property
    def compound_percent_per_trial(self) -> float | None:
        """Endpoint-implied geometric growth, not an investable compounded return.

        Intermediate wealth may be zero or negative. This does not invalidate
        the requested endpoint formula, but it prevents a realized compound
        return interpretation. A negative endpoint has no real even root.
        """
        ratio = self.final_wealth / STARTING_WEALTH
        if ratio < 0:
            return None
        if ratio == 0:
            return -100.0
        # expm1 avoids losing precision for large trial counts.
        return float(np.expm1(np.log(ratio) / self.trials) * 100)


def simulate(
    trials: int,
    seed: int = DEFAULT_SEED,
    prepared_probability: float = 0.5,
    good_luck_probability: float = 0.5,
) -> Simulation:
    """Simulate sequential additive payoffs; negative balances are permitted.

    The 50/50 baseline retains the exact original seeded integer RNG sequence.
    All additional scenarios use thresholded uniforms, preserving common
    random draws across the alternative probability configurations. Within
    each configuration, a short path is a prefix of the longer path.
    """
    if trials < 1:
        raise ValueError("trials must be at least 1")
    if not (0 <= prepared_probability <= 1 and 0 <= good_luck_probability <= 1):
        raise ValueError("probabilities must be between 0 and 1")
    rng = np.random.default_rng(seed)
    if prepared_probability == 0.5 and good_luck_probability == 0.5:
        draws = rng.integers(0, 2, size=(trials, 2))
        luck = draws[:, 0].astype(bool)
        prepared = draws[:, 1].astype(bool)
    else:
        draws = rng.random((trials, 2))
        luck = draws[:, 0] < good_luck_probability
        prepared = draws[:, 1] < prepared_probability
    changes = np.where(luck, np.where(prepared, 10, 1), np.where(prepared, -1, -10))
    wealth = np.concatenate(([STARTING_WEALTH], STARTING_WEALTH + np.cumsum(changes)))
    return Simulation(
        trials, seed, luck, prepared, changes, wealth,
        prepared_probability, good_luck_probability,
    )


def _dollars(
    value: int | float, signed: bool = False, decimals: int | None = None
) -> str:
    if decimals is None:
        magnitude = f"{abs(value):,.6f}".rstrip("0").rstrip(".")
    else:
        magnitude = f"{abs(value):,.{decimals}f}"
    prefix = "+" if value > 0 else "-" if value < 0 else ""
    return f"{prefix if signed else ('-' if value < 0 else '')}${magnitude}"


def fmt_compound(sim: Simulation) -> str:
    rate = sim.compound_percent_per_trial
    return "N/A (negative ending wealth)" if rate is None else f"{rate:+,.2f}%"


def markdown_table(simulations: list[Simulation]) -> str:
    """Article-ready table with metrics as rows and trial lengths as columns."""
    if not simulations:
        raise ValueError("at least one simulation is required")
    headers = ["Metric"] + [
        f"{sim.trials:,} trial{'s' if sim.trials != 1 else ''}"
        for sim in simulations
    ]
    rows = [
        ["Starting wealth"] + [_dollars(STARTING_WEALTH) for sim in simulations],
        ["Final wealth"] + [_dollars(sim.final_wealth) for sim in simulations],
        ["Total gain (%)"] + [f"{sim.gain_percent:+,.0f}%" for sim in simulations],
        ["Realised gain per trial"]
        + [_dollars(sim.mean_gain_per_trial, signed=True, decimals=2) for sim in simulations],
        ["Expected gain per trial"]
        + [_dollars(sim.expected_gain_per_trial, decimals=2) for sim in simulations],
        ["Implied compound growth per trial"]
        + [fmt_compound(sim) for sim in simulations],
    ]
    lines = [
        "| " + " | ".join(headers) + " |",
        "| :--- | " + " | ".join("---:" for _ in simulations) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines) + "\n"


def chart_indices(wealth: np.ndarray, max_buckets: int = 1_200) -> np.ndarray:
    """Preserve extrema in each x-bucket for a legible million-trial chart.

    Numerical statistics always use the full-resolution series.
    """
    length = len(wealth)
    if length <= max_buckets * 2:
        return np.arange(length)
    edges = np.linspace(0, length, max_buckets + 1, dtype=np.int64)
    indices = [0, length - 1]
    for begin, end in zip(edges[:-1], edges[1:]):
        if end <= begin:
            continue
        segment = wealth[begin:end]
        indices.extend((begin + int(np.argmin(segment)), begin + int(np.argmax(segment))))
    return np.unique(np.asarray(indices, dtype=np.int64))


def figure_for(sim: Simulation, scenario_label: str | None = None):
    """Construct a Plotly figure; import lazily so the model is reusable alone."""
    import plotly.graph_objects as go

    indices = chart_indices(sim.wealth)
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=indices,
            y=sim.wealth[indices],
            mode="lines+markers" if sim.trials == 1 else "lines",
            name="Wealth",
            line=dict(color="#2563eb", width=2),
            hovertemplate="Trial %{x:,}<br>Wealth $%{y:,.0f}<extra></extra>",
        )
    )
    fig.add_hline(y=0, line_dash="dot", line_color="#777", annotation_text="$0")
    fig.update_layout(
        template="plotly_white",
        title=(
            f"{scenario_label} — {sim.trials:,} trial{'s' if sim.trials != 1 else ''}"
            if scenario_label else
            f"Luck and preparation — {sim.trials:,} trial{'s' if sim.trials != 1 else ''}"
        ),
        xaxis_title="Trials",
        yaxis_title="Wealth ($)",
        xaxis=dict(
            range=[0, max(sim.trials, 1)],
            dtick=1 if sim.trials == 1 else None,
            showgrid=False,
        ),
        yaxis=dict(showgrid=True, gridcolor="#e5e7eb", zeroline=False),
        margin=dict(l=80, r=45, t=75, b=75),
        width=1100,
        height=550,
        showlegend=False,
        font=dict(family="Arial, sans-serif", size=14),
    )
    return fig


def chart_name(scenario: Scenario, trials: int) -> str:
    """The baseline keeps its existing filenames; extra scenarios are namespaced."""
    return (
        f"wealth_{trials}"
        if scenario.slug == "base"
        else f"wealth_{scenario.slug}_{trials}"
    )


def run_scenarios(
    seed: int = DEFAULT_SEED,
    skip_png: bool = False,
    scenario_slugs: set[str] | None = None,
) -> str:
    """Generate all five scenario tables, plots, and publication-ready PNGs."""
    selected = [s for s in SCENARIOS if scenario_slugs is None or s.slug in scenario_slugs]
    if not selected:
        raise ValueError("at least one scenario must be selected")
    RESULTS_DIRECTORY.mkdir(parents=True, exist_ok=True)
    summary = [
        f"Seed: {seed}. Independent per-trial luck/preparation. ",
        "Four dollar outcomes: good+prepared +$10, good+unprepared +$1, ",
        "bad+prepared -$1, bad+unprepared -$10.\n",
    ]
    for scenario in selected:
        sims = [
            simulate(
                n, seed, scenario.prepared_probability, scenario.good_luck_probability
            )
            for n in TRIAL_COUNTS
        ]
        summary.extend([f"## {scenario.label}", "", markdown_table(sims)])
        for sim in sims:
            fig = figure_for(
                sim, scenario_label=None if scenario.slug == "base" else scenario.label
            )
            name = chart_name(scenario, sim.trials)
            fig.write_html(
                RESULTS_DIRECTORY / f"{name}.html",
                include_plotlyjs="cdn", full_html=True,
            )
            if not skip_png:
                png = CHART_DIRECTORY / f"{name}.png"
                png.parent.mkdir(parents=True, exist_ok=True)
                try:
                    fig.write_image(png, width=1100, height=550, scale=2)
                except Exception as exc:
                    raise RuntimeError(
                        "PNG export requires Kaleido and Chrome/Chromium. "
                        "Use --skip-png for HTML-only previews."
                    ) from exc
    summary.append(
        "Expected gain per trial is theoretical; realised gain depends on the seed. "
        "Total gain (%) is displayed as an integer; per-trial dollar amounts "
        "and implied compound growth (%) use two decimals. A -$0.00 means a "
        "small negative realised amount rounded to two decimals. The implied "
        "growth rate uses endpoints only and is not an investable compound "
        "return when wealth crosses zero; negative final wealth is N/A. "
        "The million-trial experiment is one path of a million sequential "
        "trials, not a million independent simulated people.\n"
    )
    result = "\n".join(summary)
    (RESULTS_DIRECTORY / "summary.md").write_text(result, encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--skip-png", action="store_true", help="Generate HTML without Kaleido")
    parser.add_argument(
        "--scenario", choices=[s.slug for s in SCENARIOS], action="append",
        help="Select scenarios; omit to run all five including the baseline",
    )
    args = parser.parse_args()
    print(run_scenarios(args.seed, args.skip_png, set(args.scenario) if args.scenario else None))


if __name__ == "__main__":
    main()
