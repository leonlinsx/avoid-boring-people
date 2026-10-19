"""Render candidate PNG charts beside the uncommitted Astro article.

From repository root:
  python -m analyses.luck_preparation.article_assets
  python -m analyses.luck_preparation.article_assets --all

Default exports the 16 baseline charts (3 single-person horizons + 1
101-person cohort for each of four families). --all exports all 112.
Never changes index.md or overwrites an existing asset.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np

from . import four_families as ff

ARTICLE_ASSET_DIR = Path("src/content/blog/2026_10_24_luck_preparation/assets")


def render_article_assets(*, all_scenarios=False, out_dir=ARTICLE_ASSET_DIR):
    """Static PNG export fallback using Matplotlib (no Chrome required)."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mticker

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    colors = {"blue":"#2563eb", "purple":"#9333ea",
              "orange":"#d97706", "faded":"#8292a8"}

    def render_chart(family, scenario, path, cohort=False):
        n = path.shape[-1]-1
        fig, ax = plt.subplots(figsize=(12, 6.6 if cohort else 5.8), dpi=125)
        x = np.arange(n+1)
        if cohort:
            endings = path[:, -1]
            median_idx = int(np.argsort(endings, kind="stable")[len(endings)//2])
            for k in range(len(endings)):
                if k != median_idx:
                    ax.plot(x, path[k], color=colors["faded"], alpha=.18,
                            linewidth=.6, zorder=1)
            ax.plot(x, path[median_idx], color=colors["blue"], linewidth=2.5,
                    label="Median-ending person", zorder=4)
            observed_mean = float(np.mean(endings))
            ax.scatter([n], [observed_mean], marker="D", s=80,
                       color=colors["orange"], edgecolor="white", zorder=6,
                       label="Observed mean: " + ff.dollars(observed_mean, 2))
        else:
            ax.plot(x, path, color=colors["blue"], linewidth=2.2,
                    marker="o" if n == 1 else None,
                    label="Actual person", zorder=4)

        is_log, low, high = ff.axis_bounds(family, path)
        if is_log:
            ax.set_yscale("log")
            ax.set_ylim(10**low, 10**high)
            ax.yaxis.set_major_locator(mticker.LogLocator(base=10))
            ax.yaxis.set_minor_locator(mticker.NullLocator())
            ax.yaxis.set_major_formatter(mticker.FuncFormatter(
                lambda y, _: f"{int(y):,}" if y >= 1 else f"{y:g}"))
            ax.set_ylabel("Wealth ($) · log scale")
        else:
            ax.set_ylim(low, high)
            ax.set_ylabel("Wealth ($)")
            if family.kind == "add":
                ax.axhline(0, color="#777", linestyle=":", linewidth=.8)

        expected = ff.expected_ending_wealth(family, scenario, n)
        raw_y = math.log10(expected) if is_log else expected
        above, below = raw_y > high, raw_y < low
        y = high-.04*(high-low) if above else low+.04*(high-low) if below else raw_y
        displayed_y = 10**y if is_log else y
        suffix = " (above scale)" if above else " (below scale)" if below else ""
        ax.scatter([n], [displayed_y], marker="o", s=95,
                   color=colors["purple"], edgecolor="white", zorder=8,
                   label="Theoretical expected: "+ff.dollars(expected, 2)+suffix)
        if above or below:
            ax.annotate("Expected: "+ff.dollars(expected, 2)+suffix,
                        xy=(n, displayed_y), xytext=(-110, -14 if above else 14),
                        textcoords="offset points", ha="right", fontsize=9,
                        bbox={"facecolor":"white","edgecolor":"#ddd6fe",
                              "boxstyle":"round,pad=0.3"},
                        arrowprops={"arrowstyle":"-", "color":colors["purple"]})

        ax.set_xlim(0, max(1, n)*1.06)
        ax.set_xlabel("Trials")
        ax.grid(axis="y", color="#e5e7eb", linewidth=.7)
        ax.set_axisbelow(True)
        for side in ("top","right"):
            ax.spines[side].set_visible(False)
        population = "101 people" if cohort else "1 person"
        title = (f"{family.title} | {scenario.label} | {family.display_payoff} "
                 f"| {population} | {n:,} trials")
        ax.set_title(title, loc="left", fontsize=10.3, weight="semibold", pad=22)
        ax.legend(loc="upper center", bbox_to_anchor=(.5, -.13),
                  ncol=3, fontsize=8.6, frameon=False)
        fig.subplots_adjust(left=.095, right=.97, top=.89, bottom=.25)
        name = ("cohort" if cohort else "single")+"_"+family.slug+"_"+scenario.slug
        if not cohort:
            name += f"_{n}"
        filename = out_dir/(name+".png")
        if filename.exists():
            plt.close(fig)
            raise FileExistsError("Refusing to overwrite existing article asset: "
                                  + str(filename))
        fig.savefig(filename)
        plt.close(fig)
        return filename

    generated = []
    selected = ff.SCENARIOS if all_scenarios else ff.SCENARIOS[:1]
    for family in ff.FAMILIES:
        n = max(family.horizons)
        for scenario in selected:
            single_codes = ff.simulate_codes_single(scenario, n)
            cohort_codes = ff.simulate_codes_cohort(scenario, n, people=ff.PEOPLE)
            def path(codes):
                return (ff.add_path(codes, family.add_payoffs)
                        if family.kind == "add" else ff.mult_path(codes, family.mult_factors))
            for h in family.horizons:
                generated.append(render_chart(family, scenario, path(single_codes[:h])))
            generated.append(render_chart(family, scenario, path(cohort_codes), cohort=True))
    return generated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true",
                        help="Export all 112 charts instead of 16 baseline charts")
    parser.add_argument("--output-dir", type=Path, default=ARTICLE_ASSET_DIR)
    args = parser.parse_args()
    created = render_article_assets(all_scenarios=args.all,
                                    out_dir=args.output_dir)
    print(f"Generated {len(created)} PNGs in {args.output_dir}")


if __name__ == "__main__":
    main()
