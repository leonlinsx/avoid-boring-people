"""Bounded unattended local graphics producer. No Instagram or GitHub write token."""
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
from scripts.instagram_growth.autonomy import policy, admission, promotion,creative,research,renewal
from scripts.instagram_growth.factory import allocation
from scripts.instagram_growth import scorecard,retention


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


class GpuUnavailable(RuntimeError):
    pass


def pause_unavailable_gpu(root):
    """Use the existing durable kill switch; never overwrite an owner's hold."""
    if root is not None:
        fault=root/'GPU_FAULT.json'
        if fault.exists():
            archive=root/('gpu-fault-'+policy.sha(fault.read_bytes())+'.json')
            if not archive.exists():archive.write_bytes(fault.read_bytes())
        write(fault,{'reason':'gpu_device_unavailable','captured_at':datetime.now(timezone.utc).isoformat()})
        try:fd=os.open(root/'PAUSE',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        except FileExistsError:pass
        else:
            with os.fdopen(fd,'w') as out:
                json.dump({'reason':'gpu_device_unavailable','captured_at':datetime.now(timezone.utc).isoformat()},out)
    raise GpuUnavailable('GPU unavailable; generation requires operator recovery and clearing the existing PAUSE')


def gpu_query(arguments,root):
    try:return subprocess.check_output(['nvidia-smi',*arguments,'--format=csv,noheader,nounits'],text=True,stderr=subprocess.DEVNULL,timeout=15).strip()
    except (subprocess.SubprocessError,OSError):pause_unavailable_gpu(root)


def require_gpu(root=None):
    devices=gpu_query(['--query-gpu=index'],root).splitlines()
    if not devices or any(not row.strip().isdecimal() for row in devices):pause_unavailable_gpu(root)


def require_idle_gpu(root=None):
    require_gpu(root)
    active=gpu_query(['--query-compute-apps=pid'],root)
    if active:raise RuntimeError('GPU busy; defer without terminating other processes')


def gpu_workload_digest():
    # Bind recovery to the independently exercised inference/supervision code,
    # not unrelated captions, metadata or each individual Reel.
    root=Path(__file__).resolve().parents[1]/'factory'
    return policy.sha({name:policy.sha((root/name).read_bytes()) for name in ('audio.py','transcribe.py','run.py','gpu_guard.py')})


def graphics_mode(config):
    mode=config.get('production_mode','graphics_gpu')
    if mode not in ('graphics_gpu','native'):raise RuntimeError('unknown production mode')
    return mode=='graphics_gpu'


def check_pause(root,config):
    # PAUSE is always an operator/global stop. A separate immutable incident
    # record can authorize only a previously validated non-presenter workload.
    if (root/'PAUSE').exists():raise RuntimeError('local kill switch PAUSE exists')
    fault=root/'GPU_FAULT.json'
    if fault.exists() and not (graphics_mode(config) and config.get('validated_graphics_fault_sha256')==policy.sha(fault.read_bytes())):
        raise RuntimeError('GPU fault requires explicit workload validation/recovery')


def rendered_manifest(item,out,key):
    """Verify a frozen completed render without synthesizing it again."""
    if item not in json.loads((out/'briefs.json').read_text())['items']:raise policy.Quarantine('seed_script_mismatch')
    video=out/'final'/f'{item["concept_id"]}-REVIEW_ONLY.mp4'
    meta=json.loads(video.with_suffix('.manifest.json').read_text())
    asr=json.loads((out/'audio'/f'{item["concept_id"]}-independent-asr.json').read_text())['text']
    if policy.sha(video.read_bytes())!=meta['sha256']:raise policy.Quarantine('rendered_bytes_changed')
    manifest=admission.admit(item,meta,asr,key);admission.verify_manifest(manifest)
    return manifest,video


def finish_upload(root,pending):
    if (root/'PAUSE').exists():raise RuntimeError('local kill switch PAUSE exists')
    request=json.loads(pending.read_text());m=admission.verify_manifest(request['manifest'])
    if 'signing_payload' not in request or 'manifest_json' not in request:
        write(pending,upload_request(m,request['local_video'],request['factory']))
    receipt=root/'uploads'/f'{m["concept_id"]}.json'
    admitted=root/'admitted'/f'{m["concept_id"]}.json'
    if admitted.exists() and json.loads(admitted.read_text())!=m:raise policy.Quarantine('immutable_local_admission_changed')
    if receipt.exists():
        validate_upload_receipt(m,json.loads(receipt.read_text()))
        if not admitted.exists():write(admitted,m)
        return False
    result=subprocess.run(['node','scripts/instagram_growth/autonomy/storage.mjs','upload',str(pending)],check=True,capture_output=True,text=True,timeout=300)
    saved=json.loads(result.stdout)
    validate_upload_receipt(m,saved)
    write(receipt,saved);write(admitted,m)
    write(root/'heartbeat.json',{'at':datetime.now(timezone.utc).isoformat()})
    return True


def validate_upload_receipt(manifest,receipt):
    if (receipt.get('status')!='AUTO_HOSTED' or receipt.get('concept_id')!=manifest['concept_id']
        or receipt.get('manifest_sha256')!=policy.sha(policy.canonical(manifest))):
        raise RuntimeError('upload receipt does not bind the admitted envelope')


def recover(root,key,budget,ledger,limit,graphics=False):
    """Resume persisted uploads and untouched paired members; never rerender."""
    completed=[];known=set();quarantined=failed_concepts(root)
    for pending in sorted((root/'runs').glob('*/*-upload.json')):
        m=json.loads(pending.read_text())['manifest'];known.add(m['concept_id'])
        if graphics and m['script']['presenter']:continue
        if len(completed)>=limit:continue
        if finish_upload(root,pending):completed.append(m['concept_id'])
    for proof in sorted((root/'runs').glob('*/autopair-*/verification.json')):
        out=proof.parent
        members=json.loads((out/'briefs.json').read_text())['items']
        if any(item['concept_id'] in quarantined for item in members):continue
        for item in members:
            concept=item['concept_id']
            if graphics and item['presenter']:continue
            if concept in known or (root/'admitted'/f'{concept}.json').exists():continue
            if len(completed)>=limit or budget['attempted']>=40:return completed
            budget['attempted']+=1;write(ledger,budget)
            m,video=rendered_manifest(item,out,key)
            pending=out.parent/f'{concept}-upload.json'
            write(pending,upload_request(m,video,{'status':'recovering_completed_render','new_render':False}))
            if finish_upload(root,pending):completed.append(concept)
            known.add(concept)
    return completed


def failed_concepts(root):
    return {row['concept_id'] for path in (root/'runs').glob('*/failures.json')
            for row in json.loads(path.read_text()) if row.get('error') in
            ('Quarantine','ValueError','KeyError','CalledProcessError','TimeoutExpired')}


def renewable_candidates(state,previous,*,now=None,rejected=(),claim_ids=None):
    now=now or datetime.now(timezone.utc)
    records,quarantined=policy.discover();slots=allocation.plan(40,state,now=now)
    if claim_ids is not None:records=[r for r in records if r['claim_id'] in claim_ids]
    from scripts.instagram_growth.autonomy import editorial
    records=editorial.order(records,previous)
    seen=list(previous);result=[]
    for n,record in enumerate(records):
        slot=slots['slots'][n%len(slots['slots'])];bucket=slot['experiment_bucket']
        try:renewal.planning_spacing(record,seen,state,now=now)
        except policy.Quarantine as error:
            quarantined.append({'candidate':record['claim_id'],'reason':str(error)})
            continue
        choices=renewal.options(record,seen,state,now=now)
        if bucket=='control':
            baseline={'structure':'payoff' if len(record['source_sentences'])==1 else 'question',
                      'layout':'cards','audience':'making_a_choice'}
            choices=[c for c in choices if c['arm']==0 and renewal.specification(c)==baseline]
        elif bucket=='exploitation':
            evidence=slot.get('allocation_evidence') or {};params=evidence.get('production_parameters',{})
            frozen=params.get('creative',{})
            replication=(frozen.get('protocol')==renewal.PROTOCOL and record['topic']==evidence.get('topic')
                         and record['source_url'] not in evidence.get('source_articles',[]))
            choices=[c for c in choices if c==frozen] if replication else []
            if not choices:
                # Legacy evidence remains valid for its old production path;
                # it cannot silently become evidence for a new V2 structure.
                bucket='exploration';choices=renewal.options(record,seen,state,now=now)
        reason='useful_treatments_saturated'
        for value in choices:
            try:
                item=policy.compile_script(record,hook=0,voice='af_heart',visual='cards',caption_words=5,
                                           presenter=False,bucket=bucket,creative=value)
                if item['concept_id'] in rejected:
                    reason='previous_QA_rejection';continue
                draft={**item,'script':item,'video_sha256':'unrendered-'+item['concept_id']}
                promotion.duplicate(draft,seen)
                renewal.exposure(draft,seen,state,now=now)
                seen.append(draft);result.append(item);break
            except policy.Quarantine as error:
                reason=str(error)
                if reason.endswith('saturation') or reason=='claim_cooldown_or_pending':break
        else:
            quarantined.append({'candidate':record['claim_id'],'reason':reason})
            continue
        if not result or result[-1]['claim_id']!=record['claim_id']:
            quarantined.append({'candidate':record['claim_id'],'reason':reason})
    return result,quarantined,slots


def candidates(state, previous,*,experiments=False,research_cycle=None,shadow=False,graphics_only=False,now=None,rejected=()):
    if experiments and graphics_only and not shadow:return renewable_candidates(state,previous,now=now,rejected=rejected)
    records,quarantined=policy.discover()
    # Round-robin articles instead of exhausting adjacent paragraphs of one essay.
    records.sort(key=lambda r:(sum(x['source_file']==r['source_file'] for x in previous),r['source_file'],r['claim_id']))
    units=[('source',r) for r in records]+[('reference',i) for i in policy.REFERENCE_INDICES]
    slots=allocation.plan(40,state);result=[];seen=list(previous)
    for n in range(len(units)):
        slot=slots['slots'][n%len(slots['slots'])]
        evidence=slot.get('allocation_evidence');index=0
        if evidence:
            matches=[i for i,(kind,record) in enumerate(units) if kind=='source' and record['topic']==evidence['topic'] and record['source_url'] not in evidence['source_articles']]
            if matches:index=matches[0]
            else:slot={**slot,'experiment_bucket':'exploration','allocation_evidence':None};evidence=None
        kind,record=units.pop(index)
        kwargs={'voice':slot['voice'],'visual':slot['visual_style'],'caption_words':slot['caption_words'],'bucket':slot['experiment_bucket']}
        if kind=='source' and evidence:kwargs['hook']=evidence['production_parameters']['hook']
        try:
            if experiments:
                previous_script=next((old.get('script',old) for old in seen if kind=='source' and old.get('claim_id')==record['claim_id'] and old.get('script',old).get('template_parameters',{}).get('creative')),None)
                if previous_script:
                    kwargs={k:v for k,v in previous_script['template_parameters'].items() if k!='presenter'}
                elif kind=='source' and evidence and evidence['production_parameters'].get('creative'):
                    treatment=evidence['production_parameters']['creative']
                    if creative.has_capacity(treatment,seen):kwargs['creative']=treatment
                    else:
                        kwargs.update(bucket='exploration',creative={'protocol':creative.PROTOCOL,'factor':'baseline','arm':0,'evidence':None})
                else:
                    treatment=creative.choose(record,slot,seen,research_cycle or {},shadow=shadow,review=state.get('weekly_review')) if kind=='source' else {'protocol':creative.PROTOCOL,'factor':'baseline','arm':0,'evidence':None}
                    kwargs['creative']=treatment
                    if treatment['factor']!='baseline':kwargs.update(hook=0,voice='af_heart',visual='cards',caption_words=5)
            pair=[policy.compile_script(record,presenter=p,**kwargs) if kind=='source' else policy.compile_reference(record,presenter=p,**kwargs) for p in ((False,) if graphics_only else (False,True))]
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
    # Keep the separate read credential out of recovery/upload/model children.
    research_token=os.environ.pop('ABP_RESEARCH_META_TOKEN',None)
    research_user=os.environ.pop('ABP_RESEARCH_META_USER_ID',None)
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--limit',type=int,default=12);p.add_argument('--canary',action='store_true');p.add_argument('--seed-render',type=Path)
    p.add_argument('--dry-run',action='store_true',help='Offline rendering/verification, no hosting or publication')
    p.add_argument('--output-root',type=Path,help='Required disposable output root for dry-run')
    p.add_argument('--state',type=Path,help='Offline aggregate snapshot, dry-run only');p.add_argument('--creative-shadow',action='store_true');args=p.parse_args()
    if not 1<=args.limit<=21:p.error('1–21 assets per invocation')
    if args.dry_run and not args.output_root:p.error('dry-run requires its own --output-root')
    if not args.dry_run and (args.output_root or args.state):p.error('output/state overrides are dry-run only')
    if args.creative_shadow and not args.dry_run:p.error('creative shadow is offline-only')
    config=json.loads(Path(os.environ['ABP_AUTO_CONFIG']).read_text());root=args.output_root if args.dry_run else Path(config['root'])
    if args.dry_run and root.resolve()==Path(config['root']).resolve():p.error('dry-run must not use production state')
    root.mkdir(parents=True,exist_ok=True)
    with (root/'worker.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise RuntimeError('another GPU worker owns the lock')
        graphics=graphics_mode(config)
        if not graphics and not args.dry_run:raise RuntimeError('native presenter production remains disabled')
        check_pause(root,config)
        if not args.dry_run and config.get('validated_gpu_workload_digest')!=gpu_workload_digest():
            raise RuntimeError('GPU workload requires bounded validation before production')
        if not config.get('enabled') and not (args.canary or args.dry_run):raise RuntimeError('continuous generation is not activated')
        (root/'admitted').mkdir(exist_ok=True);(root/'uploads').mkdir(exist_ok=True)
        key=Path(os.environ.get('CREDENTIALS_DIRECTORY',''))/'auto-admission-key' if os.environ.get('CREDENTIALS_DIRECTORY') else Path(config['signing_key'])
        if key.stat().st_mode&0o077:raise RuntimeError('automatic signing credential must be owner-only')
        week=datetime.now(timezone.utc).strftime('%G-W%V');ledger=root/f'budget-{week}.json'
        budget=json.loads(ledger.read_text()) if ledger.exists() else {'attempted':0,'rendered':0}
        if args.state:state=json.loads(args.state.read_text())
        else:
            state_response=requests.get('https://api.github.com/repos/leonlinsx/avoid-boring-people/contents/instagram-state.json',params={'ref':'abp-instagram-state'},headers={'Accept':'application/vnd.github.raw+json','Cache-Control':'no-cache'},timeout=30)
            state_response.raise_for_status();state=state_response.json()
        if state.get('account')!='avoidboringpeople':raise RuntimeError('wrong durable account')
        state,_=retention.restore(state,retention.public_read)
        if not (args.canary or args.dry_run) and not state.get('auto_canary_verified'):raise RuntimeError('automatic canary not verified')
        recovered=[] if args.dry_run else recover(root,key,budget,ledger,args.limit,graphics=graphics)
        cycle={}
        # Owner-authorized creative trials run by default in existing guarded graphics mode.
        # An explicit local false is still an operator opt-out; research remains separately gated.
        experimental=bool(config.get('creative_experiments',True) or args.creative_shadow) and not args.canary
        if args.creative_shadow:cycle=research.fixture()
        elif experimental and config.get('research_enabled'):cycle=research.collect(root,config.get('research_creators',[]),key,token=research_token,user_id=research_user)
        existing=list(state.get('legacy_manifests',{}).values())+scorecard.load_manifests('scripts/instagram_growth/approved')+[x['manifest'] for x in state.get('auto_inventory',{}).values()]
        local=list((root/'admitted').glob('*.json'));prior={x['concept_id']:x for x in existing}
        for file in local:
            m=json.loads(file.read_text());admission.verify_manifest(m);prior[m['concept_id']]=m
        inventory=scorecard.inventory(list(prior.values()),state,datetime.now(timezone.utc))
        needed=min(args.limit-len(recovered),max(0,21-inventory['approved_unpublished']))
        inventory_demand=needed
        rejected=failed_concepts(root)
        plan,quarantined,slots=candidates(state,list(prior.values()),experiments=True,research_cycle=cycle,shadow=args.creative_shadow,graphics_only=graphics,rejected=rejected) if experimental else candidates(state,list(prior.values()))
        rejected_pairs={x['pair_id'] for x in plan if x['concept_id'] in rejected}
        plan=[x for x in plan if x['pair_id'] not in rejected_pairs]
        needed=min(needed,max(0,21-budget['rendered']),max(0,40-budget['attempted']))
        if args.canary:
            plan=[x for x in plan if x['source_file']=='src/content/blog/2020_08_19_city/index.md' and x['claim_id']=='claim-e54e87db222ee4fe66d84d2b']
            # Fixed canary treatment must be exactly the shadow-tested low-risk pair.
            record=next(r for r in policy.discover()[0] if r['claim_id']=='claim-e54e87db222ee4fe66d84d2b')
            plan=[policy.compile_script(record,presenter=p,bucket='control') for p in (False,True)];needed=min(2,args.limit-len(recovered))
        if graphics:plan=[x for x in plan if not x['presenter']]
        start=time.monotonic();admitted=[];failures=[];reserved=set();failed_pairs=set()
        run=root/'runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');run.mkdir(parents=True)
        factory={'started_at':datetime.now(timezone.utc).isoformat(),'policy':policy.VERSION,'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
                 'production_mode':'graphics_gpu' if graphics else 'native',
                 'gpu_fault_latched':(root/'GPU_FAULT.json').exists(),'eligible_source_units':len({x['claim_id'] for x in plan}),'source_quarantined':len(quarantined),'attempted':0,'admitted':0,'quarantined':0,
                 'allocation':slots['planned_counts'],'growth_context_available':slots.get('growth_context_available',False),
                 'exploitation':'Only fresh reproducible multi-article patterns with positive account follower context earn bounded replication; otherwise exploration.',
                 'software_spend_usd':0,'electricity_cost':'Not metered; unavailable','gpu':'RTX 5070 Ti 16GB','gpu_busy_policy':'Never terminate unrelated processes'}
        if experimental:
            from scripts.instagram_growth.autonomy import editorial
            factory['creative_protocol']=renewal.PROTOCOL if graphics and not args.creative_shadow else creative.PROTOCOL
            old_claims={m['claim_id'] for m in prior.values() if m.get('claim_id')}
            factory['creative_supply']={'new_claims':sum(i['claim_id'] not in old_claims for i in plan),
                                        'reused_claims':sum(i['claim_id'] in old_claims for i in plan),
                                        'eligible_treatments':len(plan),
                                        'eligible_episodes':sorted({i['creative_trial']['episode_id'] for i in plan if i.get('creative_trial',{}).get('episode_id')}),
                                        'rejection_reasons':{reason:sum(q.get('reason')==reason for q in quarantined) for reason in sorted({q['reason'] for q in quarantined if 'reason' in q})},
                                        'renewal':'History-derived single-variable episodes; saturation reduces cadence; no automatic replay.'}
            if graphics and not args.creative_shadow:
                factory['creative_supply']['editorial']={
                    'version':editorial.VERSION,
                    'ordered_candidates':[{'claim_id':i['claim_id'],**editorial.evaluate(i)} for i in plan],
                    'policy':'Article/topic rotation first; heuristic merit breaks ties; factual admission unchanged.'}
            factory['research']={'status':cycle.get('status','fixture' if args.creative_shadow else 'disabled'),'cost_usd':cycle.get('cost_usd',0),
                                 'calls':cycle.get('calls',0),'receipts':len(cycle.get('receipts',[])),
                                 'actual_live_eligible':len(research.eligible(cycle)),'reason':cycle.get('reason'),
                                 'fixture_is_not_live_evidence':args.creative_shadow}
        write(run/'source-quarantine.json',quarantined)
        (root/'admitted').mkdir(exist_ok=True);(root/'uploads').mkdir(exist_ok=True)
        # Completed shadow media is immutable input only; all admission checks rerun.
        seed={x['concept_id']:args.seed_render for x in json.loads((args.seed_render/'briefs.json').read_text())['items']} if args.seed_render else {}
        for item in plan:
            check_pause(root,config)
            if len(admitted)>=needed:break
            concept=item['concept_id']
            if concept in prior or item['pair_id'] in failed_pairs:continue
            if budget['attempted']>=40:break
            if time.monotonic()-start>5400:raise RuntimeError('factory wall-clock budget exhausted')
            out=seed.get(concept,run/item['pair_id'])
            if concept not in reserved:
                members=[x for x in plan if x['pair_id']==item['pair_id'] and x['concept_id'] not in prior][:min(needed-len(admitted),21-budget['rendered'])]
                if not members:break
                if concept not in seed:require_idle_gpu(root)
                reserve_render(budget,len(members),ledger);reserved.update(x['concept_id'] for x in members)
            factory['attempted']+=1;budget['attempted']+=1;write(ledger,budget)
            try:
                if concept not in seed and not (out/'verification.json').exists():
                    members=[x for x in plan if x['pair_id']==item['pair_id'] and x['concept_id'] in reserved]
                    out.mkdir(parents=True,exist_ok=True);spec=out/'spec.json';write(spec,{'items':members})
                    subprocess.run([sys.executable,'-m','scripts.instagram_growth.factory.run','--spec',str(spec),'--output',str(out),'--voice',item['voice'],'--limit',str(len(members)),*(['--graphics-only'] if graphics else [])],check=True,timeout=min(3600,max(1,5400-(time.monotonic()-start))))
                check_pause(root,config)
                manifest,video=rendered_manifest(item,out,key)
                request=run/f'{concept}-upload.json'
                factory['admitted']+=1;factory['elapsed_seconds']=round(time.monotonic()-start,2)
                if args.dry_run:
                    write(root/'admitted'/f'{concept}.json',manifest);admitted.append(concept);continue
                # Persist recovery intent before local inventory counts the item.
                write(request,upload_request(manifest,video,factory))
                write(root/'admitted'/f'{concept}.json',manifest)
                finish_upload(root,request)
                admitted.append(concept)
            except (subprocess.SubprocessError,policy.Quarantine,ValueError,KeyError) as error:
                failures.append({'concept_id':concept,'error':type(error).__name__,'reason':str(error)[:200]});factory['quarantined']+=1
                failed_pairs.add(item['pair_id'])
                write(run/'failures.json',failures)
                # A lost device is not a media rejection. Persist the hold
                # before another model job or a later reboot can retry it.
                if isinstance(error,subprocess.SubprocessError):
                    if (out/'gpu-fault.json').exists():
                        write(root/'last-gpu-diagnostic.json',json.loads((out/'gpu-fault.json').read_text()))
                        pause_unavailable_gpu(root)
                    require_gpu(root)
                # Three media failures is a quality circuit; no blind rerender loop.
                if len(failures)>=3:break
        factory.update(completed_at=datetime.now(timezone.utc).isoformat(),elapsed_seconds=round(time.monotonic()-start,2),newly_hosted=0 if args.dry_run else len(admitted)+len(recovered),recovered_hosted=len(recovered),offline_verified=len(admitted) if args.dry_run else None,inventory_before=inventory['approved_unpublished'],remaining_eligible=max(0,len(plan)-factory['attempted']),weekly_render_reservations=budget['rendered'],status='failed' if failures else 'verified_offline' if args.dry_run else 'healthy')
        if inventory_demand and (budget['rendered']>=21 or budget['attempted']>=40):factory['pause_reason']='weekly_budget_exhausted'
        elif inventory_demand and not plan:factory.update(status='supply_limited',pause_reason='cooldown_saturation_or_no_safe_treatment')
        write(run/'factory-report.json',factory);write(root/'status.json',factory)
        # Refresh signed heartbeat even when inventory is full; all data are from
        # a previously signed immutable admission, never a fabricated new approval.
        heartbeat=json.loads((root/'heartbeat.json').read_text()) if (root/'heartbeat.json').exists() else None
        refresh_due=not heartbeat or (datetime.now(timezone.utc)-datetime.fromisoformat(heartbeat['at'])).total_seconds()>=86400
        local=sorted(path for path in (root/'admitted').glob('*.json') if (root/'uploads'/path.name).is_file())
        if not args.dry_run and local and (admitted or recovered or failures or refresh_due):
            m=admission.verify_manifest(json.loads(local[-1].read_text()))
            video=root/'heartbeat.mp4';video.write_bytes(promotion.fetch(m['video_url'],policy.POLICY['max_bytes']))
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
