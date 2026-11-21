"""Recomputable ABP inventory and follower-first observational scorecard."""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from scripts.instagram_growth import reel_pilot as pilot, rolling_queue as queue

MIN_REACH = 100  # Screening floor, not a statistical confidence threshold.
UNAVAILABLE = ('follows', 'non_follower_reach', 'profile_visits', 'website_sessions', 'newsletter_signups')


def inventory(manifests, state, now):
    """Validate the existing manifest contract; never count used/renamed bytes."""
    used = state.get('receipts', {})
    hashes = {r.get('sha256') for r in used.values() if r.get('status') != 'confirmed_unpublished'}
    approved = []
    invalid = []
    seen = set()
    for m in manifests:
        name = m.get('concept_id')
        if name in used or m.get('video_sha256') in hashes:
            continue
        try:
            # Same validation as the publisher, without filesystem/network effects.
            pilot.validate_manifest(m)
            if m['trial'] or not m.get('release_after'):
                raise ValueError('ordinary released assets only')
            release = queue.instant(m['release_after'])
            if m['video_sha256'] in seen:
                raise ValueError('duplicate unpublished video hash')
            seen.add(m['video_sha256'])
            approved.append({'concept_id': name, 'release_after': release.isoformat(), 'ready_now': release <= now})
        except (ValueError, KeyError, TypeError):
            invalid.append(name)
    count = len(approved)
    level = 'EXHAUSTED' if count == 0 else 'LOW' if count < 7 else 'BUFFER_SHORT' if count < 21 else 'OK'
    return {'approved_unpublished': count, 'ready_now': sum(x['ready_now'] for x in approved),
            'target_seven_days': 21, 'days_at_max_cadence': count / 3,
            'level': level, 'invalid_or_duplicate': invalid, 'items': approved}


def load_manifests(directory):
    return [json.loads(p.read_text()) for p in sorted(Path(directory).glob('*.json'))]


def followers(state, start, now):
    points = sorted((x for x in state.get('account_snapshots', {}).values()
                     if x.get('account', pilot.ACCOUNT) == pilot.ACCOUNT
                     and type(x.get('followers_count')) is int and queue.instant(x['captured_at']) <= now),
                    key=lambda x: x['captured_at'])
    before = [x for x in points if start - timedelta(hours=24) <= queue.instant(x['captured_at']) <= start]
    during = [x for x in points if start <= queue.instant(x['captured_at']) <= now]
    first = before[-1] if before else next(iter(during), None)
    last = points[-1] if points else None
    fresh = bool(last and now - queue.instant(last['captured_at']) <= timedelta(hours=2))
    delta = last['followers_count'] - first['followers_count'] if first and last else None
    return {'start': first, 'end': last, 'net_new_followers_week': delta if before and fresh else None,
            'observed_change': delta, 'complete_week_boundary_coverage': bool(before and fresh),
            'end_snapshot_fresh': fresh, 'attribution': 'Account-level only; overlapping posts do not identify per-Reel acquisition.'}


def replicated_patterns(rows):
    groups = defaultdict(list)
    for row in rows:
        if row['window'] == '7d' and row['eligible_for_comparison'] and row.get('hypothesis'):
            groups[row['hypothesis']].append(row)
    result = []
    for hypothesis, group in groups.items():
        articles = sorted({x['source_url'] for x in group if x.get('source_url')})
        if len(articles) < 2:
            continue
        reach = sum(x['metrics']['reach'] for x in group)
        shares = [x['metrics'].get('shares') for x in group]
        result.append({'hypothesis': hypothesis, 'source_articles': articles, 'n_reels': len(group),
                       'reach': reach, 'shares_per_1000_reached': 1000 * sum(shares) / reach if all(x is not None for x in shares) else None,
                       'evidence_concepts': [x['concept_id'] for x in group],
                       'status': 'replicated_attention_candidate_not_causal_follow_winner'})
    return sorted(result, key=lambda x: (x['shares_per_1000_reached'] is not None, x['shares_per_1000_reached'] or 0), reverse=True)


def build(state, manifests, now=None):
    now = now or datetime.now(timezone.utc)
    if state.get('account') != pilot.ACCOUNT:
        raise ValueError('wrong account scorecard')
    start = now - timedelta(days=7)
    meta = {x['concept_id']: x for x in manifests}
    published = {k: r for k, r in state.get('receipts', {}).items() if r.get('status') == 'published'}
    rows = []; pending = []; cohorts = {label: [] for label in queue.WINDOWS}
    for name, receipt in published.items():
        m = meta.get(name, {})
        for label, target in queue.WINDOWS.items():
            obs = state.get('observations', {}).get(f'{name}-{label}')
            if not obs:
                pending.append({'concept_id': name, 'window': label,
                                'status': 'overdue' if now >= queue.instant(receipt['published_at']) + target else 'not_due'})
                continue
            age = obs.get('actual_age_hours')
            intended = target.total_seconds() / 3600
            timely = isinstance(age, (int, float)) and intended <= age <= intended + (24 if label == '7d' else 6)
            metrics = {**{k: None for k in (*pilot.METRICS, *UNAVAILABLE)}, **obs.get('metrics', {})}
            reach = metrics.get('reach')
            eligible = timely and isinstance(reach, (int, float)) and reach >= MIN_REACH
            row = {'concept_id': name, 'source_url': m.get('source_url', receipt.get('source_url')),
                   'source_claim': m.get('source_anchor'), 'hook': m.get('opening_hook', m.get('caption', '').split('\n')[0]),
                   'hook_type': m.get('hook_type', m.get('experiment_hypothesis')), 'hypothesis': m.get('experiment_hypothesis'),
                   'voice': m.get('voice'), 'creative_format': m.get('creative_format'), 'visual_style': m.get('visual_style', m.get('creative_format')),
                   'duration_seconds': m.get('duration_seconds'), 'cta_type': m.get('cta_type'),
                   'published_at': receipt['published_at'], 'format': 'ordinary_reel', 'window': label,
                   'actual_age_hours': age, 'metrics': metrics, 'missing': [k for k, v in metrics.items() if v is None],
                   'availability': obs.get('availability', {}), 'eligible_for_comparison': eligible,
                   'low_information': not eligible, 'timely': timely,
                   'shares_per_1000_reached': 1000 * metrics['shares'] / reach if reach and metrics.get('shares') is not None else None,
                   'watch_time_unit': 'provider value; not normalized to seconds'}
            rows.append(row)
            if timely:
                cohorts[label].append(row)
    patterns = replicated_patterns(rows)
    # Need two independent replicated patterns before comparative ranking.
    ranked = [p for p in patterns if p['shares_per_1000_reached'] is not None]
    sufficient = len(ranked) >= 2
    encouraging = [p for p in ranked if p['shares_per_1000_reached'] > 0]
    failures = [{'concept_id': k, 'status': r.get('status'), 'error_type': r.get('error_type')}
                for k, r in state.get('receipts', {}).items() if r.get('status') not in ('published', 'confirmed_unpublished')]
    return {'account': pilot.ACCOUNT, 'created_at': now.isoformat(), 'period_start': start.isoformat(),
            'followers': followers(state, start, now), 'published_total': len(published),
            'published_this_week': sum(start <= queue.instant(r['published_at']) <= now for r in published.values()),
            'inventory': inventory(manifests, state, now), 'rows': rows, 'equal_target_age_cohorts': cohorts,
            'pending_windows': pending, 'failures': failures, 'minimum_reach_per_reel': MIN_REACH,
            'top_hypotheses': ranked[:3] if sufficient else [],
            'underperforming_hypotheses': ranked[-2:] if sufficient else [],
            'replication_candidates': encouraging, 'low_information': not sufficient,
            'next_experiments': [{'hypothesis': p['hypothesis'], 'test': 'Replicate on a fresh article; preserve exploration.', 'evidence': p['evidence_concepts']} for p in encouraging[:3]] or
                                [{'hypothesis': 'Cold-start exploration', 'test': 'Keep 60/25/15 planned allocation; with no replicated evidence, reassign exploitation to exploration.'}],
            'conclusion': 'Observational attention evidence; no causal, statistically validated or per-Reel follower winner.',
            'unavailable': list(UNAVAILABLE), 'generation_health': 'Not visible from hosted state; inspect local factory status/report.',
            'aggregation': 'Cumulative outcomes are separated by target age. Do not sum repeated windows or call summed reach unique people.'}


def markdown(report):
    f = report['followers']; inv = report['inventory']; end = f.get('end') or {}
    lines = ['# ABP weekly growth scorecard', '', f"Period: {report['period_start']} → {report['created_at']}",
             f"Followers: start={(f.get('start') or {}).get('followers_count')}; end={end.get('followers_count')}; full-week net={f['net_new_followers_week']}; observed change={f['observed_change']}.",
             'Missing week boundaries mean unavailable weekly growth, not zero.',
             f"Published this week: {report['published_this_week']}; total: {report['published_total']}.",
             f"Inventory: {inv['approved_unpublished']} approved unpublished ({inv['level']}); target21; {inv['days_at_max_cadence']:.1f} days at maximum cadence.", '',
             '| Reel | Age | Actual hours | Reach | Views | Shares | Saves | Skip rate | Missing |',
             '|---|---|---:|---:|---:|---:|---:|---:|---|']
    for r in report['rows']:
        m = r['metrics']; lines.append(f"| {r['concept_id']} | {r['window']} | {r['actual_age_hours']} | {m['reach']} | {m['views']} | {m['shares']} | {m['saved']} | {m['reels_skip_rate']} | {', '.join(r['missing'])} |")
    for title, key in [('Top hypotheses', 'top_hypotheses'), ('Underperforming hypotheses', 'underperforming_hypotheses'), ('Patterns to replicate', 'replication_candidates'), ('Next experiments', 'next_experiments'), ('Pending measurement', 'pending_windows'), ('Publication failures', 'failures')]:
        lines += ['', '## ' + title, '', json.dumps(report[key], indent=2)]
    return '\n'.join(lines + ['', report['generation_health'], report['aggregation'], report['conclusion'],
                             'Website sessions, newsletter subscriptions and per-Reel follows are unavailable unless independently measured.']) + '\n'


def write(report, directory):
    root = Path(directory); root.mkdir(parents=True, exist_ok=True)
    (root / 'weekly-scorecard.json').write_text(json.dumps(report, indent=2) + '\n')
    (root / 'weekly-scorecard.md').write_text(markdown(report))
