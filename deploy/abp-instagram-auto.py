#!/usr/bin/env python3
"""Run reviewed public main in an isolated checkout; never pull/reset user work.

Installed as a user-local launcher, not executed from generated media. GitHub
publishing credentials remain exclusively on GitHub-hosted runners.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

config_path=Path.home()/'.config/abp-instagram/auto.json'
config=json.loads(config_path.read_text())
repo=Path(config['source_repo']);root=Path(config['root'])
root.mkdir(parents=True,exist_ok=True)
if (root/'PAUSE').exists():raise SystemExit('ABP local kill switch is active')
# Public repository; no GH_TOKEN, saved GitHub credentials or unreviewed branch.
env={k:v for k,v in os.environ.items() if k not in ('GH_TOKEN','GITHUB_TOKEN','INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_USER_ID')}
env['GIT_TERMINAL_PROMPT']='0'
def git(*args):return subprocess.check_output(['git','-c','credential.helper=','-C',str(repo),*args],env=env,text=True).strip()
git('fetch','https://github.com/leonlinsx/avoid-boring-people.git','main')
head=git('rev-parse','FETCH_HEAD');checkout=root/'checkouts'/head
if not checkout.exists():
    checkout.parent.mkdir(parents=True,exist_ok=True)
    git('worktree','add','--detach',str(checkout),head)
if not (checkout/'node_modules').exists():(checkout/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
env.update(ABP_AUTO_CONFIG=str(config_path),ABP_GPU_ROOT=str(repo/'.tmp/instagram-growth'))
subprocess.run([str(repo/'.venv-ig-reels/bin/python'),'-m','scripts.instagram_growth.autonomy.worker',*sys.argv[1:]],cwd=checkout,env=env,check=True)
