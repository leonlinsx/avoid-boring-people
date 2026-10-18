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


@dataclass(frozen=True)
class Simulation:
    trials: int
    seed: int
    luck: np.ndarray  # True = good luck
    prepared: np.ndarray
    changes: np.ndarray
    wealth: np.ndarray  # Includes trial 0, before the first outcome

    @property
    def final_wealth(self) -> int:
        return int(self.wealth[-1])

    @property
    def expected_gain_per_trial(self) -> float:
        # Each joint luck/prepared outcome occurs with probability 25%.
        return sum(PAYOFFS) / len(PAYOFFS)

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


def simulate(trials: int, seed: int = DEFAULT_SEED) -> Simulation:
    """Each trial independently draws luck and preparation, each 50/50.

    Payoffs are additive dollars: good/prepared +10, good/unprepared +1,
    bad/prepared -1, bad/unprepared -10. Negative wealth is permitted, so
    no unstated bankruptcy floor or leverage rule distorts the experiment.
    Calling with the same seed and a larger trial count preserves the prefix.
    """
    if trials < 1:
        raise ValueError("trials must be at least 1")
    draws = np.random.default_rng(seed).integers(0, 2, size=(trials, 2))
    luck = draws[:, 0].astype(bool)
    prepared = draws[:, 1].astype(bool)
    changes = np.where(luck, np.where(prepared, 10, 1), np.where(prepared, -1, -10))
    wealth = np.concatenate(([STARTING_WEALTH], STARTING_WEALTH + np.cumsum(changes)))
    return Simulation(trials, seed, luck, prepared, changes, wealth)


def _dollars(value: int | float, signed: bool = False) -> str:
    magnitude = f"{abs(value):,.6f}".rstrip("0").rstrip(".")
    prefix = "+" if value > 0 else "-" if value < 0 else ""
    return f"{prefix if signed else ('-' if value < 0 else '')}${magnitude}"


def fmt_compound(sim: Simulation) -> str:
    rate = sim.compound_percent_per_trial
    return "N/A (negative ending wealth)" if rate is None else f"{rate:+,.6f}%"


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
        ["Total gain (%)"] + [f"{sim.gain_percent:+,.1f}%" for sim in simulations],
        ["Realised gain per trial"]
        + [_dollars(sim.mean_gain_per_trial, signed=True) for sim in simulations],
        ["Expected gain per trial"]
        + [_dollars(sim.expected_gain_per_trial) for sim in simulations],
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


def figure_for(sim: Simulation):
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
        title=f"Luck and preparation — {sim.trials:,} trial{'s' if sim.trials != 1 else ''}",
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--skip-png", action="store_true", help="Generate tables/HTML without Kaleido")
    args = parser.parse_args()

    sims = [simulate(n, seed=args.seed) for n in TRIAL_COUNTS]
    table = markdown_table(sims)
    print(table)
    print("Expected final wealth is $1 for every trial count; realized gain can differ.")
    print("Endpoint-implied growth is not a realizable return if the path crosses $0.")

    output = Path("analyses/luck_preparation/results")
    output.mkdir(parents=True, exist_ok=True)
    (output / "summary.md").write_text(
        f"Seed: {args.seed}. Independent 50/50 luck and preparation; "
        "four equally likely additive payoffs (+$10, +$1, -$1, -$10).\n\n"
        + table
        + "\nExpected gain per trial is $0 for every trial count; expected "
        "total gain is also $0, and expected ending wealth is $1. "
        "Realised gain per trial is (final-start)/n. "
        "Implied compound growth is (final/start)^(1/n)-1, not an actual "
        "reinvestment return, even when the path crosses zero. Negative "
        "ending wealth has no real-valued even root and is N/A.\n",
        encoding="utf-8",
    )
    for sim in sims:
        fig = figure_for(sim)
        html = output / f"wealth_{sim.trials}.html"
        fig.write_html(html, include_plotlyjs="cdn", full_html=True)
        if not args.skip_png:
            png = CHART_DIRECTORY / f"wealth_{sim.trials}.png"
            png.parent.mkdir(parents=True, exist_ok=True)
            try:
                fig.write_image(png, width=1100, height=550, scale=2)
            except Exception as exc:
                raise RuntimeError(
                    "PNG export requires kaleido and Chrome/Chromium. "
                    "Install analyses/requirements.txt and ensure Chrome is available, "
                    "or run --skip-png for HTML previews."
                ) from exc
            print(f"Chart: {png}")
    print(f"Summary and interactive HTML previews: {output}/")


if __name__ == "__main__":
    main()
