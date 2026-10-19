"""One reproducible generator: four payoff families, seven cases, 1/101 people.

Writes all tables and optional interactive/static charts, without publishing.
Run: python -m analyses.luck_preparation.run --help
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import math

import numpy as np
import plotly.graph_objects as go

STARTING_WEALTH = 1.0
DEFAULT_SEED = 42
PEOPLE = 101
ADD_HORIZONS = (1, 100, 10_000)
MULT_HORIZONS = (1, 10, 100)
RESULTS_DIR = Path(".tmp/luck_preparation")
ARTICLE_ASSETS = Path("src/content/blog/2026_10_24_luck_preparation/assets")

@dataclass(frozen=True)
class Scenario:
    slug: str
    label: str
    p_prepare: float
    p_good: float

@dataclass(frozen=True)
class Family:
    slug: str
    title: str
    kind: str
    display_payoff: str
    add_payoffs: tuple[float, float, float, float] | None = None
    mult_factors: tuple[float, float, float, float] | None = None
    horizons: tuple[int, ...] = ()

SCENARIOS = [
    Scenario("base", "50% prepared, 50% good luck", .5, .5),
    Scenario("prepared90_luck50", "90% prepared, 50% good luck", .9, .5),
    Scenario("prepared10_luck50", "10% prepared, 50% good luck", .1, .5),
    Scenario("prepared50_luck90", "50% prepared, 90% good luck", .5, .9),
    Scenario("prepared50_luck10", "50% prepared, 10% good luck", .5, .1),
    Scenario("prepared90_luck10", "90% prepared, 10% good luck", .9, .1),
    Scenario("prepared10_luck90", "10% prepared, 90% good luck", .1, .9),
]

FAMILIES = [
    Family("additive", "Additive", "add", "+10 / +1 / -1 / -10",
           add_payoffs=(10, 1, -1, -10), horizons=ADD_HORIZONS),
    Family("multiplicative", "Multiplicative", "mult",
           "+10% / +1% / -1% / -10%",
           mult_factors=(1.10, 1.01, .99, .90), horizons=MULT_HORIZONS),
    Family("additive_symmetric", "Additive symmetric", "add",
           "+10 / 0 / 0 / -10",
           add_payoffs=(10, 0, 0, -10), horizons=ADD_HORIZONS),
    Family("multiplicative_reversing", "Multiplicative loss-reversing",
           "mult", "+11.11% / +1.01% / -1% / -10%",
           mult_factors=(10/9, 100/99, .99, .90), horizons=MULT_HORIZONS),
]

def simulate_codes_single(scenario, n, seed=DEFAULT_SEED):
    rng = np.random.default_rng(seed)
    if scenario.slug == "base":
        draws = rng.integers(0, 2, size=(n, 2))
        lucky, ready = draws[:, 0].astype(bool), draws[:, 1].astype(bool)
    else:
        draws = rng.random((n, 2))
        lucky = draws[:, 0] < scenario.p_good
        ready = draws[:, 1] < scenario.p_prepare
    return np.where(lucky, np.where(ready, 0, 1), np.where(ready, 2, 3))

def simulate_codes_cohort(scenario, n, people=PEOPLE, seed=DEFAULT_SEED):
    rng = np.random.default_rng(seed)
    draws = rng.random((n, people, 2), dtype=np.float32)
    lucky = draws[:, :, 0] < scenario.p_good
    ready = draws[:, :, 1] < scenario.p_prepare
    return np.where(lucky, np.where(ready, 0, 1), np.where(ready, 2, 3))

def add_path(codes, payoffs):
    steps = np.take(np.asarray(payoffs, dtype=float), codes)
    if steps.ndim == 1:
        return np.r_[STARTING_WEALTH, STARTING_WEALTH + np.cumsum(steps)]
    return np.c_[np.full(steps.shape[1], STARTING_WEALTH),
                 STARTING_WEALTH + np.cumsum(steps, axis=0).T]

def mult_path(codes, factors):
    logs = np.log(np.take(np.asarray(factors, dtype=float), codes))
    if logs.ndim == 1:
        return np.exp(np.r_[0., np.cumsum(logs)])
    return np.c_[np.ones(logs.shape[1]), np.exp(np.cumsum(logs, axis=0).T)]

def expected_add(payoffs, p, q):
    a,b,c,d = payoffs
    return p*q*a + (1-p)*q*b + p*(1-q)*c + (1-p)*(1-q)*d

def expected_mult(factors, p, q):
    w = np.array([p*q, (1-p)*q, p*(1-q), (1-p)*(1-q)])
    factors = np.asarray(factors, dtype=float)
    return float(w @ (factors-1)), float(np.expm1(w @ np.log(factors)))

def expected_ending_wealth(family, scenario, trials):
    """Population arithmetic expected ending dollar wealth, not geometric mean."""
    p, q = scenario.p_prepare, scenario.p_good
    if family.kind == "add":
        return STARTING_WEALTH + trials*expected_add(family.add_payoffs, p, q)
    arith, _ = expected_mult(family.mult_factors, p, q)
    return STARTING_WEALTH * math.exp(trials*math.log1p(arith))

def dollars(x, decimals=2):
    if x == 0:
        return "$0.00" if decimals else "$0"
    sign = "-" if x < 0 else ""
    mag = abs(float(x))
    if mag >= 1e6 or mag < 1e-3:
        mantissa, exponent = f"{mag:.2e}".split("e")
        return sign + "$" + f"{mantissa} × 10^{int(exponent):+d}"
    if mag < .01:
        return sign + "$" + f"{mag:.5f}"
    if mag < 1:
        return sign + "$" + f"{mag:.{max(2,decimals)}f}".rstrip("0").rstrip(".")
    return sign + "$" + f"{mag:,.{decimals}f}"

def axis_bounds(family, observed_values):
    """Only observed values set limits. Expected endpoint never stretches plot."""
    values = np.asarray(observed_values, dtype=float)
    low, high = float(values.min()), float(values.max())
    use_log = family.kind == "mult" and low > 0 and high/low >= 10
    if use_log:
        bottom, top = math.log10(low), math.log10(high)
        pad = max(.075*(top-bottom), .045)
        return True, bottom-pad, top+pad
    if family.kind == "add":
        low, high = min(0., low), max(0., high)
    span = high-low
    pad = max(.08*span, .03*max(1., abs(low), abs(high)))
    return False, low-pad, high+pad

def style_wealth_axis(fig, family, observed):
    is_log, low, high = axis_bounds(family, observed)
    if is_log:
        powers = range(math.ceil(low), math.floor(high)+1)
        ticks = [10.**k for k in powers]
        labels = [f"{int(t):,}" if t >= 1 else f"{t:g}" for t in ticks]
        fig.update_yaxes(title="Wealth ($) · logarithmic", type="log",
                         range=[low, high], tickmode="array",
                         tickvals=ticks, ticktext=labels,
                         showgrid=True, gridcolor="#e5e7eb")
    else:
        fig.update_yaxes(title="Wealth ($)", type="linear",
                         range=[low, high], showgrid=True,
                         gridcolor="#e5e7eb", zeroline=False)
        if family.kind == "add":
            fig.add_hline(y=0, line_dash="dot", line_color="#777")
    return is_log, low, high

def expected_marker(fig, family, scenario, trials, bounds):
    expected = expected_ending_wealth(family, scenario, trials)
    is_log, low, high = bounds
    coord = math.log10(expected) if is_log else expected
    above, below = coord > high, coord < low
    span = high-low
    pos = high-.04*span if above else low+.04*span if below else coord
    plotted = 10.**pos if is_log else pos
    val = dollars(expected)
    note = " (above scale ↑)" if above else " (below scale ↓)" if below else ""
    fig.add_trace(go.Scatter(
        x=[trials], y=[plotted], mode="markers",
        name=f"Theoretical expected ending wealth: {val}{note}",
        marker=dict(size=14, color="#9333ea", symbol="circle",
                    line=dict(color="#fff", width=1.7)),
        hovertemplate=f"Theoretical expected ending wealth: {val}{note}<extra></extra>",
    ))
    if above or below:
        fig.add_annotation(
            x=trials, y=plotted, text=f"Expected: {val}{note}",
            showarrow=True, arrowhead=0, ax=-110,
            ay=24 if above else -24, font=dict(size=11, color="#7e22ce"),
            bgcolor="rgba(255,255,255,0.92)",
            bordercolor="#ddd6fe", borderwidth=1,
        )
    return expected, above or below

def make_single_chart(family, scenario, path, trials):
    title = f"{family.title} | {scenario.label} | {family.display_payoff} | 1 person | {trials:,} trial{'s' if trials != 1 else ''}"
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=np.arange(len(path)), y=path,
        mode="lines+markers" if trials==1 else "lines",
        name="Actual wealth — 1 person",
        line=dict(color="#2563eb", width=2.5),
    ))
    fig.update_xaxes(title="Trials", showgrid=False,
                     range=[0, trials*1.065],
                     dtick=1 if trials==1 else None)
    bounds = style_wealth_axis(fig, family, path)
    expected_marker(fig, family, scenario, trials, bounds)
    fig.update_layout(
        template="plotly_white", title=title, width=1100, height=550,
        margin=dict(l=90, r=35, t=105, b=110),
        legend=dict(orientation="h", y=-.22),
        font=dict(family="Arial, sans-serif", size=13),
    )
    return fig

def make_cohort_chart(family, scenario, paths):
    count = len(paths)
    title = (f"{family.title} | {scenario.label} | {family.display_payoff} | "
             f"{count} people | {paths.shape[1]-1:,} trials")
    finals = paths[:, -1]
    median_idx = int(np.argsort(finals, kind="stable")[count//2])
    mean_final = float(np.mean(finals))
    fig = go.Figure()
    x = np.arange(paths.shape[1])
    # Rendering samples the long 10k-trial paths; all endpoint stats use full data.
    samples = np.unique(np.linspace(0, len(x)-1, min(len(x)-1, 600)+1, dtype=int))
    for i in range(count):
        if i != median_idx:
            fig.add_trace(go.Scattergl(
                x=x[samples], y=paths[i, samples], mode="lines", showlegend=False,
                line=dict(color="rgba(120,135,155,0.17)", width=.7),
                hoverinfo="skip",
            ))
    fig.add_trace(go.Scattergl(
        x=x[samples], y=paths[median_idx, samples], mode="lines",
        name=f"Median-ending person (#{median_idx+1})",
        line=dict(color="#2563eb", width=3),
    ))
    fig.add_trace(go.Scatter(
        x=[x[-1]], y=[mean_final], mode="markers",
        name=f"Observed mean ending wealth: {dollars(mean_final)}",
        marker=dict(size=14, color="#d97706", symbol="diamond",
                    line=dict(color="#fff", width=1.4)),
    ))
    bounds = style_wealth_axis(fig, family, paths)
    expected_marker(fig, family, scenario, int(x[-1]), bounds)
    fig.update_xaxes(title="Trials", showgrid=False,
                     range=[0, int(x[-1])*1.065])
    fig.update_layout(
        template="plotly_white", title=title, width=1100, height=650,
        margin=dict(l=90, r=35, t=105, b=125),
        legend=dict(orientation="h", y=-.2),
        font=dict(family="Arial, sans-serif", size=13),
    )
    return fig

def single_table(family, scenario, paths):
    rows = []
    for n,path in zip(family.horizons, paths):
        final = float(path[-1])
        if family.kind == "add":
            eg = expected_add(family.add_payoffs, scenario.p_prepare, scenario.p_good)
            obs = (final-STARTING_WEALTH)/n
            rate = "N/A" if final<0 else f"{100*((final/STARTING_WEALTH)**(1/n)-1):+.2f}%" if final>0 else "-100.00%"
            cells = (dollars(obs), dollars(eg), rate)
        else:
            er, _ = expected_mult(family.mult_factors, scenario.p_prepare, scenario.p_good)
            obs = np.mean(path[1:]/path[:-1]-1)
            compound = math.expm1(math.log(final/STARTING_WEALTH)/n)
            cells = (f"{100*obs:+.2f}%", f"{100*er:+.2f}%", f"{100*compound:+.2f}%")
        rows.append("| "+ " | ".join([f"{n:,}", dollars(STARTING_WEALTH),
                 dollars(final), dollars(expected_ending_wealth(family, scenario, n)),
                 f"{(final-1)*100:+,.0f}%", *cells])+" |")
    cells = ("Realised gain/trial | Expected gain/trial | Implied growth/trial"
             if family.kind=="add" else
             "Realised mean return/trial | Expected return/trial | Realised compound/trial")
    return ("| Trials | Start | Final | Theoretical expected end | Total gain | "+cells+" |\n"
            "| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n"
            +"\n".join(rows)+"\n")

def cohort_table(family, scenario, paths):
    rows = []
    for n in family.horizons:
        x=paths[:,n]
        rows.append(f"| {n:,} | {dollars(np.min(x))} | {dollars(np.max(x))} | "
                    f"{dollars(np.mean(x))} | {dollars(np.median(x))} | "
                    f"{dollars(expected_ending_wealth(family, scenario, n))} |")
    return ("| Trials | Minimum wealth | Maximum wealth | Mean wealth | Median wealth | Theoretical expected end |\n"
            "| :--- | ---: | ---: | ---: | ---: | ---: |\n"
            +"\n".join(rows)+"\n")

def save_png(fig, destination):
    """Static Matplotlib rendering from the same Plotly traces and plot settings."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.ticker as ticker

    destination = Path(destination)
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite article chart: {destination}")
    canvas, ax = plt.subplots(figsize=(12, 6.5), dpi=120)
    for trace in fig.data:
        label = trace.name if trace.showlegend is not False else None
        if trace.mode == "markers":
            ax.scatter(trace.x, trace.y, s=90,
                       marker="D" if trace.marker.symbol == "diamond" else "o",
                       color=trace.marker.color, zorder=5, label=label)
        else:
            color, alpha = trace.line.color or "#2563eb", None
            if color.startswith("rgba("):
                rgba = color[5:-1].split(",")
                color = tuple(float(c)/255 for c in rgba[:3])
                alpha = float(rgba[3])
            ax.plot(trace.x, trace.y, color=color, alpha=alpha,
                    linewidth=trace.line.width or 1, label=label)
    if fig.layout.yaxis.type == "log":
        low, high = fig.layout.yaxis.range
        ax.set_yscale("log")
        ax.set_ylim(10**low, 10**high)
        ax.yaxis.set_major_locator(ticker.LogLocator(base=10))
        ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda val, _: f"{val:g}"))
        ax.yaxis.set_minor_locator(ticker.NullLocator())
    else:
        ax.set_ylim(*fig.layout.yaxis.range)
    ax.set_xlim(*fig.layout.xaxis.range)
    ax.set_xlabel("Trials")
    ax.set_ylabel(fig.layout.yaxis.title.text)
    ax.set_title(fig.layout.title.text, loc="left", fontsize=10, pad=16)
    ax.grid(axis="y", alpha=.20)
    for ann in fig.layout.annotations or []:
        if not getattr(ann, "text", "").startswith("Expected:"):
            continue
        ax.annotate(ann.text, xy=(ann.x, ann.y),
                    xytext=(-95, 18 if "above" in ann.text else -18),
                    textcoords="offset points", fontsize=9,
                    bbox=dict(facecolor="white", edgecolor="#ddd6fe"),
                    arrowprops=dict(arrowstyle="-", color="#9333ea"))
    ax.legend(loc="upper center", bbox_to_anchor=(.5, -.14),
              frameon=False, fontsize=9, ncol=3)
    canvas.subplots_adjust(bottom=.24, top=.89, left=.09, right=.98)
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.savefig(destination)
    plt.close(canvas)


def run_all(seed=DEFAULT_SEED, people=PEOPLE, *, html="none", png="none",
            output_dir=RESULTS_DIR, article_assets=ARTICLE_ASSETS):
    if people < 1 or people % 2 == 0:
        raise ValueError("positive odd people count required")
    if html not in ("none", "baseline", "all") or png not in ("none", "baseline", "all"):
        raise ValueError("html/png must be none, baseline or all")
    output_dir = Path(output_dir)
    article_assets = Path(article_assets)
    if png != "none" and not article_assets.parent.is_dir():
        raise FileNotFoundError(f"Create the existing Astro article folder: {article_assets.parent}")
    output_dir.mkdir(parents=True, exist_ok=True)
    single = ["# Single-person paths: four families × seven scenarios", "",
              "Purple circle = theoretical expected ending wealth, not a line.", ""]
    cohort = [f"# {people}-person cohorts: four families × seven scenarios", "",
              "Blue = actual median-ending person; orange = observed sample mean;",
              "purple = theoretical expected ending wealth.", ""]
    # Produce trial events only once per person/case, then reuse across all payoffs.
    max_n = max(max(f.horizons) for f in FAMILIES)
    draws = {
        c.slug: (simulate_codes_single(c, max_n, seed),
                 simulate_codes_cohort(c, max_n, people, seed))
        for c in SCENARIOS
    }
    for family in FAMILIES:
        single.extend([f"## {family.title} ({family.display_payoff})", ""])
        cohort.extend([f"## {family.title} ({family.display_payoff})", ""])
        n = max(family.horizons)
        for scenario in SCENARIOS:
            one_codes, many_codes = draws[scenario.slug]
            if family.kind == "add":
                paths = [add_path(one_codes[:t], family.add_payoffs) for t in family.horizons]
                crowd = add_path(many_codes[:n], family.add_payoffs)
            else:
                paths = [mult_path(one_codes[:t], family.mult_factors) for t in family.horizons]
                crowd = mult_path(many_codes[:n], family.mult_factors)
            single.extend([f"### {scenario.label}", "",
                           single_table(family, scenario, paths), ""])
            cohort.extend([f"### {scenario.label}", "",
                           cohort_table(family, scenario, crowd), ""])
            html_selected = html == "all" or (html == "baseline" and scenario.slug == "base")
            png_selected = png == "all" or (png == "baseline" and scenario.slug == "base")
            if not (html_selected or png_selected):
                continue
            for t, path in zip(family.horizons, paths):
                fig = make_single_chart(family, scenario, path, t)
                name = f"single_{family.slug}_{scenario.slug}_{t}"
                if html_selected:
                    chart_dir = output_dir / "charts"
                    chart_dir.mkdir(parents=True, exist_ok=True)
                    fig.write_html(chart_dir / (name+".html"), include_plotlyjs="cdn")
                if png_selected:
                    save_png(fig, article_assets / (name+".png"))
            fig = make_cohort_chart(family, scenario, crowd)
            name = f"cohort_{family.slug}_{scenario.slug}"
            if html_selected:
                chart_dir = output_dir / "charts"
                chart_dir.mkdir(parents=True, exist_ok=True)
                fig.write_html(chart_dir / (name+".html"), include_plotlyjs="cdn")
            if png_selected:
                save_png(fig, article_assets / (name+".png"))
    (output_dir/"single_summary.md").write_text("\n".join(single), encoding="utf-8")
    (output_dir/"cohort_summary.md").write_text("\n".join(cohort), encoding="utf-8")
    return output_dir


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--people", type=int, default=PEOPLE)
    parser.add_argument("--html", choices=("none", "baseline", "all"), default="none")
    parser.add_argument("--png", choices=("none", "baseline", "all"), default="none")
    parser.add_argument("--output-dir", type=Path, default=RESULTS_DIR)
    parser.add_argument("--article-assets", type=Path, default=ARTICLE_ASSETS)
    a = parser.parse_args()
    print(run_all(a.seed, a.people, html=a.html, png=a.png,
                  output_dir=a.output_dir, article_assets=a.article_assets))


if __name__ == "__main__":
    main()
