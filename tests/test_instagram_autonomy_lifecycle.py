"""Disposable signing/media fixtures; never publish or contact live providers."""
import copy
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.instagram_growth import hosted as h, reel_pilot
from scripts.instagram_growth.autonomy import admission as a, policy, promotion as p, worker
from tests.test_instagram_auto_policy import city, keys, metadata


def manifest(tmp_path, monkeypatch):
    key=keys(tmp_path,monkeypatch);item=city()
    return a.admit(item,metadata(item),item['text'],key),key


def store():
    state={'account':'avoidboringpeople','receipts':{},'pilot_verified':True};saved=[]
    return SimpleNamespace(state=state,save=lambda:saved.append(copy.deepcopy(state))),saved


def feed(m,key,monkeypatch):
    body=policy.canonical(m);digest=policy.sha(body)
    url=f'https://{a.HOST}/instagram/reels/auto/manifests/{digest}.json'
    value=a.seal({'artifact_type':'abp_auto_feed_v1','account':'avoidboringpeople',
                  'generated_at':datetime.now(timezone.utc).isoformat(),
                  'storage':{'plan':'hobby','usage_quota_exceeded':False,'size_bytes':100},
                  'items':[{'concept_id':m['concept_id'],'url':url,'sha256':digest}],
                  'factory':{'status':'healthy'},'usage':{}},key)
    data={p.FEED:policy.canonical(value),url:body}
    monkeypatch.setattr(p,'fetch',lambda url,limit:data[url]);return data


def test_signed_feed_is_checked_then_promoted_once(tmp_path,monkeypatch):
    m,key=manifest(tmp_path,monkeypatch);feed(m,key,monkeypatch);st,saved=store();downloads=[]
    def download(item):
        assert not saved;downloads.append(item['video_sha256'])
    assert p.promote(st,[],download)==1
    assert downloads==[m['video_sha256']]
    assert saved[-1]['auto_inventory'][m['concept_id']]['manifest']==m
    assert p.promote(st,[],lambda _:pytest.fail('no repeated download'))==0


@pytest.mark.parametrize('change',['signature','hash','stale','account','quota','identity'])
def test_bad_feed_never_reaches_inventory(tmp_path,monkeypatch,change):
    m,key=manifest(tmp_path,monkeypatch);data=feed(m,key,monkeypatch);value=json.loads(data[p.FEED])
    if change=='signature':value['auto_signature']='invalid'
    else:
        if change=='hash':data[value['items'][0]['url']]+=b'changed'
        if change=='stale':value['generated_at']=(datetime.now(timezone.utc)-timedelta(days=9)).isoformat()
        if change=='account':value['account']='leon.lin.s'
        if change=='quota':value['storage']['usage_quota_exceeded']=True
        if change=='identity':value['items'][0]['concept_id']='another'
        value=a.seal(value,key)
    data[p.FEED]=policy.canonical(value);st,saved=store()
    with pytest.raises(policy.Quarantine):p.promote(st,[],lambda _:pytest.fail('invalid feed must not reach download'))
    assert not saved and not st.state.get('auto_inventory')


def test_media_failure_does_not_persist_promotion(tmp_path,monkeypatch):
    m,key=manifest(tmp_path,monkeypatch);feed(m,key,monkeypatch);st,saved=store()
    def bad(_):raise ValueError('MP4 bytes differ')
    with pytest.raises(ValueError):p.promote(st,[],bad)
    assert not saved and not st.state.get('auto_inventory')


def test_duplicate_claim_allows_only_the_exact_two_member_pair():
    first={**city(),'video_sha256':'a'*64}
    second={**first,'concept_id':'second','video_sha256':'b'*64,'pair_role':'presenter'}
    p.duplicate(second,[first])
    with pytest.raises(policy.Quarantine):p.duplicate({**second,'concept_id':'third','video_sha256':'c'*64},[first,second])
    with pytest.raises(policy.Quarantine):p.duplicate({**second,'pair_id':'different'},[first])
    with pytest.raises(policy.Quarantine):p.duplicate({**first,'concept_id':'renamed'},[first])


def test_delayed_canary_insights_recover_without_republication(tmp_path,monkeypatch):
    m,_=manifest(tmp_path,monkeypatch);assert m['concept_id']==p.CANARY_ID
    st,saved=store();st.state.update(auto_inventory={m['concept_id']:{'manifest':m}},auto_health={'feed_generated_at':datetime.now(timezone.utc).isoformat()})
    st.state['receipts'][m['concept_id']]={'concept_id':m['concept_id'],'status':'published','media_id':'123456789','sha256':m['video_sha256'],'published_at':datetime.now(timezone.utc).isoformat()}
    monkeypatch.setenv('ABP_REELS_PUBLISH','enabled');monkeypatch.setenv('ABP_AUTO_MODE','canary')
    monkeypatch.setattr(h,'verify_media',lambda _: {'id':'123456789','username':'avoidboringpeople','permalink':'https://www.instagram.com/reel/fixture/'})
    monkeypatch.setattr(reel_pilot,'publish',lambda *a,**kw:pytest.fail('must never republish existing canary'))
    monkeypatch.setattr(reel_pilot,'fetch_insights',lambda _: {'metrics':{'reach':None}})
    h.publish_one(st,auto_canary=True);assert saved[-1]['auto_canary_verified'] is False
    monkeypatch.setattr(reel_pilot,'fetch_insights',lambda _: {'metrics':{'reach':0}})
    h.publish_one(st,auto_canary=True);assert saved[-1]['auto_canary_verified'] is True
    assert len(st.state['receipts'])==1 and p.eligible(st.state,'enabled')==[m]
    st.state['receipts'][m['concept_id']]['sha256']='f'*64
    with pytest.raises(h.StateError,match='bind'):h.verify_auto_canary(st,m)


def test_automatic_admission_has_no_fabricated_human_approval(tmp_path,monkeypatch):
    m,_=manifest(tmp_path,monkeypatch);assert reel_pilot.validate_manifest(m)==m
    assert 'approved_by' not in m
    m['caption']+=' changed'
    with pytest.raises(policy.Quarantine):reel_pilot.validate_manifest(m)


def test_enabled_mode_starts_with_canary(monkeypatch):
    import sys
    st,_=store();st.load=lambda:st.state;events=[]
    monkeypatch.setattr(h,'Store',lambda:st);monkeypatch.setattr(h,'promote_auto',lambda _:0)
    monkeypatch.setattr(h,'inventory_health',lambda _:None)
    monkeypatch.setattr(h,'publish_one',lambda *args,**kw:events.append(kw))
    monkeypatch.setenv('ABP_AUTO_MODE','enabled');monkeypatch.setattr(sys,'argv',['hosted','publish'])
    h.main();assert events[0]['auto_canary'] is True
    st.state['auto_canary_verified']=True;h.main();assert events[1]['auto_canary'] is False


def test_circuit_stale_and_future_heartbeat_fail_closed(tmp_path,monkeypatch):
    m,_=manifest(tmp_path,monkeypatch);state={'auto_canary_verified':True,'auto_inventory':{'item':{'manifest':m}}}
    assert p.eligible(state,'enabled')==[]
    for delta in (timedelta(days=-9),timedelta(hours=1)):
        state['auto_health']={'feed_generated_at':(datetime.now(timezone.utc)+delta).isoformat()}
        assert p.eligible(state,'enabled')==[]
    state['auto_health']={'feed_generated_at':datetime.now(timezone.utc).isoformat()}
    assert p.eligible(state,'enabled')==[m]
    for _ in range(3):p.circuit(state,'measurement',ValueError('fixture'))
    assert p.eligible(state,'enabled')==[] and p.eligible(state,'off')==[]


def test_unfinished_canary_halts_queue(tmp_path,monkeypatch):
    m,_=manifest(tmp_path,monkeypatch);st,_=store()
    st.state.update(auto_inventory={m['concept_id']:{'manifest':m}},auto_health={'feed_generated_at':datetime.now(timezone.utc).isoformat()})
    st.state['receipts'][p.CANARY_ID]={'concept_id':p.CANARY_ID,'status':'publish_attempted'}
    monkeypatch.setenv('ABP_REELS_PUBLISH','enabled');monkeypatch.setenv('ABP_AUTO_MODE','canary')
    monkeypatch.setattr(reel_pilot,'publish',lambda *a,**kw:pytest.fail('ambiguous receipt cannot publish'))
    with pytest.raises(h.StateError,match='HALT'):h.publish_one(st,auto_canary=True)


def test_state_client_cannot_write_code_or_another_branch(monkeypatch):
    monkeypatch.setenv('GITHUB_TOKEN','fixture');monkeypatch.setenv('GITHUB_REPOSITORY',h.REPO);st=h.Store()
    with pytest.raises(h.StateError):st.request('PUT','contents/scripts/code.py',json={'branch':'main'})
    with pytest.raises(h.StateError):st.request('PUT',f'contents/{h.STATE_PATH}',json={'branch':'main'})


def test_render_reservation_is_durable_and_failures_cannot_refund(tmp_path):
    path=tmp_path/'budget.json';budget={'attempted':0,'rendered':19}
    worker.reserve_render(budget,2,path);assert json.loads(path.read_text())['rendered']==21
    with pytest.raises(RuntimeError):worker.reserve_render(budget,1,path)
    assert json.loads(path.read_text())['rendered']==21


def test_storage_helper_without_live_provider_calls():
    import subprocess
    subprocess.run(['node','--experimental-vm-modules','tests/instagram-storage-fixtures.mjs'],check=True,capture_output=True,text=True,timeout=30)


def test_python_signed_float_evidence_is_accepted_by_javascript(tmp_path,monkeypatch):
    import base64,subprocess
    key=keys(tmp_path,monkeypatch);item=city();media=b'disposable cross-language media fixture'
    meta=metadata(item);meta['sha256']=policy.sha(media)
    m=a.admit(item,meta,item['text'],key)
    assert m['admission']['quality']['independent_asr_word_error_rate']==0.0
    fixture=tmp_path/'cross-language.json';output=tmp_path/'uploaded.json'
    fixture.write_text(json.dumps({'output':str(output),'private_key_path':str(key),'media_base64':base64.b64encode(media).decode(),
                                   'manifest_json':policy.canonical(m).decode(),
                                   'signing_payload':policy.canonical(a.unsigned(m)).decode()}))
    result=subprocess.run(['node','--experimental-vm-modules','tests/instagram-storage-fixtures.mjs',str(fixture)],capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    uploaded=json.loads(output.read_text());assert a.verify_manifest(json.loads(uploaded['manifest']))==m
    published_feed=a.authenticate(json.loads(uploaded['feed']))
    payloads={p.FEED:uploaded['feed'].encode(),published_feed['items'][0]['url']:uploaded['manifest'].encode()}
    monkeypatch.setattr(p,'fetch',lambda url,limit:payloads[url]);st,saved=store()
    assert p.promote(st,[],lambda item:None)==1
    assert saved[-1]['auto_inventory'][m['concept_id']]['manifest']==m


def test_offline_worker_preserves_frozen_control_and_never_uploads(tmp_path,monkeypatch):
    import sys
    key=keys(tmp_path,monkeypatch);source=policy.source_record(city()['source_file'],city()['source_anchor'])
    pair=[policy.compile_script(source,presenter=v,bucket='control') for v in (False,True)]
    seed=tmp_path/'seed';(seed/'audio').mkdir(parents=True);(seed/'final').mkdir()
    (seed/'briefs.json').write_text(json.dumps({'items':pair}))
    for item in pair:
        video=seed/'final'/f'{item["concept_id"]}-REVIEW_ONLY.mp4';video.write_bytes(b'disposable fixture, not real media')
        meta=metadata(item);meta['sha256']=policy.sha(video.read_bytes())
        if item['presenter']:
            portrait=tmp_path/'portrait';portrait.write_bytes(b'disposable fictional fixture')
            monkeypatch.setattr(a,'PORTRAIT_SHA',policy.sha(portrait.read_bytes()))
            meta['presenter']={'model_variant':'Pro','model':{'revision':a.FLASH_REV},'original_reference':str(portrait)}
        video.with_suffix('.manifest.json').write_text(json.dumps(meta))
        (seed/'audio'/f'{item["concept_id"]}-independent-asr.json').write_text(json.dumps({'text':item['text']}))
    root=tmp_path/'offline';production=tmp_path/'production';config=tmp_path/'config.json';state=tmp_path/'state.json'
    config.write_text(json.dumps({'root':str(production),'enabled':False,'signing_key':str(key)}));state.write_text(json.dumps({'account':'avoidboringpeople','receipts':{}}))
    monkeypatch.setenv('ABP_AUTO_CONFIG',str(config));monkeypatch.delenv('CREDENTIALS_DIRECTORY',raising=False)
    monkeypatch.setattr(worker.requests,'get',lambda *a,**kw:pytest.fail('offline run must not fetch live data'))
    monkeypatch.setattr(worker,'candidates',lambda *args:(pair,[],{'planned_counts':{'exploration':24,'exploitation':10,'control':6}}))
    monkeypatch.setattr(policy,'discover',lambda:([source],[]));original=worker.subprocess.run
    def run(command,**kw):
        assert command[0]!='node','offline verification must not upload'
        return original(command,**kw)
    monkeypatch.setattr(worker.subprocess,'run',run)
    monkeypatch.setattr(sys,'argv',['worker','--canary','--dry-run','--state',str(state),'--output-root',str(root),'--seed-render',str(seed)])
    worker.main();report=json.loads((root/'status.json').read_text())
    assert report['status']=='verified_offline' and report['offline_verified']==2 and report['newly_hosted']==0
    assert not production.exists() and not list((root/'runs').glob('*/*-upload.json'))
    assert all(a.verify_manifest(json.loads(p.read_text()))['script']['experiment_bucket']=='control' for p in (root/'admitted').glob('*.json'))


def test_launcher_pins_main_ref_and_drops_unrelated_credentials(tmp_path,monkeypatch):
    import runpy,subprocess,sys
    launcher=Path('deploy/abp-instagram-auto.py').resolve();folder=tmp_path/'.config/abp-instagram';folder.mkdir(parents=True)
    root=tmp_path/'autonomy';repo=tmp_path/'repo';head='a'*40
    (folder/'auto.json').write_text(json.dumps({'root':str(root),'source_repo':str(repo)}))
    monkeypatch.setattr(Path,'home',lambda:tmp_path)
    for name in ('GH_TOKEN','GITHUB_TOKEN','INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_USER_ID','DATABASE_URL','AWS_SECRET_ACCESS_KEY'):monkeypatch.setenv(name,'unrelated-fixture-credential')
    calls=[]
    def git(command,**kw):
        assert 'unrelated-fixture-credential' not in kw['env'].values()
        if 'fetch' in command:assert command[-1]=='refs/heads/main:refs/abp-instagram/main'
        if 'rev-parse' in command:
            assert command[-1]=='refs/abp-instagram/main';return head
        if 'worktree' in command:Path(command[-2]).mkdir(parents=True)
        return ''
    monkeypatch.setattr(subprocess,'check_output',git)
    monkeypatch.setattr(subprocess,'run',lambda *args,**kw:calls.append((args,kw)))
    monkeypatch.setattr(sys,'argv',['launcher','--limit','2']);runpy.run_path(str(launcher),run_name='__main__')
    assert len(calls)==1 and calls[0][1]['cwd']==root/'checkouts'/head
    assert 'unrelated-fixture-credential' not in calls[0][1]['env'].values()
