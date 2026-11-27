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
            for item in pair:
                draft={**item,'video_sha256':'unrendered-'+item['concept_id']}
                promotion.duplicate(draft,seen)
                seen.append(draft)
            result+=pair
        except (policy.Quarantine,ValueError) as error:quarantined.append({'candidate':str(record.get('claim_id') if isinstance(record,dict) else record),'reason':str(error)})
    return result,quarantined,slots


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--limit',type=int,default=12);p.add_argument('--canary',action='store_true');p.add_argument('--seed-render',type=Path);args=p.parse_args()
    if not 1<=args.limit<=21:p.error('1–21 assets per invocation')
    config=json.loads(Path(os.environ['ABP_AUTO_CONFIG']).read_text());root=Path(config['root']);root.mkdir(parents=True,exist_ok=True)
    with (root/'worker.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise RuntimeError('another GPU worker owns the lock')
        if (root/'PAUSE').exists():raise RuntimeError('local kill switch PAUSE exists')
        if not config.get('enabled') and not args.canary:raise RuntimeError('continuous generation is not activated')
        # Crash recovery retries only immutable hosting, never regenerates or posts.
        for pending in sorted((root/'runs').glob('*/*-upload.json')):
            request=json.loads(pending.read_text());m=admission.verify_manifest(request['manifest'])
            receipt=root/'uploads'/f'{m["concept_id"]}.json'
            if receipt.exists():continue
            response=subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(pending)],check=True,capture_output=True,text=True,timeout=300)
            receipt.parent.mkdir(exist_ok=True);write(receipt,json.loads(response.stdout))
        state_response=requests.get('https://raw.githubusercontent.com/leonlinsx/avoid-boring-people/abp-instagram-state/instagram-state.json',params={'v':int(time.time())},headers={'Cache-Control':'no-cache'},timeout=30)
        state_response.raise_for_status();state=state_response.json()
        if state.get('account')!='avoidboringpeople':raise RuntimeError('wrong durable account')
        if not args.canary and not state.get('auto_canary_verified'):raise RuntimeError('automatic canary not verified')
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
            plan=[policy.compile_script(record,presenter=p) for p in (False,True)];needed=min(2,args.limit)
        key=Path(os.environ.get('CREDENTIALS_DIRECTORY',''))/'auto-admission-key' if os.environ.get('CREDENTIALS_DIRECTORY') else Path(config['signing_key'])
        start=time.monotonic();admitted=[];failures=[]
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
            if concept in prior:continue
            factory['attempted']+=1;budget['attempted']+=1;write(ledger,budget)
            out=seed.get(concept,run/item['pair_id'])
            try:
                if concept not in seed and not (out/'verification.json').exists():
                    members=[x for x in plan if x['pair_id']==item['pair_id']][:needed-len(admitted)]
                    out.mkdir(parents=True,exist_ok=True);spec=out/'spec.json';write(spec,{'items':members})
                    subprocess.run([sys.executable,'-m','scripts.instagram_growth.factory.run','--spec',str(spec),'--output',str(out),'--voice',item['voice'],'--limit',str(len(members))],check=True,timeout=3600)
                frozen=json.loads((out/'briefs.json').read_text())['items']
                if item not in frozen:raise policy.Quarantine('seed_script_mismatch')
                video=out/'final'/f'{concept}-REVIEW_ONLY.mp4';meta=json.loads(video.with_suffix('.manifest.json').read_text())
                asr=json.loads((out/'audio'/f'{concept}-independent-asr.json').read_text())['text']
                if policy.sha(video.read_bytes())!=meta['sha256']:raise policy.Quarantine('rendered_bytes_changed')
                manifest=admission.admit(item,meta,asr,key);admission.verify_manifest(manifest)
                write(root/'admitted'/f'{concept}.json',manifest)
                request=run/f'{concept}-upload.json'
                factory['admitted']+=1;factory['elapsed_seconds']=round(time.monotonic()-start,2)
                write(request,{'manifest':manifest,'local_video':str(video),'factory':factory})
                result=subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(request)],check=True,capture_output=True,text=True,timeout=300)
                receipt=json.loads(result.stdout);write(root/'uploads'/f'{concept}.json',receipt)
                admitted.append(concept);budget['rendered']+=1;write(ledger,budget)
            except (subprocess.SubprocessError,policy.Quarantine,ValueError,KeyError) as error:
                failures.append({'concept_id':concept,'error':type(error).__name__,'reason':str(error)[:200]});factory['quarantined']+=1
                write(run/'failures.json',failures)
                # Three media failures is a quality circuit; no blind rerender loop.
                if len(failures)>=3:break
        factory.update(completed_at=datetime.now(timezone.utc).isoformat(),elapsed_seconds=round(time.monotonic()-start,2),newly_hosted=len(admitted),inventory_before=inventory['approved_unpublished'],remaining_eligible=max(0,len(plan)-factory['attempted']),status='failed' if failures else 'healthy')
        write(run/'factory-report.json',factory);write(root/'status.json',factory)
        # Refresh signed heartbeat even when inventory is full; all data are from
        # a previously signed immutable admission, never a fabricated new approval.
        if not admitted and not failures and local:
            m=json.loads(local[-1].read_text());receipt=json.loads((root/'uploads'/f'{m["concept_id"]}.json').read_text())
            video=root/'heartbeat.mp4';response=requests.get(receipt['video_url'],timeout=60);response.raise_for_status();video.write_bytes(response.content)
            request=run/'heartbeat.json';write(request,{'manifest':m,'local_video':str(video),'factory':factory})
            subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(request)],check=True,timeout=300)
        print(json.dumps(factory,indent=2),flush=True)
        if failures:raise RuntimeError('automatic factory quarantined failures; inspect durable report')


if __name__=='__main__':main()
