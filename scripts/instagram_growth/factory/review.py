"""Offline batch review package and explicit, hash-bound durable decisions."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
import os
from pathlib import Path
import re
from scripts.instagram_growth.factory.run import validate
from scripts.instagram_growth.factory.approve import approve


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def assets(root):
    return sorted(p.parent for p in Path(root).rglob('briefs.json') if (p.parent / 'review-queue').is_dir())


def package(root, state=None, approved_dir=Path('scripts/instagram_growth/approved')):
    root = Path(root).resolve(); state = state or {}
    if state and state.get('account') != 'avoidboringpeople':
        raise ValueError('wrong account review state')
    known = [json.loads(p.read_text()) for p in approved_dir.glob('*.json')]
    used = state.get('receipts', {})
    used_hashes = {v.get('sha256') for v in used.values() if v.get('status') != 'confirmed_unpublished'}
    rows = []; ids = set(); held=(root/'editorial-hold.json').exists()
    pair_registry=json.loads((root/'presentation-pairs.json').read_text()) if (root/'presentation-pairs.json').exists() else {}
    for batch in assets(root):
        for item in json.loads((batch / 'briefs.json').read_text())['items']:
            item = validate(dict(item)); name = item['concept_id']
            if name in ids:
                raise ValueError('duplicate concept in review package')
            ids.add(name)
            if not re.fullmatch(r'https://leonlins\.com/writing/[a-zA-Z0-9_/-]+/?', item['source_url']):
                raise ValueError('unowned source URL')
            video = batch / 'final' / f'{name}-REVIEW_ONLY.mp4'
            meta = json.loads(video.with_suffix('.manifest.json').read_text())
            review = json.loads((batch / 'review-queue' / f'{name}.json').read_text())
            sha = hashlib.sha256(video.read_bytes()).hexdigest()
            if sha != meta['sha256'] or sha != review['video_sha256']:
                raise ValueError('reviewed bytes changed')
            pairing=pair_registry.get(name,{})
            if pairing and pairing.get('video_sha256')!=sha:raise ValueError('pair registry video changed')
            text = item['text']; words = set(re.findall(r'\w+', text.lower()))
            similar = []
            for other in known:
                other_words = set(re.findall(r'\w+', other.get('source_anchor', '').lower()))
                overlap = len(words & other_words) / max(1, len(words | other_words))
                if other.get('video_sha256') == sha or overlap >= .65:
                    similar.append(other['concept_id'])
            findings = list(review.get('review_findings', []))
            if held:findings.append('Batch returned for editorial revision: standalone subject/setup/payoff required.')
            if not item.get('standalone_context'):findings.append('Standalone context has not been explicitly screened.')
            passage = item.get('source_passage')
            omitted = re.sub(r'[*_`]', '', item['source_anchor'])[len(passage):] if passage else ''
            qualification = bool(re.search(r'\b(however|unless|although|except|but|caveat|only if)\b', omitted, re.I))
            if qualification:findings.append('REVISE: source qualification omitted after this passage; preserve context in a corrected creative.')
            blocked = held or not item.get('standalone_context') or name in used or sha in used_hashes or review.get('review_status') in ('rejected', 'revise') or qualification
            rows.append({'concept_id': name, 'batch': str(batch.relative_to(root)), 'video_sha256': sha,
                         'source_file': item['source_file'], 'source_sha256': item['source_sha256'],
                         'source_url': item['source_url'], 'source_anchor': item['source_anchor'],
                         'hook': item['scenes'][0]['narration'], 'transcript': text,
                         'voice': meta['audio']['voice'], 'presenter': bool(item.get('presenter')),
                         'visual': item['visual'], 'duration_seconds': meta['audio']['duration'],
                         'experiment_bucket': item.get('experiment_bucket', 'legacy_unassigned'),
                         'hypothesis': item.get('experiment_hypothesis'),
                         'standalone_context': item.get('standalone_context'),
                         'pair_id':pairing.get('pair_id',item.get('pair_id')),'pair_role':pairing.get('pair_role',item.get('pair_role')),
                         'production_seconds': meta.get('render_seconds', 0) + meta['audio'].get('seconds', 0) + meta.get('captions',{}).get('seconds',0) + meta.get('presenter', {}).get('seconds_including_load_and_encode', 0) + (json.loads((batch/'audio'/f'{name}-independent-asr.json').read_text()).get('seconds',0) if (batch/'audio'/f'{name}-independent-asr.json').exists() else 0),
                         'technical_verification': meta.get('verification', {}),
                         'rights': meta.get('rights'), 'rights_status': 'Human attribution/rights check required; source extraction is not authorship proof.',
                         'findings': findings, 'similar_to': similar, 'blocked': blocked,
                         'video': os.path.relpath(video, root / 'review')})
    if not rows:
        raise ValueError('no completed review assets')
    body = {'account': 'avoidboringpeople', 'items': rows}
    body['batch_id'] = digest(body)
    out = root / 'review'; out.mkdir(exist_ok=True)
    (out / 'review-manifest.json').write_text(json.dumps(body, indent=2) + '\n')
    template = Path(__file__).with_name('review.html').read_text()
    cards = []
    e = html.escape
    for i, row in enumerate(rows):
        n = row['concept_id']; warnings = '; '.join(row['findings']) or 'Full playback, source and rights review pending.'
        mate=next((x['concept_id'] for x in rows if row.get('pair_id') and x.get('pair_id')==row['pair_id'] and x['concept_id']!=n),None)
        comparison=f'<a href="#{e(mate)}">Compare the matching {"graphics" if row["pair_role"]=="presenter" else "presenter"} version</a>' if mate else ''
        cards.append(f'''<article id="{e(n)}" data-concept="{e(n)}"><h2>{i+1}. {e(n)}</h2>
<video controls playsinline preload="none" {'loading="lazy"' if i else ''} width="270" height="480" src="{e(row['video'])}" aria-label="{e(n)} preview"></video>
<p><a href="{e(row['source_url'])}">Read original article</a> · {e(row['voice'])} · {'Fictional presenter' if row['presenter'] else 'Graphics'} · {e(row['visual'])} · {row['duration_seconds']:.1f}s · production {row['production_seconds']:.1f}s</p><p>Presentation comparison: {e(row['pair_id'] or 'unpaired')} · {e(row['pair_role'] or 'single version')}. {comparison}</p>
<p><strong>Opening:</strong> {e(row['hook'])}</p><p>{e(row['transcript'])}</p>
<details><summary>Source, verification and rights</summary><blockquote>{e(row['source_anchor'])}</blockquote><p>{e(row['rights_status'])}</p><pre>{e(json.dumps(row['technical_verification'],indent=2))}</pre><p>{e(row['rights'] or 'Unverified')}</p></details>
<p class="warning">{e(warnings)} Similarity: {e(', '.join(row['similar_to']) or 'no flagged approved match')}. {'BLOCKED: used/rejected asset.' if row['blocked'] else ''}</p>
<fieldset><legend>Decision for {e(n)}</legend>{''.join(f'<input type="radio" id="{n}-{d}" name="{n}" value="{d}" {"checked" if d=="pending" else ""} {"disabled" if row["blocked"] and d=="approve" else ""}><label for="{n}-{d}">{d.title()}</label>' for d in ('pending','approve','reject','revise'))}</fieldset>
<label for="{n}-notes">Notes / resolved findings</label><textarea id="{n}-notes" name="{n}-notes" rows="2"></textarea></article>''')
    encoded = json.dumps(body).replace('<', '\\u003c').replace('&', '\\u0026')
    (out / 'index.html').write_text(template.replace('<!--CARDS-->', '\n'.join(cards)).replace('/*MANIFEST*/null', encoded))
    (out / 'review.js').write_text(Path(__file__).with_name('review.js').read_text())
    return out


def apply(package_dir, decisions, confirmed=False):
    """Record one explicit batch decision before idempotent approval materialization."""
    if not confirmed:
        raise ValueError('explicit confirmation required; never auto-approve')
    package_dir = Path(package_dir).resolve(); root = package_dir.parent
    snapshot = json.loads((package_dir / 'review-manifest.json').read_text())
    if digest({k:v for k,v in snapshot.items() if k!='batch_id'}) != snapshot['batch_id']:
        raise ValueError('review manifest changed')
    if decisions.get('batch_id') != snapshot['batch_id'] or decisions.get('account') != 'avoidboringpeople':
        raise ValueError('wrong account or changed review package')
    if decisions.get('confirmed_review') is not True or not str(decisions.get('reviewer', '')).strip():
        raise ValueError('named reviewer and explicit source/rights/full-playback review required')
    if (root/'editorial-hold.json').exists() and any(x.get('decision')=='approve' for x in decisions.get('decisions',[])):
        raise ValueError('batch returned for editorial revision; use corrected new assets')
    rows = {x['concept_id']: x for x in snapshot['items']}; planned = []; seen = set()
    for decision in decisions['decisions']:
        name = decision['concept_id']; action = decision['decision']
        if name not in rows or name in seen or action not in ('pending', 'approve', 'reject', 'revise'):
            raise ValueError('unknown, duplicate or invalid decision')
        seen.add(name); row = rows[name]
        if decision.get('video_sha256') != row['video_sha256']:
            raise ValueError('approval hash mismatch')
        batch = (root / row['batch']).resolve()
        if not batch.is_relative_to(root):
            raise ValueError('review batch escaped package root')
        video = batch / 'final' / f'{name}-REVIEW_ONLY.mp4'
        if hashlib.sha256(video.read_bytes()).hexdigest() != row['video_sha256']:
            raise ValueError('video changed after review')
        current = json.loads((batch / 'review-queue' / f'{name}.json').read_text())
        if action == 'approve' and (row['blocked'] or current['review_status'] in ('rejected', 'revise')):
            raise ValueError('rejected/used asset requires a corrected new creative')
        if action != 'pending' and (row['findings'] or action in ('reject', 'revise')) and not decision.get('notes', '').strip():
            raise ValueError('explain rejection, revision or resolution of findings')
        if action == 'approve':
            items = json.loads((batch / 'briefs.json').read_text())['items']
            validate(next(dict(x) for x in items if x['concept_id'] == name))
            meta = json.loads(video.with_suffix('.manifest.json').read_text())
            if meta.get('verification', {}).get('decode') != 'PASS':
                raise ValueError('technical verification missing')
        planned.append((batch, row, decision))
    # Immutable decisions are outside mutable review-package regeneration.
    ledger = root / 'review-decisions'; ledger.mkdir(exist_ok=True)
    path = ledger / f'{digest(decisions)}.json'
    if not path.exists():
        with path.open('x') as file:
            json.dump({'recorded_at': datetime.now(timezone.utc).isoformat(), 'decision': decisions}, file, indent=2)
    approved = []
    for batch, row, decision in planned:
        if decision['decision'] == 'pending':
            continue
        q = batch / 'review-queue' / f"{row['concept_id']}.json"; current = json.loads(q.read_text())
        if decision['decision'] == 'approve':
            approved.append(str(approve(batch, row['concept_id'], decisions['reviewer'], True)))
            current['review_status'] = 'approved'
        else:
            current['review_status'] = 'rejected' if decision['decision'] == 'reject' else 'revise'
        current['human_decision'] = {**decision, 'reviewer': decisions['reviewer'], 'ledger': str(path)}
        q.write_text(json.dumps(current, indent=2) + '\n')
    return {'decision_receipt': str(path), 'approved': approved}


def main():
    p = argparse.ArgumentParser(description=__doc__); sub = p.add_subparsers(dest='action', required=True)
    build = sub.add_parser('build'); build.add_argument('--root', type=Path, required=True); build.add_argument('--state', type=Path)
    commit = sub.add_parser('apply'); commit.add_argument('--package', type=Path, required=True); commit.add_argument('--decisions', type=Path, required=True); commit.add_argument('--confirm-reviewed', action='store_true')
    a = p.parse_args()
    if a.action == 'build':
        print(package(a.root, json.loads(a.state.read_text()) if a.state else None))
    else:
        print(json.dumps(apply(a.package, json.loads(a.decisions.read_text()), a.confirm_reviewed), indent=2))


if __name__ == '__main__':
    main()
