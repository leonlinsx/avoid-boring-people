"""The run's readable output: today's opportunities, then why everything else was skipped.

The report is the product. Nobody wires Scout into a dashboard, so the text has
to be enough on its own: which conversation, why now, which existing writing
fits, a reply that could be posted after reading it once, and for the options
Scout declined, the reason it declined. That last part is what makes the tool
trustworthy enough to keep running.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import List, Optional, Sequence

from scripts.scout.discovery import DiscoveryResult
from scripts.scout.filtering import ScreenResult, VERDICT_STRONG, Judgment, max_opportunities

NO_OPPORTUNITIES = "No high-confidence Scout opportunities found."

# The report is also written to `$GITHUB_STEP_SUMMARY`, which GitHub renders as
# Markdown. The proposed reply is validated before it is shown, but the model's
# explanatory sentences are not, so those are flattened to plain prose here: a
# stray `![](…)` would otherwise fetch a remote image while the author reads,
# and a bare URL would arrive as a link.
_MARKDOWN_CHARS = str.maketrans({char: " " for char in "`*_#[]()<>|~"})
_URL_PATTERN = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)


def _prose(text: object) -> str:
    """One line of plain text, safe to render as Markdown."""
    plain = _URL_PATTERN.sub("", str(text or "")).translate(_MARKDOWN_CHARS)
    return " ".join(plain.split())


def _sources_line(result: DiscoveryResult) -> str:
    parts = []
    for report in result.sources:
        if report.ok:
            parts.append(f"{report.source}: {report.found} found")
        elif report.attempted:
            parts.append(f"{report.source}: FAILED ({report.note})")
        else:
            parts.append(f"{report.source}: skipped ({report.note})")
    return "Sources: " + " | ".join(parts) if parts else "Sources: none configured"


def render_scan(
    result: DiscoveryResult,
    screen: Optional[ScreenResult],
    *,
    now: Optional[datetime] = None,
    model: str = "",
) -> str:
    """What the run looked at and what it did with it."""
    moment = now or datetime.now(timezone.utc)
    lines = [
        f"Lin Scout — {moment.strftime('%Y-%m-%d %H:%M UTC')}",
        f"Judgment model: {model}" if model else "",
        f"Queries: {', '.join(result.queries) or 'none'}",
        _sources_line(result),
        f"Candidates: {len(result.candidates)} unique",
    ]
    if screen is not None:
        lines.append(
            f"Judgments: {len(screen.judged)} model calls | {screen.gated} gated before judgment | "
            f"{len(screen.failures)} call failures"
        )
    return "\n".join(line for line in lines if line)


def render_opportunity(index: int, judgment: Judgment) -> str:
    """One opportunity, in the order the author reads it: why now, before what."""
    candidate = judgment.match.candidate
    item = judgment.match.item
    when = candidate.published_at[:10]
    lines = [
        f"{index}. SOURCE: {candidate.source} · {candidate.community} · {candidate.external_url} "
        f"({candidate.activity} replies, {when})",
        f"   WHY NOW: {_prose(judgment.why_now)}",
        f"   MATCHING CONTENT: {item.title} — {item.url}",
        f"   WHY THIS FITS: {_prose(judgment.why_fits)}",
        "   PROPOSED RESPONSE:",
        f"     {judgment.draft}",
        f"   LINK: {'yes' if judgment.link else 'no'} — {_prose(judgment.link_reason) or 'no reason given'}",
    ]
    return "\n".join(lines)


def render_report(
    judgments: Sequence[Judgment],
    *,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> str:
    """The STRONG opportunities, at most `limit` of them, or the honest empty result."""
    cap = max_opportunities() if limit is None else limit
    strong = [judgment for judgment in judgments if judgment.verdict == VERDICT_STRONG][:cap]
    if not strong:
        return NO_OPPORTUNITIES
    header = "Opportunities found:" if not dry_run else "Opportunities that would have been surfaced:"
    blocks = [render_opportunity(index, judgment) for index, judgment in enumerate(strong, start=1)]
    return "\n\n".join([header, *blocks])


def render_decisions(judgments: Sequence[Judgment], *, limit: int = 40) -> str:
    """Every candidate the run ranked, with the verdict and the reason for it."""
    rows: List[str] = []
    for judgment in judgments:
        if judgment.verdict == VERDICT_STRONG:
            continue
        rows.append(f"- {judgment.verdict}: {judgment.match.candidate.external_url} — {_prose(judgment.reason)}")
    hidden = len(rows) - limit
    if hidden > 0:
        rows = rows[:limit] + [f"- … {hidden} more not shown"]
    if not rows:
        return "Candidates considered: none (nothing matched the archive closely enough)."
    return "Candidates considered:\n" + "\n".join(rows)


def build_summary(
    result: DiscoveryResult,
    screen: Optional[ScreenResult],
    *,
    now: Optional[datetime] = None,
    dry_run: bool = False,
    limit: Optional[int] = None,
    model: str = "",
) -> str:
    """The whole run, as it should appear in a log or a workflow step summary."""
    sections = [render_scan(result, screen, now=now, model=model)]
    if screen is not None:
        sections.append(render_report(screen.judgments, dry_run=dry_run, limit=limit))
        sections.append(render_decisions(screen.judgments))
    return "\n\n".join(sections)
