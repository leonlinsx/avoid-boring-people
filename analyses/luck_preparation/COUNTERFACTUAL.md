# Payoff counterfactuals — additive symmetry and multiplicative reversibility

These are **additional experiments**. The existing additive and multiplicative implementations, charts, schedules, and seed-42 results remain unchanged. Run the lightweight reproducibility script:

```bash
python -m analyses.luck_preparation.counterfactual
python -m pytest tests/test_luck_preparation_counterfactual.py -q
```

The script reuses the exact original seed-42 preparation/luck draws for the seven previously defined probability cases.

## Alternative additive payoffs: +$10, $0, $0, −$10

For `p=P(prepared)`, `q=P(good luck)`, expected dollar gain per trial is `10(p+q−1)`.

| Prepared / luck | Old expected $/trial | New expected $/trial | New final wealth at 1,000,000 trials |
|---|---:|---:|---:|
| 50/50 | $0 | $0 | −$2,659 |
| 90/50 | +$3.60 | +$4.00 | $4,003,661 |
| 10/50 | −$3.60 | −$4.00 | −$3,997,139 |
| 50/90 | +$4.40 | +$4.00 | $4,002,441 |
| 50/10 | −$4.40 | −$4.00 | −$4,002,429 |
| 90/10 | −$0.80 | $0 | −$4,649 |
| 10/90 | +$0.80 | $0 | −$579 |

**Swapping preparedness and luck now leaves the additive expected payoff unchanged.** Sample-path endings can differ; negative balances are allowed.

## Alternative multiplicative payoffs

Two variants must not be confused:

- **Literal requested:** +11.111…%, +1.111…%, −1%, −10%, i.e. factors `10/9, 91/90, .99, .90`. The +1.111…% and −1% pair multiplies to **1.001**, leaving a 0.1% profit.
- **Fully reversing:** +11.111…%, **+1.010101…%**, −1%, −10%, i.e. factors `10/9, 100/99, .99, .90`. Both gain/loss pairs multiply to **1** exactly.

### Theoretical compound growth per trial

| Prepared / luck | Old geometric | Literal geometric | Fully reversing geometric |
|---|---:|---:|---:|
| 50/50 | −0.2534% | +0.0250% | 0.0000% |
| 90/50 | +3.4167% | +3.8912% | +3.8860% |
| 10/50 | −3.7933% | −3.6973% | −3.7406% |
| 50/90 | +4.2474% | +4.7718% | +4.7247% |
| 50/10 | −4.5600% | −4.5067% | −4.5115% |
| 90/10 | −0.8906% | −0.7998% | −0.8008% |
| 10/90 | +0.7080% | +0.8889% | +0.8073% |

Geometric is `exp(E[log(factor)])−1`: a long-run theoretical growth rate, not a single sample's realized rate.

### Fully reversing variant: arithmetic expected return and seed-42 path

| Prepared / luck | Arithmetic expected return/trial | Final wealth after 100 trials | Realized compound growth after 10,000 trials |
|---|---:|---:|---:|
| 50/50 | +0.2803% | $1.19 | −0.0800% |
| 90/50 | +4.1005% | $82.23 | +3.8386% |
| 10/50 | −3.5399% | $0.05 | −3.8167% |
| 50/90 | +4.9045% | $148.84 | +4.7097% |
| 50/10 | −4.3439% | $0.00578 | −4.5538% |
| 90/10 | −0.6999% | $0.29 | −0.8221% |
| 10/90 | +0.9082% | $4.38 | +0.7823% |

**Important:** The exactly reversing baseline has **zero expected log return**, *not* zero expected arithmetic return. Jensen's inequality still creates a gap (0.2803% arithmetic versus 0% geometric): the gain adjustments compensate that gap rather than eliminate it. The realized 10,000-trial sample can still decline (the seed-42 baseline ends near $0.000333).

Full reversing-factor log expectation simplifies to:

```
E[log growth] = log(10/9)*(p+q-1) + log(100/99)*(q-p)
```

Thus preparation and luck **still have different marginal geometric effects**: the mixed events' payoffs differ. In contrast, the symmetric additive structure makes them interchangeable in expected dollar terms.

### Limitations

Wealth starts at $1; each experiment is one sequential path, not repeated independent simulated people. All luck/prepared draws are independent across trials and within each trial. No borrowing limits or feedback effects are included. These are payoff-model sensitivity experiments, not economic or investment forecasts.
