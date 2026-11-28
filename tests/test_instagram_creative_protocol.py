"""Synthetic transport/media fixtures; never evidence of real public performance."""
import copy
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path

import pytest

from scripts.instagram_growth.autonomy import admission as a,policy,creative,research,worker,promotion
from scripts.instagram_growth import scorecard
from tests.test_instagram_auto_policy import city,keys,metadata
from tests.test_instagram_outlier_research import live_receipt

NOW=datetime(2026,11,26,12,tzinfo=timezone.utc)


def treatment(factor='hook',arm=1,evidence=None):
    return {'protocol':creative.PROTOCOL,'factor':factor,'arm':arm,'evidence':evidence}


def item(factor='hook',arm=1,**kwargs):
    old=city();source=policy.source_record(old['source_file'],old['source_anchor'])
    return policy.compile_script(source,creative=treatment(factor,arm,kwargs.pop('evidence',None)),**kwargs)




def test_genuine_published_v1_receipt_survives_without_resigning_or_mutating():
    m=json.loads(Path('tests/fixtures/instagram/published-auto-v1.json').read_text())
    original=copy.deepcopy(m)
    assert a.verify_manifest(m)==original
    assert m['admission']['runtime_digest']==a.LEGACY_RUNTIME_DIGEST
    assert m['admission']['policy_digest']==a.LEGACY_POLICY_DIGEST


@pytest.mark.parametrize('mode',['unknown_runtime','mixed_policy','new_creative'])
def test_legacy_exception_is_one_frozen_digest_pair_and_never_new_treatments(tmp_path,monkeypatch,mode):
    key=keys(tmp_path,monkeypatch);i=item() if mode=='new_creative' else city()
    m=a.admit(i,metadata(i),i['text'],key)
    m['admission'].update(policy_digest=a.LEGACY_POLICY_DIGEST,runtime_digest=a.LEGACY_RUNTIME_DIGEST)
    if mode=='unknown_runtime':m['admission']['runtime_digest']='0'*64
    if mode=='mixed_policy':m['admission']['policy_digest']=policy.policy_digest()
    with pytest.raises(policy.Quarantine,match='policy'):a.verify_manifest(a.seal(m,key))


@pytest.mark.parametrize('factor',['audience','hook','caption'])
def test_single_factor_keeps_complete_owned_claim_and_explicit_audience(factor):
    control=item(factor,0);changed=item(factor,1)
    for i in (control,changed):
        assert policy.verify_script(i)['source_fidelity']=='EXACT_COMPLETE_PARAGRAPH'
        assert ' '.join(s['narration'] for s in i['scenes'][1:3])==policy.clean(i['source_anchor'])
        assert all(i['audience'][k] for k in ('intended_viewer','specific_problem','promised_payoff'))
        assert 'if you can' in i['text']
    if factor=='audience':
        assert control['audience']['position']!=changed['audience']['position']
        assert 'Reconsidering' in changed['scenes'][0]['narration']
    elif factor=='hook':
        assert control['hook_structure']=='diagnostic_question'
        assert changed['hook_structure']=='attributed_source_first'
        assert changed['source_sentences'][0] in changed['scenes'][0]['narration']
        assert changed['scenes'][0]['narration'].startswith('Leon Lin on city:')
    else:
        assert control['text']==changed['text']
        assert creative.caption(control)!=creative.caption(changed)
        assert 'Which part' in creative.caption(control) and 'full perspective' in creative.caption(changed)
        assert 'profile link' not in creative.caption(changed)


def test_new_baseline_preserves_control_copy_and_attributes():
    old=city();new=item('baseline',0)
    for field in ('scenes','voice','visual','caption_words','text'):assert old[field]==new[field]
    expected=old['scenes'][0]['narration']+'\n\nLeon Lin’s perspective: '+old['source_url']+'\n\nAI-generated narration. Original graphics.'
    assert creative.caption(new)==expected


def test_experiment_does_not_create_a_duplicate_exception():
    control=item('hook',0);changed=item('hook',1)
    with pytest.raises(policy.Quarantine,match='repetitive_claim'):
        promotion.duplicate({**changed,'video_sha256':'new' },[{**control,'video_sha256':'old'}])
    other=item('hook',0,presenter=True)
    assert other['pair_id']==control['pair_id'] and other['text']==control['text']
    assert other['audience']==control['audience'] and other['creative_trial']==control['creative_trial']
    promotion.duplicate({**other,'video_sha256':'paired'},[{**control,'video_sha256':'old'}])


@pytest.mark.parametrize('field',['audience','caption','creative_trial','research_origin'])
def test_signed_creative_metadata_and_caption_must_match_reconstruction(tmp_path,monkeypatch,field):
    key=keys(tmp_path,monkeypatch);i=item();m=a.admit(i,metadata(i),i['text'],key)
    assert a.verify_manifest(m)==m
    if field in ('audience','creative_trial'):m[field]={'invented':'unbound'}
    else:m[field]+=' arbitrary material'
    with pytest.raises(policy.Quarantine,match='disagreement'):a.verify_manifest(a.seal(m,key))


def test_finite_parallel_trials_count_claim_pairs_not_independent_format_posts():
    previous=[];counts={}
    for n in range(40):
        record={'topic':'city','source_url':'https://leonlins.com/writing/block'+str(n%2)}
        c=creative.choose(record,{'experiment_bucket':'exploration'},previous,{})
        if c['factor']=='baseline':continue
        counts[c['factor'],c['arm']]=counts.get((c['factor'],c['arm']),0)+1
        previous.append({'claim_id':str(n),'source_url':record['source_url'],'template_parameters':{'creative':c}})
    assert counts=={(f,arm):3 for f in ('audience','hook','caption','compression') for arm in (0,1)}
    assert creative.choose({'topic':'city','source_url':'new'}, {'experiment_bucket':'control'},[],{})==treatment('baseline',0)
    assert not creative.has_capacity(treatment('hook',1),previous)


def test_disabled_research_and_experiments_preserve_candidate_controls(monkeypatch):
    original=worker.candidates({'account':'avoidboringpeople'},[])
    monkeypatch.setattr(research,'eligible',lambda *a,**k:pytest.fail('disabled experiment must not collect/select research'))
    assert worker.candidates({'account':'avoidboringpeople'},[],experiments=False,research_cycle={'poison':'ignored'})==original


def test_signed_fixture_is_reproducible_but_never_live_admissible(tmp_path,monkeypatch):
    fixture=research.fixture();receipt=fixture['receipts'][-1]
    facts=research.validate_receipt(receipt,now=NOW)
    assert facts['verified_relative_outlier'] and facts['relative_outlier_ratio']>=3
    assert facts['shadow_eligible'] and not facts['live_eligible']
    key=keys(tmp_path,monkeypatch);i=item('research',1,evidence=receipt)
    with pytest.raises(policy.Quarantine,match='fixture'):a.admit(i,metadata(i),i['text'],key)
    forged=copy.deepcopy(receipt);forged['mode']='live'
    with pytest.raises(policy.Quarantine,match='signature'):research.validate_receipt(forged,now=NOW)
















def test_weekly_attention_comparison_does_not_double_count_pairs_or_declare_growth():
    now=NOW+timedelta(days=1);i=item();other=item(presenter=True)
    manifests=[{'concept_id':x['concept_id'],'claim_id':x['claim_id'],'script':x,'source_url':x['source_url'],
                'voice':x['voice'],'pair_id':x['pair_id'],'pair_role':x['pair_role'],'creative_format':'presenter' if x['presenter'] else 'graphics'} for x in (i,other)]
    state={'account':'avoidboringpeople','receipts':{m['concept_id']:{'status':'published','published_at':(now-timedelta(days=7)).isoformat()} for m in manifests},
           'observations':{m['concept_id']+'-7d':{'actual_age_hours':168,'metrics':{'reach':100000,'shares':1000}} for m in manifests}}
    report=scorecard.build(state,manifests,now)
    comparison=report['creative_experiments'][0]['comparisons'][-1]
    assert comparison['arms']['treatment']['eligible_posts']==2
    assert comparison['arms']['treatment']['distinct_claims']==1 and comparison['winner'] is None
    assert report['recommendation']=='ADJUST' and report['followers']['net_new_followers_week'] is None
    assert 'qualified_owned_site_outcomes' in scorecard.markdown(report)


def test_source_first_hook_keeps_the_independent_audio_qualification_gate():
    i=item();m=metadata(i)
    assert a.qa_check(i,m,i['text'])['status']=='PASS'
    with pytest.raises(policy.Quarantine,match='qualification'):a.qa_check(i,m,i['text'].replace('if you can','you can'))


def test_live_research_fixture_transport_can_inform_only_owned_source_material(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);receipt=live_receipt(key)
    i=item('research',1,evidence=receipt)
    m=a.admit(i,metadata(i),i['text'],key)
    assert a.verify_manifest(m)==m and m['research_origin']=='viral_outlier_informed'
    assert m['script']['audience']['intended_viewer']
    receipt['topic']='learning';receipt=a.seal(receipt,key)
    with pytest.raises(policy.Quarantine,match='topic_mismatch'):item('research',1,evidence=receipt)


def test_previously_reserved_experimental_partner_keeps_its_frozen_treatment(monkeypatch):
    original=item('hook',1);record=policy.source_record(original['source_file'],original['source_anchor'])
    monkeypatch.setattr(policy,'discover',lambda:([record],[]));monkeypatch.setattr(policy,'REFERENCE_INDICES',())
    candidates,_,_=worker.candidates({'account':'avoidboringpeople'},[{**original,'video_sha256':'prior'}],experiments=True)
    assert len(candidates)==1 and candidates[0]['presenter'] is True
    assert candidates[0]['pair_id']==original['pair_id'] and candidates[0]['text']==original['text']
    assert candidates[0]['creative_trial']==original['creative_trial']


def test_follower_backed_replication_copies_the_new_structure_not_just_legacy_hook_number(monkeypatch):
    from tests.test_instagram_feedback_loop import review
    records,_=policy.discover();source=policy.source_record(city()['source_file'],city()['source_anchor'])
    other=next(r for r in records if r['source_file']<source['source_file'] and r['topic']!='city')
    monkeypatch.setattr(policy,'discover',lambda:([other,source],[]));monkeypatch.setattr(policy,'REFERENCE_INDICES',())
    r=review();r['replication_candidates'][0]['production_parameters']['creative']=treatment()
    candidates,_,_=worker.candidates({'weekly_review':r},[],experiments=True)
    copied=[i for i in candidates if i['experiment_bucket']=='exploitation']
    assert len(copied)==2 and all(i['hook_structure']=='attributed_source_first' for i in copied)


def test_recovery_children_never_inherit_the_separate_research_credential(tmp_path,monkeypatch):
    import os,sys
    from types import SimpleNamespace
    key=keys(tmp_path,monkeypatch);root=tmp_path/'state';config=tmp_path/'config.json'
    config.write_text(json.dumps({'root':str(root),'enabled':True,'signing_key':str(key),'creative_experiments':True,'research_enabled':True,'research_creators':[],'validated_gpu_workload_digest':worker.gpu_workload_digest()}))
    monkeypatch.setenv('ABP_AUTO_CONFIG',str(config));monkeypatch.delenv('CREDENTIALS_DIRECTORY',raising=False)
    monkeypatch.setenv('ABP_RESEARCH_META_TOKEN','fixture-read-only');monkeypatch.setenv('ABP_RESEARCH_META_USER_ID','12345678')
    monkeypatch.setattr(worker.requests,'get',lambda *a,**k:SimpleNamespace(raise_for_status=lambda:None,json=lambda:{'account':'avoidboringpeople','auto_canary_verified':True,'receipts':{}}))
    monkeypatch.setattr(worker.scorecard,'load_manifests',lambda *a:[])
    monkeypatch.setattr(worker,'candidates',lambda *a,**k:([],[],{'planned_counts':{'exploration':24,'exploitation':10,'control':6}}))
    events=[]
    def recover(*args,**kwargs):
        assert 'ABP_RESEARCH_META_TOKEN' not in os.environ and 'ABP_RESEARCH_META_USER_ID' not in os.environ
        events.append('recovery');return []
    def collect(*args,**kwargs):
        assert kwargs['token']=='fixture-read-only' and kwargs['user_id']=='12345678'
        assert 'ABP_RESEARCH_META_TOKEN' not in os.environ
        events.append('research');return {'status':'unavailable','receipts':[]}
    monkeypatch.setattr(worker,'recover',recover);monkeypatch.setattr(research,'collect',collect)
    monkeypatch.setattr(worker,'require_idle_gpu',lambda *a:pytest.fail('no eligible source, no GPU'))
    monkeypatch.setattr(sys,'argv',['worker','--limit','1']);worker.main()
    assert events==['recovery','research']


def test_graphics_experiment_planning_never_reserves_a_presenter(monkeypatch):
    original=item('hook',1);record=policy.source_record(original['source_file'],original['source_anchor'])
    monkeypatch.setattr(policy,'discover',lambda:([record],[]));monkeypatch.setattr(policy,'REFERENCE_INDICES',())
    candidates,_,_=worker.candidates({'account':'avoidboringpeople'},[],experiments=True,graphics_only=True)
    assert len(candidates)==1 and not candidates[0]['presenter']
    assert candidates[0]['creative_trial']['unit']=='distinct_owned_claim_graphics_only'
    assert candidates[0]['creative_trial']['max_posts_per_arm']==3


def test_new_native_experiment_cannot_be_admitted(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);native=item(presenter=True)
    with pytest.raises(policy.Quarantine,match='native_presenter_disabled'):a.admit(native,metadata(native),native['text'],key)


def test_protected_gpu_graphics_v1_runtime_is_compatible_but_not_new_creative(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);i=city();m=a.admit(i,metadata(i),i['text'],key)
    m['admission'].update(policy_digest=a.LEGACY_POLICY_DIGEST,runtime_digest=a.GRAPHICS_RUNTIME_DIGEST)
    assert a.verify_manifest(a.seal(m,key))['script']==i
    new=item();m=a.admit(new,metadata(new),new['text'],key)
    m['admission'].update(policy_digest=a.LEGACY_POLICY_DIGEST,runtime_digest=a.GRAPHICS_RUNTIME_DIGEST)
    with pytest.raises(policy.Quarantine,match='policy'):a.verify_manifest(a.seal(m,key))
