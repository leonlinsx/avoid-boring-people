# Four-family luck × preparation experiments

Run the unified analysis from the repository root:

```bash
python -m analyses.luck_preparation.four_families
python -m pytest tests/test_four_families.py -q
```

This is an **additional** implementation of the latest article experiments, not a modification of the older single-person/cohort archival scripts. It uses four payoff families and the seven previously selected luck/prepared probability splits, seed 42. Each family has a **single-person path** and a **101-person cohort**. No article index, newsletter, social posting, or deployment is created.

| Family | Outcomes: good+prepared / good+unprepared / bad+prepared / bad+unprepared | Horizons |
|---|---|---|
| Additive | +$10 / +$1 / −$1 / −$10 | 1, 100, 10,000 |
| Multiplicative | +10% / +1% / −1% / −10% | 1, 10, 100 |
| Additive symmetric | +$10 / $0 / $0 / −$10 | 1, 100, 10,000 |
| Multiplicative loss-reversing | +11.111…% / +1.010101…% / −1% / −10%; exact factors 10/9, 100/99, .99, .90 | 1, 10, 100 |

**Chart convention:** payoff and preparation/luck probabilities appear in every title. The **blue line** represents actual wealth or the actual median-ending person (101-person). The **100 pale lines** represent the other participants. The **orange diamond** is the observed mean of 101 ending dollar balances. A **purple circle at the final trial** shows *exact theoretical expected ending dollar wealth*, which is computed analytically from the payoff matrix and probabilities rather than the sample. **No theoretical line is drawn.**

If the expected endpoint is far outside the observed outcomes, it is marked at the chart boundary and explicitly labeled **above/below scale** with the actual value. The chart axis is not stretched or presented as its literal y-coordinate. **Additive** charts use a linear axis (balances may be negative). **Multiplicative** charts switch to log-scale dollar ticks (0.1, 1, 10, 100...) only when the observed range spans at least 10×; otherwise they use a linear axis.

At trial n, the analytic formulas are

- Additive: `E[W_n] = 1 + n E[dollar payoff]`
- Multiplicative: `E[W_n] = 1 × (E[gross factor])^n`

Expected multiplicative **dollar** wealth is not the geometric mean or the typical individual's wealth. Under exact loss reversing, the 50/50 geometric rate is 0% yet the expected arithmetic wealth after 100 trials is approximately $1.32.

**Single-person:** 4 families × 7 scenarios × 3 horizons = **84** HTML Plotly charts.

**Cohorts:** 4 × 7 = **28** HTML Plotly charts (101 participants each, longest horizon). Each family/scenario has full min, max, arithmetic mean and median at each of three checkpoints; the highlighted path is the actual person ranked 51st by *final* wealth at the longest horizon. Trial outcomes for the 50/50 single path preserve the original seeded integer stream; other single scenarios preserve their original uniform streams. All 101-person paths use independent person/trial uniforms and paired random draws across cases.

The generator writes `analyses/luck_preparation/results/four_families/` when invoked. The accompanying downloadable package in the conversation also contains all 112 already generated interactive HTMLs and 112 static PNGs, plus results and tests; PNG exports were made with an offline Matplotlib fallback because Kaleido wasn't available.

**Interpretation constraints:** this stylized model independently redraws preparedness and luck on each trial, gives all people equal probabilities within a scenario, permits negative additive wealth, and does not model preparation costs, persistence, debt limits, or causal effects. A cohort's sample mean/minimum/maximum is not the theoretical population expectation/bounds. Four payoff matrices were *assumed*; the simulations do not establish real-world magnitudes or causal importance of luck and preparation.
