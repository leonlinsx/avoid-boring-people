"""Supervise one serialized, bounded GPU stage; never reset hardware or retry."""
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time


def query():
    value=subprocess.check_output(['nvidia-smi','--query-gpu=index,memory.used','--format=csv,noheader,nounits'],text=True,stderr=subprocess.DEVNULL,timeout=10).strip()
    rows=[row.split(',') for row in value.splitlines()]
    if len(rows)!=1 or len(rows[0])!=2 or not all(x.strip().isdecimal() for x in rows[0]):raise RuntimeError('GPU device unavailable')
    return int(rows[0][1])


def driver_errors(since):
    result=subprocess.run(['journalctl','-k','--since',since,'--no-pager','-o','cat'],capture_output=True,text=True,timeout=10,check=True)
    return [line[:1000] for line in result.stdout.splitlines() if re.search(r'NVRM:.*(?:Xid|GPU.*fallen off)',line)]


def run(command,log,out,*,timeout=900,env=None):
    started=datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    # Failure to inspect health is a visible stop, never inferred stability.
    peak=query();driver_errors(started)
    baseline=peak
    if peak>6144:raise RuntimeError('GPU device memory budget unavailable')
    process=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env=env)
    deadline=time.monotonic()+timeout;reason=None;errors=[]
    try:
        while process.poll() is None:
            try:peak=max(peak,query())
            except (OSError,RuntimeError,subprocess.SubprocessError):reason='device_lost';break
            if peak>6144:reason='vram_budget_exceeded';break
            if time.monotonic()>deadline:reason='stage_timeout';break
            time.sleep(.5)
        if reason:
            os.killpg(process.pid,signal.SIGTERM)
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=10)
        try:
            peak=max(peak,query());errors=driver_errors(started)
            if errors:reason='driver_error'
        except (OSError,RuntimeError,subprocess.SubprocessError):reason='device_lost'
    finally:
        if process.poll() is None:
            os.killpg(process.pid,signal.SIGTERM);process.wait(timeout=10)
    evidence={'stage':Path(command[-1]).name,'captured_at':datetime.now(timezone.utc).isoformat(),'baseline_device_used_mib':baseline,'peak_device_used_mib':peak,'max_device_used_mib':6144,'timeout_seconds':timeout,'exit_code':process.returncode,'reason':reason,'new_driver_errors':errors}
    (out/(Path(command[-1]).name+'.gpu.json')).write_text(json.dumps(evidence,indent=2)+'\n')
    if reason in ('device_lost','driver_error'):(out/'gpu-fault.json').write_text(json.dumps(evidence,indent=2)+'\n')
    if reason or process.returncode:raise subprocess.CalledProcessError(process.returncode or 1,command)
