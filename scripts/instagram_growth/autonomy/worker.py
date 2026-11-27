"""Bounded unattended local GPU producer. No Instagram or GitHub write token."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import requests
from scripts.instagram_growth.autonomy import policy, admission, promotion
from scripts.instagram_growth.factory import allocation
from scripts.instagram_growth import scorecard


def write(path, value):
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(path)


def upload_request(manifest,video,factory):
    # JS JSON.stringify changes Python 0.0 to 0. Preserve exact signed bytes
    # rather than changing the established signature/canonicalization policy.
    return {'manifest':manifest,'local_video':str(video),'factory':factory,
            'signing_payload':policy.canonical(admission.unsigned(manifest)).decode(),
            'manifest_json':policy.canonical(manifest).decode()}


def reserve_render(budget,count,ledger):
    """Reserve before GPU work; failed/crashed work never refunds the cap."""
    if count<1 or budget['rendered']+count>21:raise RuntimeError('weekly render budget exhausted')
    budget['rendered']+=count;write(ledger,budget)


def require_idle_gpu():
    active=subprocess.check_output(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'],text=True,timeout=15).strip()
    if active:raise RuntimeError('GPU busy; defer without terminating other processes')


def candidates(state, previous):
    records,quarantined=policy.discover()
    # Round-robin articles instead of exhausting adjacent paragraphs of one essay.
    records.sort(key=lambda r:(sum(x['source_file']==r['source_file'] for x in previous),r['source_file'],r['claim_id']))
    units=[('source',r) for r in records]+[('reference',i) for i in policy.REFERENCE_INDICES]
    slots=allocation.plan(40,state);result=[];seen=list(previous)
    for n,(kind,record) in enumerate(units):
        slot=slots['slots'][n%len(slots['slots'])]
        kwargs={'voice':slot['voice'],'visual':slot['visual_style'],'caption_words':slot['caption_words'],'bucket':slot['experiment_bucket']}
        try:
            pair=[policy.compile_script(record,presenter=p,**kwargs) if kind=='source' else policy.compile_reference(record,presenter=p,**kwargs) for p in (False,True)]
            # Duplicate screening uses the same fields before video hashes exist.
            fresh=[]
            for item in pair:
                if any(old['concept_id']==item['concept_id'] for old in seen):continue
                draft={**item,'video_sha256':'unrendered-'+item['concept_id']}
                promotion.duplicate(draft,seen)
                seen.append(draft);fresh.append(item)
            result+=fresh
        except (policy.Quarantine,ValueError) as error:quarantined.append({'candidate':str(record.get('claim_id') if isinstance(record,dict) else record),'reason':str(error)})
    return result,quarantined,slots


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--limit',type=int,default=12);p.add_argument('--canary',action='store_true');p.add_argument('--seed-render',type=Path)
    p.add_argument('--dry-run',action='store_true',help='Offline rendering/verification, no hosting or publication')
    p.add_argument('--output-root',type=Path,help='Required disposable output root for dry-run')
    p.add_argument('--state',type=Path,help='Offline aggregate snapshot, dry-run only');args=p.parse_args()
    if not 1<=args.limit<=21:p.error('1–21 assets per invocation')
    if args.dry_run and not args.output_root:p.error('dry-run requires its own --output-root')
    if not args.dry_run and (args.output_root or args.state):p.error('output/state overrides are dry-run only')
    config=json.loads(Path(os.environ['ABP_AUTO_CONFIG']).read_text());root=args.output_root if args.dry_run else Path(config['root'])
    if args.dry_run and root.resolve()==Path(config['root']).resolve():p.error('dry-run must not use production state')
    root.mkdir(parents=True,exist_ok=True)
    with (root/'worker.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise RuntimeError('another GPU worker owns the lock')
        if (root/'PAUSE').exists():raise RuntimeError('local kill switch PAUSE exists')
        if not config.get('enabled') and not (args.canary or args.dry_run):raise RuntimeError('continuous generation is not activated')
        (root/'admitted').mkdir(exist_ok=True);(root/'uploads').mkdir(exist_ok=True)
        # Crash recovery retries only immutable hosting, never regenerates or posts.
        for pending in sorted((root/'runs').glob('*/*-upload.json')):
            if args.dry_run:break
            request=json.loads(pending.read_text());m=admission.verify_manifest(request['manifest'])
            if 'signing_payload' not in request or 'manifest_json' not in request:
                write(pending,upload_request(m,request['local_video'],request['factory']))
            receipt=root/'uploads'/f'{m["concept_id"]}.json'
            if receipt.exists():continue
            response=subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(pending)],check=True,capture_output=True,text=True,timeout=300)
            receipt.parent.mkdir(exist_ok=True);write(receipt,json.loads(response.stdout))
            write(root/'admitted'/f'{m["concept_id"]}.json',m)
        if args.state:state=json.loads(args.state.read_text())
        else:
            state_response=requests.get('https://raw.githubusercontent.com/leonlinsx/avoid-boring-people/abp-instagram-state/instagram-state.json',params={'v':int(time.time())},headers={'Cache-Control':'no-cache'},timeout=30)
            state_response.raise_for_status();state=state_response.json()
        if state.get('account')!='avoidboringpeople':raise RuntimeError('wrong durable account')
        if not (args.canary or args.dry_run) and not state.get('auto_canary_verified'):raise RuntimeError('automatic canary not verified')
        existing=scorecard.load_manifests('scripts/instagram_growth/approved')+[x['manifest'] for x in state.get('auto_inventory',{}).values()]
        local=list((root/'admitted').glob('*.json'));prior={x['concept_id']:x for x in existing}
        for file in local:
            m=json.loads(file.read_text());admission.verify_manifest(m);prior[m['concept_id']]=m
        inventory=scorecard.inventory(list(prior.values()),state,datetime.now(timezone.utc))
        needed=min(args.limit,max(0,21-inventory['approved_unpublished']))
        plan,quarantined,slots=candidates(state,list(prior.values()))
        week=datetime.now(timezone.utc).strftime('%G-W%V');ledger=root/f'budget-{week}.json'
        budget=json.loads(ledger.read_text()) if ledger.exists() else {'attempted':0,'rendered':0}
        needed=min(needed,max(0,21-budget['rendered']),max(0,40-budget['attempted']))
        if args.canary:
            plan=[x for x in plan if x['source_file']=='src/content/blog/2020_08_19_city/index.md' and x['claim_id']=='claim-e54e87db222ee4fe66d84d2b']
            # Fixed canary treatment must be exactly the shadow-tested low-risk pair.
            record=next(r for r in policy.discover()[0] if r['claim_id']=='claim-e54e87db222ee4fe66d84d2b')
            plan=[policy.compile_script(record,presenter=p,bucket='control') for p in (False,True)];needed=min(2,args.limit)
        key=Path(os.environ.get('CREDENTIALS_DIRECTORY',''))/'auto-admission-key' if os.environ.get('CREDENTIALS_DIRECTORY') else Path(config['signing_key'])
        if key.stat().st_mode&0o077:raise RuntimeError('automatic signing credential must be owner-only')
        start=time.monotonic();admitted=[];failures=[];reserved=set();failed_pairs=set()
        run=root/'runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');run.mkdir(parents=True)
        factory={'started_at':datetime.now(timezone.utc).isoformat(),'policy':policy.VERSION,'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
                 'eligible_source_units':len(plan)//2,'source_quarantined':len(quarantined),'attempted':0,'admitted':0,'quarantined':0,
                 'allocation':slots['planned_counts'],'exploitation':'Reassigned to exploration without cross-article replication',
                 'software_spend_usd':0,'electricity_cost':'Not metered; unavailable','gpu':'RTX 5070 Ti 16GB','gpu_busy_policy':'Never terminate unrelated processes'}
        write(run/'source-quarantine.json',quarantined)
        (root/'admitted').mkdir(exist_ok=True);(root/'uploads').mkdir(exist_ok=True)
        # Completed shadow media is immutable input only; all admission checks rerun.
        seed={x['concept_id']:args.seed_render for x in json.loads((args.seed_render/'briefs.json').read_text())['items']} if args.seed_render else {}
        for item in plan:
            if len(admitted)>=needed:break
            concept=item['concept_id']
            if concept in prior or item['pair_id'] in failed_pairs:continue
            if budget['attempted']>=40:break
            if time.monotonic()-start>5400:raise RuntimeError('factory wall-clock budget exhausted')
            out=seed.get(concept,run/item['pair_id'])
            if concept not in reserved:
                members=[x for x in plan if x['pair_id']==item['pair_id'] and x['concept_id'] not in prior][:min(needed-len(admitted),21-budget['rendered'])]
                if not members:break
                if concept not in seed:require_idle_gpu()
                reserve_render(budget,len(members),ledger);reserved.update(x['concept_id'] for x in members)
            factory['attempted']+=1;budget['attempted']+=1;write(ledger,budget)
            try:
                if concept not in seed and not (out/'verification.json').exists():
                    members=[x for x in plan if x['pair_id']==item['pair_id'] and x['concept_id'] in reserved]
                    out.mkdir(parents=True,exist_ok=True);spec=out/'spec.json';write(spec,{'items':members})
                    subprocess.run([sys.executable,'-m','scripts.instagram_growth.factory.run','--spec',str(spec),'--output',str(out),'--voice',item['voice'],'--limit',str(len(members))],check=True,timeout=min(3600,max(1,5400-(time.monotonic()-start))))
                frozen=json.loads((out/'briefs.json').read_text())['items']
                if item not in frozen:raise policy.Quarantine('seed_script_mismatch')
                video=out/'final'/f'{concept}-REVIEW_ONLY.mp4';meta=json.loads(video.with_suffix('.manifest.json').read_text())
                asr=json.loads((out/'audio'/f'{concept}-independent-asr.json').read_text())['text']
                if policy.sha(video.read_bytes())!=meta['sha256']:raise policy.Quarantine('rendered_bytes_changed')
                manifest=admission.admit(item,meta,asr,key);admission.verify_manifest(manifest)
                request=run/f'{concept}-upload.json'
                factory['admitted']+=1;factory['elapsed_seconds']=round(time.monotonic()-start,2)
                if args.dry_run:
                    write(root/'admitted'/f'{concept}.json',manifest);admitted.append(concept);continue
                # Persist recovery intent before local inventory counts the item.
                write(request,upload_request(manifest,video,factory))
                write(root/'admitted'/f'{concept}.json',manifest)
                result=subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(request)],check=True,capture_output=True,text=True,timeout=300)
                receipt=json.loads(result.stdout);write(root/'uploads'/f'{concept}.json',receipt)
                write(root/'heartbeat.json',{'at':datetime.now(timezone.utc).isoformat()})
                admitted.append(concept)
            except (subprocess.SubprocessError,policy.Quarantine,ValueError,KeyError) as error:
                failures.append({'concept_id':concept,'error':type(error).__name__,'reason':str(error)[:200]});factory['quarantined']+=1
                failed_pairs.add(item['pair_id'])
                write(run/'failures.json',failures)
                # Three media failures is a quality circuit; no blind rerender loop.
                if len(failures)>=3:break
        factory.update(completed_at=datetime.now(timezone.utc).isoformat(),elapsed_seconds=round(time.monotonic()-start,2),newly_hosted=0 if args.dry_run else len(admitted),offline_verified=len(admitted) if args.dry_run else None,inventory_before=inventory['approved_unpublished'],remaining_eligible=max(0,len(plan)-factory['attempted']),weekly_render_reservations=budget['rendered'],status='failed' if failures else 'verified_offline' if args.dry_run else 'healthy')
        if len(admitted)<needed and (budget['rendered']>=21 or budget['attempted']>=40):factory['pause_reason']='weekly_budget_exhausted'
        if needed and not plan:factory.update(status='source_exhausted',pause_reason='no_fresh_admissible_claims')
        write(run/'factory-report.json',factory);write(root/'status.json',factory)
        # Refresh signed heartbeat even when inventory is full; all data are from
        # a previously signed immutable admission, never a fabricated new approval.
        heartbeat=json.loads((root/'heartbeat.json').read_text()) if (root/'heartbeat.json').exists() else None
        refresh_due=not heartbeat or (datetime.now(timezone.utc)-datetime.fromisoformat(heartbeat['at'])).total_seconds()>=86400
        if not args.dry_run and not admitted and not failures and local and refresh_due:
            m=json.loads(local[-1].read_text());receipt=json.loads((root/'uploads'/f'{m["concept_id"]}.json').read_text())
            video=root/'heartbeat.mp4';response=requests.get(receipt['video_url'],timeout=60);response.raise_for_status();video.write_bytes(response.content)
            request=run/'heartbeat.json';write(request,upload_request(m,video,factory))
            subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(request)],check=True,timeout=300)
            write(root/'heartbeat.json',{'at':datetime.now(timezone.utc).isoformat()})
        print(json.dumps(factory,indent=2),flush=True)
        if failures:raise RuntimeError('automatic factory quarantined failures; inspect durable report')


if __name__=='__main__':
    try:main()
    except Exception as error:
        print('instagram_factory_alert automatic_factory_failure '+type(error).__name__,flush=True)
        parser=argparse.ArgumentParser(add_help=False);parser.add_argument('--output-root',type=Path)
        args,_=parser.parse_known_args()
        try:
            config=json.loads(Path(os.environ['ABP_AUTO_CONFIG']).read_text())
            root=args.output_root or Path(config['root']);root.mkdir(parents=True,exist_ok=True)
            write(root/'status.json',{'status':'failed','error_type':type(error).__name__,'captured_at':datetime.now(timezone.utc).isoformat()})
        except (OSError,ValueError,KeyError):pass
        raise
