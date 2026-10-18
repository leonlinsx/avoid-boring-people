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
TRIAL_COUNTS = (1, 1000)
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
    def gain_percent(self) -> float:
        return (self.final_wealth / STARTING_WEALTH - 1) * 100

    @property
    def compound_percent_per_trial(self) -> float | None:
        """Equivalent geometric rate, only for paths where compounding is possible.

        A terminal zero is a -100% rate if wealth was positive beforehand.
        If wealth was zero/negative before the final trial, later additive gains
        cannot be interpreted as compounded investment returns.
        """
        if self.final_wealth < 0 or np.any(self.wealth[:-1] <= 0):
            return None
        return ((self.final_wealth / STARTING_WEALTH) ** (1 / self.trials) - 1) * 100


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


def fmt_compound(sim: Simulation) -> str:
    rate = sim.compound_percent_per_trial
    return "N/A (wealth hit $0 or below)" if rate is None else f"{rate:,.3f}%"


def markdown_table(simulations: list[Simulation]) -> str:
    lines = [
        "| Trials | Initial wealth | Final wealth | Total gain | Equivalent compounded gain / trial |",
        "| ---: | ---: | ---: | ---: | ---: |",
    ]
    for sim in simulations:
        lines.append(
            f"| {sim.trials:,} | ${STARTING_WEALTH:,} | ${sim.final_wealth:,} "
            f"| {sim.gain_percent:+,.1f}% | {fmt_compound(sim)} |"
        )
    return "\n".join(lines) + "\n"


def figure_for(sim: Simulation):
    """Construct a Plotly figure; import lazily so the model is reusable alone."""
    import plotly.graph_objects as go

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=np.arange(sim.trials + 1),
            y=sim.wealth,
            mode="lines+markers" if sim.trials == 1 else "lines",
            name="Wealth",
            hovertemplate="Trial %{x:,}<br>Wealth $%{y:,.0f}<extra></extra>",
        )
    )
    fig.add_hline(y=0, line_dash="dot", line_color="#777", annotation_text="$0")
    fig.update_layout(
        template="plotly_white",
        title=f"Luck and preparation — {sim.trials:,} trial{'s' if sim.trials != 1 else ''}",
        xaxis_title="Trials",
        yaxis_title="Wealth ($)",
        xaxis=dict(range=[0, max(sim.trials, 1)], dtick=1 if sim.trials == 1 else None),
        margin=dict(l=80, r=45, t=75, b=75),
        width=1100,
        height=550,
        showlegend=False,
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
    print("Additive payouts can take wealth below $0; such paths have no valid compounded return.")

    output = Path("analyses/luck_preparation/results")
    output.mkdir(parents=True, exist_ok=True)
    (output / "summary.md").write_text(
        f"Seed: {args.seed}. Independent luck and preparation draws, 50/50 each.\n\n"
        + table
        + "\nCompounded rate is an endpoint-equivalent geometric rate, not an actual "
        "reinvestment return. N/A if wealth went nonpositive before the final trial "
        "or ended negative.\n",
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
