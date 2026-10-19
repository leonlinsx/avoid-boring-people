# Luck × preparation — Astro article handoff (unpublished)

**Write the article only in the existing local directory**
\`src/content/blog/2026_10_24_luck_preparation/index.md\`.
The analysis PR deliberately **does not create an index.md or any other
Markdown file beneath src/content/blog**. Astro's blog loader matches
\`**/*.{md,mdx}\`, so even a "notes.md" placeholder in an article directory
can appear as an unintended content entry.

## Existing Astro conventions

Use exactly the existing date-prefixed directory + index.md format, with
co-located \`./assets/*.png\` and Markdown image references.
A reference article is \`src/content/blog/2021_04_03_ergodicity/index.md\`
(the time vs ensemble averages article); avoid retelling it at length.

When ready to write, follow the current blog schema in
\`src/content.config.ts\`. Example frontmatter **for reference only**:

\`\`\`yaml
---
title: 'Luck and Preparation'
description: 'A simulation of how chance and preparation shape outcomes'
pubDate: 2026-10-24
category: Risk & Decision Making
tags: ['luck', 'risk', 'simulation', 'decision making']
featured: false
---
\`\`\`

The title, copy, date, category and tags are **not yet approved**; this is
not a draft article and is not committed to the public blog collection.

## Prepare a small working gallery next to your index.md

From the repository root after merging the analysis:

\`\`\`bash
python -m pip install -r analyses/requirements.txt
python -m analyses.luck_preparation.four_families
python -m analyses.luck_preparation.article_assets
\`\`\`

This generates the initial **16 baseline PNG charts** at:

\`src/content/blog/2026_10_24_luck_preparation/assets/\`

It does not create or modify \`index.md\`. To view all permutations
locally, optionally generate the **112-chart catalog** with
\`python -m analyses.luck_preparation.article_assets --all\` into a
**fresh** output directory. The exporter refuses to overwrite images
whose filenames already exist.

Example article-relative image reference:

\`\`\`markdown
![101 people accumulating additive payoffs](./assets/cohort_additive_base.png)
\`\`\`

Select and commit **only charts actually needed by the article**.
Don't bulk-commit 112 PNGs to the site or serve local Plotly HTML files
as Astro article assets. Interactive standalone HTML previews are
generated at \`analyses/luck_preparation/results/four_families/\`, ignored
by Git for the original experiments.

## Numerical source of truth

\`python -m analyses.luck_preparation.four_families\` generates:

- \`analyses/luck_preparation/results/four_families/single_summary.md\`
- \`analyses/luck_preparation/results/four_families/cohort_summary.md\`
- **112 interactive Plotly HTMLs** (84 single paths + 28 cohorts)

Each cohort summary has 101 people's minimum/maximum/mean/median at
three horizons. Both table types include theoretical **expected ending
wealth**, calculated from the actual payoff matrix, not the observed
101-person arithmetic mean.

The model families, payoffs, trial horizons, marker semantics, seed and
limitations are specified in \`FOUR_FAMILIES.md\`. The standalone PNG
fallback is Matplotlib, as Chrome is not necessarily installed. Its
visual conventions match the Plotly data and intentionally mark
off-scale theoretical expectations rather than stretching axes.

## Publication preflight (only after you write the article)

1. Confirm the selected figures match the argument and their captions
   explain probability/payoff assumptions; define the payoff ordering.
2. Distinguish arithmetic expected wealth from the typical/median person,
   and additive scores from compounded wealth. Explain the separately
   redrawn preparation/luck assumptions, no costs or bankruptcy rules.
3. Avoid presenting 101 people's sample min/max as population bounds.
4. Compare with \`2021_04_03_ergodicity\` to avoid repetition.
5. Check the active Astro content loader, image paths and build; **do not
   merge an article index.md without explicit publication approval**.
6. Deploy/send newsletters/social posts only with separate authorization.

The support-analysis merge alone is safe: no publishable new Markdown
article is included and the existing local article folder is untouched.
