"""Scout's command line: one scheduled run, plus three commands for the author.

`run` is what the daily workflow calls: read the published article index, search
the external sources, judge what matches, print the opportunities found, record
them, and expire the ones nobody acted on. `--dry-run` does exactly the same work
except that it writes nothing, which is how a change to any stage is inspected
before it can influence what gets surfaced. `--no-llm` stops after the
deterministic gates, for checking what the sources returned without spending a
model call.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import os
import sys
from typing import Optional, Sequence

from scripts.scout import discovery, filtering, matching, report, state
from scripts.scout.errors import ScoutError
from scripts.scout.inventory import load_inventory
from scripts.scout.state import STATUSES


def _print_step_summary(summary: str) -> None:
    """Append the run to the workflow step summary, where the author reads it."""
    destination = os.getenv("GITHUB_STEP_SUMMARY")
    if not destination:
        return
    with open(destination, "a", encoding="utf-8") as summary_file:
        summary_file.write(summary + "\n")


def _split_queries(raw: Optional[str]) -> Optional[Sequence[str]]:
    if raw is None:
        return None
    return [query.strip() for query in raw.split(",") if query.strip()]


def run_command(args: argparse.Namespace) -> int:
    if args.no_llm and not args.dry_run:
        raise ScoutError("❌ --no-llm is only available with --dry-run: a real run must judge its candidates")
    use_llm = not args.no_llm
    if use_llm and not filtering.llm_required():
        raise ScoutError(
            "❌ no judgment model is configured (set DEEPSEEK_API_KEY, or use SOCIAL_LLM_PROVIDER=ollama "
            "with OLLAMA_MODEL); --dry-run --no-llm inspects discovery without one"
        )

    now = datetime.now(timezone.utc)
    items = load_inventory()
    if not items:
        raise ScoutError("❌ the article index returned no content; refusing to report an empty run")

    state_data = state.load_state()
    recorded = state.recorded_urls(state_data)
    queries = matching.build_queries(items, limit=matching.query_limit(), override=_split_queries(args.queries))
    if not queries:
        raise ScoutError("❌ no search queries could be derived from the archive; pass --queries")

    discovered = discovery.discover(
        queries,
        now=now,
        per_query_limit=discovery.per_query_limit(),
        max_age_days=filtering.max_age_days(),
        timeout=discovery.timeout_seconds(),
    )
    for source_report in discovered.sources:
        if not source_report.ok:
            print(f"⚠️  scout_source_unavailable {source_report.source} ({source_report.note})")
    if not discovered.any_source_ok:
        raise ScoutError("❌ every discovery source failed; refusing to report an empty run")
    if not any(report.found for report in discovered.sources if report.attempted):
        # A source can answer happily and still return nothing, which is what an
        # upstream change in query semantics looks like from here. Reporting that
        # as a quiet day would hide a broken run indefinitely.
        raise ScoutError("❌ every reachable source returned no candidates; refusing to report an empty run")

    ranked = matching.rank_candidates(discovered.candidates, items)
    screened = filtering.screen(
        ranked,
        items=items,
        now=now,
        recorded=recorded,
        use_llm=use_llm,
    )

    summary = report.build_summary(
        discovered,
        screened,
        now=now,
        dry_run=args.dry_run,
        limit=args.max_opportunities,
        model=filtering.identity() if use_llm else "none (--no-llm)",
    )
    print(summary)
    _print_step_summary(summary)

    if args.dry_run:
        print("\nDry run: nothing recorded and scout-state.json left untouched.")
        return 0

    surfaced = 0
    for judgment in screened.judgments:
        if judgment.verdict != filtering.VERDICT_STRONG or surfaced >= args.max_opportunities:
            continue
        if state.record_surfaced(
            state_data,
            url=judgment.match.candidate.external_url,
            source=judgment.match.candidate.source,
            content_id=judgment.match.item.content_id,
            draft=judgment.draft,
            now=now,
        ):
            surfaced += 1
    expired = state.expire_stale(state_data, now=now)
    state.save_state(state_data)
    print(f"\nRecorded {surfaced} surfaced opportunity(ies); expired {expired} stale one(s).")
    return 0


def list_command(args: argparse.Namespace) -> int:
    entries = sorted(
        (state.load_state().get("opportunities") or {}).values(),
        key=lambda entry: str(entry.get("surfaced_at") or ""),
        reverse=True,
    )
    if args.status:
        entries = [entry for entry in entries if entry.get("status") == args.status]
    if not entries:
        print("No scout opportunities recorded yet.")
        return 0
    for entry in entries:
        day = str(entry.get("surfaced_at") or "")[:10]
        print(f"{str(entry.get('status')):<10} {day}  {entry.get('external_url')}  ({entry.get('content_id')})")
    return 0


def _set_status(url: str, status: str, outcome: Optional[str] = None) -> int:
    state_data = state.load_state()
    if not state.set_status(state_data, url, status, outcome=outcome):
        raise ScoutError(f"❌ {url} is not a recorded scout opportunity")
    state.save_state(state_data)
    print(f"✅ Marked {state.normalize_url(url)} as {status}.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.scout",
        description="Find the few current external conversations worth joining with existing writing.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    run_parser = commands.add_parser("run", help="search, judge, and record today's opportunities")
    run_parser.add_argument("--dry-run", action="store_true", help="do the work but record nothing")
    run_parser.add_argument("--no-llm", action="store_true", help="stop before the judgment calls")
    run_parser.add_argument("--queries", help="comma-separated queries instead of the derived ones")
    run_parser.add_argument(
        "--max-opportunities",
        type=int,
        default=filtering.max_opportunities(),
        help="at most this many opportunities are reported and recorded",
    )
    run_parser.set_defaults(handler=run_command)

    list_parser = commands.add_parser("list", help="show recorded opportunities")
    list_parser.add_argument("--status", choices=STATUSES, help="only this status")
    list_parser.set_defaults(handler=list_command)

    dismiss_parser = commands.add_parser("dismiss", help="record that an opportunity was not worth joining")
    dismiss_parser.add_argument("url")
    dismiss_parser.set_defaults(handler=lambda args: _set_status(args.url, state.STATUS_DISMISSED))

    acted_parser = commands.add_parser("acted", help="record that an opportunity was acted on")
    acted_parser.add_argument("url")
    acted_parser.add_argument("--outcome", help="what came of it")
    acted_parser.set_defaults(handler=lambda args: _set_status(args.url, state.STATUS_ACTED, args.outcome))

    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.handler(args)
    except ScoutError as error:
        print(str(error))
        return 1
    except KeyboardInterrupt:
        print("❌ interrupted")
        return 130


if __name__ == "__main__":  # pragma: no cover - the module entry point does this
    sys.exit(main())
