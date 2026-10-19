# Multiplicative luck × preparation — seed 42

Each trial multiplies current wealth by 1.10, 1.01, 0.99 or 0.90. The exact same seeded luck/preparation outcomes as the additive experiments are reused for each scenario. Initial wealth: $1.

## Baseline: 50% prepared, 50% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $0.94 | $3.10 × 10^-15 |
| Total gain (%) | −1% | −6% | −100% |
| Realised mean return per trial (%) | -1.00% | +0.17% | -0.08% |
| Expected return per trial (%) | +0.00% | +0.00% | +0.00% |
| Realised compound growth per trial (%) | -1.00% | -0.06% | -0.33% |

## 90% prepared, 50% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $51.74 | $1.29 × 10^+144 |
| Total gain (%) | −1% | +5,074% | +1.29 × 10^+146% |
| Realised mean return per trial (%) | -1.00% | +4.17% | +3.56% |
| Expected return per trial (%) | +3.60% | +3.60% | +3.60% |
| Realised compound growth per trial (%) | -1.00% | +4.03% | +3.37% |

## 10% prepared, 50% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.90 | $0.04 | $5.31 × 10^-172 |
| Total gain (%) | −10% | −96% | −100% |
| Realised mean return per trial (%) | -10.00% | -2.85% | -3.68% |
| Expected return per trial (%) | -3.60% | -3.60% | -3.60% |
| Realised compound growth per trial (%) | -10.00% | -3.06% | -3.87% |

## 50% prepared, 90% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $1.10 | $93.28 | $1.46 × 10^+180 |
| Total gain (%) | +10% | +9,228% | +1.46 × 10^+182% |
| Realised mean return per trial (%) | +10.00% | +4.77% | +4.39% |
| Expected return per trial (%) | +4.40% | +4.40% | +4.40% |
| Realised compound growth per trial (%) | +10.00% | +4.64% | +4.24% |

## 50% prepared, 10% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $5.50 × 10^-3 | $3.29 × 10^-205 |
| Total gain (%) | −1% | −99% | −100% |
| Realised mean return per trial (%) | -1.00% | -4.91% | -4.44% |
| Expected return per trial (%) | -4.40% | -4.40% | -4.40% |
| Realised compound growth per trial (%) | -1.00% | -5.07% | -4.60% |

## 90% prepared, 10% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $0.99 | $0.27 | $2.08 × 10^-40 |
| Total gain (%) | −1% | −73% | −100% |
| Realised mean return per trial (%) | -1.00% | -1.22% | -0.82% |
| Expected return per trial (%) | -0.80% | -0.80% | -0.80% |
| Realised compound growth per trial (%) | -1.00% | -1.29% | -0.91% |

## 10% prepared, 90% good luck

| Metric | 1 trial | 100 trials | 10,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1.00 | $1.00 | $1.00 |
| Final wealth | $1.01 | $3.89 | $4.50 × 10^+29 |
| Total gain (%) | +1% | +289% | +4.50 × 10^+31% |
| Realised mean return per trial (%) | +1.00% | +1.44% | +0.78% |
| Expected return per trial (%) | +0.80% | +0.80% | +0.80% |
| Realised compound growth per trial (%) | +1.00% | +1.37% | +0.69% |

Note: Expected return is the arithmetic expectation of a single trial, not the expected compound growth. Realised mean return is the arithmetic average of observed percentage payoffs. Realised compound growth is exp(sum(log factors)/trials) - 1. Total gain is shown to zero decimals; per-trial percentages are shown to two decimals. Huge/small final wealth is written in scientific notation rather than under/overflowing. Chart y-axis is log10 dollars: 0 is $1; +1 is $10; -1 is $0.10. Outcomes represent one path per scenario, not a distribution of people.
