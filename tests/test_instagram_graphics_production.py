"""Graphics production can run with a latched GPU and with serialized GPU inference and a separate incident latch."""
import json
from pathlib import Path
import runpy
import subprocess
import sys

import pytest
from scripts.instagram_growth.autonomy import worker,policy,admission
from tests.test_instagram_auto_policy import city,keys


def test_default_is_gpu_and_only_exact_validated_incident_is_recognized(tmp_path):
    assert worker.graphics_mode({})
    pause=tmp_path/'GPU_FAULT.json';pause.write_text('existing GPU fault')
    config={'validated_graphics_fault_sha256':policy.sha(pause.read_bytes())}
    worker.check_pause(tmp_path,config)
    assert pause.read_text()=='existing GPU fault'
    for invalid in ({}, {**config,'production_mode':'native'}, {'validated_graphics_fault_sha256':'other'}):
        with pytest.raises(RuntimeError,match='GPU fault'):worker.check_pause(tmp_path,invalid)
    pause.write_text('new owner hold')
    with pytest.raises(RuntimeError,match='GPU fault'):worker.check_pause(tmp_path,config)
    assert pause.read_text()=='new owner hold'
    (tmp_path/'PAUSE').write_text('general operator hold')
    with pytest.raises(RuntimeError,match='kill switch'):worker.check_pause(tmp_path,{})


def test_graphics_recovery_never_uploads_presenter(tmp_path,monkeypatch):
    run=tmp_path/'runs'/'one';run.mkdir(parents=True)
    (run/'presenter-upload.json').write_text(json.dumps({'manifest':{'concept_id':'native','script':{'presenter':True}}}))
    monkeypatch.setattr(worker,'finish_upload',lambda *a:pytest.fail('presenter recovery forbidden'))
    assert worker.recover(tmp_path,None,{},None,1,graphics=True)==[]


def test_real_worker_graphics_failure_checks_gpu_and_keeps_incident(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);item=city();root=tmp_path/'offline';root.mkdir()
    pause=root/'GPU_FAULT.json';pause.write_text('GPU fault')
    state=tmp_path/'state.json';state.write_text(json.dumps({'account':'avoidboringpeople','receipts':{}}))
    config=tmp_path/'config.json';config.write_text(json.dumps({'root':str(tmp_path/'production'),'enabled':False,'signing_key':str(key),'validated_graphics_fault_sha256':policy.sha(pause.read_bytes())}))
    monkeypatch.setenv('ABP_AUTO_CONFIG',str(config));monkeypatch.delenv('CREDENTIALS_DIRECTORY',raising=False)
    pair=[dict(item,presenter=False),dict(item,presenter=True,concept_id='forbidden-presenter')]
    monkeypatch.setattr(worker,'candidates',lambda *a:(pair,[],{'planned_counts':{}}))
    monkeypatch.setattr(worker.scorecard,'load_manifests',lambda *a:[])
    monkeypatch.setattr(worker,'gpu_query',lambda args,*a:'0' if '--query-gpu=index' in args else '')
    original=worker.subprocess.run;calls=[]
    def run(command,**kw):
        if 'scripts.instagram_growth.factory.run' in command:
            assert '--graphics-only' in command
            items=json.loads(Path(command[command.index('--spec')+1]).read_text())['items']
            assert len(items)==1 and not items[0]['presenter'];calls.append(command)
            raise subprocess.CalledProcessError(1,command)
        assert command[0]!='node';return original(command,**kw)
    monkeypatch.setattr(worker.subprocess,'run',run)
    monkeypatch.setattr(sys,'argv',['worker','--dry-run','--state',str(state),'--output-root',str(root),'--limit','1'])
    with pytest.raises(RuntimeError,match='quarantined'):worker.main()
    assert len(calls)==1 and pause.read_text()=='GPU fault'
    assert json.loads(next(root.glob('budget-*.json')).read_text())=={'attempted':1,'rendered':1}
    assert json.loads((root/'status.json').read_text())['status']=='failed'


def test_graphics_runner_rejects_presenter_before_any_model(tmp_path,monkeypatch):
    item=city();item['presenter']=True;spec=tmp_path/'spec.json';spec.write_text(json.dumps({'items':[item]}))
    monkeypatch.setattr(subprocess,'run',lambda *a,**kw:pytest.fail('must reject before subprocess'))
    monkeypatch.setattr(sys,'argv',['run','--spec',str(spec),'--output',str(tmp_path/'out'),'--graphics-only'])
    from scripts.instagram_growth.factory import run
    with pytest.raises(ValueError,match='rejects presenter'):run.main()


def test_launcher_keeps_fault_latch_and_rejects_changed_hold(tmp_path,monkeypatch):
    folder=tmp_path/'.config/abp-instagram';folder.mkdir(parents=True);root=tmp_path/'auto';root.mkdir()
    pause=root/'GPU_FAULT.json';pause.write_text('GPU fault');cfg={'root':str(root),'source_repo':str(tmp_path/'repo'),'validated_graphics_fault_sha256':policy.sha(pause.read_bytes())}
    (folder/'auto.json').write_text(json.dumps(cfg));monkeypatch.setattr(Path,'home',lambda:tmp_path)
    calls=[]
    def git(command,**kw):
        if 'rev-parse' in command:return 'a'*40
        if 'worktree' in command:Path(command[-2]).mkdir(parents=True)
        return ''
    monkeypatch.setattr(subprocess,'check_output',git);monkeypatch.setattr(subprocess,'run',lambda *a,**kw:calls.append(kw))
    monkeypatch.setattr(sys,'argv',['launcher','--limit','1'])
    runpy.run_path('deploy/abp-instagram-auto.py',run_name='__main__')
    assert len(calls)==1 and calls[0]['env']['OMP_NUM_THREADS']=='4'
    assert pause.read_text()=='GPU fault'
    pause.write_text('new strategic hold')
    with pytest.raises(SystemExit,match='GPU fault'):runpy.run_path('deploy/abp-instagram-auto.py',run_name='__main__')
    assert len(calls)==1


def test_native_production_refused_before_credentials(tmp_path,monkeypatch):
    cfg=tmp_path/'config.json';cfg.write_text(json.dumps({'root':str(tmp_path/'root'),'production_mode':'native','enabled':True}))
    monkeypatch.setenv('ABP_AUTO_CONFIG',str(cfg));monkeypatch.setattr(sys,'argv',['worker','--limit','1'])
    with pytest.raises(RuntimeError,match='remains disabled'):worker.main()


def test_genuine_published_v1_stays_valid_and_unknown_runtime_does_not(tmp_path,monkeypatch):
    manifest=json.loads(Path('tests/fixtures/instagram/published-auto-v1.json').read_text())
    assert admission.verify_manifest(manifest)['admission']['runtime_digest']==admission.LEGACY_RUNTIME
    key=keys(tmp_path,monkeypatch)
    changed=json.loads(json.dumps(manifest));changed['admission']['runtime_digest']='0'*64
    with pytest.raises(policy.Quarantine,match='stale_or_changed'):admission.verify_manifest(admission.seal(changed,key))
    changed=json.loads(json.dumps(manifest));changed['script']['scenes'][1]['narration']='An unsupported generated factual claim.'
    with pytest.raises(policy.Quarantine):admission.verify_manifest(admission.seal(changed,key))


def test_new_device_incident_archives_evidence_and_revokes_validation(tmp_path):
    fault=tmp_path/'GPU_FAULT.json';fault.write_text('historical incident bytes')
    authorized={'validated_graphics_fault_sha256':policy.sha(fault.read_bytes())}
    worker.check_pause(tmp_path,authorized)
    with pytest.raises(worker.GpuUnavailable):worker.pause_unavailable_gpu(tmp_path)
    assert (tmp_path/('gpu-fault-'+policy.sha(b'historical incident bytes')+'.json')).read_bytes()==b'historical incident bytes'
    assert policy.sha(fault.read_bytes())!=authorized['validated_graphics_fault_sha256']
    with pytest.raises(RuntimeError,match='kill switch'):worker.check_pause(tmp_path,authorized)


def test_operator_hold_blocks_upload_before_reading_pending_media(tmp_path):
    (tmp_path/'PAUSE').write_text('stop now')
    with pytest.raises(RuntimeError,match='kill switch'):worker.finish_upload(tmp_path,tmp_path/'does-not-exist.json')


def test_unvalidated_gpu_production_refused_before_credentials(tmp_path,monkeypatch):
    cfg=tmp_path/'config.json';cfg.write_text(json.dumps({'root':str(tmp_path/'root'),'enabled':True}))
    monkeypatch.setenv('ABP_AUTO_CONFIG',str(cfg));monkeypatch.setattr(sys,'argv',['worker','--limit','1'])
    with pytest.raises(RuntimeError,match='bounded validation'):worker.main()
