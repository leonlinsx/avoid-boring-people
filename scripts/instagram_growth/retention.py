"""Lossless cold evidence on the existing Git data branch; no media deletion.

Only content-addressed, independently read-back archives may leave hot CAS state.
Readers reconstruct the original logical tables before making any decisions.
"""
from __future__ import annotations
import base64
import copy
from datetime import datetime, timedelta, timezone
import gzip
import json
import re
import time
import zlib
import requests
from scripts.instagram_growth.autonomy import admission, policy

FORMAT = 'abp_evidence_archive_v1'
TABLES = ('receipts', 'auto_inventory', 'observations', 'measurement_gaps', 'account_snapshots', 'legacy_manifests')
HOT_DAYS = 14
MAX_FILE = 500_000
MAX_PAYLOAD = 8_000_000
MAX_HISTORY = 64_000_000
STATE_LIMIT = 900_000
PREFIX = 'instagram-archives/'
RAW = 'https://raw.githubusercontent.com/leonlinsx/avoid-boring-people/abp-instagram-state/'


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.utcoffset() is None:raise ValueError('archive timestamp requires offset')
    return result.astimezone(timezone.utc)


def reference(digest):
    if not isinstance(digest, str) or not re.fullmatch('[a-f0-9]{64}', digest):raise ValueError('invalid archive digest')
    return {'sha256': digest, 'path': PREFIX + digest + '.json'}


def check_ref(ref):
    if not isinstance(ref, dict) or ref != reference(ref.get('sha256')):raise ValueError('invalid archive reference')
    return ref


def encode(payload):
    raw = policy.canonical(payload)
    if len(raw) > MAX_PAYLOAD:raise ValueError('archive payload budget')
    body = policy.canonical({'format': FORMAT, 'content_sha256': policy.sha(raw),
                             'payload_gzip_base64': base64.b64encode(gzip.compress(raw, mtime=0)).decode()})
    if len(body) > MAX_FILE:raise ValueError('archive file budget')
    return reference(policy.sha(body)), body


def decode(ref, body):
    check_ref(ref)
    if len(body) > MAX_FILE or policy.sha(body) != ref['sha256']:raise ValueError('archive hash mismatch')
    wrapper = json.loads(body)
    if set(wrapper) != {'format', 'content_sha256', 'payload_gzip_base64'} or wrapper['format'] != FORMAT:
        raise ValueError('archive format')
    inflater = zlib.decompressobj(16 + zlib.MAX_WBITS)
    raw = inflater.decompress(base64.b64decode(wrapper['payload_gzip_base64'], validate=True), MAX_PAYLOAD + 1)
    if len(raw) > MAX_PAYLOAD or not inflater.eof or inflater.unused_data:raise ValueError('archive decompression budget')
    if policy.sha(raw) != wrapper['content_sha256']:raise ValueError('archive content hash mismatch')
    value = json.loads(raw)
    if set(value) != {'format', 'account', 'previous', 'tables', 'review'} or value['format'] != FORMAT or value['account'] != 'avoidboringpeople':
        raise ValueError('archive identity')
    if set(value['tables']) != set(TABLES) or any(not isinstance(t, dict) for t in value['tables'].values()):raise ValueError('archive tables')
    if value['previous'] is not None:check_ref(value['previous'])
    for name, row in value['tables']['auto_inventory'].items():
        encoded = row['manifest_json'];m = json.loads(encoded)
        admission.authenticate(m)
        if (m.get('account') != 'avoidboringpeople' or m.get('review_status') != 'AUTO_ADMITTED'
            or m.get('concept_id') != name or policy.canonical(m).decode() != encoded
            or policy.sha(encoded.encode()) != row['envelope_sha256']):raise ValueError('archive envelope mismatch')
        r=value['tables']['receipts'].get(name,{})
        if r.get('status')!='published' or r.get('sha256')!=m['video_sha256']:raise ValueError('archive publication mismatch')
    for name,m in value['tables']['legacy_manifests'].items():
        r=value['tables']['receipts'].get(name,{})
        if m.get('concept_id')!=name or m.get('account')!='avoidboringpeople' or r.get('status')!='published' or r.get('sha256')!=m.get('video_sha256'):
            raise ValueError('archive manual publication mismatch')
    return value


def empty():
    return {key: {} for key in TABLES}


def pack(tables):
    result = copy.deepcopy(tables)
    for row in result['auto_inventory'].values():row['manifest_json'] = policy.canonical(row.pop('manifest')).decode()
    return result


def unpack(tables):
    result = copy.deepcopy(tables)
    for row in result['auto_inventory'].values():row['manifest'] = json.loads(row.pop('manifest_json'))
    return result


def restore(hot, read):
    """Return logical state plus the cold baseline used to omit identical rows."""
    if hot.get('account') != 'avoidboringpeople':raise ValueError('wrong archive account')
    ref = hot.get('archive_head');pages = [];seen = set();size = 0;start = time.monotonic()
    while ref:
        check_ref(ref)
        if ref['sha256'] in seen or time.monotonic() - start > 90:raise ValueError('archive recovery circuit')
        seen.add(ref['sha256']);body = read(ref);size += len(body)
        if size > MAX_HISTORY:raise ValueError('archive recovery byte budget')
        page = decode(ref, body);size += len(policy.canonical(page))
        if size > MAX_HISTORY:raise ValueError('archive restored byte budget')
        pages.append(page);ref = page['previous']
    cold = empty();review = None
    for page in reversed(pages):
        for key, values in unpack(page['tables']).items():
            for name,row in values.items():
                if key=='auto_inventory' and name in cold[key] and cold[key][name]['envelope_sha256']!=row['envelope_sha256']:
                    raise ValueError('archive immutable concept conflict')
                if key=='legacy_manifests' and name in cold[key] and cold[key][name]!=row:raise ValueError('archive immutable manual concept conflict')
            cold[key].update(values)
        if page['review'] is not None:review = page['review']
    if review is not None:cold['weekly_review'] = review
    state = copy.deepcopy(hot)
    # Match the existing sort_keys=True CAS roundtrip, including tie ordering
    # in observational groups; archive page boundaries must not affect it.
    for key in TABLES:state[key] = copy.deepcopy(dict(sorted({**cold[key], **hot.get(key, {})}.items())))
    if 'weekly_review' not in hot and review is not None:state['weekly_review'] = copy.deepcopy(review)
    return state, cold


def compact(state, cold):
    result = copy.deepcopy(state)
    for key in TABLES:
        if key in result:result[key] = {name: value for name, value in result[key].items() if cold.get(key, {}).get(name) != value}
    if 'weekly_review' in cold and result.get('weekly_review') == cold['weekly_review']:result.pop('weekly_review', None)
    return result


def window_done(state,name,label):
    key=name+'-'+label;obs=state.get('observations',{}).get(key);gap=state.get('measurement_gaps',{}).get(key)
    return (isinstance(obs,dict) and obs.get('concept_id')==name and obs.get('window')==label and isinstance(obs.get('metrics'),dict)
            or isinstance(gap,dict) and gap.get('concept_id')==name and gap.get('window')==label and gap.get('reason')=='age_window_missed')


def plan(state, cold, *, now=None, force=False, review=False, manifests=()):
    """Terminal evidence only; one bounded batch, archive first, no state mutation."""
    now = now or datetime.now(timezone.utc);hot = compact(state, cold)
    # Archive before either existing ceiling, without adding per-tick tiny files.
    if not (force or review or len(hot.get('auto_inventory', {})) >= 48 or len(policy.canonical(hot)) >= 550_000):return None
    tables = empty();receipts = state.get('receipts', {})
    known={**state.get('legacy_manifests',{}),**{m['concept_id']:m for m in manifests}}
    published = sorted((n for n, r in receipts.items() if r.get('status') == 'published'), key=lambda n: receipts[n]['published_at'])
    pinned = {admission_canary(), next(iter(published), None)}
    for name in published:
        r = receipts[name]
        if name in pinned or instant(r['published_at']) > now - timedelta(days=HOT_DAYS):continue
        media = r.get('verified_media', {})
        if not r.get('media_id') or media.get('username') != 'avoidboringpeople' or str(media.get('id')) != str(r['media_id']):continue
        windows = [name + '-' + label for label in ('24h', '48h', '7d')]
        if not all(window_done(state,name,label) for label in ('24h','48h','7d')):continue
        if name not in state.get('auto_inventory',{}) and name not in known:continue
        if (cold.get('receipts', {}).get(name) == r and cold.get('auto_inventory',{}).get(name)==state.get('auto_inventory',{}).get(name)
            and all(cold.get(key,{}).get(w)==state.get(key,{}).get(w) for key in ('observations','measurement_gaps') for w in windows)):
            continue
        tables['receipts'][name] = r
        if name in state.get('auto_inventory', {}):tables['auto_inventory'][name] = state['auto_inventory'][name]
        else:tables['legacy_manifests'][name]=known[name]
        for key in ('observations', 'measurement_gaps'):
            tables[key].update({w: state[key][w] for w in windows if w in state.get(key, {})})
        if len(tables['receipts']) >= 24:break
    for name, point in hot.get('account_snapshots', {}).items():
        if instant(point['captured_at']) < now - timedelta(days=HOT_DAYS):tables['account_snapshots'][name] = point
    # Every historical review remains recoverable, while only one head is hot.
    frozen_review = state.get('weekly_review') if review else None
    if not any(tables.values()) and frozen_review is None:return None
    value = {'format': FORMAT, 'account': 'avoidboringpeople', 'previous': state.get('archive_head'),
             'tables': pack(tables), 'review': frozen_review}
    ref, body = encode(value)
    return ref, body, tables, frozen_review


def admission_canary():
    # Import late: promotion imports policy/scorecard in existing callers.
    from scripts.instagram_growth.autonomy.promotion import CANARY_ID
    return CANARY_ID


def public_read(ref):
    check_ref(ref)
    response = requests.get(RAW + ref['path'], stream=True, timeout=(10, 20), allow_redirects=False)
    try:
        response.raise_for_status();body = bytearray()
        for chunk in response.iter_content(65536):
            body.extend(chunk)
            if len(body) > MAX_FILE:raise ValueError('archive download budget')
        return bytes(body)
    finally:response.close()


def health(state, cold=None, *, now=None):
    now=now or datetime.now(timezone.utc)
    hot = compact(state, cold or empty());size = len(json.dumps(hot, indent=2, sort_keys=True).encode())
    count = len(hot.get('auto_inventory', {}));storage = state.get('auto_health', {}).get('storage', {})
    pending = [r for r in hot.get('receipts', {}).values() if r.get('status') not in ('published', 'confirmed_unpublished')]
    usage=state.get('auto_health',{}).get('usage',{})
    queued=[x['manifest'].get('admitted_at') for name,x in hot.get('auto_inventory',{}).items() if name not in state.get('receipts',{})]
    ages=[max(0,(now-instant(t)).total_seconds()/3600) for t in queued if t]
    feed=state.get('auto_health',{}).get('retention',{})
    return {'hot_envelopes': count, 'hot_envelope_limit': 64, 'hot_envelope_headroom': max(0, 64-count),
            'signed_feed_envelopes':feed.get('active_envelopes'),'oldest_unpublished_age_hours':max(ages) if ages else None,
            'hot_state_bytes': size, 'hot_state_limit_bytes': STATE_LIMIT, 'hot_state_headroom_bytes': max(0, STATE_LIMIT-size),
            'archive_head': state.get('archive_head'), 'archived_receipts_restored': len((cold or {}).get('receipts', {})),
            'archive_recovery': 'hash_and_signature_verified' if state.get('archive_head') and cold is not None else 'not_needed' if not state.get('archive_head') else 'not_checked',
            'unreconciled_hot_receipts': len(pending), 'stored_bytes': storage.get('size_bytes'),
            'monthly_reserved_bytes':usage.get('bytes_reserved'),'monthly_reserved_operations':usage.get('operations_reserved'),
            'media_retirement': 'DISABLED; public media and original envelopes are never deleted',
            'level': 'LOW_HEADROOM' if count >= 56 or size >= 700_000 or storage.get('size_bytes',0)>=650*1024**2
                     or usage.get('operations_reserved',0)>=750 or usage.get('bytes_reserved',0)>=224*1024**2 else 'OK'}


if __name__ == '__main__':
    import argparse
    from pathlib import Path
    parser=argparse.ArgumentParser(description='Read-only evidence recovery; no signing, CAS write, GPU, upload or publication')
    parser.add_argument('--state',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    state,cold=restore(json.loads(args.state.read_text()),public_read)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(state,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'recovery':health(state,cold),'output_kind':'logical_history_snapshot_not_a_hot_CAS_replacement',
                      'publication':'NOT_RUN','media_retirement':'DISABLED'},indent=2))
