# Luck × preparation: reproducible article experiment

Keep the model in `analyses/` so future articles can import and extend it;
nothing runs inside the Astro/Vercel build.

## Run from repository root

```bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.run
python -m pytest tests/test_luck_preparation.py -q
```

Default seed: `42`. Override with `--seed N`. To generate tables and
Plotly HTML without Kaleido/Chrome, use `--skip-png`.

The simulation runs for **1**, **1,000** and **1,000,000** trials; the
short runs are exact prefixes of the longer path using the same seed.
Outputs include:
- `analyses/luck_preparation/results/summary.md` — reproducible results table.
- `results/wealth_1.html`, `wealth_1000.html`,
  `wealth_1000000.html` — interactive, local-only Plotly HTML previews.
- `src/content/blog/luck_preparation/charts/wealth_1.png`,
  `wealth_1000.png`, `wealth_1000000.png` — static Plotly charts for
  the article and newsletter. PNG export needs Kaleido and Chrome/Chromium.

Embed a PNG in article Markdown: `![Wealth](./charts/wealth_1000000.png)`.
Only horizontal gridlines are displayed. For the million-trial chart,
plotting preserves endpoints and both extrema per x-axis bucket,
reducing roughly one million points to at most 2,402 plotted points;
**all calculations still use the full 1,000,000 trials**.

Keep the article `index.md` absent until publication is intended; new
articles can activate the site's automated social distribution.

## Model assumptions and interpretation

- Initial wealth: **$1**.
- Luck is independently good or bad (50/50), and preparation is
  independently prepared or unprepared (50/50).
- Four equally likely **additive dollar** changes:
  good/prepared **+$10**; good/unprepared **+$1**;
  bad/prepared **−$1**; bad/unprepared **−$10**.
- Wealth may be negative: no bankruptcy floor or borrowing constraint.
- **Realised gain per trial** (dollars) = `(final - initial) / trials`.
- **Expected gain per trial** (dollars) = `(10 + 1 - 1 - 10) / 4 = $0`.
  The expected total gain across 1, 1,000, or 1,000,000 trials is also $0;
  expected ending wealth is $1 in every case.
- **Total gain (%)** = `(final / initial - 1) * 100`.
- Endpoint-implied compound growth rate = `(final / initial)^(1/trials) - 1`.
  This is **not a realizable compounded investment return**, even when
  the number is positive, because wealth can pass through $0 or below.
  At seed 42, the 1,000-trial path hits negative wealth but ends at $29,
  giving +0.337297% implied per trial. The 1,000,000-trial path ends
  at −$2,511, which has no real-valued growth rate for an even trial count
  and remains reported as **N/A** (no absolute-value or sign-adjusted
  substitute is presented).
- The article summary puts **expected gain per trial** directly below
  **realised gain per trial**, with the scenarios as columns.
- This is one sequence of sequential outcomes per length, **not**
  1,000,000 independent Monte Carlo paths.

## Reuse in future work

```python
from analyses.luck_preparation.run import simulate
path = simulate(1000, seed=42)
print(path.final_wealth, path.mean_gain_per_trial)
```

Commit model, assumptions, seed, results, and published PNGs with the
eventual article; do not make publication contingent on running the model.
