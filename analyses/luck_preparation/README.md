# Luck × preparation — article analysis (unpublished)

**One generator:** `analyses/luck_preparation/run.py`. It contains the four payoff families, seven probability scenarios, shared random draws, mathematical expectations, summary tables, and both HTML and PNG charts. No duplicate additive/multiplicative/cohort/counterfactual/renderer modules.

From the repo root:

```bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.run                       # Full single-person and cohort tables
python -m analyses.luck_preparation.run --html all             # 112 Plotly previews, .tmp/luck_preparation/charts
python -m analyses.luck_preparation.run --png baseline         # 16 starter PNGs next to article
python -m analyses.luck_preparation.run --png all              # Optional: all 112 PNGs, do not commit all
python -m pytest tests/test_luck_preparation.py -q
```

Generated tables are `.tmp/luck_preparation/single_summary.md` and `.tmp/luck_preparation/cohort_summary.md`, which remain untracked because the repo already ignores `.tmp/`. Selectively generated PNGs go in `src/content/blog/2026_10_24_luck_preparation/assets/`. The exporter requires that the article directory already exists, refuses to overwrite any image, and **never creates or alters `index.md`**.

Use the site's existing Astro directory and frontmatter pattern in your own `src/content/blog/2026_10_24_luck_preparation/index.md`, with relative image links e.g. `![Simulation](./assets/cohort_additive_base.png)`. Do **not** add extra Markdown files or placeholders under `src/content/blog`: Astro's content glob treats every `.md` and `.mdx` there as a blog entry. The experiment PR commits no blog article or image binaries.

## Experimental design

Every outcome is drawn independently per trial and person. Start wealth = $1; seed = 42; 101 independent people per scenario. Seven (preparedness / good-luck) pairs: **50/50, 90/50, 10/50, 50/90, 50/10, 90/10, 10/90**.

Four payoffs always follow this order: **good luck + prepared, good luck + unprepared, bad luck + prepared, bad luck + unprepared**.

| Family | Payoffs | Horizons |
|---|---|---|
| Additive | +$10 / +$1 / −$1 / −$10 | 1, 100, 10,000 |
| Multiplicative | +10% / +1% / −1% / −10% | 1, 10, 100 |
| Additive symmetric | +$10 / $0 / $0 / −$10 | 1, 100, 10,000 |
| Multiplicative loss-reversing | Exact factors 10/9, 100/99, 0.99, 0.90 (roughly +11.111…%, +1.010101…%, −1%, −10%) | 1, 10, 100 |

**84 single-person horizon charts + 28 cohort charts = 112.** Every title includes family, scenario, payoffs, people and trials. Blue = actual path (or the real median-ending person's path); faded grey = other 100 paths; orange diamond = sample arithmetic mean ending wealth; purple circle = exact **theoretical expected ending wealth** at the final trial, *not* a trajectory. The off-scale expected marker is explicitly labeled; additive plots remain linear to accommodate negative balances, while multiplicative plots use logarithmic, powers-of-ten dollar axes only where useful. All statistics use full trials; long cohort lines may be visual downsampled.

Tables show every horizon and the theoretical expected ending value. Additive expected wealth is `1 + n E[dollar payoff]`; multiplicative expected wealth is `(E[gross factor])^n`. Expected dollar wealth is not the same as the median or geometric-growth outcome.

## Limitations

These are **illustrative assumptions**, not evidence estimating actual real-world luck or preparation. Preparation is independently redrawn, not learned; additive balances can be negative without any insolvency rule; no preparation costs or correlated luck; the observed cohort minimum/maximum are sample statistics, not mathematical bounds. This article should complement, not replicate, `src/content/blog/2021_04_03_ergodicity/index.md`.

Nothing here merges or publishes an article, newsletter or social post.
