# Luck × preparation: cross-family results (seed 42)

**Current article configuration only.** Seven preparedness/good-luck scenarios per
family; 101 independent people per scenario. All start at $1. The four payoff
cases are ordered **good+prepared / good+unprepared / bad+prepared /
bad+unprepared**. Individual and cohort sample outcomes are simulations;
theoretical expected ending wealth comes from the probabilities and payoffs.

Additive cases use **1 / 100 / 10,000** trials; multiplicative use
**1 / 10 / 100**. The tables below show the **longest** horizon for each family.
To regenerate full 84-row single-person and 84-row cohort summaries including
the shorter checkpoints, run:

\`\`\`bash
python -m analyses.luck_preparation.four_families
\`\`\`

This writes \`single_summary.md\` and \`cohort_summary.md\` alongside this
file. Those generated tables are not substitutes for the exact formulas:
additive \`E[W_n] = 1+nE[X]\`; multiplicative \`E[W_n] = (E[M])^n\`.
The mean is the *arithmetic mean of 101 ending dollar balances*, not the
geometric mean or representative person's balance.

## Additive (+$10 / +$1 / -$1 / -$10), 10,000 trials

| Prepared / good luck | One person | Cohort min | Cohort max | Cohort mean | Cohort median | Theoretical E[final] |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50% / 50% | -$761 | -$1,401 | $1,866 | $19.84 | -$18 | $1 |
| 90% / 50% | $35,565 | $34,705 | $37,425 | $35,988.74 | $35,988 | $36,001 |
| 10% / 50% | -$36,750 | -$37,528 | -$34,494 | -$36,025.07 | -$36,124 | -$35,999 |
| 50% / 90% | $43,866 | $42,698 | $45,580 | $44,078.54 | $44,063 | $44,001 |
| 50% / 10% | -$44,420 | -$45,025 | -$42,902 | -$43,962.30 | -$43,956 | -$43,999 |
| 90% / 10% | -$8,204 | -$8,870 | -$7,037 | -$7,993.40 | -$8,010 | -$7,999 |
| 10% / 90% | $7,767 | $6,792 | $9,242 | $8,033.63 | $8,009 | $8,001 |

## Multiplicative (+10% / +1% / -1% / -10%), 100 trials

| Prepared / good luck | One person | Cohort min | Cohort max | Cohort mean | Cohort median | Theoretical E[final] |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50% / 50% | $0.9431 | $0.0987 | $5.72 | $1.08 | $0.8157 | $1.00 |
| 90% / 50% | $51.74 | $4.05 | $134.27 | $37.12 | $31.03 | $34.35 |
| 10% / 50% | $0.0446 | $0.00286 | $0.1379 | $0.0269 | $0.0228 | $0.0256 |
| 50% / 90% | $93.28 | $13.66 | $300.44 | $76.66 | $63.41 | $74.14 |
| 50% / 10% | $0.00550 | $0.00136 | $0.0413 | $0.0112 | $0.00921 | $0.0111 |
| 90% / 10% | $0.2736 | $0.1469 | $1.26 | $0.4604 | $0.432 | $0.4479 |
| 10% / 90% | $3.89 | $0.655 | $8.17 | $2.23 | $2.07 | $2.22 |

## Additive symmetric (+$10 / $0 / $0 / -$10), 10,000 trials

| Prepared / good luck | One person | Cohort min | Cohort max | Cohort mean | Cohort median | Theoretical E[final] |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50% / 50% | -$719 | -$1,339 | $1,751 | $21.50 | $11 | $1 |
| 90% / 50% | $39,621 | $38,741 | $41,361 | $39,986.94 | $39,981 | $40,001 |
| 10% / 50% | -$40,729 | -$41,489 | -$38,649 | -$40,028.41 | -$40,089 | -$39,999 |
| 50% / 90% | $39,851 | $38,631 | $41,651 | $40,074.86 | $40,081 | $40,001 |
| 50% / 10% | -$40,409 | -$41,099 | -$38,689 | -$39,962.27 | -$39,979 | -$39,999 |
| 90% / 10% | -$169 | -$789 | $941 | $3.18 | -$19 | $1 |
| 10% / 90% | -$259 | -$1,209 | $1,251 | $24.96 | -$9 | $1 |

## Multiplicative loss-reversing (+11.111…% / +1.010101…% / -1% / -10%), 100 trials

Exact gross factors are 10/9, 100/99, 0.99 and 0.90.

| Prepared / good luck | One person | Cohort min | Cohort max | Cohort mean | Cohort median | Theoretical E[final] |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 50% / 50% | $1.19 | $0.1139 | $8.39 | $1.44 | $1.06 | $1.32 |
| 90% / 50% | $82.23 | $5.15 | $235.84 | $60.58 | $49.79 | $55.63 |
| 10% / 50% | $0.0486 | $0.00304 | $0.1532 | $0.0286 | $0.0243 | $0.0272 |
| 50% / 90% | $148.84 | $19.51 | $534.91 | $124.77 | $100.61 | $120.07 |
| 50% / 10% | $0.00578 | $0.00141 | $0.0439 | $0.0119 | $0.00989 | $0.0118 |
| 90% / 10% | $0.2878 | $0.1529 | $1.44 | $0.5099 | $0.4659 | $0.4954 |
| 10% / 90% | $4.38 | $0.6942 | $9.77 | $2.48 | $2.27 | $2.47 |

### Interpretation safeguards

- The matrices and probabilities are illustrative **assumptions**, not empirical estimates.
- The 101-person extremes are **sample extrema**, not population bounds.
- Fixed additive dollar increments can produce negative wealth with no insolvency rule.
- For additive outcomes, multiplying trial count only accumulates independent gains;
  the endpoint-implied rate is not a reinvested return.
- For multiplicative outcomes, expected wealth, geometric growth and the
  median person's experience are distinct; reversible gain/loss pairs do not
  guarantee expected dollar wealth of $1.
- Real-world effort, changing preparation levels, luck dependence, survivorship,
  and costs are not modeled.
