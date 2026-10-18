# Luck × preparation: reproducible article experiment

This experiment is separate from production Astro code, so future essays can
reuse or extend it without rerunning a simulation at site build time.

## Run from the repository root

```bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.run
python -m pytest tests/test_luck_preparation.py -q
```

Outputs:
- Markdown table: `analyses/luck_preparation/results/summary.md`.
- Interactive Plotly previews: `results/wealth_1.html` and `wealth_1000.html`.
- PNG charts: `src/content/blog/luck_preparation/charts/wealth_1.png` and
  `wealth_1000.png`.

Plotly PNG export requires Kaleido and Chrome/Chromium installed locally.
Use `--skip-png` for the Markdown table and HTML previews when image export
isn't configured. Local HTML previews load Plotly from its CDN. Use `--seed N`
to choose a different reproducible path (default: 42).

Once the article is ready, add `src/content/blog/luck_preparation/index.md`
and embed the PNGs:

```markdown
![Wealth after one trial](./charts/wealth_1.png)
![Wealth across one thousand trials](./charts/wealth_1000.png)
```

These static PNGs work on leonlins.com and in the newsletter. Do **not**
create the article's `index.md` until ready to publish: this site's
article workflows can distribute new published articles automatically.

## Model

- Starting wealth: $1.
- Each trial independently draws luck (good/bad) and preparedness
  (prepared/unprepared); both are 50/50. Each joint outcome is 25%.
- Good + prepared: +$10; good + unprepared: +$1;
  bad + prepared: -$1; bad + unprepared: -$10.
- Additive wealth change, not multiplication or percentage returns. There is
  no bankruptcy stop or borrowing constraint; wealth may become negative.
- Expected dollar payoff per trial: $0.
- The 1-trial simulation is the first trial of the 1,000-trial path, both
  using the same seed. This is one path, **not** 1,000 Monte Carlo paths.
- Total gain = `(final / initial - 1) * 100`. The equivalent geometric
  rate per trial = `((final / initial) ** (1 / trials) - 1) * 100` only
  when prior wealth remains positive and final wealth is nonnegative.
  A final $0 gives -100% if wealth was positive until then.
  If wealth went nonpositive before the last trial, or ended negative,
  the compounded rate is **N/A**. Even when numerically defined, the
  geometric rate is endpoint-equivalent, not a realized reinvested return.
- With seed 42, trial 1 loses $1 (wealth $0) and trial 1,000 ends at $29,
  having crossed zero along the way. The 1,000-trial compounded rate is
  therefore N/A despite the positive ending balance.

## Reuse in future analyses

```python
from analyses.luck_preparation.run import simulate

path = simulate(1000, seed=42)
print(path.final_wealth)
```

Keep analysis modules in `analyses/` and commit the model, assumptions,
seed, and figures with the eventual article rather than duplicating code
inside Markdown.
