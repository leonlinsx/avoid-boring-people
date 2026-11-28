"""Cheap editorial ordering of already admitted paragraphs, never admission.

Signals are explainable lexical proxies, not predicted engagement or model
judgments. Source rotation precedes this score; no passage is cut or rewritten.
"""
import re
from scripts.instagram_growth.autonomy import policy

VERSION = 'ABP-PASSAGE-RANK-1'


def evaluate(record):
    text = policy.clean(record['source_anchor']).casefold()
    units = policy.sentences(text)
    def has(pattern):return int(bool(re.search(pattern, text)))
    contrast = has(r'\b(but|though|neither|instead|unless|tension|tradeoff|not|until)\b')
    concrete = len(set(re.findall(r'\b(city|cities|house|rent|friends|friendship|community|group|membership|skills?|steps|diagram|options?|backup|product|customer|users?|database|databases|data|company|companies|startup)\b', text)))
    reason = has(r'\b(because|if|when|until|means|implies|likelihood|in order to|so that|which)\b')
    action = has(r'\b(decid\w*|choos\w*|choice|move|learn\w*|practice|effort|work on|building|test|priorities|steps|plan)\b')
    viewer = has(r'\b(you|your|people|life|friends|community|skills?|priorities|choice|options?)\b')
    # A source can pass the narrow factual compiler yet remain weak editorially:
    # unresolved essay references and acknowledgments are not useful payoffs.
    unresolved = has(r"\b(this|these|those)\b|\bwe've covered\b|\bi'd assume\b|\bseemingly\b")
    dimensions = {
        'curiosity': min(2, contrast + reason),
        'specificity': min(2, concrete),
        'counterintuitiveness': contrast,
        'practical_relevance': action + int(bool(action and reason)),
        'audience_relevance': viewer + int(bool(viewer and action)),
        'narrative_payoff': int(bool(reason)) + int(bool(reason and (len(units)>1 or contrast))),
    }
    return {'version': VERSION, 'dimensions': dimensions,
            'unresolved_context_penalty': 3*unresolved,
            'score': sum(dimensions.values())-3*unresolved,
            'interpretation': 'Editorial ordering only; not factual admission or predicted audience response.'}


def order(records, previous):
    """Greedy article/topic rotation; editorial merit breaks equally used ties."""
    from collections import Counter
    from scripts.instagram_growth.autonomy.renewal import script
    articles = Counter(script(m).get('source_file') for m in previous)
    topics = Counter(script(m).get('topic') for m in previous)
    remaining = list(records); result = []
    scores = {r['claim_id']: evaluate(r)['score'] for r in remaining}
    while remaining:
        record = min(remaining, key=lambda r: (articles[r['source_file']], topics[r['topic']],
                     -scores[r['claim_id']], r['source_file'], r['claim_id']))
        remaining.remove(record); result.append(record)
        articles[record['source_file']] += 1; topics[record['topic']] += 1
    return result


def comparison(evaluation, limit=6):
    """Replay frozen independent judgments; no model/API call or pass threshold."""
    records, rejected = policy.discover()
    ratings = {r['claim_id']: r for r in evaluation['ratings']}
    result = {'ranker': VERSION, 'accepted_source_paragraphs':len(records),
              'source_articles':len({r['source_url'] for r in records}),
              'rejected_paragraphs':len(rejected), 'top_k':limit,
              'evaluation':'Frozen blinded local-model opinions, not audience measurements.'}
    rankings = {'previous':sorted(records,key=lambda r:(r['source_file'],r['claim_id'])),
                'editorial':order(records,[])}
    for label, ranking in rankings.items():
        top = ranking[:limit]
        known = [ratings[r['claim_id']] for r in top if r['claim_id'] in ratings]
        dimensions = evaluation['dimensions']
        result[label] = {'claim_ids':[r['claim_id'] for r in top], 'rated':len(known),
                         'missing_ratings':len(top)-len(known),
                         'source_articles':len({r['source_url'] for r in top}),
                         'independent_standalone':sum(r['standalone'] for r in known),
                         'dimension_means':{d:sum(r['scores'][d] for r in known)/len(known) if known else None for d in dimensions},
                         'mean_editorial_rating':sum(sum(r['scores'].values())/len(dimensions) for r in known)/len(known) if known else None}
    return result


if __name__ == '__main__':
    import argparse
    import json
    from pathlib import Path
    parser = argparse.ArgumentParser(description='Observe-only editorial comparison; no inference, media, signing or publication')
    parser.add_argument('--evaluation',type=Path,default=Path('tests/fixtures/instagram/editorial-evaluation-v1.json'))
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    result = comparison(json.loads(args.evaluation.read_text()))
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
