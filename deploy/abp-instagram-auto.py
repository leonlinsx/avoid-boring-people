#!/usr/bin/env python3
"""Run reviewed public main in an isolated checkout; never pull/reset user work.

Installed as a user-local launcher, not executed from generated media. GitHub
publishing credentials remain exclusively on GitHub-hosted runners.
"""
import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import shutil

config_path=Path.home()/'.config/abp-instagram/auto.json'
config=json.loads(config_path.read_text())
repo=Path(config['source_repo']);root=Path(config['root'])
root.mkdir(parents=True,exist_ok=True)
pause=root/'PAUSE'
if config.get('production_mode','graphics_gpu')!='graphics_gpu':raise SystemExit('Native presenter production remains disabled')
if pause.exists():raise SystemExit('ABP local kill switch is active')
fault=root/'GPU_FAULT.json'
if fault.exists() and config.get('validated_graphics_fault_sha256')!=hashlib.sha256(fault.read_bytes()).hexdigest():
    raise SystemExit('GPU fault requires explicit workload validation/recovery')
# Forward runtime settings only, never unrelated shell/user-manager credentials.
allowed=('PATH','HOME','USER','LOGNAME','LANG','LC_ALL','XDG_CACHE_HOME','XDG_CONFIG_HOME',
         'XDG_DATA_HOME','XDG_RUNTIME_DIR','CREDENTIALS_DIRECTORY','CUDA_VISIBLE_DEVICES',
         'LD_LIBRARY_PATH','PYTORCH_CUDA_ALLOC_CONF','SSL_CERT_FILE','SSL_CERT_DIR',
         'REQUESTS_CA_BUNDLE','NODE_EXTRA_CA_CERTS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY',
         'NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy')
env={k:os.environ[k] for k in allowed if k in os.environ}
node=config.get('node_executable') or shutil.which('node',path=env.get('PATH',os.defpath))
if not node or not Path(node).is_absolute() or not Path(node).is_file() or not os.access(node,os.X_OK):
    raise SystemExit('Configure node_executable with the existing absolute Node binary; service PATH has no usable Node')
env['PATH']=str(Path(node).parent)+os.pathsep+env.get('PATH',os.defpath)
env.update(OMP_NUM_THREADS='4',MKL_NUM_THREADS='4',OPENBLAS_NUM_THREADS='4',OPENCV_OPENCL_RUNTIME='disabled',HF_HUB_OFFLINE='1')
env['GIT_TERMINAL_PROMPT']='0'
def git(*args):return subprocess.check_output(['git','-c','credential.helper=','-C',str(repo),*args],env=env,text=True).strip()
git('fetch','https://github.com/leonlinsx/avoid-boring-people.git','refs/heads/main:refs/abp-instagram/main')
# FETCH_HEAD is shared with other worktrees and can change during their fetch.
head=git('rev-parse','refs/abp-instagram/main');checkout=root/'checkouts'/head
if not checkout.exists():
    checkout.parent.mkdir(parents=True,exist_ok=True)
    git('worktree','add','--detach',str(checkout),head)
if not (checkout/'node_modules').exists():(checkout/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
env.update(ABP_AUTO_CONFIG=str(config_path),ABP_GPU_ROOT=str(repo/'.tmp/instagram-growth'))
if config.get('creative_experiments') and config.get('research_enabled') and config.get('research_meta_credential_file'):
    credential=Path(config['research_meta_credential_file'])
    if not credential.is_absolute() or credential.stat().st_mode&0o077:raise SystemExit('Research credential must be an owner-only absolute file')
    secret=json.loads(credential.read_text())
    env.update(ABP_RESEARCH_META_TOKEN=secret['token'],ABP_RESEARCH_META_USER_ID=secret['user_id'])
subprocess.run([str(repo/'.venv-ig-reels/bin/python'),'-m','scripts.instagram_growth.autonomy.worker',*sys.argv[1:]],cwd=checkout,env=env,check=True)
