# Multiplicative luck × preparation — seed 42

Each trial multiplies current wealth by 1.10, 1.01, 0.99 or 0.90. The exact same seeded luck/preparation outcomes as the additive experiments are reused for each scenario. Initial wealth: $1.

## Baseline: 50% prepared, 50% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $0.10 | $3.88 × 10^-1,113 |
| Total gain (%) | −1% | −90% | −100% |
| Realised mean return per trial (%) | -1.00% | +0.03% | -0.00% |
| Expected return per trial (%) | +0.00% | +0.00% | +0.00% |
| Realised compound growth per trial (%) | -1.00% | -0.23% | -0.26% |

## 90% prepared, 50% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $8.40 × 10^+14 | $2.14 × 10^+14,607 |
| Total gain (%) | −1% | +8.40 × 10^+16% | +2.14 × 10^+14,609% |
| Realised mean return per trial (%) | -1.00% | +3.68% | +3.60% |
| Expected return per trial (%) | +3.60% | +3.60% | +3.60% |
| Realised compound growth per trial (%) | -1.00% | +3.50% | +3.42% |

## 10% prepared, 50% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.90 | $1.57 × 10^-17 | $1.64 × 10^-16,780 |
| Total gain (%) | −10% | −100% | −100% |
| Realised mean return per trial (%) | -10.00% | -3.60% | -3.60% |
| Expected return per trial (%) | -3.60% | -3.60% | -3.60% |
| Realised compound growth per trial (%) | -10.00% | -3.80% | -3.79% |

## 50% prepared, 90% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $1.10 | $4.85 × 10^+17 | $4.11 × 10^+18,075 |
| Total gain (%) | +10% | +4.85 × 10^+19% | +4.11 × 10^+18,077% |
| Realised mean return per trial (%) | +10.00% | +4.31% | +4.40% |
| Expected return per trial (%) | +4.40% | +4.40% | +4.40% |
| Realised compound growth per trial (%) | +10.00% | +4.16% | +4.25% |

## 50% prepared, 10% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $3.07 × 10^-21 | $7.45 × 10^-20,283 |
| Total gain (%) | −1% | −100% | −100% |
| Realised mean return per trial (%) | -1.00% | -4.44% | -4.40% |
| Expected return per trial (%) | -4.40% | -4.40% | -4.40% |
| Realised compound growth per trial (%) | -1.00% | -4.61% | -4.56% |

## 90% prepared, 10% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $7.62 × 10^-5 | $8.11 × 10^-3,907 |
| Total gain (%) | −1% | −100% | −100% |
| Realised mean return per trial (%) | -1.00% | -0.85% | -0.80% |
| Expected return per trial (%) | -0.80% | -0.80% | -0.80% |
| Realised compound growth per trial (%) | -1.00% | -0.94% | -0.90% |

## 10% prepared, 90% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $1.01 | $200.05 | $3.38 × 10^+3,062 |
| Total gain (%) | +1% | +19,905% | +3.38 × 10^+3,064% |
| Realised mean return per trial (%) | +1.00% | +0.62% | +0.80% |
| Expected return per trial (%) | +0.80% | +0.80% | +0.80% |
| Realised compound growth per trial (%) | +1.00% | +0.53% | +0.71% |

Note: Expected return is the arithmetic expectation of a single trial, not expected compound growth. Realised mean return is the arithmetic average of observed percentage payoffs. Realised compound growth is exp(sum(log factors)/trials) - 1. Total gain is shown to zero decimals; per-trial percentages are shown to two decimals. Huge/small final wealth is written in scientific notation rather than under/overflowing. Chart y-axis is log10 dollars: 0 is $1; +1 is $10; -1 is $0.10. Outcomes represent one path per scenario, not a distribution of people.
