"""Selection cannot confer admission; new tasks cannot borrow old signatures."""
import copy
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest

from scripts.instagram_growth.autonomy import editorial, policy, renewal, promotion, admission
from scripts.instagram_growth import scorecard
from tests.test_instagram_auto_policy import city, keys, metadata

BASE = {'structure':'question','layout':'cards','audience':'making_a_choice'}


def reflection(arm=1, control=None):
    return policy.compile_script(city(),creative={'protocol':renewal.PROTOCOL,'factor':'reflection',
         'arm':arm,'evidence':None,'control':control or BASE})


def test_protected_main_v2_compiler_vectors_remain_exact():
    release=json.loads(Path('tests/fixtures/instagram/renewal-v2-release.json').read_text())
    records={r['claim_id']:r for r in policy.discover()[0]}
    for vector in release['vectors']:
        rebuilt=policy.compile_script(records[vector['claim_id']],creative=vector['config'])
        assert policy.sha(rebuilt)==vector['script_sha256']


def test_editorial_has_six_explainable_dimensions_and_cannot_admit_source():
    records,_=policy.discover()
    for record in records:
        result=editorial.evaluate(record)
        assert set(result['dimensions'])=={'curiosity','specificity','counterintuitiveness',
                'practical_relevance','audience_relevance','narrative_payoff'}
        assert all(0<=value<=2 for value in result['dimensions'].values())
        assert result['score']==sum(result['dimensions'].values())-result['unresolved_context_penalty']
    # Attractive text with changed source is never an admission shortcut.
    changed=copy.deepcopy(records[0]);changed['source_anchor']='Choosing a city is easy because you can always move.'
    assert editorial.evaluate(changed)['score']>0
    with pytest.raises(policy.Quarantine):policy.compile_script(changed)


def test_editorial_rotation_and_input_permutation_stability():
    records,_=policy.discover();before=copy.deepcopy(records)
    ranked=editorial.order(records,[])
    assert ranked==editorial.order(list(reversed(records)),[])
    assert records==before and {r['claim_id'] for r in ranked}=={r['claim_id'] for r in records}
    assert len({r['source_file'] for r in ranked[:12]})==12
    # Even the highest merit cannot outrank an unexposed article.
    history=[{'script':ranked[0]}]*4
    assert editorial.order(records,history)[0]['source_file']!=ranked[0]['source_file']


def test_spoken_condition_task_is_one_variable_and_not_a_caption_relabel():
    control=reflection(0);treatment=reflection()
    assert treatment['scenes'][:3]==control['scenes'][:3]
    assert treatment['source_anchor']==control['source_anchor']
    assert treatment['voice']==control['voice'] and treatment['caption_words']==control['caption_words']
    assert treatment['presentation_signature']=={**BASE,'application':'condition_check'}
    assert control['presentation_signature']==BASE
    assert control['creative_trial']['episode_id']==treatment['creative_trial']['episode_id']
    assert treatment['cta_type']=='reflect'
    policy.verify_script(treatment)
    original={**control,'script':control,'video_sha256':'control'}
    new={**treatment,'script':treatment,'video_sha256':'treatment'}
    promotion.duplicate(new,[original])
    with pytest.raises(policy.Quarantine,match='duplicate_video'):
        promotion.duplicate({**new,'video_sha256':'control'},[original])
    mutated=copy.deepcopy(treatment);mutated['scenes'][3]['narration']='Follow for another perspective.'
    with pytest.raises(policy.Quarantine,match='unbound'):policy.verify_script(mutated)
    equivalent={**original,'concept_id':'different-name','video_sha256':'different-bytes','caption':'Please reflect'}
    with pytest.raises(policy.Quarantine,match='equivalent'):promotion.duplicate(equivalent,[original])


def test_reflection_is_selected_after_finite_old_arms_without_resetting_history():
    from itertools import product
    history=[]
    baseline=reflection(0)
    history.append({**baseline,'script':baseline,'video_sha256':policy.sha(baseline)})
    for levels in product(*renewal.AXES.values()):
        control=dict(zip(renewal.FIELDS.values(),levels))
        for factor in renewal.AXES:
            if control[renewal.FIELDS[factor]]!=renewal.AXES[factor][0]:continue
            cfg={'protocol':renewal.PROTOCOL,'factor':factor,'arm':1,'evidence':None,'control':control}
            i=policy.compile_script(city(),creative=cfg)
            history.append({**i,'script':i,'video_sha256':policy.sha(i)})
    choices=renewal.options(city(),history,{})
    assert choices and all(c['factor']=='reflection' and c['arm']==1 for c in choices)
    i=policy.compile_script(city(),creative=choices[0]);promotion.duplicate({**i,'script':i,'video_sha256':'new'},history)
    now=datetime.now(timezone.utc)
    state={'receipts':{m['concept_id']:{'status':'published','published_at':(now-timedelta(days=90)).isoformat()} for m in history}}
    renewal.exposure(i,history,state,now=now)
    with pytest.raises(policy.Quarantine,match='cooldown'):renewal.exposure(i,history,{},now=now)


def test_old_release_signature_cannot_authorize_new_spoken_task(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch)
    for i in (reflection(),reflection(0)):
        m=admission.admit(i,metadata(i),i['text'],key)
        assert admission.verify_manifest(m)==m
        m['admission'].update(policy_digest=admission.RENEWAL002_POLICY_DIGEST,runtime_digest=admission.RENEWAL002_RUNTIME_DIGEST)
        with pytest.raises(policy.Quarantine,match='policy'):admission.verify_manifest(admission.seal(m,key))
    frozen=json.loads(Path('tests/fixtures/instagram/renewal-v2-release.json').read_text())['vectors'][0]
    old=policy.compile_script(city(),creative=frozen['config'])
    m=admission.admit(old,metadata(old),old['text'],key)
    m['admission'].update(policy_digest=admission.RENEWAL002_POLICY_DIGEST,runtime_digest=admission.RENEWAL002_RUNTIME_DIGEST)
    assert admission.verify_manifest(admission.seal(m,key))['script']==old
    changed=copy.deepcopy(m);changed['cta_type']='reflect'
    with pytest.raises(policy.Quarantine,match='cta'):admission.verify_manifest(admission.seal(changed,key))


def test_weekly_review_proposes_new_task_without_claiming_outcomes():
    review=scorecard.creative_learning([])
    assert 'typography' in review['factor_priority'] and 'reflection' in review['factor_priority']
    assert review['observed_posts']==0
    assert 'no growth winner' in review['effect']
    assert all('{' not in h['test'] for h in review['hypotheses'])


def test_planning_spreads_exposures_without_rewriting_publication_cooldown():
    now=datetime.now(timezone.utc);old=reflection(0);new=reflection()
    history=[{**old,'script':old,'video_sha256':'old'}]
    state={'receipts':{old['concept_id']:{'status':'published','published_at':(now-timedelta(days=8)).isoformat()}}}
    renewal.exposure(new,history,state,now=now)  # Existing contract remains seven days.
    with pytest.raises(policy.Quarantine,match='planning_spacing'):
        renewal.planning_spacing(new,history,state,now=now)
    state['receipts'][old['concept_id']]['published_at']=(now-timedelta(days=10)).isoformat()
    renewal.planning_spacing(new,history,state,now=now)


def test_one_additional_owned_relationship_paragraph_keeps_complete_context(tmp_path,monkeypatch):
    path=Path('src/content/blog/2020_02_26_time/index.md')
    anchor=next(p for p in path.read_text().split('\n\n') if p.startswith('You want as much time as possible'))
    record=policy.source_record(path,anchor)
    assert record['topic']=='relationships'
    compiled=policy.compile_script(record)
    policy.verify_script(compiled)
    assert 'If you\'re not making the time' in compiled['text']
    assert policy.clean(anchor)==' '.join(s['narration'] for s in compiled['scenes'][1:3])
    truncated=anchor.split('. ')[0]+'.'
    with pytest.raises(policy.Quarantine,match='complete_source_paragraph'):policy.source_record(path,truncated)
    quotation=next(p for p in path.read_text().split('\n\n') if p.startswith('> “You have'))
    with pytest.raises(policy.Quarantine):policy.source_record(path,quotation)
    changed=copy.deepcopy(compiled)
    changed['scenes'][2]['narration']=changed['scenes'][2]['narration'].replace('not making','making')
    with pytest.raises(policy.Quarantine):policy.verify_script(changed)
    key=keys(tmp_path,monkeypatch)
    manifest=admission.admit(compiled,metadata(compiled),compiled['text'],key)
    assert admission.verify_manifest(manifest)==manifest
    for pd,rd in ((admission.RENEWAL002_POLICY_DIGEST,admission.RENEWAL002_RUNTIME_DIGEST),
                  (admission.TYPE001_POLICY_DIGEST,admission.TYPE001_RUNTIME_DIGEST),
                  (admission.COMPACT001_POLICY_DIGEST,admission.COMPACT001_RUNTIME_DIGEST),
                  (admission.CREATIVE001_POLICY_DIGEST,admission.CREATIVE001_RUNTIME_DIGEST),
                  (admission.LEGACY_POLICY_DIGEST,admission.LEGACY_RUNTIME_DIGEST)):
        old=copy.deepcopy(manifest);old['admission'].update(policy_digest=pd,runtime_digest=rd)
        with pytest.raises(policy.Quarantine,match='policy'):admission.verify_manifest(admission.seal(old,key))
