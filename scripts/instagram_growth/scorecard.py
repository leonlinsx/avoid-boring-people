"""Recomputable ABP inventory and follower-first observational scorecard."""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from scripts.instagram_growth import reel_pilot as pilot, rolling_queue as queue, retention
from scripts.instagram_growth.factory.allocation import production_parameters,plan

MIN_REACH = 100  # Screening floor, not a statistical confidence threshold.
UNAVAILABLE = ('follows', 'non_follower_reach', 'profile_visits', 'website_sessions', 'newsletter_signups')


def window_end(label, published_at):
    """Existing comparison tolerance, also used to schedule useful reads."""
    return published_at + queue.WINDOWS[label] + timedelta(hours=24 if label == '7d' else 6)


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
        encouraging_articles = sorted({x['source_url'] for x in group if (x['metrics'].get('shares') or 0)>0 and x.get('source_url')})
        parameters=[production_parameters(x.get('production_parameters')) for x in group]
        repeatable=parameters[0] if all(p is not None and p==parameters[0] for p in parameters) else None
        topics={x.get('topic') for x in group}
        result.append({'hypothesis': hypothesis, 'source_articles': articles, 'n_reels': len(group),
                       'reach': reach, 'shares_per_1000_reached': 1000 * sum(shares) / reach if all(x is not None for x in shares) else None,
                       'evidence_concepts': [x['concept_id'] for x in group],
                       'encouraging_source_articles': encouraging_articles, 'replication_eligible': len(encouraging_articles)>=2,
                       'production_parameters':repeatable,'topic':next(iter(topics)) if len(topics)==1 else None,
                       'status': 'replicated_attention_candidate_not_causal_follow_winner'})
    return sorted(result, key=lambda x: (x['shares_per_1000_reached'] is not None, x['shares_per_1000_reached'] or 0), reverse=True)


def paired_presentations(rows):
    groups=defaultdict(dict)
    for row in rows:
        if row.get('pair_id') and row.get('pair_role') in ('presenter','graphics'):
            groups[(row['pair_id'],row['window'])][row['pair_role']]=row
    result=[]
    for (pair_id,window),members in groups.items():
        head=members.get('presenter');graphics=members.get('graphics')
        complete=bool(head and graphics)
        age_gap=abs(head['actual_age_hours']-graphics['actual_age_hours']) if complete else None
        eligible=bool(complete and head['eligible_for_comparison'] and graphics['eligible_for_comparison'] and age_gap<=1)
        result.append({'pair_id':pair_id,'window':window,'status':'comparable_observational_pair' if eligible else 'insufficient_or_mismatched_evidence',
                       'age_gap_hours':age_gap,'members':{k:v['concept_id'] for k,v in members.items()},
                       'presenter_metrics':head['metrics'] if head else None,'graphics_metrics':graphics['metrics'] if graphics else None,
                       'caveat':'Same script/voice/captions; publication time and audiences still differ. No causal or per-Reel follower conclusion.'})
    return result


def creative_results(rows,manifests,published):
    """Existing scorecard only; paired formats never become independent claims."""
    from scripts.instagram_growth.autonomy.creative import PROTOCOL,HYPOTHESES,MAX_POSTS_PER_ARM
    result=[]
    for factor,hypothesis in HYPOTHESES.items():
        members=[m for m in manifests if m.get('script',{}).get('creative_trial',{}).get('protocol')==PROTOCOL
                 and m['script']['creative_trial']['factor']==factor]
        if not members:continue
        arms={arm:[m for m in members if m['script']['creative_trial']['arm']==arm] for arm in ('control','treatment')}
        counts={arm:{'admitted':len(group),'published':sum(m['concept_id'] in published for m in group),
                     'distinct_claims':len({m['claim_id'] for m in group})} for arm,group in arms.items()}
        comparisons=[]
        for window in queue.WINDOWS:
            summary={}
            for arm in arms:
                observed=[r for r in rows if r['window']==window and r.get('creative_trial',{}).get('factor')==factor and r['creative_trial']['arm']==arm]
                eligible=[r for r in observed if r['eligible_for_comparison']]
                reach=sum(r['metrics']['reach'] for r in eligible)
                shares=[r['metrics'].get('shares') for r in eligible]
                summary[arm]={'observed_posts':len(observed),'eligible_posts':len(eligible),
                              'distinct_claims':len({r['claim_id'] for r in eligible}),
                              'independent_source_articles':len({r['source_url'] for r in eligible}),
                              'summed_reel_reach_nonunique':reach,
                              'shares_per_1000_reached':1000*sum(shares)/reach if reach and all(x is not None for x in shares) else None,
                              'blocks':[{'topic':r['topic'],'source_article':r['source_url'],'format':r['creative_format'],
                                         'publication_slot_utc_start_hour':6*(queue.instant(r['published_at']).hour//6),
                                         'voice':r['voice'],'duration_seconds':r['duration_seconds'],'cta':r['cta_type']} for r in eligible],
                              'per_reel_follows':None,'qualified_owned_site_outcomes':None}
            blocksets=[{(b['topic'],b['source_article'],b['format'],b['publication_slot_utc_start_hour']) for b in summary[arm]['blocks']} for arm in ('control','treatment')]
            comparisons.append({'window':window,'arms':summary,'shared_observational_blocks':len(blocksets[0]&blocksets[1]),'winner':None})
        result.append({'protocol':PROTOCOL,'factor':factor,'hypothesis':hypothesis,'max_posts_per_arm':MAX_POSTS_PER_ARM,
                       'counts':counts,'status':'bounded_arm_complete' if all(v['published']>=MAX_POSTS_PER_ARM for v in counts.values()) else 'collecting_or_supply_limited',
                       'comparisons':comparisons,'decision':'ADJUST',
                       'limitation':'Directional observational comparisons only. Account follower change cannot be assigned to overlapping arms; qualified owned-site outcomes unavailable. Never select a growth winner from attention alone.'})
    return result


def creative_learning(rows,now=None):
    """Use one equal-age observation per Reel; diagnoses only order exploration."""
    from scripts.instagram_growth.autonomy.creative import HYPOTHESES
    from scripts.instagram_growth.autonomy import renewal
    hypotheses={**HYPOTHESES,'reflection':renewal.HYPOTHESES['reflection'].format(
        structure='matched',layout='the same graphics',audience='the same')}
    now=now or datetime.now(timezone.utc)
    factors=['audience','hook','caption','compression','typography','reflection']
    observed=[r for r in rows if r['window']=='24h' and r['timely']
              and now-timedelta(days=14)<=queue.instant(r['published_at'])<=now
              and isinstance(r['metrics'].get('reach'),(int,float))]
    articles={r['source_url'] for r in observed if r.get('source_url')}
    low_reach=len(observed)>=6 and len(articles)>=3 and all(r['metrics']['reach']<MIN_REACH for r in observed)
    exposed=[r for r in observed if r['eligible_for_comparison']]
    skips=[r['metrics'].get('reels_skip_rate') for r in exposed]
    weak_openings=(len(exposed)>=6 and len({r['source_url'] for r in exposed})>=3
                   and all(isinstance(v,(int,float)) and 0<=v<=100 for v in skips)
                   and sum(skips)/len(skips)>=65)
    priority=['audience','hook','compression','caption'] if low_reach else ['compression','hook','audience','caption'] if weak_openings else factors
    priority=list(dict.fromkeys(priority+factors))
    reason=('Low reach across multiple articles: explore audience positioning and openings; inspect native discoverability after distinct treatments receive exposure.' if low_reach else
            'High skip across exposed articles: test a nonrepeating payoff and practical question.' if weak_openings else
            'Insufficient cross-article exposure for a creative diagnosis; balance the preregistered trials.')
    return {'observation_window':'24h','observed_posts':len(observed),'source_articles':len(articles),
            'evidence_concepts':[r['concept_id'] for r in observed],
            'factor_priority':priority,'reason':reason,
            'hypotheses':[{'factor':f,'test':hypotheses[f]} for f in priority],
            'effect':'Order ties in bounded exploration only; no growth winner or increased exploitation.',
            'limitations':'Diagnostic thresholds are not significance tests. Missing, late and repeated-age observations cannot trigger a change.'}


def renewable_results(rows,manifests,state,now):
    from scripts.instagram_growth.autonomy import renewal as r
    episodes={r.script(m)['creative_trial']['episode_id']:r.script(m) for m in manifests
              if r.script(m).get('creative_trial',{}).get('protocol')==r.PROTOCOL}
    result=[]
    for eid,item in sorted(episodes.items()):
        trial=item['creative_trial'];value=item['template_parameters']['creative']
        specs={'control':value['control'],'treatment':r.specification({**value,'arm':1})}
        arms={}
        for arm,spec in specs.items():
            members=[m for m in manifests if r.comparable(m,item['topic'],spec)]
            ids={m['concept_id'] for m in members}
            receipts=[(name,state.get('receipts',{}).get(name,{})) for name in sorted(ids)]
            published=[(name,p) for name,p in receipts if p.get('status')=='published']
            observed=[row for row in rows if row['concept_id'] in ids]
            arms[arm]={'admitted_claims':len({m['claim_id'] for m in members}),
                       'published_claims':len({m['claim_id'] for m in members if m['concept_id'] in {name for name,_ in published}}),
                       'publication_receipts':[{'concept_id':name,'published_at':p['published_at']} for name,p in published],
                       'measurement_receipts':[{'key':row['concept_id']+'-'+row['window'],
                                                'eligible_for_comparison':row['eligible_for_comparison'],
                                                'actual_age_hours':row['actual_age_hours'],'metrics':row['metrics']} for row in observed],
                       'missing_windows':[name+'-'+window for name,_ in published for window in queue.WINDOWS
                                          if name+'-'+window not in state.get('observations',{})]}
        dates=[r.instant(p['published_at']) for a in arms.values() for p in a['publication_receipts']
               if p['concept_id'] in {m['concept_id'] for m in manifests if r.script(m).get('creative_trial',{}).get('episode_id')==eid}]
        complete=all(a['published_claims']>=r.MAX_POSTS for a in arms.values())
        timed_out=bool(dates and now-min(dates)>=r.STOP_AFTER)
        result.append({'episode_id':eid,'protocol':r.PROTOCOL,'topic':item['topic'],'primary_variable':trial['primary_variable'],
                       'hypothesis':trial['hypothesis'],'control':specs['control'],'treatment':specs['treatment'],
                       'arms':arms,'stop_conditions':trial['stop_conditions'],
                       'status':'arm_complete' if complete else 'closed_incomplete_evidence' if timed_out else 'collecting_or_supply_limited',
                       'winner':None,'next_action':'Choose an unused supported contrast automatically; never replay the same claim/execution.',
                       'limitation':'Controls can be shared observations, not new independent replications. Follower attribution and qualified website outcomes remain unavailable.'})
    published=sorted(((queue.instant(p['published_at']),name) for name,p in state.get('receipts',{}).items()
                      if p.get('status')=='published'))
    meta={m['concept_id']:m for m in manifests};seen=set();new=0;reused=0;unknown=0
    treatments=[]
    for when,name in published:
        m=meta.get(name,{});claim=m.get('claim_id')
        if now-timedelta(days=7)<=when<=now:
            if not claim:unknown+=1
            elif claim in seen:reused+=1
            else:new+=1
            s=r.script(m)
            if s.get('treatment_id'):treatments.append({'concept_id':name,'source_claim_id':claim,'treatment_id':s['treatment_id'],
                                                      'hypothesis':s['creative_trial']['hypothesis'],'specification':r.signature(m)})
        if claim:seen.add(claim)
    return {'protocol':r.PROTOCOL,'published_this_week':{'new_source_claims':new,'reused_source_claims':reused,'unknown_legacy_claims':unknown},
            'treatments_tested_this_week':treatments,'episodes':result,
            'repeat_windows':{'claim_cooldown_days':7,'max_claim_exposures_in_28d':3,'max_article_in_7d':3,'max_topic_in_7d':5},
            'supply':state.get('auto_health',{}).get('factory',{}).get('creative_supply',{}),
            'cadence_policy':'Publish less when safe, distinct supply is limited. Episode renewal never resets creative identity or resource budgets.'}


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
        script=m.get('script',{});template=script.get('template_parameters',{})
        attributes={k:template.get(k) for k in ('hook','voice','visual','caption_words')}
        if 'creative' in template:attributes['creative']=template['creative']
        parameters=production_parameters(attributes) if script.get('reference_index') is None else None
        for label, target in queue.WINDOWS.items():
            obs = state.get('observations', {}).get(f'{name}-{label}')
            if not obs:
                gap = state.get('measurement_gaps', {}).get(f'{name}-{label}')
                pending.append({'concept_id': name, 'window': label,
                                'status': 'missed' if gap else 'overdue' if now >= queue.instant(receipt['published_at']) + target else 'not_due'})
                continue
            age = obs.get('actual_age_hours')
            intended = target.total_seconds() / 3600
            timely = isinstance(age, (int, float)) and intended <= age <= intended + (24 if label == '7d' else 6)
            metrics = {**{k: None for k in (*pilot.METRICS, *UNAVAILABLE)}, **obs.get('metrics', {})}
            reach = metrics.get('reach')
            eligible = timely and isinstance(reach, (int, float)) and reach >= MIN_REACH
            row = {'concept_id': name, 'source_url': m.get('source_url', receipt.get('source_url')),
                   'source_claim': m.get('source_anchor'), 'hook': (script.get('scenes') or [{}])[0].get('narration',m.get('opening_hook', m.get('caption', '').split('\n')[0])),
                   'hook_type': m.get('hook_type', m.get('experiment_hypothesis')), 'hypothesis': m.get('experiment_hypothesis'),
                   'voice': m.get('voice'), 'creative_format': m.get('creative_format'), 'visual_style': m.get('visual_style', m.get('creative_format')),
                   'duration_seconds': m.get('duration_seconds'), 'cta_type': m.get('cta_type'),
                   'pair_id':m.get('pair_id'),'pair_role':m.get('pair_role'),
                   'production_parameters':parameters,'topic':script.get('topic'),
                   'claim_id':m.get('claim_id'),'creative_trial':script.get('creative_trial',{}),'audience':script.get('audience'),
                   'hook_structure':script.get('hook_structure'),'caption_strategy':script.get('caption_strategy'),
                   'research_origin':script.get('research_origin'),'research_evidence_id':script.get('research_evidence_id'),
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
    encouraging = [p for p in ranked if p['replication_eligible']]
    follower_result=followers(state,start,now)
    allocation=plan(40,{'weekly_review':{'created_at':now.isoformat(),'followers':follower_result,
                                      'replication_candidates':encouraging}},now=now)
    repeatable={x['allocation_evidence']['hypothesis']:x['allocation_evidence'] for x in allocation['slots'] if x.get('allocation_evidence')}
    failures = [{'concept_id': k, 'status': r.get('status'), 'error_type': r.get('error_type')}
                for k, r in state.get('receipts', {}).items() if r.get('status') not in ('published', 'confirmed_unpublished')]
    halted=bool(failures or any(x.get('consecutive_failures',0)>=3 for x in state.get('operation_health',{}).values()))
    return {'account': pilot.ACCOUNT, 'created_at': now.isoformat(), 'period_start': start.isoformat(),
            'followers': follower_result, 'published_total': len(published),
            'recommendation':'STOP' if halted else 'CONTINUE' if repeatable else 'ADJUST',
            'recommendation_reason':'Resolve publication/operation exceptions.' if halted else 'Bounded follow-up tests; account growth does not causally identify a Reel winner.' if repeatable else 'No follower-backed reproducible pattern yet; preserve controls and explore. Owned-site outcomes remain unavailable.',
            'published_this_week': sum(start <= queue.instant(r['published_at']) <= now for r in published.values()),
            'inventory': inventory(manifests, state, now), 'rows': rows, 'equal_target_age_cohorts': cohorts,
            'matched_presentation_pairs':paired_presentations(rows),
            'creative_experiments':creative_results(rows,manifests,published),
            'creative_learning':creative_learning(rows,now),
            'retention':retention.health(state,now=now),
            'renewable_creative':renewable_results(rows,manifests,state,now),
            'measurement_health': state.get('measurement_health', {}),
            'pending_windows': pending, 'failures': failures, 'minimum_reach_per_reel': MIN_REACH,
            'top_hypotheses': ranked[:3] if sufficient else [],
            'underperforming_hypotheses': ranked[-2:] if sufficient else [],
            'replication_candidates': encouraging, 'low_information': not sufficient,
            'next_experiments': [{'hypothesis': p['hypothesis'], 'test': 'Replicate frozen attributes on a fresh article; preserve exploration. This is a follow-up test, not causal follower attribution.', 'evidence': p['evidence_concepts']} for p in list(repeatable.values())[:3]] or
                                [{'hypothesis': 'Cold-start exploration', 'test': 'Keep 60/25/15 planned allocation; with no replicated evidence, reassign exploitation to exploration.'}],
            'conclusion': 'Observational attention evidence; no causal, statistically validated or per-Reel follower winner.',
            'unavailable': list(UNAVAILABLE),
            'generation_health': 'Producer telemetry is from its signed feed; see automatic_operations and its timestamps.' if state.get('auto_health') else 'Not visible from hosted state; inspect local factory status/report.',
            'automatic_operations':{'producer':state.get('auto_health',{}),'operations':state.get('operation_health',{})},
            'aggregation': 'Cumulative outcomes are separated by target age. Do not sum repeated windows or call summed reach unique people.'}


def markdown(report):
    f = report['followers']; inv = report['inventory']; end = f.get('end') or {}
    lines = ['# ABP weekly growth scorecard', '', f"Period: {report['period_start']} → {report['created_at']}",
             f"Followers: start={(f.get('start') or {}).get('followers_count')}; end={end.get('followers_count')}; full-week net={f['net_new_followers_week']}; observed change={f['observed_change']}.",
             'Missing week boundaries mean unavailable weekly growth, not zero.',
             f"Decision: {report['recommendation']} — {report['recommendation_reason']}",
             f"Published this week: {report['published_this_week']}; total: {report['published_total']}.",
             f"Inventory: {inv['approved_unpublished']} approved unpublished ({inv['level']}); target21; {inv['days_at_max_cadence']:.1f} days at maximum cadence.", '',
             '| Reel | Age | Actual hours | Reach | Views | Shares | Saves | Skip rate | Missing |',
             '|---|---|---:|---:|---:|---:|---:|---:|---|']
    for r in report['rows']:
        m = r['metrics']; lines.append(f"| {r['concept_id']} | {r['window']} | {r['actual_age_hours']} | {m['reach']} | {m['views']} | {m['shares']} | {m['saved']} | {m['reels_skip_rate']} | {', '.join(r['missing'])} |")
    for title, key in [('Top hypotheses', 'top_hypotheses'), ('Underperforming hypotheses', 'underperforming_hypotheses'), ('Patterns to replicate', 'replication_candidates'), ('Presenter versus graphics pairs','matched_presentation_pairs'), ('Creative protocol','creative_experiments'), ('Renewable creative episodes','renewable_creative'), ('Retention and recovery','retention'), ('Creative learning','creative_learning'), ('Next experiments', 'next_experiments'), ('Pending measurement', 'pending_windows'), ('Publication failures', 'failures'), ('Automatic operations','automatic_operations')]:
        lines += ['', '## ' + title, '', json.dumps(report[key], indent=2)]
    measurement = report.get('measurement_health') or {}
    lines += ['', f"Measurement: {measurement.get('status', 'unavailable')}; {sum(x['status'] == 'missed' for x in report['pending_windows'])} missed age windows; {measurement.get('remaining_due', 'unavailable')} readings still due. Late cumulative readings cannot reconstruct earlier outcomes."]
    return '\n'.join(lines + ['', report['generation_health'], report['aggregation'], report['conclusion'],
                             'Website sessions, newsletter subscriptions and per-Reel follows are unavailable unless independently measured.']) + '\n'


def write(report, directory):
    root = Path(directory); root.mkdir(parents=True, exist_ok=True)
    (root / 'weekly-scorecard.json').write_text(json.dumps(report, indent=2) + '\n')
    (root / 'weekly-scorecard.md').write_text(markdown(report))
