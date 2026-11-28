"""Real signing/CAS/archive/storage code; disposable keys and provider fixtures.

No GPU, Meta, production state, hosting credentials or media deletion.
"""
import base64
import copy
from datetime import datetime, timedelta, timezone
from itertools import product
import json
from pathlib import Path
import subprocess

import pytest
import requests

from scripts.instagram_growth import hosted as h, retention as r, scorecard
from scripts.instagram_growth.autonomy import admission as a, policy, renewal, promotion, worker
from scripts.instagram_growth.factory import source_typography
from tests.test_instagram_auto_policy import keys, metadata

START = datetime(2027, 1, 4, tzinfo=timezone.utc)


class Ledger:
    def __init__(self, monkeypatch):
        self.hot={'account':'avoidboringpeople','receipts':{},'auto_inventory':{},'observations':{},'account_snapshots':{}}
        self.sha='0';self.files={};self.fault=None;self.clock=START
        monkeypatch.setenv('GITHUB_TOKEN','disposable-test-token');monkeypatch.setenv('GITHUB_REPOSITORY',h.REPO)
        ledger=self
        class Clock(datetime):
            @classmethod
            def now(cls,tz=None):return ledger.clock
        monkeypatch.setattr(r,'datetime',Clock)
        monkeypatch.setattr(h.Store,'request',lambda store,*args,**kwargs:self.request(*args,**kwargs))

    def request(self,method,path,**kwargs):
        if path=='contents/instagram-state.json':
            if method=='GET':return {'sha':self.sha,'content':base64.b64encode(json.dumps(self.hot).encode()).decode()}
            value=kwargs['json'];assert value['branch']==h.BRANCH
            if self.fault=='cas':self.fault=None;self.sha+='-concurrent';raise h.StateError('fixture CAS conflict')
            if value['sha']!=self.sha:raise h.StateError('fixture CAS conflict')
            self.hot=json.loads(base64.b64decode(value['content']));self.sha+='-saved'
            if self.fault=='state_response_lost':self.fault=None;raise requests.ConnectionError('fixture committed response lost')
            return {'content':{'sha':self.sha}}
        assert path.startswith('contents/instagram-archives/')
        name=path.removeprefix('contents/')
        if method=='GET':
            if self.fault=='archive_outage':raise requests.ConnectionError('fixture archive unavailable')
            return {'content':base64.b64encode(self.files[name]).decode()} if name in self.files else None
        value=kwargs['json'];assert 'sha' not in value
        body=base64.b64decode(value['content']);assert name==r.reference(policy.sha(body))['path']
        assert name not in self.files;self.files[name]=body
        if self.fault=='archive_crash':self.fault=None;raise SystemExit('fixture crash after immutable create')
        return {'content':{'sha':policy.sha(body)}}

    def open(self):
        store=h.Store();store.load();return store


def admissions(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);result=[]
    for record in policy.discover()[0]:
        for structure,layout,audience in product(*renewal.AXES.values()):
            if len(record['source_sentences'])==1 and structure=='question':continue
            spec={'structure':structure,'layout':layout,'audience':audience}
            factor='compression' if len(record['source_sentences'])>1 else 'typography'
            field=renewal.FIELDS[factor];arm=int(spec[field]==renewal.AXES[factor][1])
            control={**spec,field:renewal.AXES[factor][0]}
            value={'protocol':renewal.PROTOCOL,'factor':factor,'arm':arm,'control':control,'evidence':None}
            item=policy.compile_script(record,creative=value)
            meta=metadata(item);media=('disposable fixture bytes '+item['concept_id']).encode();meta['sha256']=policy.sha(media)
            if layout=='source_type':
                from PIL import ImageFont
                words=[{'word':w,'start':n*.3,'end':n*.3+.25} for n,w in enumerate(item['text'].split())]
                duration=len(words)*.3;alignment={'words':words,'model_revision':'test-fixture'}
                plan=source_typography.plan(item,alignment,duration)
                for panel in plan['sentences']:panel['layout']=source_typography.layout(panel,lambda text,size:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size).getlength(text))
                meta.update(captions=alignment,source_typography=plan);meta['audio']['duration']=duration
            m=a.admit(item,meta,item['text'],key);a.verify_manifest(m)
            result.append((m,media))
    # Interleave claims, not adjacent executions of the same paragraph.
    result.sort(key=lambda x:(x[0]['script']['presentation_signature']['layout'],x[0]['script']['presentation_signature']['structure'],
                              x[0]['script']['presentation_signature']['audience'],x[0]['claim_id']))
    assert len(result)>100
    return key,result


def insert(store,m,when,*,published=True,complete=True):
    name=m['concept_id'];digest=policy.sha(policy.canonical(m))
    store.state.setdefault('auto_inventory',{})[name]={'manifest':m,'envelope_sha256':digest,
        'envelope_url':f'https://{a.HOST}/instagram/reels/auto/manifests/{digest}.json','promoted_at':when.isoformat()}
    if not published:return
    media_id=str(100000000000+len(store.state['auto_inventory']))
    store.state['receipts'][name]={'concept_id':name,'status':'published','published_at':when.isoformat(),
        'sha256':m['video_sha256'],'media_id':media_id,'verified_media':{'id':media_id,'username':'avoidboringpeople'}}
    if complete:
        for label,age in (('24h',24),('48h',48),('7d',168)):
            store.state.setdefault('observations',{})[name+'-'+label]={'concept_id':name,'window':label,'actual_age_hours':age,
                'metrics':{'reach':150,'shares':1},'captured_at':(when+timedelta(hours=age)).isoformat()}


def test_over_100_real_signed_admissions_roundtrip_and_storage_rotation(tmp_path,monkeypatch):
    key,items=admissions(tmp_path,monkeypatch);ledger=Ledger(monkeypatch);snapshots=[];maximum=0
    for n,(m,_) in enumerate(items):
        ledger.clock=START+timedelta(days=n*3);store=ledger.open();insert(store,m,ledger.clock)
        store.state['account_snapshots'][str(n)]={'account':'avoidboringpeople','captured_at':ledger.clock.isoformat(),'followers_count':n}
        if n%7==0:store.state['weekly_review']={'created_at':ledger.clock.isoformat(),'followers':{'observed_change':0},'creative_learning':{'factor_priority':['compression']}}
        before=copy.deepcopy(store.state);store.save(archive_review=n%7==0)
        restored,cold=r.restore(ledger.hot,lambda ref:ledger.files[ref['path']])
        for table in r.TABLES:
            # Legacy metadata is absent in these source-bound admission fixtures.
            assert restored.get(table,{})==before.get(table,{})
        assert restored.get('weekly_review')==before.get('weekly_review')
        size=len(json.dumps(ledger.hot,indent=2,sort_keys=True).encode());maximum=max(maximum,size)
        assert size<r.STATE_LIMIT and len(ledger.hot.get('auto_inventory',{}))<=48
        snapshots.append(copy.deepcopy(ledger.hot))
    assert len(ledger.files)>4 and len(cold['receipts'])>80
    assert len(restored['auto_inventory'])==len(items) and len(restored['account_snapshots'])==len(items)
    source=policy.discover()[0][0];slot={'account':'avoidboringpeople'}
    assert renewal.options(source,[x['manifest'] for x in before['auto_inventory'].values()],before,now=ledger.clock)==renewal.options(source,[x['manifest'] for x in restored['auto_inventory'].values()],restored,now=ledger.clock)
    control=json.loads(json.dumps(before,sort_keys=True))  # original, unarchived CAS wire roundtrip
    left=scorecard.build(control,[x['manifest'] for x in control['auto_inventory'].values()],ledger.clock)
    right=scorecard.build(restored,[x['manifest'] for x in restored['auto_inventory'].values()],ledger.clock)
    for keyname in ('followers','rows','creative_learning','renewable_creative','replication_candidates','inventory'):
        assert left[keyname]==right[keyname]
    fixture=tmp_path/'retention-fixture.json'
    fixture.write_text(json.dumps({'private_key_path':str(key),'admissions':[{'manifest_json':policy.canonical(m).decode(),
        'signing_payload':policy.canonical(a.unsigned(m)).decode(),'media_base64':base64.b64encode(media).decode()} for m,media in items],
        'states':snapshots,'archives':{name:base64.b64encode(body).decode() for name,body in ledger.files.items()},
        'start':START.isoformat(),'maximum_hot_bytes':maximum}))
    run=subprocess.run(['node','--experimental-vm-modules','tests/instagram-retention-fixtures.mjs',str(fixture)],capture_output=True,text=True,timeout=180)
    assert run.returncode==0,run.stderr+run.stdout
    assert 'PASS' in run.stdout
    print(run.stdout.strip())
    print(f'Archive chunks: {len(ledger.files)}; peak hot CAS bytes: {maximum}')


@pytest.mark.parametrize('fault',['archive_crash','cas','state_response_lost'])
def test_archive_crashes_and_conflicts_never_lose_committed_evidence(tmp_path,monkeypatch,fault):
    _,items=admissions(tmp_path,monkeypatch);ledger=Ledger(monkeypatch);store=ledger.open()
    for n,(m,_) in enumerate(items[:50]):insert(store,m,START+timedelta(hours=n))
    # First persist young records; then age them into the real archive policy.
    store.save();original=copy.deepcopy(ledger.hot);ledger.clock=START+timedelta(days=40)
    store=ledger.open();ledger.fault=fault
    with pytest.raises((SystemExit,h.StateError,requests.ConnectionError)):store.save()
    restored=ledger.open()
    for key in r.TABLES:assert restored.state.get(key,{})==original.get(key,{})
    restored.save();again=ledger.open()
    assert len(again.state['auto_inventory'])==50 and len(ledger.hot['auto_inventory'])<50
    # A stale hot checkpoint can still reconstruct its own immutable history.
    old,_=r.restore(original,lambda ref:ledger.files[ref['path']])
    assert len(old['auto_inventory'])==50


def test_delayed_unpublished_unreconciled_measurements_and_corruption(tmp_path,monkeypatch):
    _,items=admissions(tmp_path,monkeypatch);ledger=Ledger(monkeypatch);store=ledger.open()
    for n,(m,_) in enumerate(items[:8]):insert(store,m,START+timedelta(hours=n),published=n!=2,complete=n!=3)
    name=items[4][0]['concept_id'];store.state['receipts'][name]['status']='reconciliation_required'
    store.save();ledger.clock=START+timedelta(days=40)
    plan=r.plan(store.state,{},force=True,now=ledger.clock)
    assert plan
    _,_,tables,_=plan
    assert items[2][0]['concept_id'] not in tables['auto_inventory']
    assert items[3][0]['concept_id'] not in tables['auto_inventory']
    assert items[4][0]['concept_id'] not in tables['auto_inventory']
    store.state['weekly_review']={'created_at':ledger.clock.isoformat()};store.save(archive_review=True)
    head=ledger.hot['archive_head'];original=ledger.files[head['path']]
    ledger.files[head['path']]=original[:-1]+b'x'
    with pytest.raises(ValueError,match='hash'):ledger.open()
    ledger.files[head['path']]=original;ledger.fault='archive_outage'
    with pytest.raises(requests.ConnectionError):ledger.open()
    ledger.fault=None;restored=ledger.open()
    assert restored.state['receipts'][name]['status']=='reconciliation_required'
    assert items[2][0]['concept_id'] in restored.state['auto_inventory']
    old_key=next(iter(restored.cold['observations']));original_reach=restored.cold['observations'][old_key]['metrics']['reach']
    restored.state['observations'][old_key]['metrics']['reach']+=1
    assert restored.cold['observations'][old_key]['metrics']['reach']==original_reach
    restored.state['weekly_review']['created_at']='a later read-only correction'
    assert restored.cold['weekly_review']['created_at']!=restored.state['weekly_review']['created_at']
    restored.save();restored=ledger.open()
    assert restored.state['observations'][old_key]['metrics']['reach']==original_reach+1
    assert restored.state['weekly_review']['created_at']=='a later read-only correction'
    # Delayed windows become explicit gaps, not invented observations.
    delayed=items[3][0]['concept_id']
    for window in ('24h','48h','7d'):restored.state.setdefault('measurement_gaps',{})[delayed+'-'+window]={'concept_id':delayed,'window':window,'reason':'age_window_missed'}
    ready=r.plan(restored.state,restored.cold,force=True,now=ledger.clock)
    assert ready and delayed in ready[2]['auto_inventory']
    # Independently challenge inner integrity, even with a valid outer digest.
    wrapper=json.loads(original);wrapper['content_sha256']='0'*64;bad=policy.canonical(wrapper)
    with pytest.raises(ValueError,match='content hash'):r.decode(r.reference(policy.sha(bad)),bad)
    payload=r.decode(head,original);row=next(iter(payload['tables']['auto_inventory'].values()))
    forged=json.loads(row['manifest_json']);forged['auto_signature']=base64.b64encode(b'0'*64).decode()
    row['manifest_json']=policy.canonical(forged).decode();row['envelope_sha256']=policy.sha(row['manifest_json'].encode())
    ref,bad=r.encode(payload)
    with pytest.raises(policy.Quarantine,match='signature'):r.decode(ref,bad)


def test_archive_client_cannot_overwrite_or_escape_its_data_branch(monkeypatch):
    monkeypatch.setenv('GITHUB_TOKEN','disposable-test-token');monkeypatch.setenv('GITHUB_REPOSITORY',h.REPO)
    store=h.Store();monkeypatch.setattr(store.session,'request',lambda *a,**k:pytest.fail('must fail before transport'))
    path='contents/instagram-archives/'+'a'*64+'.json'
    with pytest.raises(h.StateError,match='overwritten'):store.request('PUT',path,json={'branch':h.BRANCH,'sha':'old'})
    with pytest.raises(h.StateError,match='dedicated data'):store.request('PUT',path,json={'branch':'main'})
    with pytest.raises(h.StateError,match='application code'):store.request('PUT','contents/AGENTS.md',json={'branch':h.BRANCH})


def test_historical_manual_manifest_is_copied_and_available_without_hot_file(monkeypatch):
    ledger=Ledger(monkeypatch);store=ledger.open();manual=scorecard.load_manifests(h.QUEUE_DIR)[:2]
    for n,m in enumerate(manual):
        name=m['concept_id'];media_id=str(123400+n)
        store.state['receipts'][name]={'concept_id':name,'status':'published','published_at':(START+timedelta(hours=n)).isoformat(),
            'sha256':m['video_sha256'],'media_id':media_id,'verified_media':{'id':media_id,'username':'avoidboringpeople'}}
        for window in ('24h','48h','7d'):store.state.setdefault('measurement_gaps',{})[name+'-'+window]={'concept_id':name,'window':window,'reason':'age_window_missed'}
    expected=h.all_manifests(store.state);store.save();ledger.clock=START+timedelta(days=40)
    store=ledger.open();store.save(archive_review=True)
    assert manual[1]['concept_id'] in store.state['legacy_manifests']
    assert h.all_manifests(ledger.open().state)==expected
    monkeypatch.setattr(h,'QUEUE_DIR',Path('/tmp/no-original-manifest-files-here'))
    assert manual[1] in h.all_manifests(ledger.open().state)
