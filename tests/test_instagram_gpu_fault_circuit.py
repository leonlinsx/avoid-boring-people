"""CPU-only simulation of device loss; no CUDA or actual nvidia-smi calls."""
import json
from pathlib import Path
import subprocess
import sys

import pytest

from scripts.instagram_growth.autonomy import worker,policy,admission
from tests.test_instagram_auto_policy import city,keys


def test_idle_control_and_busy_deferral_do_not_create_a_persistent_hold(tmp_path,monkeypatch):
    busy=False;calls=[]
    def query(command,**kwargs):
        calls.append(command)
        assert kwargs['timeout']==15 and kwargs['stderr']==subprocess.DEVNULL
        return '0\n' if '--query-gpu=index' in command else '1234\n' if busy else ''
    monkeypatch.setattr(worker.subprocess,'check_output',query)
    worker.require_idle_gpu(tmp_path)
    busy=True
    with pytest.raises(RuntimeError,match='GPU busy'):worker.require_idle_gpu(tmp_path)
    assert len(calls)==4 and not (tmp_path/'PAUSE').exists()


@pytest.mark.parametrize('response',['','Unknown Error','No devices were found'])
def test_missing_or_malformed_device_response_creates_owner_only_hold(tmp_path,monkeypatch,response):
    monkeypatch.setattr(worker.subprocess,'check_output',lambda *a,**k:response)
    with pytest.raises(worker.GpuUnavailable):worker.require_idle_gpu(tmp_path)
    pause=tmp_path/'PAUSE'
    assert json.loads(pause.read_text())['reason']=='gpu_device_unavailable'
    assert pause.stat().st_mode&0o777==0o600


@pytest.mark.parametrize('failure',[subprocess.CalledProcessError(6,['fixture'],stderr='private diagnostic'),subprocess.TimeoutExpired(['fixture'],15),FileNotFoundError('fixture')])
def test_failed_probe_is_durable_and_does_not_persist_raw_error(tmp_path,monkeypatch,failure):
    def query(*a,**k):raise failure
    monkeypatch.setattr(worker.subprocess,'check_output',query)
    with pytest.raises(worker.GpuUnavailable):worker.require_idle_gpu(tmp_path)
    assert 'private diagnostic' not in (tmp_path/'PAUSE').read_text()


def test_existing_owner_pause_is_preserved(tmp_path,monkeypatch):
    pause=tmp_path/'PAUSE';pause.write_text('owner strategic hold')
    monkeypatch.setattr(worker.subprocess,'check_output',lambda *a,**k:'')
    with pytest.raises(worker.GpuUnavailable):worker.require_gpu(tmp_path)
    assert pause.read_text()=='owner strategic hold'


def test_render_device_loss_halts_before_another_model_and_survives_restart(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);i=city();record=policy.source_record(i['source_file'],i['source_anchor'])
    other=next(r for r in policy.discover()[0] if r['claim_id']!=record['claim_id'])
    plan=[policy.compile_script(r,presenter=p) for r in (record,other) for p in (False,True)]
    production=tmp_path/'production';root=tmp_path/'offline';config=tmp_path/'config.json';state=tmp_path/'state.json'
    config.write_text(json.dumps({'root':str(production),'enabled':False,'signing_key':str(key),'production_mode':'native'}));state.write_text(json.dumps({'account':'avoidboringpeople','receipts':{}}))
    monkeypatch.setenv('ABP_AUTO_CONFIG',str(config));monkeypatch.delenv('CREDENTIALS_DIRECTORY',raising=False)
    monkeypatch.setattr(worker.requests,'get',lambda *a,**k:pytest.fail('offline path must not fetch public data'))
    monkeypatch.setattr(worker.scorecard,'load_manifests',lambda *a:[])
    monkeypatch.setattr(worker,'candidates',lambda *a:(plan,[],{'planned_counts':{'exploration':24,'exploitation':10,'control':6}}))
    render_calls=[];original_query=worker.subprocess.check_output;original_run=worker.subprocess.run
    def query(command,**kwargs):
        if command[0]!='nvidia-smi':return original_query(command,**kwargs)
        if render_calls:raise subprocess.CalledProcessError(6,command,stderr='GPU has fallen off the bus')
        return '0\n' if '--query-gpu=index' in command else ''
    def run(command,**kwargs):
        if 'scripts.instagram_growth.factory.run' in command:
            render_calls.append(command);raise subprocess.CalledProcessError(1,command)
        assert command[0]!='node','failed render must not upload'
        return original_run(command,**kwargs)
    monkeypatch.setattr(worker.subprocess,'check_output',query);monkeypatch.setattr(worker.subprocess,'run',run)
    monkeypatch.setattr(sys,'argv',['worker','--dry-run','--state',str(state),'--output-root',str(root),'--limit','4'])
    with pytest.raises((RuntimeError,subprocess.SubprocessError)):worker.main()
    assert len(render_calls)==1
    assert (root/'PAUSE').exists(),'lost GPU must persist PAUSE'
    assert not production.exists()
    budget=json.loads(next(root.glob('budget-*.json')).read_text())
    assert budget=={'attempted':1,'rendered':2}
    # A later healthy boot cannot automatically clear the existing kill switch.
    monkeypatch.setattr(worker.subprocess,'check_output',lambda *a,**k:pytest.fail('restart must stop before any GPU query'))
    with pytest.raises(RuntimeError,match='kill switch'):worker.main()
    assert len(render_calls)==1


def test_orchestration_change_preserves_attestation_but_renderer_change_does_not(tmp_path,monkeypatch):
    source=Path(admission.__file__).resolve().parents[1];expected=admission.runtime_digest()
    for name in admission.RUNTIME_FILES:
        target=tmp_path/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((source/name).read_bytes())
    monkeypatch.setattr(admission,'__file__',str(tmp_path/'autonomy/admission.py'))
    assert admission.runtime_digest()==expected
    (tmp_path/'autonomy/worker.py').write_text('disposable orchestration change')
    assert admission.runtime_digest()==expected
    renderer=tmp_path/'factory/render.py';renderer.write_bytes(renderer.read_bytes()+b'\n# disposable renderer mutation\n')
    assert admission.runtime_digest()!=expected
