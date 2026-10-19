"""101-person ensembles over the existing seven additive and seven multiplicative cases.

Run: python -m analyses.luck_preparation.cohorts [--skip-png]
Each person gets independent trial draws. Reuse the SAME uniforms for that
person/trial across probability cases, making scenario comparisons paired.
The historical one-person experiments are not modified.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .run import DEFAULT_SEED, SCENARIOS, TRIAL_COUNTS as ADD_HORIZONS
from .multiplicative import (
    MULTIPLICATIVE_TRIAL_COUNTS as MULT_HORIZONS,
    format_wealth,
)

PEOPLE = 101
CHUNK_SIZE = 5_000
SAMPLE_POINTS = 1_201
ADD_PAYOFFS = np.array([10, 1, -1, -10], dtype=np.int8)
LOG_FACTORS = np.log(np.array([1.10, 1.01, .99, .90], dtype=np.float64))
LOG10 = np.log(10.)
RESULTS_DIRECTORY = Path("analyses/luck_preparation/results/cohorts")
CHART_DIRECTORY = Path("src/content/blog/luck_preparation/charts/cohorts")


@dataclass
class Ensemble:
    seed: int
    people: int
    additive_times: np.ndarray
    multiplicative_times: np.ndarray
    additive_paths: np.ndarray
    multiplicative_paths: np.ndarray
    additive_endings: dict[int, np.ndarray]
    multiplicative_endings: dict[int, np.ndarray]


def times_to_plot(max_trials: int, horizons: tuple[int, ...]) -> np.ndarray:
    """Sampling is only for plots, never for ending-wealth statistics."""
    return np.unique(np.r_[0, np.linspace(0, max_trials, SAMPLE_POINTS).astype(int), horizons])


def simulate_ensemble(
    seed: int = DEFAULT_SEED,
    people: int = PEOPLE,
    chunk_size: int = CHUNK_SIZE,
) -> Ensemble:
    if people < 1 or people % 2 != 1:
        raise ValueError("people must be a positive odd integer for a median person")
    if chunk_size < 1:
        raise ValueError("chunk_size must be positive")
    count = len(SCENARIOS)
    max_add, max_mult = max(ADD_HORIZONS), max(MULT_HORIZONS)
    t_add = times_to_plot(max_add, ADD_HORIZONS)
    t_mult = times_to_plot(max_mult, MULT_HORIZONS)
    add = np.empty((count, people, len(t_add)), dtype=np.int64)
    mult = np.empty((count, people, len(t_mult)), dtype=np.float64)
    add[:, :, 0], mult[:, :, 0] = 1, 0
    add_state = np.ones((count, people), dtype=np.int64)
    mult_state = np.zeros((count, people), dtype=np.float64)
    add_ends, mult_ends = {}, {}
    probs_p = np.array([s.prepared_probability for s in SCENARIOS])
    probs_q = np.array([s.good_luck_probability for s in SCENARIOS])
    rng = np.random.default_rng(seed)

    for start in range(0, max_add, chunk_size):
        stop = min(max_add, start + chunk_size)
        length = stop - start
        # Time-major RNG layout gives independent per-person, per-trial draws.
        # Shared draws across scenarios give a controlled, paired comparison.
        draws = rng.random((length, people, 2), dtype=np.float32)
        lucky = draws[:, :, 0, None] < probs_q
        ready = draws[:, :, 1, None] < probs_p
        codes = np.where(lucky, np.where(ready, 0, 1), np.where(ready, 2, 3))
        cumulative = np.cumsum(ADD_PAYOFFS[codes], axis=0, dtype=np.int64)

        l, r = np.searchsorted(t_add, [start + 1, stop + 1])
        if l < r:
            sampled = cumulative[t_add[l:r] - start - 1]
            add[:, :, l:r] = add_state[:, :, None] + sampled.transpose(2, 1, 0)
        for n in ADD_HORIZONS:
            if start < n <= stop:
                add_ends[n] = add_state + cumulative[n - start - 1].T
        add_state += cumulative[-1].T

        if start < max_mult:
            end_m = min(max_mult, stop)
            m_cum = np.cumsum(LOG_FACTORS[codes[:end_m - start]], axis=0)
            ml, mr = np.searchsorted(t_mult, [start + 1, end_m + 1])
            if ml < mr:
                sampled = m_cum[t_mult[ml:mr] - start - 1]
                mult[:, :, ml:mr] = mult_state[:, :, None] + sampled.transpose(2, 1, 0)
            for n in MULT_HORIZONS:
                if start < n <= end_m:
                    mult_ends[n] = mult_state + m_cum[n - start - 1].T
            mult_state += m_cum[-1].T

    return Ensemble(seed, people, t_add, t_mult, add, mult, add_ends, mult_ends)


def log_mean(log_wealth: np.ndarray) -> float:
    high = float(np.max(log_wealth))
    return high + float(np.log(np.mean(np.exp(log_wealth - high))))


def ending_statistics(ends: np.ndarray, multiplicative: bool = False) -> dict[str, float]:
    if multiplicative:
        # The mean of dollar wealth is NOT the mean of log wealth.
        return dict(min=float(np.min(ends)), max=float(np.max(ends)),
                    mean=log_mean(ends), median=float(np.median(ends)))
    return dict(min=float(np.min(ends)), max=float(np.max(ends)),
                mean=float(np.mean(ends)), median=float(np.median(ends)))


def median_person_index(ends: np.ndarray) -> int:
    return int(np.argsort(ends, kind="stable")[len(ends) // 2])


def _add_fmt(value: float, label: str = "") -> str:
    if label in ("min", "max", "median"):
        return f"${value:,.0f}" if value >= 0 else f"-${abs(value):,.0f}"
    return f"${value:,.2f}" if value >= 0 else f"-${abs(value):,.2f}"


def stat_table(ensemble: Ensemble, family: str) -> str:
    is_mult = family == "multiplicative"
    endings = ensemble.multiplicative_endings if is_mult else ensemble.additive_endings
    horizons = MULT_HORIZONS if is_mult else ADD_HORIZONS
    lines = [
        "| Scenario | Trials | Minimum wealth | Maximum wealth | Mean wealth | Median wealth |",
        "| :--- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for i, scenario in enumerate(SCENARIOS):
        for n in horizons:
            stats = ending_statistics(endings[n][i], multiplicative=is_mult)
            fields = [
                format_wealth(stats[k]) if is_mult else _add_fmt(stats[k], k)
                for k in ("min", "max", "mean", "median")
            ]
            lines.append("| " + " | ".join([scenario.label, f"{n:,}", *fields]) + " |")
    return "\n".join(lines) + "\n"


def figure_for(ensemble: Ensemble, family: str, i: int):
    """All 101 paths in each chart, plus a mean-END-wealth marker."""
    import plotly.graph_objects as go

    is_mult = family == "multiplicative"
    times = ensemble.multiplicative_times if is_mult else ensemble.additive_times
    paths = ensemble.multiplicative_paths if is_mult else ensemble.additive_paths
    finals = (
        ensemble.multiplicative_endings[max(MULT_HORIZONS)][i]
        if is_mult else ensemble.additive_endings[max(ADD_HORIZONS)][i]
    )
    med = median_person_index(finals)
    stats = ending_statistics(finals, multiplicative=is_mult)
    fig = go.Figure()
    y_values = paths[i] / LOG10 if is_mult else paths[i]
    for k in range(ensemble.people):
        if k != med:
            fig.add_trace(go.Scattergl(
                x=times, y=y_values[k], mode="lines", showlegend=False,
                line=dict(color="rgba(120,135,155,0.17)", width=.7),
                hoverinfo="skip",
            ))
    fig.add_trace(go.Scattergl(
        x=times, y=y_values[med], mode="lines",
        line=dict(color="#2563eb", width=3),
        name=f"Median-ending person (#{med+1})",
        hovertemplate=(
            "Trial %{x:,}<br>log10 wealth %{y:.2f}<extra></extra>"
            if is_mult else "Trial %{x:,}<br>Wealth $%{y:,.0f}<extra></extra>"
        ),
    ))
    mean_y = stats["mean"] / LOG10 if is_mult else stats["mean"]
    mean_label = format_wealth(stats["mean"]) if is_mult else _add_fmt(stats["mean"])
    fig.add_trace(go.Scatter(
        x=[int(times[-1])], y=[mean_y], mode="markers",
        marker=dict(size=14, color="#d97706", symbol="diamond",
                    line=dict(color="#ffffff", width=1)),
        name=f"Mean ending wealth: {mean_label}",
        hovertemplate="Mean ending wealth: " + mean_label + "<extra></extra>",
    ))
    fig.update_layout(
        template="plotly_white",
        title=f"{family.title()} — {SCENARIOS[i].label} — {ensemble.people} people",
        xaxis_title="Trials",
        yaxis_title="log10 wealth ($)" if is_mult else "Wealth ($)",
        xaxis=dict(showgrid=False, range=[0, int(times[-1])]),
        yaxis=dict(showgrid=True, gridcolor="#e5e7eb", zeroline=False),
        legend=dict(orientation="h", y=-.2),
        font=dict(family="Arial, sans-serif", size=13),
        margin=dict(l=85, r=45, t=80, b=110), width=1100, height=650,
    )
    return fig


def run_ensemble(seed: int = DEFAULT_SEED, people: int = PEOPLE,
                 skip_png: bool = False, chunk_size: int = CHUNK_SIZE) -> str:
    e = simulate_ensemble(seed=seed, people=people, chunk_size=chunk_size)
    RESULTS_DIRECTORY.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {people}-person luck × preparation ensembles — seed {seed}", "",
        "Each person independently samples luck and preparation each trial. "
        "The same random uniforms for a given person/trial are reused across "
        "scenarios (paired comparison); historical single-person seeded "
        "streams remain unchanged. All wealth starts at $1.", "",
        "## Additive (+$10, +$1, -$1, -$10); 1 / 1,000 / 1,000,000 trials", "",
        stat_table(e, "additive"), "",
        "## Multiplicative (+10%, +1%, -1%, -10%); 1 / 100 / 10,000 trials", "",
        stat_table(e, "multiplicative"), "",
        "Mean = arithmetic mean of ending wealth across 101 people; on a "
        "log10 chart, the mean marker is log10(arithmetic mean wealth), NOT "
        "mean(log wealth). The blue line is a REAL person whose ending "
        "wealth is the sample median at the longest horizon, with stable "
        "ties broken by original person order. Orange diamond = mean "
        "ending wealth at the longest horizon. All other 100 paths are "
        "faint grey. For 1,000,000 additive trials, chart lines show evenly "
        "sampled trial coordinates while all ending statistics use full data. "
        "For multiplicative charts, log10 wealth avoids under/overflow. "
        "No original experiment data/code or publishing workflow is changed.\n",
    ]
    report = "\n".join(lines)
    (RESULTS_DIRECTORY / "summary.md").write_text(report, encoding="utf-8")
    for family in ("additive", "multiplicative"):
        for i, scenario in enumerate(SCENARIOS):
            fig = figure_for(e, family, i)
            base = f"{family}_{scenario.slug}"
            fig.write_html(RESULTS_DIRECTORY / (base + ".html"),
                           include_plotlyjs="cdn", full_html=True)
            if not skip_png:
                png = CHART_DIRECTORY / (base + ".png")
                png.parent.mkdir(parents=True, exist_ok=True)
                try:
                    fig.write_image(png, scale=2, width=1100, height=650)
                except Exception as exc:
                    raise RuntimeError("Kaleido and Chrome needed for PNG; use --skip-png") from exc
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--people", type=int, default=PEOPLE)
    parser.add_argument("--chunk-size", type=int, default=CHUNK_SIZE)
    parser.add_argument("--skip-png", action="store_true")
    args = parser.parse_args()
    print(run_ensemble(seed=args.seed, people=args.people,
                       skip_png=args.skip_png, chunk_size=args.chunk_size))


if __name__ == "__main__":
    main()
