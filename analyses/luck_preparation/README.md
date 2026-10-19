# Luck × preparation: reproducible article experiments

All analysis lives in `analyses/` and is computed **locally**, never during Astro build or newsletter sending. The original seeded 50/50 baseline is preserved, with six additional experimental scenarios.

## Run

From the repository root:

```bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.run
python -m pytest tests/test_luck_preparation.py -q
```

Override the seed with `--seed N`; use `--skip-png` for HTML and summary only if Kaleido/Chrome is unavailable. To rerun one scenario, pass `--scenario prepared90_luck50` (or any other slug below); omit it to regenerate all seven.

Each scenario runs **1, 1,000 and 1,000,000 sequential trials**. The one-trial run is the first trial of the longer paths, not an independent sample. Reusing a seed reproduces all outputs exactly.

| Slug | Prepared probability | Good-luck probability | Expected gain per trial |
|---|---:|---:|---:|
| `base` | 50% | 50% | $0.00 |
| `prepared90_luck50` | 90% | 50% | +$3.60 |
| `prepared10_luck50` | 10% | 50% | −$3.60 |
| `prepared50_luck90` | 50% | 90% | +$4.40 |
| `prepared50_luck10` | 50% | 10% | −$4.40 |
| `prepared90_luck10` | 90% | 10% | −$0.80 |
| `prepared10_luck90` | 10% | 90% | +$0.80 |

Starting wealth is $1. Within each trial, independent luck and preparation draws determine **additive dollar payoffs**: good/prepared +$10, good/unprepared +$1, bad/prepared −$1, bad/unprepared −$10. No borrowing constraint or bankruptcy floor is applied; balances may be negative.

### Expected value

For `p = P(prepared)` and `q = P(good luck)`, expected dollar gain per trial is:

`E[Δwealth] = 10pq + q(1-p) - p(1-q) - 10(1-p)(1-q) = 9p + 11q - 10`.

Expected total gain for `n` trials is `n * E[Δwealth]`. Expected final wealth is `$1 + expected total gain`. The observed realised gain is stochastic and approaches the expected per-trial gain at large sample sizes; a single observed outcome need not equal its expectation.

The additional cross-cases (90% prepared/10% good luck and 10% prepared/90% good luck) are especially useful for illustrating payoff dependence: exchanging the preparation and luck probabilities changes theoretical expected gain from −$0.80 to +$0.80 per trial under the original asymmetric mixed-case payoffs (+$1 versus −$1). The 1,000,000-trial sampled paths remain single individuals, not populations.

### Reproducibility and comparison

- The **original 50/50 case retains the exact earlier NumPy seeded integer draws**: ending wealth $0, $29 and −$2,511 for seed 42.
- Additional scenarios use the **same uniform random numbers** per seed, with different probability thresholds, to support a less noisy comparison across preparedness/luck conditions. Their random stream is different from the legacy baseline's stream; do not interpret the realised differences with baseline as a perfectly paired treatment effect.
- The probability arguments to `simulate` are keyword parameters, so later research can extend the model without duplicating it.

### Outputs

- `analyses/luck_preparation/results/summary.md`: all seven article-ready comparison tables (total gain % with zero decimals; realised/expected $ per trial and implied growth % with two decimals).
- `analyses/luck_preparation/results/wealth_*.html`: 21 interactive Plotly HTML previews. These local previews load Plotly from CDN.
- `src/content/blog/luck_preparation/charts/wealth_*.png`: 21 publication/newsletter PNGs when Kaleido and Chrome are available.
- Original baseline filenames remain `wealth_1.png`, `wealth_1000.png`, `wealth_1000000.png`; added scenarios are named `wealth_<slug>_<trial_count>.png`.

The Plotly charts have **horizontal gridlines only**. For 1,000,000 trials, the plot retains the endpoints and minimum/maximum in each x-axis bucket, avoiding a million browser points while preserving full-resolution calculation of statistics.

**Interpretation:** realised gain per trial is `(final-start)/n`; total gain (%) is `(final/start-1)*100`; endpoint-implied compound growth is `(final/start)^(1/n)-1` when the final balance is nonnegative. If final wealth is negative, display **N/A**, not a sign-adjusted growth rate. Even a positive endpoint growth number is not a genuine reinvested return if the path crosses zero. `−$0.00` reflects a slightly negative dollar value after rounding. At 1,000,000 trials, positive endpoint implied compound growth may round to `+0.00%` at the requested precision.

These are sequential-trial paths for one simulated person in each scenario, **not** 1,000,000 independently sampled people. Results should not be interpreted as financial forecasts.

### Reuse in later analyses

```python
from analyses.luck_preparation.run import simulate
future = simulate(1000, seed=42, prepared_probability=.9, good_luck_probability=.5)
print(future.final_wealth, future.expected_gain_per_trial)
```

Do **not** add the article `src/content/blog/luck_preparation/index.md` until publication is authorized: it can activate automated website/social distribution. Commit source code and static PNGs alongside the final article when ready.
