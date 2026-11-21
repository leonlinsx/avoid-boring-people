"""Bounded ABP jobs for GitHub-hosted Actions, with CAS state before publishing.

No local Instagram credential, runner registration, artifact secret, or paid API.
State is public aggregate/provenance data on a dedicated branch, never tokens.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import tempfile
from datetime import datetime, timezone
import requests
from scripts.instagram_growth import reel_pilot as pilot, rolling_queue as queue

REPO = 'leonlinsx/avoid-boring-people'
BRANCH = 'abp-instagram-state'
STATE_PATH = 'instagram-state.json'
QUEUE_DIR = Path('scripts/instagram_growth/approved')
HOST = 'kveensoemz2j3t8d.public.blob.vercel-storage.com'

class StateError(RuntimeError):
    pass

class Store:
    def __init__(self):
        token = os.environ.get('GITHUB_TOKEN')
        if not token or os.environ.get('GITHUB_REPOSITORY') != REPO:
            raise StateError('exact repository and GitHub job token required')
        self.session = requests.Session()
        self.session.headers.update(Authorization=f'Bearer {token}', Accept='application/vnd.github+json', **{'X-GitHub-Api-Version':'2022-11-28'})
        self.sha = None
        self.state = None
    def request(self, method, route, **kwargs):
        response = self.session.request(method, f'https://api.github.com/repos/{REPO}/{route}', timeout=30, **kwargs)
        if response.status_code not in (200, 201):
            raise StateError(f'GitHub durable state refused HTTP {response.status_code}; no blind retry')
        return response.json()
    def load(self):
        raw = self.request('GET', f'contents/{STATE_PATH}', params={'ref':BRANCH})
        self.sha = raw['sha']
        self.state = json.loads(base64.b64decode(raw['content']))
        if self.state.get('account') != pilot.ACCOUNT or not isinstance(self.state.get('receipts'),dict):
            raise StateError('state has wrong account/shape')
        return self.state
    def save(self):
        body = json.dumps(self.state, indent=2, sort_keys=True).encode()
        if len(body)>900_000:
            raise StateError('state budget exceeded; archive reviewed observations before continuing')
        result = self.request('PUT', f'contents/{STATE_PATH}', json={'branch':BRANCH,'sha':self.sha,'message':'ABP Reel receipts [skip ci] [skip vercel]','content':base64.b64encode(body).decode()})
        self.sha = result['content']['sha']
    def receipt(self, record):
        self.state['receipts'][record['concept_id']] = record
        self.save()


def read_api(route, params=None):
    uid, token = pilot.confirmed_account()
    response = requests.get(f'{pilot.ig.INSTAGRAM_API_BASE}/{route.format(uid=uid)}', params=params,
                            headers=pilot.ig._auth_headers(token), timeout=30)
    if response.status_code!=200:
        raise StateError(f'ABP read failed HTTP {response.status_code}')
    return response.json()


def live_quota():
    raw = read_api('{uid}/content_publishing_limit', {'fields':'config,quota_usage'})
    rows = raw.get('data') or []
    if not rows or type(rows[0].get('quota_usage')) is not int:
        raise StateError('live publishing quota unavailable')
    usage = rows[0]['quota_usage']
    limit = (rows[0].get('config') or {}).get('quota_total')
    if type(limit) is not int or usage>=limit-1:
        raise StateError('live publishing quota has no verified safety margin')
    return {'usage':usage,'limit':limit}


def verify_media(media_id):
    # Query fields individually: an unsupported field must not mask identity.
    raw = read_api(media_id, {'fields':'id,username,media_type,permalink,timestamp'})
    if str(raw.get('id'))!=media_id or raw.get('username','').casefold()!=pilot.ACCOUNT:
        raise StateError('published media belongs to a different identity')
    if raw.get('media_type')!='VIDEO' or not str(raw.get('permalink','')).startswith('https://www.instagram.com/'):
        raise StateError('published video/permalink not confirmed')
    optional={}
    for field in ('media_product_type','is_shared_to_feed','is_ai_generated'):
        try:optional[field]=read_api(media_id,{'fields':field}).get(field)
        except StateError:optional[field]=None
    return {**raw,**optional,'visibility_caveat':'API media existence/ownership verified; algorithmic distribution and native Trial visibility require their own evidence'}


def download(item, root):
    from urllib.parse import urlsplit
    if urlsplit(item['video_url']).hostname!=HOST:
        raise StateError('hosted queue must use the one verified ABP Blob store')
    local = root / f"{item['video_sha256']}.mp4"
    response=requests.get(item['video_url'],stream=True,allow_redirects=False,timeout=(15,60))
    if response.status_code!=200:
        raise StateError(f'approved public MP4 returned HTTP {response.status_code}')
    size=0
    try:
        with local.open('wb') as output:
            for chunk in response.iter_content(1024*1024):
                size+=len(chunk)
                if size>pilot.MAX_BYTES:raise StateError('download too large')
                output.write(chunk)
    finally:response.close()
    item={**item,'video_path':str(local)}
    pilot.local_video_preflight(item)
    return item


def source_check(item):
    path=Path(item['source_file']).resolve()
    if not path.is_relative_to(Path('src/content/blog').resolve()) or not path.is_file():
        raise StateError('invalid source path')
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=item['source_sha256'] or item['source_anchor'] not in data.decode():
        raise StateError('approved source has changed')


def publish_one(store, concept=None, *, is_pilot=False):
    state=store.state
    maximum=int(os.getenv('ABP_REELS_MAX_PER_24H','3'))
    if maximum not in (1,2,3):raise StateError('cadence must be bounded to 1–3 posts per 24h')
    if not is_pilot and (not state.get('pilot_verified') or os.getenv('ABP_REELS_PUBLISH')!='enabled'):
        raise StateError('kill switch or unverified pilot prevents scheduling')
    now=datetime.now(timezone.utc)
    with tempfile.TemporaryDirectory(prefix='abp-reels-') as tmp:
        root=Path(tmp);receipts=root/'receipts';receipts.mkdir()
        for name,record in state['receipts'].items():
            if not isinstance(name,str) or not __import__('re').fullmatch(r'[a-z0-9][a-z0-9_-]{2,63}',name):raise StateError('unsafe receipt identity')
            pilot.write_receipt(receipts/f'{name}.json',record)
        if is_pilot:
            if any(r.get('status')!='confirmed_unpublished' for r in state['receipts'].values()):raise StateError('pilot already attempted; reconcile its durable receipt')
            if not concept:raise StateError('pilot requires exact concept')
            item=pilot.load_manifest(QUEUE_DIR/f'{concept}.json')
        else:
            item,reason=queue.choose(QUEUE_DIR,receipts,now,max_per_24h=maximum,min_spacing_hours=max(3,int(os.getenv('ABP_REELS_MIN_SPACING_HOURS','3'))))
            if item is None:
                print(reason)
                if reason.startswith('HALT'):raise StateError(reason)
                return
        source_check(item)
        state['last_quota']=live_quota()
        state['last_account']=pilot.account_snapshot()
        store.save()
        local=download(item,root)
        record=pilot.publish(local,state_dir=receipts,receipt_sink=store.receipt)
        media=verify_media(str(record['media_id']))
        metrics=pilot.fetch_insights(str(record['media_id']))
        state['receipts'][item['concept_id']].update(verified_media=media,initial_insights=metrics)
        available=any(metrics['metrics'].get(k) is not None for k in pilot.METRICS)
        state['pilot_verified']=bool(is_pilot and available) or bool(state.get('pilot_verified'))
        state['last_published_at']=record['published_at']
        store.save()
        print(json.dumps({'media':media,'insights':metrics,'pilot_verified':state['pilot_verified']},indent=2))
        if is_pilot and not available:raise StateError('real post exists, but Insights unavailable; recurring publication remains disabled')


def measure(store):
    state=store.state;now=datetime.now(timezone.utc)
    account=pilot.account_snapshot()  # Errors fail visibly; never record success.
    account['account']=pilot.ACCOUNT
    state.setdefault('account_snapshots',{})[now.strftime('%Y%m%dT%H%M%SZ')]=account
    snapshots=state.setdefault('observations',{})
    count=0
    for concept,r in state['receipts'].items():
        if r.get('status')!='published':continue
        age=now-queue.instant(r['published_at'])
        for label,target in queue.WINDOWS.items():
            key=f'{concept}-{label}'
            if key in snapshots or age<target:continue
            value=pilot.fetch_insights(str(r['media_id']))
            value.update(concept_id=concept,window=label,published_at=r['published_at'],actual_age_hours=age.total_seconds()/3600,account=pilot.ACCOUNT)
            if not any(value['metrics'].get(k) is not None for k in pilot.METRICS):
                raise StateError('all media Insights unavailable; snapshot remains pending for next scheduled read')
            snapshots[key]=value;count+=1
            if count>=12:break
    state['last_measurement_at']=now.isoformat();store.save()
    print(json.dumps({'account':account,'new_snapshots':count},indent=2))


def verify_pilot(store):
    """Read-only recheck after delayed Insights; never repeat media_publish."""
    published=[r for r in store.state['receipts'].values() if r.get('status')=='published']
    if not published:
        raise StateError('no published pilot receipt to verify; reconcile uncertain receipts first')
    receipt=min(published,key=lambda r:r['published_at'])
    media=verify_media(str(receipt['media_id']))
    metrics=pilot.fetch_insights(str(receipt['media_id']))
    receipt.update(verified_media=media,initial_insights=metrics)
    available=any(metrics['metrics'].get(k) is not None for k in pilot.METRICS)
    store.state['pilot_verified']=available
    store.save()
    print(json.dumps({'media':media,'insights':metrics,'pilot_verified':available},indent=2))
    if not available:
        raise StateError('pilot exists but Insights remain unavailable; keep scheduling disabled')


def reconcile_no_publish(store,concept):
    """Explicit operator action for a rejected container, never an ambiguous publish."""
    record=store.state['receipts'].get(concept)
    if (not record or record.get('status')!='reconciliation_required'
        or record.get('error_type')!='GraphApiError' or record.get('container_id')
        or record.get('media_id')):
        raise StateError('cannot prove a rejected pre-container phase; investigate media before any retry')
    record.update(status='confirmed_unpublished',reconciliation={
        'reason':'API container creation rejected; no container ID and media_publish never reached',
        'operator_action':'explicit reconcile-no-publish dispatch',
        'captured_at':datetime.now(timezone.utc).isoformat()})
    store.save()
    print(json.dumps({'concept':concept,'status':'confirmed_unpublished','no_Meta_write':True}))


def weekly(store):
    state=store.state
    observations=list(state.get('observations',{}).values())
    cohorts={label:[] for label in queue.WINDOWS};late=[]
    manifest_meta={p.stem:json.loads(p.read_text()) for p in QUEUE_DIR.glob('*.json')}
    for x in observations:
        m=x['metrics'];reach=m.get('reach');shares=m.get('shares')
        intended=queue.WINDOWS[x['window']].total_seconds()/3600
        if x['actual_age_hours']>intended+(24 if x['window']=='7d' else 6):late.append(x['concept_id']+'-'+x['window']);continue
        cohorts[x['window']].append({'concept_id':x['concept_id'],'hypothesis':manifest_meta.get(x['concept_id'],{}).get('experiment_hypothesis'),'creative_format':manifest_meta.get(x['concept_id'],{}).get('creative_format'),'voice':manifest_meta.get(x['concept_id'],{}).get('voice'),'source_url':manifest_meta.get(x['concept_id'],{}).get('source_url'),'actual_age_hours':x['actual_age_hours'],'reach':reach,'views':m.get('views'),'shares_per_1000_reached':1000*shares/reach if isinstance(reach,(int,float)) and reach>0 and isinstance(shares,(int,float)) else None,'average_watch_time_api_value':m.get('ig_reels_avg_watch_time'),'watch_time_unit':'provider value; not normalized to seconds','attributed_follows':None})
    report={'created_at':datetime.now(timezone.utc).isoformat(),'account':pilot.ACCOUNT,'equal_target_age_cohorts':cohorts,'late_snapshots_excluded':late,'follower_snapshots':state.get('account_snapshots',{}),'conclusion':'Exploratory attention evidence only; per-Reel follow attribution unavailable; no causal or statistical winner declared','next_generation':'Use fresh source claims and one or two promising patterns; preserve exploration and human approval.'}
    state['weekly_review']=report;store.save();print(json.dumps(report,indent=2))


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['preflight','pilot','publish','measure','weekly','verify','reconcile-no-publish']);p.add_argument('--concept');args=p.parse_args()
    store=Store();store.load()
    if args.action=='preflight':
        print(json.dumps({'account':pilot.account_snapshot(),'quota':live_quota(),'state_account':store.state['account'],'no_publication':True},indent=2))
    elif args.action in ('pilot','publish'):publish_one(store,args.concept,is_pilot=args.action=='pilot')
    elif args.action=='measure':measure(store)
    elif args.action=='verify':verify_pilot(store)
    elif args.action=='reconcile-no-publish':reconcile_no_publish(store,args.concept)
    else:weekly(store)

if __name__=='__main__':main()
