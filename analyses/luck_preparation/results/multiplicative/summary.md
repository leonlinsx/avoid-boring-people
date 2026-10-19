# Multiplicative luck × preparation — seed 42

Each trial multiplies current wealth by 1.10, 1.01, 0.99 or 0.90. The exact same seeded luck/preparation outcomes as the additive experiments are reused for each scenario. Initial wealth: $1.

## Baseline: 50% prepared, 50% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $1.20 | $0.94 |
| Total gain (%) | −1% | +20% | −6% |
| Realised mean return per trial (%) | -1.00% | +2.00% | +0.17% |
| Expected return per trial (%) | +0.00% | +0.00% | +0.00% |
| Realised compound growth per trial (%) | -1.00% | +1.82% | -0.06% |

## 90% prepared, 50% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $1.16 | $51.74 |
| Total gain (%) | −1% | +16% | +5,074% |
| Realised mean return per trial (%) | -1.00% | +1.60% | +4.17% |
| Expected return per trial (%) | +3.60% | +3.60% | +3.60% |
| Realised compound growth per trial (%) | -1.00% | +1.51% | +4.03% |

## 10% prepared, 50% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.90 | $0.61 | $0.04 |
| Total gain (%) | −10% | −39% | −96% |
| Realised mean return per trial (%) | -10.00% | -4.70% | -2.85% |
| Expected return per trial (%) | -3.60% | -3.60% | -3.60% |
| Realised compound growth per trial (%) | -10.00% | -4.85% | -3.06% |

## 50% prepared, 90% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $1.10 | $1.55 | $93.28 |
| Total gain (%) | +10% | +55% | +9,228% |
| Realised mean return per trial (%) | +10.00% | +4.60% | +4.77% |
| Expected return per trial (%) | +4.40% | +4.40% | +4.40% |
| Realised compound growth per trial (%) | +10.00% | +4.51% | +4.64% |

## 50% prepared, 10% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $0.57 | $5.50 × 10^-3 |
| Total gain (%) | −1% | −43% | −99% |
| Realised mean return per trial (%) | -1.00% | -5.30% | -4.91% |
| Expected return per trial (%) | -4.40% | -4.40% | -4.40% |
| Realised compound growth per trial (%) | -1.00% | -5.42% | -5.07% |

## 90% prepared, 10% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $0.84 | $0.27 |
| Total gain (%) | −1% | −16% | −73% |
| Realised mean return per trial (%) | -1.00% | -1.70% | -1.22% |
| Expected return per trial (%) | -0.80% | -0.80% | -0.80% |
| Realised compound growth per trial (%) | -1.00% | -1.74% | -1.29% |

## 10% prepared, 90% good luck

| Metric | 1 trial | 10 trials | 100 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $1.01 | $1.20 | $3.89 |
| Total gain (%) | +1% | +20% | +289% |
| Realised mean return per trial (%) | +1.00% | +1.90% | +1.44% |
| Expected return per trial (%) | +0.80% | +0.80% | +0.80% |
| Realised compound growth per trial (%) | +1.00% | +1.87% | +1.37% |

Note: Expected return is the arithmetic expectation of a single trial, not the expected compound growth. Realised mean return is the arithmetic average of observed percentage payoffs. Realised compound growth is exp(sum(log factors)/trials) - 1. Total gain is shown to zero decimals; per-trial percentages are shown to two decimals. Huge/small final wealth is written in scientific notation rather than under/overflowing. Chart y-axis is log10 dollars: 0 is $1; +1 is $10; -1 is $0.10. Outcomes represent one path per scenario, not a distribution of people.
