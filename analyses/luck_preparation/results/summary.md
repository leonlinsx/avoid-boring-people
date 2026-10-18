Seed: 42. Independent per-trial luck/preparation.
Four dollar outcomes: good+prepared +$10, good+unprepared +$1,
bad+prepared -$1, bad+unprepared -$10.

## Baseline: 50% prepared, 50% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1 | $1 | $1 |
| Final wealth | $0 | $29 | -$2,511 |
| Total gain (%) | -100% | +2,800% | -251,200% |
| Realised gain per trial | -$1.00 | +$0.03 | -$0.00 |
| Expected gain per trial | $0.00 | $0.00 | $0.00 |
| Implied compound growth per trial | -100.00% | +0.34% | N/A (negative ending wealth) |

## 90% prepared, 50% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1 | $1 | $1 |
| Final wealth | $0 | $3,680 | $3,604,181 |
| Total gain (%) | -100% | +367,900% | +360,418,000% |
| Realised gain per trial | -$1.00 | +$3.68 | +$3.60 |
| Expected gain per trial | $3.60 | $3.60 | $3.60 |
| Implied compound growth per trial | -100.00% | +0.82% | +0.00% |

## 10% prepared, 50% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1 | $1 | $1 |
| Final wealth | -$9 | -$3,601 | -$3,596,539 |
| Total gain (%) | -1,000% | -360,200% | -359,654,000% |
| Realised gain per trial | -$10.00 | -$3.60 | -$3.60 |
| Expected gain per trial | -$3.60 | -$3.60 | -$3.60 |
| Implied compound growth per trial | N/A (negative ending wealth) | N/A (negative ending wealth) | N/A (negative ending wealth) |

## 50% prepared, 90% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1 | $1 | $1 |
| Final wealth | $11 | $4,313 | $4,402,395 |
| Total gain (%) | +1,000% | +431,200% | +440,239,400% |
| Realised gain per trial | +$10.00 | +$4.31 | +$4.40 |
| Expected gain per trial | $4.40 | $4.40 | $4.40 |
| Implied compound growth per trial | +1,000.00% | +0.84% | +0.00% |

## 50% prepared, 10% good luck

| Metric | 1 trial | 1,000 trials | 1,000,000 trials |
| :--- | ---: | ---: | ---: |
| Starting wealth | $1 | $1 | $1 |
| Final wealth | $0 | -$4,443 | -$4,402,962 |
| Total gain (%) | -100% | -444,400% | -440,296,300% |
| Realised gain per trial | -$1.00 | -$4.44 | -$4.40 |
| Expected gain per trial | -$4.40 | -$4.40 | -$4.40 |
| Implied compound growth per trial | -100.00% | N/A (negative ending wealth) | N/A (negative ending wealth) |

Expected gain per trial is theoretical; realised gain depends on the seed. Total gain (%) is displayed as an integer; per-trial dollar amounts and implied compound growth (%) use two decimals. A -$0.00 means a small negative realised amount rounded to two decimals. The implied growth rate uses endpoints only and is not an investable compound return when wealth crosses zero; negative final wealth is N/A. The million-trial experiment is one path of a million sequential trials, not a million independent simulated people.
