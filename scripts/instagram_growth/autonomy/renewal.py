"""Source-exact creative episodes derived from immutable history, not a new store.

The graph is bounded by useful compiler-supported contrasts. Episode identities
do not replenish duplicate content: every claim/execution remains single-use.
"""
from datetime import datetime, timedelta, timezone
from itertools import product
from scripts.instagram_growth.autonomy import policy

PROTOCOL = 'ABP-CREATIVE-002'
AXES = {'compression': ('question', 'payoff'),
        'typography': ('cards', 'source_type'),
        'audience': ('making_a_choice', 'reassessing_an_earlier_choice')}
FIELDS = dict(zip(AXES, ('structure', 'layout', 'audience')))
PRIMARY_FIELDS = {**FIELDS, 'reflection': 'application'}
HYPOTHESES = {
    'compression': 'For {audience} viewers using {layout}, an attributed payoff and full explanation followed by an application question retain more attention than a diagnostic question before the explanation.',
    'typography': 'With {structure} narration for {audience} viewers, complete word-aligned source typography improves comprehension and qualified discovery over the existing graphics.',
    'audience': 'With {structure} narration and {layout}, an explicit invitation to revisit an earlier choice produces more qualified discovery than positioning the same perspective for a new choice.',
    'reflection': 'With {structure} narration and {layout} for {audience} viewers, asking for a boundary condition instead of asking for a follow produces more saves and qualified discovery. Classroom self-explanation evidence motivates this test; it does not establish Reel performance.',
}
MAX_POSTS = 3
COOLDOWN = timedelta(days=7)
EXPOSURE = timedelta(days=28)
STOP_AFTER = timedelta(days=14)
PLANNING_REUSE = timedelta(days=10)  # Spread three exposures across 28 days.


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.utcoffset() is None:raise policy.Quarantine('repetition_timestamp_missing_offset')
    return result.astimezone(timezone.utc)


def script(item):
    return item.get('script', item)


def config(value):
    if set(value) != {'protocol', 'factor', 'arm', 'evidence', 'control'}:
        raise policy.Quarantine('renewal_protocol_fields')
    if (value['protocol'] != PROTOCOL or value['factor'] not in HYPOTHESES
        or type(value['arm']) is not int or value['arm'] not in (0, 1) or value['evidence'] is not None):
        raise policy.Quarantine('renewal_protocol_treatment')
    control = value['control']
    if not isinstance(control, dict) or set(control) != set(FIELDS.values()):
        raise policy.Quarantine('renewal_control_fields')
    if any(control[FIELDS[f]] not in levels for f, levels in AXES.items()):
        raise policy.Quarantine('renewal_control_values')
    if value['factor'] in AXES and control[FIELDS[value['factor']]] != AXES[value['factor']][0]:
        raise policy.Quarantine('renewal_primary_variable')
    return value


def specification(value):
    value = config(value)
    if value['factor'] == 'reflection':
        return {**value['control'], **({'application': 'condition_check'} if value['arm'] else {})}
    return {**value['control'], FIELDS[value['factor']]: AXES[value['factor']][value['arm']]}


def compact(value):
    return bool(value and value.get('protocol') == PROTOCOL and specification(value)['structure'] == 'payoff')


def signature(item):
    """Ignore IDs, colors, caption wording, voice and equivalent hook rewrites.

    Source placement/repetition, whole-source typography, earlier-choice
    positioning and a spoken boundary-condition task distinguish executions.
    Caption-only CTA rewrites still do not create capacity.
    """
    s = script(item)
    if not s.get('scenes'):return None  # Unverifiable legacy execution: no reuse exception.
    value = s.get('template_parameters', {}).get('creative', {})
    if value.get('protocol') == PROTOCOL:return specification(value)
    factor, arm = value.get('factor'), value.get('arm')
    structure = ('payoff' if (factor == 'compression' and arm == 1) or
                 (factor == 'typography' and len(s.get('source_sentences', [])) == 1)
                 else 'repeated_payoff' if factor in ('hook', 'research') and arm == 1 or factor == 'compression' and arm == 0
                 else 'question')
    return {'structure': structure, 'layout': 'source_type' if s.get('visual') == 'source_type' else 'cards',
            'audience': 'reassessing_an_earlier_choice' if factor == 'audience' and arm == 1 else 'making_a_choice'}


def episode(topic, value):
    return 'episode-' + policy.sha({'protocol': PROTOCOL, 'topic': topic,
                                   'factor': value['factor'], 'control': value['control']})[:24]


def apply(item, value):
    from scripts.instagram_growth.autonomy import creative
    spec = specification(value)
    if item['presenter'] or item.get('reference_index') is not None:
        raise policy.Quarantine('renewal_owned_graphics_only')
    # Freeze all secondary production variables. Identity cannot authorize an
    # untested voice, arbitrary prose, a palette change or a new renderer.
    if (item['voice'], item['visual'], item['caption_words'], item['template_parameters']['hook']) != ('af_heart', 'cards', 5, 0):
        raise policy.Quarantine('renewal_secondary_variables')
    legacy = {'protocol': creative.PROTOCOL, 'factor': 'compression' if spec['structure'] == 'payoff' else 'baseline',
              'arm': 1 if spec['structure'] == 'payoff' else 0, 'evidence': None}
    item = creative.apply(item, legacy)
    # Freeze caption policy across structural arms too. The first beat follows
    # the primary narrative change; no simultaneous caption-CTA experiment.
    item['caption_strategy'] = 'source_question'
    item['creative_trial']['owned_site_campaign'] = None
    if spec['audience'] == 'reassessing_an_earlier_choice':
        if spec['structure'] == 'question':
            item['scenes'][0]['narration'] = 'Reconsidering ' + item['topic'] + '? ' + item['scenes'][0]['narration']
            item['scenes'][0]['headline'] = ('RECONSIDERING ' + item['topic'] + '?').upper()
        else:
            item['scenes'][2] = {'narration': 'When revisiting an earlier choice, which condition would matter most?',
                                 'headline': 'REVISIT AN EARLIER CHOICE', 'detail': 'WHICH CONDITION MATTERS MOST?'}
        item['audience'].update(position=spec['audience'], intended_viewer='Someone reassessing ' + creative.JOBS.get(item['topic'], item['topic']),
                                specific_problem='An earlier choice may need revisiting: ' + item['topic'])
    item['visual'] = spec['layout']
    if spec.get('application') == 'condition_check':
        item['scenes'][3] = {
            'narration': 'Before your next choice, name a condition that would make this perspective less useful.',
            'headline': 'WHERE WOULD THIS NOT APPLY?', 'detail': 'NAME A CONDITION BEFORE DECIDING'}
        item['cta_type'] = 'reflect'
    eid = episode(item['topic'], value)
    h = policy.sha({'protocol': PROTOCOL, 'specification': spec, 'voice': item['voice'], 'caption_words': 5,
                    'caption_strategy': item['caption_strategy']})
    tid = 'treatment-' + policy.sha({'claim': item['claim_id'], 'specification': h})[:24]
    pair = 'autopair-' + policy.sha({'treatment': tid})[:20]
    item.update(source_claim_id=item['claim_id'], treatment_id=tid, creative_spec_hash=h,
                presentation_signature=spec, pair_id=pair, concept_id='abpa-' + policy.sha({'pair': pair, 'presenter': False})[:24])
    item['creative_trial'] = {**item['creative_trial'], 'protocol': PROTOCOL, 'factor': value['factor'],
                             'arm': 'treatment' if value['arm'] else 'control', 'episode_id': eid,
                             'hypothesis': HYPOTHESES[value['factor']].format(**{k:v.replace('_',' ') for k,v in value['control'].items()}), 'primary_variable': PRIMARY_FIELDS[value['factor']],
                             'control': value['control'], 'specification': spec, 'unit': 'distinct_owned_claim_graphics_only',
                             'stop_conditions': {'max_distinct_claims_per_arm': MAX_POSTS, 'days_after_first_publication': 14,
                                                 'unsafe_or_saturated_supply': 'defer; never relax QA'},
                             'measurement_receipt_keys': ['concept_id-24h', 'concept_id-48h', 'concept_id-7d'],
                             'limitations': 'Existing control observations may be reused, never regenerated. Incomplete evidence ends an episode without a growth winner.'}
    item['template_parameters']['creative'] = value
    item['experiment_hypothesis'] = eid + ' / ' + value['factor'] + ' / ' + item['creative_trial']['arm']
    return item


def comparable(item, topic, spec):
    s = script(item)
    return (s.get('topic') == topic and not s.get('presenter') and s.get('voice') == 'af_heart'
            and s.get('caption_words') == 5 and s.get('caption_strategy', 'source_question') == 'source_question'
            and s.get('visual') == spec['layout'] and s.get('template_parameters', {}).get('hook') == 0
            and signature(item) == spec)


def claims_for(previous, topic, spec):
    # Only the frozen secondary variables qualify as observational controls.
    return {script(m)['claim_id'] for m in previous if comparable(m, topic, spec)}


def options(record, previous, state, *, now=None):
    """Generate new single-variable episodes against prior presentation contexts.

    No episode counter to reset. Reused controls retain their original receipt;
    new contexts become possible as earlier treatments enter immutable history.
    """
    now = now or datetime.now(timezone.utc)
    review = state.get('weekly_review', {})
    try:fresh = now - timedelta(days=8) <= instant(review['created_at']) <= now + timedelta(minutes=5)
    except (KeyError, ValueError, TypeError):fresh = False
    priorities = review.get('creative_learning', {}).get('factor_priority', []) if fresh else []
    factors = list(dict.fromkeys([f for f in priorities if f in HYPOTHESES] + list(HYPOTHESES)))
    used = [signature(m) for m in previous if script(m).get('claim_id') == record['claim_id']]
    choices = []
    for levels in product(*AXES.values()):
        control = dict(zip(FIELDS.values(), levels))
        for factor in factors:
            if factor in AXES and control[FIELDS[factor]] != AXES[factor][0]:continue
            if len(record['source_sentences']) == 1 and (control['structure'] != 'payoff' or factor == 'compression'):continue
            base = {'protocol': PROTOCOL, 'factor': factor, 'arm': 0, 'evidence': None, 'control': control}
            target = specification({**base, 'arm': 1})
            counts = [len(claims_for(previous, record['topic'], spec)) for spec in (control, target)]
            complexity = sum(AXES[f].index(control[FIELDS[f]]) for f in AXES)
            # Build new contexts from previously verified controls, rather than
            # starting at arbitrary corners of a Cartesian permutation space.
            root = {'structure': 'payoff' if len(record['source_sentences']) == 1 else 'question',
                    'layout': 'cards', 'audience': 'making_a_choice'}
            if control != root and not counts[0]:continue
            eid = episode(record['topic'], base)
            members = [m for m in previous if script(m).get('creative_trial', {}).get('episode_id') == eid]
            published = [state.get('receipts', {}).get(m['concept_id'], {}) for m in members]
            dates = [instant(r['published_at']) for r in published if r.get('status') == 'published']
            if dates and now - min(dates) >= STOP_AFTER:continue
            for arm, spec in enumerate((control, target)):
                if counts[arm] >= MAX_POSTS or spec in used:continue
                # Prefer continuing an existing episode, then controls supported
                # by actual history, balanced arms, and feedback-informed axes.
                rank = (not bool(members), -min(counts[0], MAX_POSTS), factors.index(factor),
                        complexity, sum(counts), counts[arm], policy.sha(control), arm)
                choices.append((rank, {**base, 'arm': arm}))
    return [value for _, value in sorted(choices, key=lambda x: x[0])]


def exposure(candidate, previous, state, *, now=None):
    """Admission and publication use the same conservative repeat windows.

    An unpublished reservation occupies its exposure window until it publishes;
    missing legacy dates fail closed for claim reuse, never assume old age.
    """
    now = now or datetime.now(timezone.utc)
    recent = []
    claim = script(candidate).get('claim_id')
    for old in previous:
        if old['concept_id'] == candidate['concept_id']:continue
        s = script(old);r = state.get('receipts', {}).get(old['concept_id'], {})
        if r.get('status') == 'confirmed_unpublished':continue
        stamp = r.get('published_at') if r.get('status') == 'published' else None
        when = instant(stamp) if stamp else now
        same = s.get('claim_id', old.get('claim_id')) == claim
        if same and now - when < COOLDOWN:raise policy.Quarantine('claim_cooldown_or_pending')
        if now - when < EXPOSURE:recent.append((s, same, when))
    if sum(same for _, same, _ in recent) >= 3:raise policy.Quarantine('claim_28d_saturation')
    article = script(candidate).get('source_url');topic = script(candidate).get('topic')
    if sum(s.get('source_url') == article and now - when < COOLDOWN for s, _, when in recent) >= 3:
        raise policy.Quarantine('article_7d_saturation')
    if topic and sum(s.get('topic') == topic and now - when < COOLDOWN for s, _, when in recent) >= 5:
        raise policy.Quarantine('topic_7d_saturation')


def planning_spacing(record, previous, state, *, now):
    """Avoid spending all three claim exposures in the first three weeks.

    A conservative planner interval does not change the seven-day admission /
    publication contract or postpone already admitted inventory. Pending and
    ambiguous reservations continue to be handled by exposure(), unchanged.
    """
    for old in previous:
        if script(old).get('claim_id') != record['claim_id']:continue
        receipt = state.get('receipts', {}).get(old['concept_id'], {})
        if receipt.get('status') == 'published':
            if not receipt.get('published_at'):raise policy.Quarantine('claim_cooldown_or_pending')
            if now-instant(receipt['published_at']) < PLANNING_REUSE:
                raise policy.Quarantine('claim_planning_spacing')


if __name__ == '__main__':
    import argparse
    import json
    from pathlib import Path
    import subprocess
    from scripts.instagram_growth.autonomy import admission, worker
    from scripts.instagram_growth import scorecard
    parser = argparse.ArgumentParser(description='Planning-only source reuse proof; no GPU, signing, hosting or publication')
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--published-only', action='store_true', help='Replay only published claims/history, excluding queued inventory; never live eligibility')
    parser.add_argument('--at', help='Hypothetical timestamp for cooldown replay; never live eligibility')
    args = parser.parse_args()
    state = json.loads(args.state.read_text())
    if state.get('account') != 'avoidboringpeople':parser.error('wrong account')
    manifests = scorecard.load_manifests('scripts/instagram_growth/approved') + [x['manifest'] for x in state.get('auto_inventory', {}).values()]
    for m in manifests:
        if m.get('review_status') == 'AUTO_ADMITTED':admission.verify_manifest(m)
    if args.published_only:
        manifests = [m for m in manifests if state.get('receipts', {}).get(m['concept_id'], {}).get('status') == 'published']
    now = instant(args.at) if args.at else datetime.now(timezone.utc)
    published_claims = {m.get('claim_id') for m in manifests if state.get('receipts', {}).get(m['concept_id'], {}).get('status') == 'published'}
    items, quarantined, allocation = worker.renewable_candidates(state, manifests, now=now, claim_ids=published_claims if args.published_only else None)
    result = {'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(), 'protocol': PROTOCOL,
              'mode': 'historical_replay_not_live_eligibility' if args.at or args.published_only else 'current_inventory_planning_only',
              'as_of': now.isoformat(), 'media_generation': 'NOT_RUN', 'hosting': 'NOT_RUN', 'publication': 'NOT_RUN',
              'eligible': len(items), 'reusing_published_claims': sum(i['claim_id'] in published_claims for i in items),
              'allocation': allocation['planned_counts'], 'items': items,
              'rejections': {reason: sum(q.get('reason') == reason for q in quarantined) for reason in sorted({q['reason'] for q in quarantined if 'reason' in q})}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'items'}))
