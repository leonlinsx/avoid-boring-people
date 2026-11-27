"""Initial 60/25/15 allocation; replicated attention is not follower causality."""
from math import floor
import copy
import hashlib
import json
from datetime import datetime,timedelta,timezone

WEIGHTS = {'exploration': .60, 'exploitation': .25, 'control': .15}


def production_parameters(value):
    """Only repeat treatments already supported by the source-bound compiler."""
    if not isinstance(value,dict) or set(value)!={'hook','voice','visual','caption_words'}:return None
    if (type(value['hook']) is not int or value['hook'] not in (0,1)
        or value['voice'] not in ('af_heart','af_nicole') or value['visual'] not in ('cards','statement')
        or value['caption_words'] not in (3,5)):return None
    return dict(value)


def plan(count, state, *, now=None):
    review=state.get('weekly_review',{});followers=review.get('followers',{})
    net=followers.get('net_new_followers_week');now=now or datetime.now(timezone.utc)
    try:
        created=datetime.fromisoformat(review['created_at'].replace('Z','+00:00'))
        fresh=created.utcoffset() is not None and now-timedelta(days=8)<=created<=now+timedelta(minutes=5)
    except (ValueError,KeyError,TypeError):fresh=False
    growth=fresh and followers.get('complete_week_boundary_coverage') is True and type(net) is int and net>0
    candidates = [x for x in review.get('replication_candidates', [])
                  if x.get('replication_eligible') is True and len(set(x.get('encouraging_source_articles', []))) >= 2 and x.get('n_reels', 0) >= 2
                  and x.get('reach', 0) >= 200 and (x.get('shares_per_1000_reached') or 0) > 0
                  and growth and x.get('topic') and production_parameters(x.get('production_parameters'))]
    quotas = {k: floor(count * w) for k, w in WEIGHTS.items()}
    for key in sorted(WEIGHTS, key=lambda k: count * WEIGHTS[k] - quotas[k], reverse=True)[:count - sum(quotas.values())]:
        quotas[key] += 1
    # Interleave buckets so a smaller successful render count retains breadth.
    remaining = dict(quotas); used = {k:0 for k in quotas}; slots = []
    while sum(remaining.values()):
        i = len(slots)
        key = max((k for k in WEIGHTS if remaining[k]), key=lambda k: quotas[k]*(i+1)/count-used[k])
        remaining[key] -= 1; used[key] += 1
        evidence = candidates[i % len(candidates)] if key == 'exploitation' and candidates else None
        actual = 'exploration' if key == 'exploitation' and not evidence else key
        slots.append({'planned_bucket': key, 'experiment_bucket': actual,
                              'allocation_evidence': evidence,
                              'allocation_note': 'No replicated evidence; exploitation reassigned to exploration.' if key != actual else None,
                              'voice': 'af_nicole' if i % 4 == 3 else 'af_heart',
                              'presenter': i % 3 == 1, 'caption_words': 3 if i % 2 else 5,
                              'duration_target': '15-20s' if i % 2 else '25-40s',
                              'visual_style': 'statement' if i % 3 == 2 else 'cards',
                      'cta_type': 'website' if i % 5 == 4 else 'follow'})
        if actual=='control':
            slots[-1].update(voice='af_heart',presenter=False,caption_words=5,duration_target='25-40s',visual_style='cards',cta_type='follow')
        elif evidence:
            params=evidence['production_parameters']
            slots[-1].update(voice=params['voice'],visual_style=params['visual'],caption_words=params['caption_words'])
    return {'weights': WEIGHTS, 'planned_counts': quotas, 'slots': slots,
            'growth_context_available':growth,
            'policy': 'Unchanged 60/25/15 weights; reproducible multi-article attention plus an observed positive follower week permits a bounded replication, not causal attribution or an admission override.'}


def presentation_pairs(items, limit):
    """Within the render budget, reserve up to six matched presentation pairs."""
    budget=min(6,limit//2)
    base=copy.deepcopy(items[:max(1,limit-budget)])
    paired=[]
    for item in base[:min(budget,limit-len(base))]:
        fingerprint=hashlib.sha256(json.dumps({'source':item['source_file'],'scenes':item['scenes'],'voice':item.get('voice','af_heart')},sort_keys=True).encode()).hexdigest()[:16]
        item.update(pair_id='abppair-'+fingerprint,pair_primary_factor='fictional_presenter_opening_vs_graphics',pair_role='presenter' if item.get('presenter') else 'graphics')
        alternate=copy.deepcopy(item);alternate['concept_id']+='-alt';alternate['presenter']=not item.get('presenter',False);alternate['pair_role']='presenter' if alternate['presenter'] else 'graphics'
        paired.append(alternate)
    # Pair identities are explicit; publication timing remains observational.
    result=base+paired
    return result[:limit]
