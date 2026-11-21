"""Weekly local GPU production and review handoff; no publisher or credentials."""
import argparse
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import subprocess
import requests
from scripts.instagram_growth.factory.review import package
from scripts.instagram_growth import scorecard
from scripts.instagram_growth.factory.allocation import presentation_pairs


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--count',type=int,default=40);p.add_argument('--render-limit',type=int,default=21);p.add_argument('--output-root',type=Path,default=Path.home()/'.local/share/abp-instagram/factory');p.add_argument('--spec',type=Path,help='Explicit editorial revision spec; never overwrite an existing frozen draft');a=p.parse_args()
    if not 1<=a.count<=40 or not 1<=a.render_limit<=24:p.error('bounded candidate/render budget exceeded')
    week=datetime.now(timezone.utc).strftime('%G-W%V');out=a.output_root/week;out.mkdir(parents=True,exist_ok=True);os.chmod(out,0o700)
    status=out/'factory-status.json';status.write_text(json.dumps({'status':'running','started_at':datetime.now(timezone.utc).isoformat()}))
    root=Path(os.getenv('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve();python=Path('.venv-ig-reels/bin/python').absolute()
    # Public aggregate state only; no Instagram or GitHub credentials needed here.
    r=requests.get('https://raw.githubusercontent.com/leonlinsx/avoid-boring-people/abp-instagram-state/instagram-state.json',timeout=30)
    if r.status_code!=200:raise RuntimeError('durable experiment state unavailable; do not infer outcomes')
    state=r.json()
    if state.get('account')!='avoidboringpeople':raise RuntimeError('wrong account state')
    inv=scorecard.inventory(scorecard.load_manifests('scripts/instagram_growth/approved'),state,datetime.now(timezone.utc))
    if inv['level']!='OK':print('instagram_factory_alert inventory_'+inv['level'].lower(),inv['approved_unpublished'],flush=True)
    (out/'observations.json').write_text(json.dumps(state,indent=2))
    if a.spec and (out/'drafts.json').exists() and json.loads(a.spec.read_text())['items']!=json.loads((out/'drafts.json').read_text())['items']:
        raise ValueError('editorial spec differs from frozen batch; choose a new output root')
    if not (out/'drafts.json').exists():
        if a.spec:
            curated=json.loads(a.spec.read_text());curated.setdefault('quarantined',[]);curated['source']='Explicit editorial revision spec; not an automatic-model generation result and not human playback approval.'
            (out/'drafts.json').write_text(json.dumps(curated,indent=2)+'\n')
        else:
            subprocess.run([str(python),'-m','scripts.instagram_growth.factory.draft','--count',str(a.count),'--output',str(out),'--state',str(out/'observations.json')],check=True,timeout=2400)
    drafts=json.loads((out/'drafts.json').read_text());render_plan=out/'render-plan.json'
    if render_plan.exists():selected=json.loads(render_plan.read_text())
    else:
        frozen={x['concept_id']:x for path in out.glob('af_*/briefs.json') for x in json.loads(path.read_text())['items']}
        selected=list(frozen.values()) if frozen else presentation_pairs(drafts['items'],a.render_limit)
        render_plan.write_text(json.dumps(selected,indent=2)+'\n')
    if len(selected)>a.render_limit:raise ValueError('render budget differs from frozen plan; use a new output root')
    if not selected:raise RuntimeError('all drafts quarantined; human source review needed')
    if len(selected)<a.render_limit:print('instagram_factory_alert review_inventory_shortfall',len(selected),a.render_limit,flush=True)
    batches={'af_heart':[],'af_nicole':[]}
    for i,item in enumerate(selected):batches[item['voice'] if 'experiment_bucket' in item else 'af_nicole' if i%7==6 else 'af_heart'].append(item)
    for voice,items in batches.items():
        if not items:continue
        spec=out/f'{voice}-spec.json';spec.write_text(json.dumps({'items':items},indent=2))
        subprocess.run([str(python),'-m','scripts.instagram_growth.factory.run','--spec',str(spec),'--output',str(out/voice),'--limit',str(len(items)),'--voice',voice],check=True,timeout=3600)
    review=package(out,state)
    from collections import Counter
    (out/'WEEKLY_REVIEW.json').write_text(json.dumps({'account':'avoidboringpeople','status':'human_review_required','candidate_budget':a.count,'accepted_drafts':len(drafts['items']),'quarantined':len(drafts['quarantined']),'rendered_for_review':len(selected),'voices':{k:len(v) for k,v in batches.items()},'allocation':drafts.get('allocation'),'actual_rendered_allocation':dict(Counter(x.get('experiment_bucket','legacy_unassigned') for x in selected)),'review_package':str(review/'index.html'),'inventory':inv,'published':0,'source':drafts.get('source','cached local Qwen3.5 9B with context/source critique, Kokoro, optional FlashHead Pro, original motion graphics'),'growth_claim':'No follower acquisition result inferred from automatic creative scores'},indent=2))
    status.write_text(json.dumps({'status':'success_review_required','completed_at':datetime.now(timezone.utc).isoformat(),'rendered':len(selected)},indent=2))
    print(json.dumps({'status':'WEEKLY_REVIEW_READY','output':str(out),'published':0}))

if __name__=='__main__':
    try:main()
    except Exception as error:
        # Traceback/journal plus durable failure marker; never mark a partial batch successful.
        print('instagram_factory_alert generation_failed '+type(error).__name__,flush=True)
        import sys
        parser=argparse.ArgumentParser(add_help=False);parser.add_argument('--output-root',type=Path,default=Path.home()/'.local/share/abp-instagram/factory');args,_=parser.parse_known_args()
        folder=args.output_root/datetime.now(timezone.utc).strftime('%G-W%V');folder.mkdir(parents=True,exist_ok=True)
        (folder/'factory-status.json').write_text(json.dumps({'status':'failed','error_type':type(error).__name__,'captured_at':datetime.now(timezone.utc).isoformat()},indent=2))
        raise
