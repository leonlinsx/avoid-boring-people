"""Supervision fault cases without actual GPU, journal or model calls."""
import json
from pathlib import Path
import subprocess
import pytest
from scripts.instagram_growth.factory import gpu_guard as guard


class Process:
    pid=123456789
    def __init__(self):self.returncode=None;self.polls=0
    def poll(self):
        self.polls+=1
        if self.polls>1:self.returncode=0
        return self.returncode
    def wait(self,**kw):self.returncode=-15;return self.returncode


@pytest.mark.parametrize('fault',[None,'device_lost','driver_error','vram_budget_exceeded','stage_timeout'])
def test_supervisor_records_peaks_and_stops_only_its_process_group(tmp_path,monkeypatch,fault):
    p=Process();kills=[];queries=[]
    monkeypatch.setattr(guard.subprocess,'Popen',lambda *a,**k:p)
    def query():
        queries.append(1)
        if len(queries)>1 and fault=='device_lost':raise RuntimeError('lost device')
        return 7000 if len(queries)>1 and fault=='vram_budget_exceeded' else 2048
    monkeypatch.setattr(guard,'query',query)
    monkeypatch.setattr(guard,'driver_errors',lambda *a:['NVRM: Xid 79'] if len(queries)>1 and fault=='driver_error' else [])
    monkeypatch.setattr(guard.os,'killpg',lambda pid,sig:kills.append(pid))
    monkeypatch.setattr(guard.time,'sleep',lambda *a:None)
    with (tmp_path/'stage.log').open('w') as log:
        if fault:
            with pytest.raises(subprocess.CalledProcessError):guard.run(['python','audio.py'],log,tmp_path,timeout=-1 if fault=='stage_timeout' else 900)
        else:guard.run(['python','audio.py'],log,tmp_path)
    evidence=json.loads((tmp_path/'audio.py.gpu.json').read_text())
    assert evidence['reason']==fault
    assert (tmp_path/'gpu-fault.json').exists()==(fault in ('device_lost','driver_error'))
    assert all(pid==p.pid for pid in kills)
    if fault in ('device_lost','vram_budget_exceeded','stage_timeout'):assert kills==[p.pid]


def test_unreadable_monitor_does_not_start_a_stage(tmp_path,monkeypatch):
    monkeypatch.setattr(guard,'query',lambda:2048)
    def unavailable(*a):raise subprocess.CalledProcessError(1,['journalctl'])
    monkeypatch.setattr(guard,'driver_errors',unavailable)
    monkeypatch.setattr(guard.subprocess,'Popen',lambda *a,**k:pytest.fail('must fail before model'))
    with (tmp_path/'stage.log').open('w') as log:
        with pytest.raises(subprocess.CalledProcessError):guard.run(['python','audio.py'],log,tmp_path)
