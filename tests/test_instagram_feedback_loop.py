"""Follower-first allocation and safe continuation of a completed GPU pair."""
import copy
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.instagram_growth.autonomy import admission as a,policy,worker
from scripts.instagram_growth.factory import allocation
from scripts.instagram_growth import scorecard
from tests.test_instagram_auto_policy import city,keys,metadata


PARAMS={'hook':0,'voice':'af_heart','visual':'cards','caption_words':5}


def evidence():
    return {'hypothesis':'concrete situation / city','topic':'city','source_articles':['one','two'],
            'encouraging_source_articles':['one','two'],'replication_eligible':True,'n_reels':2,
            'reach':800,'shares_per_1000_reached':10,'production_parameters':dict(PARAMS)}


def review(net=2):
    return {'created_at':datetime.now(timezone.utc).isoformat(),
            'followers':{'net_new_followers_week':net,'complete_week_boundary_coverage':True},
            'replication_candidates':[evidence()]}


@pytest.mark.parametrize('net',[None,0,-2])
def test_attention_cannot_earn_exploitation_without_observed_follower_growth(net):
    p=allocation.plan(40,{'weekly_review':review(net)})
    assert p['planned_counts']=={'exploration':24,'exploitation':10,'control':6}
    assert all(x['experiment_bucket']!='exploitation' for x in p['slots'])


def test_positive_current_replicated_evidence_reuses_frozen_attributes():
    p=allocation.plan(40,{'weekly_review':review()})
    selected=[x for x in p['slots'] if x['experiment_bucket']=='exploitation']
    assert len(selected)==10
    assert all(x['voice']=='af_heart' and x['visual_style']=='cards' and x['caption_words']==5 for x in selected)
    assert all(x['voice']=='af_heart' and x['visual_style']=='cards' for x in p['slots'] if x['experiment_bucket']=='control')


@pytest.mark.parametrize('bad',['stale','partial','unreproducible'])
def test_stale_partial_or_unreproducible_evidence_returns_to_exploration(bad):
    r=review()
    if bad=='stale':r['created_at']=(datetime.now(timezone.utc)-timedelta(days=9)).isoformat()
    if bad=='partial':r['followers']['complete_week_boundary_coverage']=False
    if bad=='unreproducible':r['replication_candidates'][0]['production_parameters']['hook']=99
    assert all(x['experiment_bucket']!='exploitation' for x in allocation.plan(40,{'weekly_review':r})['slots'])


@pytest.mark.parametrize('valid',[True,False])
def test_launcher_resolves_configured_node_in_a_service_path(tmp_path,monkeypatch,valid):
    import runpy,subprocess,sys
    launcher=Path('deploy/abp-instagram-auto.py').resolve();home=tmp_path/'home'
    configdir=home/'.config/abp-instagram';configdir.mkdir(parents=True)
    node=tmp_path/'runtime/bin/node';node.parent.mkdir(parents=True)
    if valid:node.write_text('disposable fixture');node.chmod(0o755)
    root=tmp_path/'state';repo=tmp_path/'source'
    (configdir/'auto.json').write_text(json.dumps({'root':str(root),'source_repo':str(repo),'node_executable':str(node)}))
    monkeypatch.setattr(Path,'home',lambda:home);monkeypatch.setenv('PATH','/usr/bin:/bin')
    calls=[]
    def git(command,**kw):
        calls.append(kw['env'])
        if 'rev-parse' in command:return 'a'*40
        if 'worktree' in command:Path(command[-2]).mkdir(parents=True)
        return ''
    monkeypatch.setattr(subprocess,'check_output',git)
    monkeypatch.setattr(subprocess,'run',lambda *args,**kw:calls.append(kw['env']))
    monkeypatch.setattr(sys,'argv',['launcher'])
    if valid:
        runpy.run_path(str(launcher),run_name='__main__')
        assert calls and all(x['PATH'].split(':')[0]==str(node.parent) for x in calls)
    else:
        with pytest.raises(SystemExit,match='node_executable'):runpy.run_path(str(launcher),run_name='__main__')
        assert not calls


def completed_pair(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);source=policy.source_record(city()['source_file'],city()['source_anchor'])
    pair=[policy.compile_script(source,presenter=v,bucket='control') for v in (False,True)]
    root=tmp_path/'state';out=root/'runs'/'frozen'/'autopair-fixture';(out/'audio').mkdir(parents=True);(out/'final').mkdir()
    (root/'admitted').mkdir();(root/'uploads').mkdir();(out/'briefs.json').write_text(json.dumps({'items':pair}));(out/'verification.json').write_text('{}')
    for item in pair:
        video=out/'final'/f'{item["concept_id"]}-REVIEW_ONLY.mp4';video.write_bytes(b'disposable fixture, not real media')
        meta=metadata(item);meta['sha256']=policy.sha(video.read_bytes())
        if item['presenter']:
            portrait=tmp_path/'portrait';portrait.write_bytes(b'disposable fictional fixture');monkeypatch.setattr(a,'PORTRAIT_SHA',policy.sha(portrait.read_bytes()))
            meta['presenter']={'model_variant':'Pro','model':{'revision':a.FLASH_REV},'original_reference':str(portrait)}
        video.with_suffix('.manifest.json').write_text(json.dumps(meta));(out/'audio'/f'{item["concept_id"]}-independent-asr.json').write_text(json.dumps({'text':item['text']}))
    m,video=worker.rendered_manifest(pair[0],out,key)
    pending=out.parent/f'{m["concept_id"]}-upload.json';worker.write(pending,worker.upload_request(m,video,{'status':'uploading'}))
    worker.write(root/'admitted'/f'{m["concept_id"]}.json',m)
    return root,out,pair,key


def test_recovery_finishes_pending_and_unsigned_partner_once_without_rendering(tmp_path,monkeypatch):
    root,out,pair,key=completed_pair(tmp_path,monkeypatch);budget={'attempted':1,'rendered':2};ledger=root/'budget.json';worker.write(ledger,budget)
    calls=[];original=worker.subprocess.run
    def run(command,**kw):
        if command[0]!='node':return original(command,**kw)
        assert 'factory.run' not in command
        calls.append(command)
        m=json.loads(Path(command[-1]).read_text())['manifest']
        assert json.loads(ledger.read_text())['rendered']==2
        return SimpleNamespace(stdout=json.dumps({'status':'AUTO_HOSTED','concept_id':m['concept_id'],'manifest_sha256':policy.sha(policy.canonical(m))}))
    monkeypatch.setattr(worker.subprocess,'run',run)
    first=worker.recover(root,key,budget,ledger,1);assert len(first)==1 and len(calls)==1
    second=worker.recover(root,key,budget,ledger,1);assert len(second)==1 and len(calls)==2
    assert worker.recover(root,key,budget,ledger,2)==[] and len(calls)==2
    assert budget=={'attempted':2,'rendered':2}
    assert set(first+second)=={x['concept_id'] for x in pair}
    assert all(a.verify_manifest(json.loads(p.read_text())) for p in (root/'admitted').glob('*.json'))


def test_recovery_does_not_retry_a_quarantined_frozen_pair(tmp_path,monkeypatch):
    root,out,pair,key=completed_pair(tmp_path,monkeypatch)
    # A signed pending first member is safe to finish, but its rejected partner
    # must not be silently admitted through the recovery path.
    for p in out.parent.glob('*-upload.json'):p.unlink()
    worker.write(out.parent/'failures.json',[{'concept_id':pair[1]['concept_id'],'error':'Quarantine'}])
    monkeypatch.setattr(worker.subprocess,'run',lambda *a,**kw:pytest.fail('quarantined render must not be uploaded'))
    assert worker.recover(root,key,{'attempted':2,'rendered':2},root/'budget.json',12)==[]


def test_existing_receipt_is_verified_instead_of_assuming_file_existence_means_success(tmp_path,monkeypatch):
    root,out,pair,key=completed_pair(tmp_path,monkeypatch)
    worker.write(root/'uploads'/f'{pair[0]["concept_id"]}.json',{'status':'AUTO_HOSTED','manifest_sha256':'0'*64})
    original=worker.subprocess.run
    def run(command,**kw):
        if command[0]=='node':pytest.fail('invalid receipt must stop before a new upload')
        return original(command,**kw)
    monkeypatch.setattr(worker.subprocess,'run',run)
    with pytest.raises(RuntimeError,match='receipt'):worker.recover(root,key,{'attempted':1,'rendered':2},root/'budget.json',12)


def test_weekly_report_shows_signed_factory_health_without_claiming_growth():
    now=datetime.now(timezone.utc)
    st={'account':'avoidboringpeople','receipts':{},'auto_health':{'factory':{'status':'failed','quarantined':2},'storage':{'plan':'hobby'}},'operation_health':{}}
    result=scorecard.build(st,[],now)
    assert result['recommendation']=='ADJUST' and result['followers']['net_new_followers_week'] is None
    text=scorecard.markdown(result)
    assert 'Automatic operations' in text and 'failed' in text and 'unavailable' in text
    st['operation_health']['publishing']={'consecutive_failures':3}
    assert scorecard.build(st,[],now)['recommendation']=='STOP'


def test_automatic_replication_requires_consistent_frozen_parameters():
    row={'concept_id':'one','window':'7d','eligible_for_comparison':True,'hypothesis':'concrete situation / city',
         'source_url':'https://leonlins.com/writing/one','topic':'city','production_parameters':dict(PARAMS),
         'metrics':{'reach':200,'shares':2}}
    other={**copy.deepcopy(row),'concept_id':'two','source_url':'https://leonlins.com/writing/two'}
    assert scorecard.replicated_patterns([row,other])[0]['production_parameters']==PARAMS
    other['production_parameters']['voice']='af_nicole'
    assert scorecard.replicated_patterns([row,other])[0]['production_parameters'] is None


def test_production_uses_earned_treatment_on_a_fresh_source_without_changing_claims(monkeypatch):
    records,_=policy.discover();city_source=policy.source_record(city()['source_file'],city()['source_anchor'])
    other=next(x for x in records if x['source_file']<city_source['source_file'] and x['topic']!='city')
    monkeypatch.setattr(policy,'discover',lambda:([city_source,other],[]));monkeypatch.setattr(policy,'REFERENCE_INDICES',())
    r=review();r['replication_candidates'][0]['production_parameters'].update(hook=1,voice='af_nicole',visual='statement',caption_words=3)
    items,_,_=worker.candidates({'weekly_review':r},[])
    treated=[x for x in items if x['topic']=='city']
    assert len(treated)==2 and all(x['experiment_bucket']=='exploitation' for x in treated)
    assert all(x['template_parameters']['hook']==1 and x['voice']=='af_nicole' and x['visual']=='statement' for x in treated)
    assert all(policy.verify_script(x)['source_fidelity']=='EXACT_COMPLETE_PARAGRAPH' for x in treated)
    r['replication_candidates'][0]['source_articles'].append(city_source['source_url'])
    fallback,_,_=worker.candidates({'weekly_review':r},[])
    assert all(x['experiment_bucket']!='exploitation' for x in fallback)
