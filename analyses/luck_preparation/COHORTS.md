# 101-person luck × preparation ensembles

This is an **additional distribution analysis** of the 14 established scenarios:
seven original additive cases and seven original multiplicative cases. It
**does not** replace the earlier single-person paths or introduce a new
payoff matrix. Alternative symmetric/loss-offset payoff experiments are
outside this 14-case comparison.

## Run locally

From the repository root:

```bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.cohorts --skip-png
python -m pytest tests/test_luck_preparation_cohorts.py -q
```

Omit `--skip-png` to generate static Plotly PNGs using Kaleido and
Chrome/Chromium. Seed defaults to **42**; the cohort count is **101**.
The initial wealth of every person is **$1**. All paths are simulated
independently across people, with independent luck and preparation draws
within each trial.

For a given **person and trial**, reuse the same two uniformly random
draws across all seven probability scenarios, so changing preparation
or good-luck probabilities gives a *paired comparison*. The cohort RNG
sequence differs from the earlier one-person historical sequences; the
historical one-person seeded output remains unchanged.

The simulation processes the original million-trial additive horizon
in bounded chunks, so it does not allocate a 101 × 1,000,000 history
matrix. All reported ending statistics use the **full exact trial count**.

## Coverage and outputs

| Family | Number of scenarios | Horizons | Payoffs |
|---|---:|---|---|
| Additive | 7 | 1 / 1,000 / 1,000,000 | +$10 / +$1 / −$1 / −$10 |
| Multiplicative | 7 | 1 / 100 / 10,000 | ×1.10 / ×1.01 / ×0.99 / ×0.90 |

The script writes:

- `analyses/luck_preparation/results/cohorts/summary.md`: minimum,
  maximum, **arithmetic mean**, and sample median of ending wealth for
  each of the 42 family/scenario/horizon combinations.
- `analyses/luck_preparation/results/cohorts/{additive,multiplicative}_<slug>.html`:
  **14 Plotly charts**, one per family/scenario, spanning the *longest*
  family-specific horizon. Use the HTML for interactive exploration.
- `src/content/blog/luck_preparation/charts/cohorts/{additive,multiplicative}_<slug>.png`:
  the same 14 charts for article/newsletter use, when PNG export is enabled.

## Chart semantics

Each chart displays **all 101 people**: 100 light grey trajectories plus
one bold blue line from the **actual person ranked 51st by ending wealth
at that family's longest horizon**. This is a genuine realized trajectory,
*not* a pointwise median curve. Ties resolve reproducibly by original
person index. An orange diamond at the last trial marks the **arithmetic
mean of the 101 ending balances**.

At the shorter checkpoints, the highlighted long-run median person need
not be the current median person. The summary table computes the median
separately at each checkpoint.

For the multiplicative model, the y-axis is **log10(wealth in dollars)**,
but summary statistics and the mean marker are calculated using **dollar
wealth**. The mean is stabilized through log-sum-exp before transforming
to log10 for plotting; **the geometric mean is not substituted for the
arithmetic mean**. Wealth remains positive in multiplicative runs.
An arbitrary log-axis value of 0 corresponds to $1.

Additive charts use the ordinary dollar wealth y-axis and can cross below
zero. The 1,000,000-trial charts use about 1,200 uniformly sampled x
positions (plus checkpoint times) to keep interactive output usable;
**every single original trial is included in final wealth statistics**.
Only horizontal gridlines are displayed.

## Interpretation and limitations

101 people allow direct sample min/max/mean/median comparisons. They do
not characterize truly extreme distribution tails well, especially in
multiplicative scenarios. A small sample's arithmetic mean may differ
enormously from population expected wealth if rare huge winners dominate
the expectation. With additive fair-game outcomes, the cohort sample mean
may not be exactly $1 even after 1m trials; that is sampling variation,
not an error in theoretical expected values.

No publication article `index.md`, production deployment, newsletter or
social post is created by this experiment.
