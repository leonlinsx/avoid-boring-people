"""Finite owned sources, advancing clocks and synthetic media/Insights only."""
import copy
from datetime import datetime, timedelta, timezone
import json

import pytest

from scripts.instagram_growth.autonomy import admission as a, policy, promotion, renewal as r, worker
from scripts.instagram_growth import rolling_queue, scorecard
from tests.test_instagram_auto_policy import city, keys, metadata
from tests.test_instagram_autonomy_lifecycle import feed, store

NOW = datetime(2027, 1, 4, tzinfo=timezone.utc)
BASE = {'structure': 'question', 'layout': 'cards', 'audience': 'making_a_choice'}


def item(factor='compression', arm=1, control=None):
    return policy.compile_script(city(), creative={'protocol': r.PROTOCOL, 'factor': factor, 'arm': arm,
                                                   'evidence': None, 'control': control or BASE})


def draft(i):
    return {**i, 'script': i, 'video_sha256': policy.sha(i)}


@pytest.mark.parametrize('factor', list(r.AXES))
def test_new_treatment_of_published_claim_is_source_exact_and_reconstructable(factor):
    original = draft(city()); new = draft(item(factor))
    assert new['claim_id'] == new['source_claim_id'] == original['claim_id']
    policy.verify_script(new['script'])
    promotion.duplicate(new, [original])
    state = {'receipts': {original['concept_id']: {'status': 'published', 'published_at': (NOW-timedelta(days=8)).isoformat()}}}
    r.exposure(new, [original], state, now=NOW)
    assert new['treatment_id'] and new['creative_spec_hash']
    assert sum(BASE[k] != new['presentation_signature'][k] for k in BASE) == 1
    state['receipts'][original['concept_id']]['published_at'] = (NOW-timedelta(days=6)).isoformat()
    with pytest.raises(policy.Quarantine, match='cooldown'):r.exposure(new, [original], state, now=NOW)


def test_cosmetic_relabel_caption_voice_and_heavily_reworded_question_cannot_open_capacity():
    original = draft(city()); equivalent = draft(item(arm=0))
    with pytest.raises(policy.Quarantine, match='equivalent'):promotion.duplicate(equivalent, [original])
    old = copy.deepcopy(original)
    old['concept_id'] = 'renamed';old['script']['scenes'][0]['narration'] = 'How might one choose a suitable place to live?'
    old['script']['voice'] = 'af_nicole';old['caption'] = 'A different caption';old['script']['visual'] = 'statement'
    with pytest.raises(policy.Quarantine, match='equivalent'):promotion.duplicate(equivalent, [old])
    new = draft(item());new['video_sha256'] = original['video_sha256']
    with pytest.raises(policy.Quarantine, match='duplicate_video'):promotion.duplicate(new, [original])
    altered = draft(item());altered['script']['scenes'][0]['narration'] += ' Unsupported assertion.'
    with pytest.raises(policy.Quarantine, match='unbound'):promotion.duplicate(altered, [original])


@pytest.mark.parametrize('mutation', ['negation', 'omit', 'reorder', 'source_hash', 'identity', 'control'])
def test_source_and_protocol_mutations_never_pass(mutation):
    i = item()
    if mutation == 'negation':i['scenes'][1]['narration'] = i['scenes'][1]['narration'].replace('if you can', 'you can')
    if mutation == 'omit':i['source_sentences'].pop()
    if mutation == 'reorder':i['scenes'][0], i['scenes'][1] = i['scenes'][1], i['scenes'][0]
    if mutation == 'source_hash':i['source_sha256'] = '0'*64
    if mutation == 'identity':i['treatment_id'] = 'new-name'
    if mutation == 'control':i['template_parameters']['creative']['control'] = {**BASE, 'structure': 'payoff'}
    with pytest.raises(policy.Quarantine):policy.verify_script(i)


def test_v2_cannot_borrow_historical_signature_policy_and_identity_fields_are_bound(tmp_path, monkeypatch):
    key = keys(tmp_path, monkeypatch);i = item();m = a.admit(i, metadata(i), i['text'], key)
    assert a.verify_manifest(m) == m
    changed = copy.deepcopy(m);changed['treatment_id'] = 'renamed'
    with pytest.raises(policy.Quarantine, match='treatment_disagreement'):a.verify_manifest(a.seal(changed, key))
    for pd, rd in ((a.TYPE001_POLICY_DIGEST, a.TYPE001_RUNTIME_DIGEST),
                   (a.COMPACT001_POLICY_DIGEST, a.COMPACT001_RUNTIME_DIGEST),
                   (a.CREATIVE001_POLICY_DIGEST, a.CREATIVE001_RUNTIME_DIGEST)):
        changed = copy.deepcopy(m);changed['admission'].update(policy_digest=pd, runtime_digest=rd)
        with pytest.raises(policy.Quarantine, match='policy'):a.verify_manifest(a.seal(changed, key))
    legacy = city();old = a.admit(legacy, metadata(legacy), legacy['text'], key)
    old['admission'].update(policy_digest=a.TYPE001_POLICY_DIGEST, runtime_digest=a.TYPE001_RUNTIME_DIGEST)
    assert a.verify_manifest(a.seal(old, key))['script'] == legacy


def test_signed_reuse_promotes_queues_and_joins_real_measurement_schema(tmp_path, monkeypatch):
    # All transport/media are disposable fixtures; no GPU/Meta/provider call.
    key = keys(tmp_path, monkeypatch);i = item();m = a.admit(i, metadata(i), i['text'], key)
    old_i = city();old_meta = metadata(old_i);old_meta['sha256'] = 'b'*64
    old = a.admit(old_i, old_meta, old_i['text'], key)
    st, _ = store();now = datetime.now(timezone.utc)
    st.state['receipts'][old['concept_id']] = {'concept_id': old['concept_id'], 'status': 'published',
                                             'sha256': old['video_sha256'], 'published_at': (now-timedelta(days=8)).isoformat()}
    feed(m, key, monkeypatch)
    assert promotion.promote(st, [old], lambda _: None) == 1
    assert promotion.promote(st, [old], lambda _: pytest.fail('immutable promotion repeats')) == 0
    st.state.update(auto_canary_verified=True)
    assert promotion.eligible(st.state, 'enabled', legacy=[old]) == [m]
    queue = tmp_path/'queue';receipts = tmp_path/'receipts';queue.mkdir();receipts.mkdir()
    (queue/(m['concept_id']+'.json')).write_text(json.dumps(m))
    (receipts/(old['concept_id']+'.json')).write_text(json.dumps(st.state['receipts'][old['concept_id']]))
    chosen, reason = rolling_queue.choose(queue, receipts, now)
    assert reason == 'READY' and chosen == m
    st.state['receipts'][m['concept_id']] = {'status': 'published', 'published_at': now.isoformat()}
    st.state['observations'] = {m['concept_id']+'-24h': {'actual_age_hours': 24, 'metrics': {'reach': 150, 'shares': 2}}}
    report = scorecard.build(st.state, [old, m], now+timedelta(hours=25))
    assert report['renewable_creative']['published_this_week']['reused_source_claims'] == 1
    ep = report['renewable_creative']['episodes'][0]
    assert ep['winner'] is None and ep['arms']['treatment']['measurement_receipts'][0]['key'].endswith('-24h')
    assert len(ep['arms']['treatment']['missing_windows']) == 2
    assert report['followers']['net_new_followers_week'] is None
    st.state['receipts'][old['concept_id']]['published_at'] = (now-timedelta(days=1)).isoformat()
    assert promotion.eligible(st.state, 'enabled', legacy=[old]) == []


def test_finite_archive_continues_across_eight_weekly_budgets_then_saturates(monkeypatch):
    records, _ = policy.discover();monkeypatch.setattr(policy, 'discover', lambda: (records, []))
    state = {'account': 'avoidboringpeople', 'receipts': {}};history = [];weeks = [];snapshots = []
    for week in range(8):
        count = 0;reused = 0;old_claims = {m['claim_id'] for m in history}
        for day in range(7):
            now = NOW+timedelta(weeks=week, days=day)
            choices, _, _ = worker.candidates(state, history, experiments=True, graphics_only=True, now=now)
            # No new content, weekly prompt, episode counter or manual arm input.
            for n, i in enumerate(choices[:min(3, 21-count)]):
                r.exposure(i, history, state, now=now)
                policy.verify_script(i);promotion.duplicate(draft(i), history)
                reused += i['claim_id'] in old_claims
                history.append(draft(i));count += 1
                state['receipts'][i['concept_id']] = {'status': 'published', 'published_at': (now+timedelta(hours=n*4)).isoformat()}
        weeks.append((count, reused));snapshots.append({i['creative_trial']['episode_id'] for i in map(r.script, history)})
    assert all(0 < count <= 21 for count, _ in weeks)
    # The 28-day exposure cap can leave a week with only a deferred fresh claim.
    # Most later weeks must renew old claims; a quota is never a posting target.
    assert sum(reused > 0 for _, reused in weeks[1:]) >= 6
    assert len({m['claim_id'] for m in history}) <= len(records)
    assert len(history) > 4*len(records)
    assert snapshots[0] < snapshots[-1] and len(snapshots[-1]) > 20
    episodes = scorecard.renewable_results([],history,state,now)['episodes']
    completed = [ep for ep in episodes if ep['status']=='arm_complete']
    assert completed
    first_completion = min(max(r.instant(p['published_at']) for arm in ep['arms'].values()
                               for p in arm['publication_receipts']) for ep in completed)
    episode_starts = {}
    for m in history:
        eid=m['creative_trial']['episode_id'];when=r.instant(state['receipts'][m['concept_id']]['published_at'])
        episode_starts[eid]=min(when,episode_starts.get(eid,when))
    assert any(when>first_completion for when in episode_starts.values())
    executions = [(m['claim_id'], policy.sha(r.signature(m))) for m in history]
    assert len(set(executions)) == len(executions)
    # Inventing an episode ID/advancing time never reopens an exhausted spec.
    sample = records[0];all_specs = []
    from itertools import product
    for structure, layout, audience in product(*r.AXES.values()):
        # Use signed-shape metadata for planning only, never an admission.
        fake = draft(city());fake['script'] = {**fake['script'], 'claim_id': sample['claim_id'],
                       'template_parameters': {'creative': {'protocol': r.PROTOCOL, 'factor': 'compression', 'arm': int(structure=='payoff'),
                         'evidence': None, 'control': {'structure': 'question', 'layout': layout, 'audience': audience}}}}
        all_specs.append(fake)
    assert not r.options(sample, all_specs, {}, now=NOW+timedelta(days=365))


def test_qa_rejection_moves_to_other_treatments_and_pause_and_budget_still_hold(tmp_path, monkeypatch):
    records, _ = policy.discover();monkeypatch.setattr(policy, 'discover', lambda: ([records[0]], []))
    choices, _, _ = worker.renewable_candidates({}, [], now=NOW)
    assert choices
    rejected = {choices[0]['concept_id']}
    later, reasons, _ = worker.renewable_candidates({}, [], now=NOW, rejected=rejected)
    assert all(i['concept_id'] not in rejected for i in later)
    assert later or reasons  # Reduced supply is an honest outcome.
    (tmp_path/'PAUSE').write_text('owner hold')
    with pytest.raises(RuntimeError, match='PAUSE'):worker.check_pause(tmp_path, {'production_mode':'graphics_gpu'})
    budget = {'rendered':21};ledger = tmp_path/'budget.json'
    with pytest.raises(RuntimeError, match='budget'):worker.reserve_render(budget, 1, ledger)
    assert budget['rendered']==21 and not ledger.exists()
    next_week = {'rendered':0};worker.reserve_render(next_week, 1, ledger)
    assert json.loads(ledger.read_text())['rendered']==1
    run = tmp_path/'runs'/'fixture';run.mkdir(parents=True)
    worker.write(run/'failures.json',[{'concept_id':'failed-render','error':'CalledProcessError'},
                                     {'concept_id':'failed-qa','error':'Quarantine'}])
    assert worker.failed_concepts(tmp_path)=={'failed-render','failed-qa'}


def test_saturation_pending_legacy_dates_and_article_rotation():
    new = draft(item());old = draft(city())
    with pytest.raises(policy.Quarantine, match='cooldown'):r.exposure(new, [old], {}, now=NOW)
    others = [{**old, 'concept_id':'post-'+str(n), 'script':{**old['script'], 'claim_id':'other-'+str(n)}} for n in range(3)]
    state = {'receipts':{o['concept_id']:{'status':'published','published_at':(NOW-timedelta(days=2)).isoformat()} for o in others}}
    with pytest.raises(policy.Quarantine, match='article_7d'):r.exposure(new, others, state, now=NOW)
    repeats = [{**old, 'concept_id':'repeat-'+str(n)} for n in range(3)]
    state = {'receipts':{o['concept_id']:{'status':'published','published_at':(NOW-timedelta(days=8+n*8)).isoformat()} for n,o in enumerate(repeats)}}
    with pytest.raises(policy.Quarantine, match='28d'):r.exposure(new, repeats, state, now=NOW)
    topic_posts = [{**old, 'concept_id':'topic-'+str(n),
                    'script':{**old['script'],'claim_id':'other-'+str(n),'source_url':'article-'+str(n)}} for n in range(5)]
    state = {'receipts':{o['concept_id']:{'status':'published','published_at':(NOW-timedelta(days=2)).isoformat()} for o in topic_posts}}
    with pytest.raises(policy.Quarantine, match='topic_7d'):r.exposure(new, topic_posts, state, now=NOW)
    r.exposure(new, topic_posts[:4], state, now=NOW)


def test_incomplete_episode_rolls_forward_with_no_growth_winner():
    i = item();m = draft(i)
    state = {'account':'avoidboringpeople','receipts':{m['concept_id']:{'status':'published','published_at':NOW.isoformat()}}}
    record = policy.source_record(i['source_file'], i['source_anchor'])
    choices = r.options(record, [m], state, now=NOW+timedelta(days=15))
    assert choices and all(r.episode(record['topic'], c)!=i['creative_trial']['episode_id'] for c in choices)
    report = scorecard.renewable_results([], [m], state, NOW+timedelta(days=15))
    assert report['episodes'][0]['status']=='closed_incomplete_evidence' and report['episodes'][0]['winner'] is None


def test_replication_requires_the_same_topic_and_a_fresh_article(monkeypatch):
    source = policy.source_record(city()['source_file'], city()['source_anchor'])
    other = next(record for record in policy.discover()[0] if record['topic']!='city')
    monkeypatch.setattr(policy,'discover',lambda:([source,other],[]))
    frozen=item()['template_parameters']['creative']
    evidence={'topic':'city','source_articles':['https://leonlins.com/writing/another-article'],
              'production_parameters':{'creative':frozen}}
    slot={'experiment_bucket':'exploitation','allocation_evidence':evidence}
    monkeypatch.setattr(worker.allocation,'plan',lambda *args,**kwargs:{'slots':[slot],'planned_counts':{}})
    items,_,_=worker.renewable_candidates({},[],now=NOW)
    reused=[i for i in items if i['experiment_bucket']=='exploitation']
    assert len(reused)==1 and reused[0]['topic']=='city' and reused[0]['template_parameters']['creative']==frozen
    evidence['source_articles']=[source['source_url']]
    items,_,_=worker.renewable_candidates({},[],now=NOW)
    assert all(i['experiment_bucket']=='exploration' for i in items)


def test_control_and_treatment_freeze_secondary_variables_and_share_observations():
    for factor in r.AXES:
        control=item(factor,0);treatment=item(factor,1)
        assert all(control[k]==treatment[k] for k in ('voice','caption_words','caption_strategy','source_anchor'))
        assert control['creative_trial']['owned_site_campaign']==treatment['creative_trial']['owned_site_campaign']
        assert control['creative_trial']['episode_id']==treatment['creative_trial']['episode_id']
        assert r.comparable(draft(control),control['topic'],BASE)
    changed=city();changed['caption_strategy']='read_full_context'
    assert not r.comparable(changed,changed['topic'],BASE)
