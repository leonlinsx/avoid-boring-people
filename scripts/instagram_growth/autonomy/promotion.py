"""Untrusted public data -> verified inventory in the existing CAS state only.

No checkout, shell command, code write, workflow edit or credential in a feed.
"""
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
import json
from urllib.parse import urlsplit
import requests
from scripts.instagram_growth.autonomy import admission as a, policy

FEED=f'https://{a.HOST}/instagram/reels/auto/feed.json'
CANARY_ID='abpa-973d2e169e179358776c057a'


def fetch(url, limit):
    u=urlsplit(url)
    if u.scheme!='https' or u.hostname!=a.HOST or u.query or u.fragment or u.username or u.password:
        raise policy.Quarantine('unowned_data_url')
    response=requests.get(url,stream=True,allow_redirects=False,timeout=(15,60))
    try:
        if response.status_code!=200:raise policy.Quarantine('public_data_unavailable')
        data=bytearray()
        for chunk in response.iter_content(65536):
            data.extend(chunk)
            if len(data)>limit:raise policy.Quarantine('public_data_budget')
        return bytes(data)
    finally:response.close()


def duplicate(candidate, existing):
    """Legacy matched pairs survive; only reconstructed V2 opens source reuse."""
    from scripts.instagram_growth.autonomy import renewal
    s=renewal.script(candidate)
    renewable=s.get('template_parameters',{}).get('creative',{}).get('protocol')==renewal.PROTOCOL
    if renewable:policy.verify_script(s)
    for old in existing:
        if old['concept_id']==candidate['concept_id']:
            if old['video_sha256']!=candidate['video_sha256']:raise policy.Quarantine('immutable_concept_changed')
            continue
        if old['video_sha256']==candidate['video_sha256']:raise policy.Quarantine('duplicate_video')
        same=old.get('claim_id')==candidate['claim_id']
        similar=SequenceMatcher(None,policy.clean(old.get('source_anchor','')).casefold(),policy.clean(candidate['source_anchor']).casefold()).ratio()>.82
        if same or similar:
            matched=(same and old.get('pair_id')==candidate['pair_id'] and old.get('pair_role')!=candidate['pair_role']
                     and old.get('pair_role') in ('presenter','graphics'))
            if matched:continue
            # An adjacent/reworded claim cannot acquire new creative capacity.
            if not same or not renewable:raise policy.Quarantine('repetitive_claim_or_near_duplicate')
            prior=renewal.signature(old)
            if prior is None or prior==renewal.signature(candidate):
                raise policy.Quarantine('equivalent_creative_execution')


def promote(store, legacy, download):
    now=datetime.now(timezone.utc)
    feed=a.authenticate(json.loads(fetch(FEED,450_000)))
    if feed.get('artifact_type')!='abp_auto_feed_v1' or feed.get('account')!='avoidboringpeople':raise policy.Quarantine('wrong_feed')
    generated=datetime.fromisoformat(feed['generated_at'].replace('Z','+00:00'))
    if not now-timedelta(days=8)<=generated<=now+timedelta(minutes=5):raise policy.Quarantine('stale_factory_heartbeat')
    storage=feed['storage']
    if storage.get('plan')!='hobby' or storage.get('usage_quota_exceeded') is not False or storage.get('size_bytes',10**10)>=750*1024**2:
        raise policy.Quarantine('storage_circuit')
    entries=feed['items']
    if not isinstance(entries,list) or not 1<=len(entries)<=64:raise policy.Quarantine('feed_budget')
    inventory=store.state.setdefault('auto_inventory',{})
    staged={};quarantine=[]
    for entry in entries:
        if set(entry)!={'concept_id','url','sha256'}:raise policy.Quarantine('unexpected_feed_fields')
        expected=f'https://{a.HOST}/instagram/reels/auto/manifests/{entry["sha256"]}.json'
        if entry['url']!=expected:raise policy.Quarantine('unbound_envelope_url')
        if entry['concept_id'] in inventory:
            if inventory[entry['concept_id']]['envelope_sha256']!=entry['sha256']:raise policy.Quarantine('immutable_inventory_changed')
            continue
        body=fetch(entry['url'],64_000)
        if policy.sha(body)!=entry['sha256']:raise policy.Quarantine('envelope_hash_mismatch')
        item=a.verify_manifest(json.loads(body))
        if item['concept_id']!=entry['concept_id']:raise policy.Quarantine('envelope_identity')
        try:
            history=legacy+[x['manifest'] for x in inventory.values()]+[x['manifest'] for x in staged.values()]
            duplicate(item,history)
            if item['script'].get('treatment_id'):
                from scripts.instagram_growth.autonomy import renewal
                renewal.exposure(item,history,store.state,now=now)
        except policy.Quarantine as error:
            quarantine.append({'concept_id':item['concept_id'],'reason':str(error)});continue
        # Real public MP4 bytes, SHA and ffprobe, not the producer's attestation alone.
        download(item)
        staged[item['concept_id']]={'manifest':item,'envelope_url':entry['url'],'envelope_sha256':entry['sha256'],'promoted_at':now.isoformat()}
    inventory.update(staged)
    store.state['auto_health']={'promoted_at':now.isoformat(),'factory':feed['factory'],'storage':storage,'usage':feed['usage'],'quarantined':quarantine,'newly_promoted':len(staged),'feed_generated_at':feed['generated_at']}
    store.save()
    return len(staged)


def circuit(state, operation, error=None):
    row=state.setdefault('operation_health',{}).setdefault(operation,{'consecutive_failures':0})
    row.update(checked_at=datetime.now(timezone.utc).isoformat())
    row['consecutive_failures']=row['consecutive_failures']+1 if error else 0
    row['error']=type(error).__name__ if error else None
    return row['consecutive_failures']>=3


def eligible(state, mode, *, canary=False,legacy=()):
    if mode not in ('canary','enabled'):return []
    if not canary and (mode!='enabled' or not state.get('auto_canary_verified')):return []
    if any(x.get('consecutive_failures',0)>=3 for x in state.get('operation_health',{}).values()):return []
    health=state.get('auto_health',{})
    when=health.get('feed_generated_at')
    now=datetime.now(timezone.utc)
    if not when or not now-timedelta(days=8)<=datetime.fromisoformat(when.replace('Z','+00:00'))<=now+timedelta(minutes=5):return []
    inventory=[a.verify_manifest(x['manifest']) for x in state.get('auto_inventory',{}).values()]
    from scripts.instagram_growth.autonomy import renewal
    history=list(legacy)+inventory;result=[]
    # Pending inventory is considered at admission. At publication, exclude
    # other queued assets: only actual exposure and ambiguous receipts count.
    published=[m for m in history if m['concept_id'] in state.get('receipts',{})]
    for item in inventory:
        if item['script'].get('treatment_id'):
            try:
                duplicate(item,[m for m in published if m['concept_id']!=item['concept_id']])
                renewal.exposure(item,published,state,now=now)
            except policy.Quarantine:continue
        result.append(item)
    return result
