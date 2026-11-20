"""Read manually collected ABP aggregate metrics; never publish or fetch accounts."""
import argparse
import csv
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path

PLAN = Path(__file__).resolve().parents[2] / "docs/instagram-growth-reels-v1.json"
COUNTS = ("accounts_reached", "non_follower_reach", "views", "post_attributed_follows", "shares", "saves", "profile_visits")
FLOATS = ("duration_seconds", "average_watch_seconds", "three_second_view_rate")


def number(value, integer=False):
    if value is None or not value.strip():
        return None
    n = float(value)
    if not math.isfinite(n) or n < 0 or (integer and not n.is_integer()):
        raise ValueError("Metrics must be finite nonnegative numbers; counts must be integers")
    return int(n) if integer else n


def timestamp(value):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.utcoffset() is None:
        raise ValueError("Timestamps must include a timezone")
    return dt


def read_observations(handle, plan):
    rows, seen, slots = [], set(), set()
    articles = {b["article"] for b in plan["live_plan"]["blocks"]}
    reader = csv.DictReader(handle)
    required = {"account", "post_id", "article", "format", "visibility", "published_at", "observed_at", "window_hours", *COUNTS, *FLOATS}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError("Observation CSV is missing required column headers")
    for raw in reader:
        if None in raw:
            raise ValueError("Unexpected extra CSV cells")
        if not any((v or "").strip() for v in raw.values()):
            continue
        if raw.get("account") != plan["account"]:
            raise ValueError("Only the experiment's ABP account is allowed")
        article, form = raw.get("article"), raw.get("format")
        if article not in articles or form not in {"graphics", "presenter"}:
            raise ValueError("Unknown article or format")
        post = (raw.get("post_id") or "").strip()
        window = number(raw.get("window_hours"), True)
        if not post or window not in plan["live_plan"]["measurement_windows_hours"]:
            raise ValueError("A real post_id and a prespecified measurement window are required")
        key, slot = (post, window), (article, form, window)
        if key in seen or slot in slots:
            raise ValueError("Duplicate post snapshot or article/format/window slot")
        seen.add(key)
        slots.add(slot)
        visibility = raw.get("visibility")
        if visibility not in {"trial", "standard"}:
            raise ValueError("Record trial or standard visibility explicitly")
        published, observed = timestamp(raw["published_at"]), timestamp(raw["observed_at"])
        elapsed = (observed - published).total_seconds() / 3600
        if elapsed < 0:
            raise ValueError("Observation precedes publication")
        values = {k: number(raw.get(k), True) for k in COUNTS}
        values.update({k: number(raw.get(k)) for k in FLOATS})
        if values["duration_seconds"] is not None and values["duration_seconds"] <= 0:
            raise ValueError("Duration must be positive")
        if values["three_second_view_rate"] is not None and values["three_second_view_rate"] > 1:
            raise ValueError("Three-second view rate is a fraction from 0 to 1")
        reach, follows = values["accounts_reached"], values["post_attributed_follows"]
        nonfollowers = values["non_follower_reach"]
        if reach is not None and ((follows is not None and follows > reach) or (nonfollowers is not None and nonfollowers > reach)):
            raise ValueError("Follows/non-follower reach cannot exceed reached accounts in one snapshot")
        timely = abs(elapsed - window) <= (6 if window == 48 else 24)
        rates = {f"{k}_per_1000_reached": 1000 * values[k] / reach if reach and values[k] is not None else None for k in ("post_attributed_follows", "shares", "saves", "profile_visits")}
        watch, duration = values["average_watch_seconds"], values["duration_seconds"]
        # Loops can make this exceed one; it is not a completion rate.
        rates["watch_time_ratio"] = watch / duration if duration and watch is not None else None
        rows.append({"post_id": post, "article": article, "format": form, "visibility": visibility,
                     "window_hours": window, "elapsed_hours": elapsed, "timely": timely,
                     "published_at": published.isoformat(), "observed_at": observed.isoformat(),
                     "protocol_notes": (raw.get("protocol_notes") or "").strip(),
                     "values": values, "rates": rates})
    identities, assignments = {}, {}
    for row in rows:
        identity = (row["article"], row["format"], row["visibility"], row["published_at"])
        previous = identities.setdefault(row["post_id"], identity)
        if identity != previous:
            raise ValueError("Post identity changed between snapshots")
        assignment = assignments.setdefault((row["article"], row["format"]), row["post_id"])
        if assignment != row["post_id"]:
            raise ValueError("Article/format slot changed post between snapshots")
    return rows


def summarize(rows, plan):
    # Do not select winners using diagnostic 48-hour snapshots or partial cohorts.
    final = [r for r in rows if r["window_hours"] == 168]
    reasons = []
    expected_posts = 2 * len(plan["live_plan"]["blocks"])
    if len(final) != expected_posts:
        reasons.append(f"{expected_posts} seven-day post observations are required")
    if any(not r["timely"] for r in final):
        reasons.append("one or more seven-day observations missed the +/-24h window")
    if len({r["visibility"] for r in final}) > 1:
        reasons.append("trial and standard delivery must not be pooled")
    groups = {}
    limits = plan["live_plan"]["minimum_information"]
    for form in ("graphics", "presenter"):
        cohort = [r for r in final if r["format"] == form]
        primary = [r for r in cohort if r["values"]["accounts_reached"] is not None and r["values"]["post_attributed_follows"] is not None]
        if len(primary) != limits["posts_per_format"]:
            reasons.append(f"{form}: {limits['posts_per_format']} complete primary-metric observations are required")
        reach = sum(r["values"]["accounts_reached"] for r in primary)
        follows = sum(r["values"]["post_attributed_follows"] for r in primary)
        if reach < limits["reached_per_format"]:
            reasons.append(f"{form}: insufficient exposure")
        if any(r["values"]["accounts_reached"] < limits["reached_per_post"] for r in primary):
            reasons.append(f"{form}: one or more posts below the exposure floor")
        groups[form] = {"complete_posts": len(primary), "reached_with_complete_primary": reach if primary else None,
                        "follows_with_complete_primary": follows if primary else None,
                        "follows_per_1000_reached": 1000 * follows / reach if reach else None}
    if sum(g["follows_with_complete_primary"] or 0 for g in groups.values()) < limits["attributed_follows_total"]:
        reasons.append("too few attributed follows for the pilot's information gate")
    blocks = []
    for block in plan["live_plan"]["blocks"]:
        pair = {r["format"]: r for r in final if r["article"] == block["article"]}
        if len(pair) == 2:
            g, p = (pair[k]["rates"]["post_attributed_follows_per_1000_reached"] for k in ("graphics", "presenter"))
            blocks.append({"article": block["article"], "presenter_minus_graphics": p - g if p is not None and g is not None else None})
    g, p = (groups[k]["follows_per_1000_reached"] for k in ("graphics", "presenter"))
    difference = p - g if p is not None and g is not None else None
    candidate = None
    if not reasons and difference is not None:
        direction = 1 if difference > 0 else -1
        agreement = sum(b["presenter_minus_graphics"] is not None and direction * b["presenter_minus_graphics"] > 0 for b in blocks)
        if abs(difference) >= plan["live_plan"]["minimum_effect_per_1000"] and agreement >= plan["live_plan"]["required_block_agreement"]:
            candidate = "presenter" if direction == 1 else "graphics"
    return {"experiment_id": plan["experiment_id"], "live_status": "not_started" if not rows else "observations_recorded",
            "status": "inconclusive" if reasons else "human_review_required",
            "reasons": reasons, "groups": groups, "blocks": blocks,
            "presenter_minus_graphics_per_1000": difference,
            "directional_candidate": candidate, "scale_authorized": False,
            "next_action": "Collect complete comparable data; do not scale" if reasons else "Review guardrails and confounders; replicate any candidate before scaling",
            "inference_limit": "Descriptive post-level pilot, not randomized causal evidence or statistical significance",
            "observations": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("observations", type=Path)
    parser.add_argument("--plan", type=Path, default=PLAN)
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text())
    with args.observations.open(newline="") as handle:
        result = summarize(read_observations(handle, plan), plan)
    result["plan_sha256"] = hashlib.sha256(args.plan.read_bytes()).hexdigest()
    result["observations_sha256"] = hashlib.sha256(args.observations.read_bytes()).hexdigest()
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
