from datetime import datetime, timezone

from scripts.scout import report
from scripts.scout.discovery import Candidate, DiscoveryResult, SourceReport
from scripts.scout.filtering import Judgment, ScreenResult
from scripts.scout.inventory import ContentItem
from scripts.scout.matching import Match

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
DRAFT = "The mechanism the thread is missing is that nobody is paid to price the tail."


def _item():
    return ContentItem(
        content_id="market-failure",
        title="When markets fail quietly",
        url="https://leonlins.com/writing/market-failure",
        published_at="2021-01-01",
        category="Investing",
        tags=("investing",),
        summary="Risk hides.",
        body="Risk hides.",
    )


def _match(url="https://news.ycombinator.com/item?id=1"):
    return Match(
        candidate=Candidate(
            source="hacker-news",
            external_url=url,
            title="Investing risk nobody prices",
            author="someone",
            community="Hacker News",
            published_at="2026-09-17T00:00:00+00:00",
            body="Body",
            activity=12,
        ),
        item=_item(),
        score=6,
        matched_terms=("investing",),
    )


def _judgment(verdict, *, url="https://news.ycombinator.com/item?id=1"):
    extra = {}
    if verdict == "STRONG":
        extra = {
            "why_now": "The thread is live and unanswered.",
            "why_fits": "The article names the mechanism.",
            "draft": DRAFT,
            "link_reason": "No link needed.",
        }
    return Judgment(match=_match(url), verdict=verdict, reason=f"{verdict.lower()} reason", **extra)


def _result(*, ok=True, note="", attempted=True):
    return DiscoveryResult(
        candidates=(_match().candidate,),
        sources=(SourceReport("hacker-news", attempted=attempted, ok=ok, found=1, note=note),),
        queries=("investing",),
    )


def _screen(*judgments, gated=0, judged=None):
    return ScreenResult(
        judgments=judgments,
        judged=tuple(judgments) if judged is None else judged,
        gated=gated,
    )


def test_the_scan_header_names_the_queries_sources_and_model():
    scan = report.render_scan(
        _result(), _screen(_judgment("STRONG")), now=NOW, model="deepseek/deepseek-chat"
    )

    assert "Lin Scout — 2026-09-18 12:00 UTC" in scan
    assert "Judgment model: deepseek/deepseek-chat" in scan
    assert "Queries: investing" in scan
    assert "hacker-news: 1 found" in scan


def test_the_scan_says_why_a_source_contributed_nothing():
    failed = report.render_scan(_result(ok=False, note="ScoutError: down"), None, now=NOW)
    skipped = report.render_scan(_result(ok=False, attempted=False, note="no credentials"), None, now=NOW)

    assert "hacker-news: FAILED (ScoutError: down)" in failed
    assert "hacker-news: skipped (no credentials)" in skipped


def test_the_report_shows_only_the_opportunities_worth_acting_on():
    text = report.render_report(
        [_judgment("STRONG"), _judgment("MAYBE"), _judgment("REJECT")], dry_run=False
    )

    assert text.startswith("Opportunities found:")
    assert "WHY NOW: The thread is live and unanswered." in text
    assert DRAFT in text
    assert "MATCHING CONTENT: When markets fail quietly" in text
    assert "LINK: no" in text
    assert "maybe reason" not in text


def test_the_report_caps_what_it_shows():
    text = report.render_report(
        [_judgment("STRONG", url=f"https://news.ycombinator.com/item?id={n}") for n in range(1, 5)],
        limit=2,
        dry_run=False,
    )

    assert text.count("PROPOSED RESPONSE") == 2
    assert "item?id=3" not in text


def test_a_dry_run_says_what_it_would_have_surfaced():
    text = report.render_report([_judgment("STRONG")], dry_run=True)

    assert text.startswith("Opportunities that would have been surfaced:")


def test_finding_nothing_is_reported_plainly():
    assert report.render_report([_judgment("REJECT")], dry_run=False) == report.NO_OPPORTUNITIES


def test_the_decisions_list_explains_every_candidate_it_declined():
    text = report.render_decisions([_judgment("REJECT"), _judgment("MAYBE"), _judgment("STRONG")])

    assert "- REJECT: https://news.ycombinator.com/item?id=1 — reject reason" in text
    assert "- MAYBE: " in text
    assert "strong reason" not in text


def test_the_decisions_list_truncates_instead_of_printing_hundreds_of_rows():
    judgments = [_judgment("REJECT", url=f"https://news.ycombinator.com/item?id={n}") for n in range(1, 6)]

    text = report.render_decisions(judgments, limit=2)

    assert text.count("- REJECT:") == 2
    assert "… 3 more not shown" in text


def test_an_empty_decision_list_says_why_it_is_empty():
    assert report.render_decisions([]) == (
        "Candidates considered: none (nothing matched the archive closely enough)."
    )


def test_the_summary_assembles_the_whole_run():
    summary = report.build_summary(
        _result(),
        _screen(_judgment("STRONG"), _judgment("REJECT"), gated=3),
        now=NOW,
        limit=5,
        model="deepseek/deepseek-chat",
    )

    assert "Lin Scout — " in summary
    assert "Judgments: 2 model calls | 3 gated before judgment" in summary
    assert "Opportunities found:" in summary
    assert "Candidates considered:" in summary


def test_model_written_prose_is_flattened_before_it_reaches_the_step_summary():
    judgment = Judgment(
        match=_match(),
        verdict="STRONG",
        reason="see ![x](https://attacker.test/beacon) and `whoami`",
        why_now="live **now** <https://attacker.test>",
        why_fits="the article names the mechanism",
        draft=DRAFT,
        link=False,
        link_reason="no link needed",
    )

    text = report.build_summary(_result(), _screen(judgment), now=NOW)

    # The summary is rendered as Markdown by GitHub, so nothing the model wrote
    # may arrive as a link, an image, or emphasis.
    assert "https://attacker.test" not in text
    assert "![x]" not in text
    assert "`whoami`" not in text
    assert "**now**" not in text
    assert "<https://attacker.test>" not in text
    assert "live now" in text


def test_the_summary_works_before_the_judgment_stage_has_run():
    summary = report.build_summary(_result(), None, now=NOW, model="none (--no-llm)")

    assert "Judgment model: none (--no-llm)" in summary
    assert "Candidates considered" not in summary
