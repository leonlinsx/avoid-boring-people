"""Initial 60/25/15 allocation; replicated attention is not follower causality."""
from math import floor
import copy
import hashlib
import json

WEIGHTS = {'exploration': .60, 'exploitation': .25, 'control': .15}


def plan(count, state):
    candidates = [x for x in state.get('weekly_review', {}).get('replication_candidates', [])
                  if x.get('replication_eligible') is True and len(set(x.get('encouraging_source_articles', []))) >= 2 and x.get('n_reels', 0) >= 2
                  and x.get('reach', 0) >= 200 and (x.get('shares_per_1000_reached') or 0) > 0]
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
    return {'weights': WEIGHTS, 'planned_counts': quotas, 'slots': slots,
            'policy': 'Initial experimental weights; minimum reach and multi-article replication required; never auto-approve.'}


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
    # Counterbalance which presentation is encountered first across pairs.
    result=base+paired
    return result[:limit]
