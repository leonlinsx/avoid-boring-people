"""Bounded ABP jobs for GitHub-hosted Actions, with CAS state before publishing.

No local Instagram credential, runner registration, artifact secret, or paid API.
State is public aggregate/provenance data on a dedicated branch, never tokens.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import copy
import json
import os
import re
from pathlib import Path
import tempfile
from datetime import datetime, timezone, timedelta
import requests
from scripts.instagram_growth import reel_pilot as pilot, rolling_queue as queue
from scripts.instagram_growth import scorecard, retention
from scripts.instagram_growth.autonomy import promotion

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
        self.cold = retention.empty()
    def request(self, method, route, **kwargs):
        archive=re.fullmatch(r'contents/instagram-archives/[a-f0-9]{64}\.json',route)
        if method not in ('GET','PUT') or not (route==f'contents/{STATE_PATH}' or archive):
            raise StateError('state client cannot write application code or other refs')
        if archive and method=='PUT' and 'sha' in kwargs.get('json',{}):raise StateError('immutable archive cannot be overwritten')
        if method=='PUT' and kwargs.get('json',{}).get('branch')!=BRANCH:
            raise StateError('state client can write only the dedicated data branch')
        response = self.session.request(method, f'https://api.github.com/repos/{REPO}/{route}', timeout=30, **kwargs)
        if archive and method=='GET' and response.status_code==404:return None
        if response.status_code not in (200, 201):
            raise StateError(f'GitHub durable state refused HTTP {response.status_code}; no blind retry')
        return response.json()
    def load(self):
        raw = self.request('GET', f'contents/{STATE_PATH}', params={'ref':BRANCH})
        self.sha = raw['sha']
        self.state = json.loads(base64.b64decode(raw['content']))
        if self.state.get('account') != pilot.ACCOUNT or not isinstance(self.state.get('receipts'),dict):
            raise StateError('state has wrong account/shape')
        self.state,self.cold=retention.restore(self.state,self.read_archive)
        return self.state
    def read_archive(self,ref):
        retention.check_ref(ref)
        raw=self.request('GET','contents/'+ref['path'],params={'ref':BRANCH})
        if raw is None:raise FileNotFoundError(ref['path'])
        return base64.b64decode(raw['content'],validate=False)
    def write_archive(self,ref,body):
        # Create-only Git content; a lost response is recovered by a read, not
        # an overwrite. Orphans after a CAS conflict are harmless immutable data.
        try:existing=self.read_archive(ref)
        except FileNotFoundError:existing=None
        if existing is None:
            try:
                self.request('PUT','contents/'+ref['path'],json={'branch':BRANCH,'message':'ABP immutable evidence archive [skip ci] [skip vercel]',
                             'content':base64.b64encode(body).decode()})
            except (requests.RequestException,StateError):
                # A lost create response may already have committed. Only an
                # exact independent readback can turn that uncertainty to success.
                if self.read_archive(ref)!=body:raise
        elif existing!=body:raise StateError('immutable archive already differs')
        restored=self.read_archive(ref)
        if restored!=body:raise StateError('archive readback changed')
        retention.decode(ref,restored)
    def save(self,*,archive_review=False):
        cold=copy.deepcopy(self.cold);old_head=self.state.get('archive_head')
        planned=retention.plan(self.state,cold,review=archive_review,manifests=scorecard.load_manifests(QUEUE_DIR))
        if planned:
            ref,archive,tables,review=planned
            self.write_archive(ref,archive)
            for key,rows in tables.items():cold[key].update(copy.deepcopy(rows))
            if review is not None:cold['weekly_review']=copy.deepcopy(review)
            self.state['archive_head']=ref
        try:
            hot=retention.compact(self.state,cold)
            body = json.dumps(hot, indent=2, sort_keys=True).encode()
            if len(body)>900_000:raise StateError('state budget exceeded; unresolved evidence remains hot')
            result = self.request('PUT', f'contents/{STATE_PATH}', json={'branch':BRANCH,'sha':self.sha,'message':'ABP Reel receipts [skip ci] [skip vercel]','content':base64.b64encode(body).decode()})
        except Exception:
            if old_head is None:self.state.pop('archive_head',None)
            else:self.state['archive_head']=old_head
            raise
        self.sha = result['content']['sha']
        self.cold=cold
        if planned:self.state.setdefault('legacy_manifests',{}).update(copy.deepcopy(tables['legacy_manifests']))
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


def insights_probe():
    """Check existing owned media, so new-post processing lag isn't a scope test."""
    raw=read_api('{uid}/media',{'fields':'id,media_type','limit':1})
    media=raw.get('data') or []
    if not media:return {'status':'no_existing_media'}
    result=pilot.fetch_insights(str(media[0]['id']))
    return {'available':any(result['metrics'].get(k) is not None for k in pilot.METRICS),
            'media_id':media[0]['id'],'availability':result.get('availability',{})}


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
    if hashlib.sha256(data).hexdigest()!=item['source_sha256'] or item['source_anchor'] not in data.decode() or any(a not in data.decode() for a in item.get('context_anchors',[])):
        raise StateError('approved source has changed')


def publish_one(store, concept=None, *, is_pilot=False, auto_canary=False):
    state=store.state
    maximum=int(os.getenv('ABP_REELS_MAX_PER_24H','3'))
    if maximum not in (1,2,3):raise StateError('cadence must be bounded to 1–3 posts per 24h')
    if not is_pilot and (not state.get('pilot_verified') or os.getenv('ABP_REELS_PUBLISH')!='enabled'):
        raise StateError('kill switch or unverified pilot prevents scheduling')
    now=datetime.now(timezone.utc)
    auto=promotion.eligible(state,os.getenv('ABP_AUTO_MODE','off'),canary=auto_canary,legacy=scorecard.load_manifests(QUEUE_DIR))
    if auto_canary:
        if state.get('auto_canary_verified'):raise StateError('automatic canary already passed; never repeat it')
        # This ID is a fixed low-risk source-exact graphics treatment, not feed-selected code.
        auto=[x for x in auto if x['concept_id']==promotion.CANARY_ID]
        if not auto:raise StateError('verified automatic canary is not eligible')
        if verify_auto_canary(store,auto[0]):return
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
            candidates=root/'queue';candidates.mkdir()
            if not auto_canary:
                for path in QUEUE_DIR.glob('*.json'):(candidates/path.name).write_bytes(path.read_bytes())
            for m in auto:(candidates/f'{m["concept_id"]}.json').write_text(json.dumps(m))
            item,reason=queue.choose(candidates,receipts,now,max_per_24h=maximum,min_spacing_hours=max(3,int(os.getenv('ABP_REELS_MIN_SPACING_HOURS','3'))))
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
        if item.get('review_status')=='AUTO_ADMITTED':
            state['receipts'][item['concept_id']]['auto_admission']={'policy':item['admitted_by'],'envelope_sha256':state['auto_inventory'][item['concept_id']]['envelope_sha256']}
            if auto_canary:
                state['auto_canary_verified']=available
                state['auto_canary_media_id']=str(record['media_id'])
        state['last_published_at']=record['published_at']
        store.save()
        print(json.dumps({'media':media,'insights':metrics,'pilot_verified':state['pilot_verified']},indent=2))
        if auto_canary and not available:
            print('AUTO_CANARY_AWAITING_INSIGHTS: published receipt preserved; later checks only read this media')
        elif is_pilot and not available:raise StateError('real post exists, but Insights unavailable; recurring publication remains disabled')


def verify_auto_canary(store,item):
    """Only re-read a known published canary; never repeat media_publish."""
    record=store.state['receipts'].get(promotion.CANARY_ID)
    if not record or record.get('status')!='published':return False
    if record.get('sha256')!=item['video_sha256']:
        raise StateError('automatic canary receipt does not bind the admitted media')
    media=verify_media(str(record['media_id']))
    metrics=pilot.fetch_insights(str(record['media_id']))
    available=any(metrics['metrics'].get(k) is not None for k in pilot.METRICS)
    record.update(verified_media=media,initial_insights=metrics)
    store.state.update(auto_canary_verified=available,auto_canary_media_id=str(record['media_id']))
    store.save()
    if not available:
        if datetime.now(timezone.utc)-queue.instant(record['published_at'])>timedelta(hours=48):
            raise StateError('automatic canary Insights unavailable after 48h; check permissions')
        print('AUTO_CANARY_AWAITING_INSIGHTS: no new publication')
    else:print('AUTO_CANARY_VERIFIED: existing media ownership, permalink and Insights confirmed')
    return True


def measure(store):
    state=store.state;now=datetime.now(timezone.utc)
    account=pilot.account_snapshot()  # Errors fail visibly; never record success.
    account['account']=pilot.ACCOUNT
    state.setdefault('account_snapshots',{})[now.strftime('%Y%m%dT%H%M%SZ')]=account
    snapshots=state.setdefault('observations',{})
    gaps=state.setdefault('measurement_gaps',{})
    due=[]
    for concept,r in state['receipts'].items():
        if r.get('status')!='published':continue
        published=queue.instant(r['published_at'])
        for label,target in queue.WINDOWS.items():
            key=f'{concept}-{label}'
            if key in snapshots or now<published+target:continue
            deadline=scorecard.window_end(label,published)
            if now>deadline:
                gaps.setdefault(key,{'concept_id':concept,'window':label,'reason':'age_window_missed',
                                     'deadline':deadline.isoformat(),'detected_at':now.isoformat()})
                continue
            due.append((deadline,concept,label,r))
    # Earliest deadlines first; one budget across the whole ledger, including
    # unavailable reads. Expired windows never consume scarce API requests.
    count=0;failures=[]
    for _,concept,label,r in sorted(due)[:12]:
        key=f'{concept}-{label}'
        try:
            value=pilot.fetch_insights(str(r['media_id']))
            age=queue.instant(value['captured_at'])-queue.instant(r['published_at'])
            value.update(concept_id=concept,window=label,published_at=r['published_at'],actual_age_hours=age.total_seconds()/3600,account=pilot.ACCOUNT)
            if not any(value['metrics'].get(k) is not None for k in pilot.METRICS):
                raise StateError('all media Insights unavailable; snapshot remains pending for next scheduled read')
            snapshots[key]=value;count+=1
        except (requests.RequestException,ValueError,KeyError,StateError) as error:
            # Preserve other readings and the follower snapshot, then fail the
            # job visibly. Never persist provider exception text or retry now.
            failures.append({'concept_id':concept,'window':label,'error_type':type(error).__name__})
    state['measurement_health']={'checked_at':now.isoformat(),'status':'failed' if failures else 'healthy',
                                 'attempted':min(12,len(due)),'new_snapshots':count,
                                 'remaining_due':len(due)-count,'failures':failures}
    if not failures:state['last_measurement_at']=now.isoformat()
    store.save()
    if failures:raise StateError('measurement incomplete; successful readings saved, unavailable readings remain pending')
    print(json.dumps({'account':account,'new_snapshots':count},indent=2))


def verify_pilot(store):
    """Read-only recheck after delayed Insights; never repeat media_publish."""
    canary=store.state.get('auto_inventory',{}).get(promotion.CANARY_ID)
    if canary:
        from scripts.instagram_growth.autonomy.admission import verify_manifest
        if verify_auto_canary(store,verify_manifest(canary['manifest'])):return
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
    # Fresh account evidence and due age windows precede production advice.
    measure(store)
    report=scorecard.build(store.state,all_manifests(store.state))
    report['retention']=retention.health(store.state,getattr(store,'cold',None))
    # Keep detailed rows in downloadable artifacts, not repeated in the CAS ledger.
    store.state['weekly_review']={k:v for k,v in report.items() if k not in ('rows','equal_target_age_cohorts')}
    if isinstance(store,Store):store.save(archive_review=True)
    else:store.save()
    report['retention']=retention.health(store.state,getattr(store,'cold',None))
    scorecard.write(report,'reports/instagram-growth')
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a') as output:output.write(scorecard.markdown(report))
    print(json.dumps({'weekly_report':'reports/instagram-growth','low_information':report['low_information']},indent=2))


def inventory_health(store):
    report=scorecard.inventory(all_manifests(store.state),store.state,datetime.now(timezone.utc))
    print(json.dumps({'instagram_inventory':report},indent=2))
    if report['level']!='OK':
        message=f"ABP inventory {report['level']}: {report['approved_unpublished']} approved unpublished; target21; never auto-approve to fill quota"
        print(f'::warning::{message}')
    archive_health=retention.health(store.state,getattr(store,'cold',None))
    print(json.dumps({'retention_health':archive_health}))
    if archive_health['level']!='OK':print('::warning::ABP retention headroom low; preserve evidence and inspect existing limits')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as output:
            output.write(f"\nABP inventory: **{report['level']}**, {report['approved_unpublished']} approved unpublished; target21.\n")
    return report


def all_manifests(state):
    legacy=dict(state.get('legacy_manifests',{}))
    for m in scorecard.load_manifests(QUEUE_DIR):
        if m['concept_id'] in legacy and legacy[m['concept_id']]!=m:raise StateError('immutable archived manual concept changed')
        legacy[m['concept_id']]=m
    return [legacy[name] for name in sorted(legacy)]+[x['manifest'] for x in state.get('auto_inventory',{}).values()]


def promote_auto(store):
    with tempfile.TemporaryDirectory(prefix='abp-promote-') as tmp:
        return promotion.promote(store,scorecard.load_manifests(QUEUE_DIR),lambda item:download(item,Path(tmp)))


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['preflight','pilot','publish','measure','weekly','verify','reconcile-no-publish','auto-promote','auto-canary']);p.add_argument('--concept');args=p.parse_args()
    store=Store();store.load()
    mode=os.getenv('ABP_AUTO_MODE','off')
    if args.action in ('auto-promote','auto-canary') and mode not in ('canary','enabled'):raise StateError('automatic path is disabled')
    if args.action in ('publish','auto-promote','auto-canary') and mode in ('canary','enabled'):
        try:
            count=promote_auto(store);promotion.circuit(store.state,'promotion');store.save();print(f'Auto promoted: {count}')
        except Exception as error:
            promotion.circuit(store.state,'promotion',error);store.save()
            # Do not conceal a failed promotion, nor publish behind an invalid feed.
            raise
    inventory_health(store)
    if args.action=='preflight':
        print(json.dumps({'account':pilot.account_snapshot(),'quota':live_quota(),'insights_probe':insights_probe(),'state_account':store.state['account'],'no_publication':True},indent=2))
    elif args.action in ('pilot','publish','auto-canary'):
        try:
            publish_one(store,args.concept,is_pilot=args.action=='pilot',auto_canary=args.action=='auto-canary' or (args.action=='publish' and mode in ('canary','enabled') and not store.state.get('auto_canary_verified')))
            promotion.circuit(store.state,'publishing');store.save()
        except Exception as error:
            promotion.circuit(store.state,'publishing',error);store.save();raise
    elif args.action=='measure':
        try:measure(store);promotion.circuit(store.state,'measurement');store.save()
        except Exception as error:promotion.circuit(store.state,'measurement',error);store.save();raise
    elif args.action=='auto-promote':print('Data-only promotion complete; no Meta write')
    elif args.action=='verify':verify_pilot(store)
    elif args.action=='reconcile-no-publish':reconcile_no_publish(store,args.concept)
    else:weekly(store)

if __name__=='__main__':main()
