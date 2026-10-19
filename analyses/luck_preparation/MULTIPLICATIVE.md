# Multiplicative experiment — separate companion to the additive experiment

**Nothing in the original additive experiment is replaced.** This experiment
uses the same seven luck/preparation probability combinations, the same
seeded **trial events**, and the same horizons (1, 1,000, 1,000,000). Only
the payoff structure changes from additive dollars to multiplicative
percentages of wealth before each trial.

| Outcome | Additive change | Multiplicative factor |
|---|---:|---:|
| Prepared, good luck | +$10 | ×1.10 (+10%) |
| Unprepared, good luck | +$1 | ×1.01 (+1%) |
| Prepared, bad luck | −$1 | ×0.99 (−1%) |
| Unprepared, bad luck | −$10 | ×0.90 (−10%) |

Wealth always starts at **$1** and remains strictly **positive**. Results are
one sequential path per scenario, not distributions of 1 million people.

## How to run

From the website repository root:

```bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.multiplicative
python -m pytest tests/test_luck_preparation.py tests/test_luck_preparation_multiplicative.py -q
```

If local Kaleido/Chrome cannot export PNG, run with `--skip-png`
to generate the full numerical table and all 21 interactive Plotly HTML
previews. Optional `--seed N` and `--scenario prepared90_luck10`
arguments work exactly as for the additive experiment.

Outputs live in **separate directories**:
- `analyses/luck_preparation/results/multiplicative/summary.md` — seven
  published-style tables, three horizons each.
- `analyses/luck_preparation/results/multiplicative/wealth_*.html` — 21
  local interactive previews (Plotly CDN loaded when viewed).
- `src/content/blog/luck_preparation/charts/multiplicative/wealth_*.png` —
  21 static charts for Astro/Markdown and newsletter images. The PNG files
  are generated with Plotly/Kaleido and Chrome, not during site builds.

Chart y-axis deliberately shows **log10 wealth in dollars**, not raw wealth.
With 1 million multiplications, wealth can reach values exceeding
`10^18075` or below `10^-20282`; a normal floating-point dollar series
would overflow to infinity or underflow to zero. **0 on the chart corresponds
to $1**, +1 corresponds to $10, −1 corresponds to $0.10. The chart keeps
only horizontal grid lines and the prior min/max-preserving downsampling.

## Metrics and mathematics

Each independent trial returns `R` in {+0.10, +0.01, −0.01, −0.10}.
The actual wealth after `n` trials is:

`W_n = W_0 * product(1 + R_i)`.

To preserve numerical precision, implementation stores:

`log(W_n) = log(W_0) + sum(log(1 + R_i))`.

If `p` is preparation probability and `q` is good-luck probability, the
**arithmetic expected return per trial** is

`E[R] = 0.09*p + 0.11*q - 0.10`.

For reporting:
- **Expected return per trial (%)**: `100 * E[R]`.
- **Realised mean return per trial (%)**:
  `100 * sum(R_i) / n` (arithmetic mean).
- **Realised compound growth per trial (%)**:
  `100 * (exp(sum(log(1+R_i))/n) - 1)` (geometric mean).
- **Total gain (%)**: `100 * (W_n/W_0 - 1)`. Display integer percentages,
  with scientific notation for huge gains; tiny amounts display −100%
  at zero-decimal rounding even though true wealth never reaches zero.
- **Final wealth**: dollars, with scientific notation when needed, never
  a float that silently over/underflows.

Per-trial percentages display two decimals. Internal calculations use
full log precision. Extremely small final wealth is expressed as
`$mantissa × 10^negative_exponent`, **not** as $0.

### The central insight

At 50% prepared and 50% good luck, expected arithmetic return is
**exactly 0%**, but the expected logarithmic return is **negative**:

`E[log(1+R)] = [log(1.10) + log(1.01) + log(0.99) + log(0.90)] / 4`
`≈ -0.002537585`.

For large `n`, the typical compound growth converges toward
`exp(E[log(1+R)]) - 1 ≈ -0.2534%` **per trial**. This is volatility drag,
and distinguishes expected wealth from the typical wealth path.

**Important:** The arithmetic expected final wealth for the neutral case
is $1 at all horizons, even though a typical million-trial path has wealth
near zero. These are not contradictory: expected wealth and the wealth of
one typical realization are different objects.

No article `index.md` or newsletter is created as part of this experiment;
publication remains a separate explicit step.
