"""Reviewed batch -> bounded existing Blob upload -> ordinary queue PR. No publish."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
from scripts.instagram_growth import reel_pilot as pilot, hosted, rolling_queue
from scripts.instagram_growth.factory.run import validate,standalone
from scripts.instagram_growth.factory.review import assets, digest

REPO = 'leonlinsx/avoid-boring-people'
MAX_BATCH_BYTES = 75 * 1024 * 1024


def approved(root, state):
    """Require durable human decisions; legacy/model-only approval isn't enough."""
    if state.get('account') != pilot.ACCOUNT:
        raise ValueError('wrong account state')
    root = Path(root).resolve(); result = []; hashes = set()
    if (root/'editorial-hold.json').exists():raise ValueError('editorial revision required before release')
    used = state.get('receipts', {})
    used_hashes = {x.get('sha256') for x in used.values() if x.get('status') != 'confirmed_unpublished'}
    for batch in assets(root):
        for path in sorted((batch / 'approved').glob('*.json')):
            m = json.loads(path.read_text()); name = m['concept_id']
            review = json.loads((batch / 'review-queue' / f'{name}.json').read_text())
            human = review.get('human_decision', {})
            receipt = Path(human.get('ledger', '/NONEXISTENT')).resolve()
            if not receipt.is_relative_to(root / 'review-decisions') or not receipt.is_file():
                raise ValueError('durable human approval missing')
            recorded = json.loads(receipt.read_text())['decision']
            match = next((x for x in recorded['decisions'] if x['concept_id'] == name), {})
            if (review['review_status'] != 'approved' or human.get('decision') != 'approve'
                    or recorded.get('confirmed_review') is not True or recorded.get('reviewer') != m.get('approved_by')
                    or match.get('decision') != 'approve' or match.get('video_sha256') != m['video_sha256']):
                raise ValueError('rejected/unreviewed creative cannot be replenished')
            if m.get('trial') is not False or m['account'] != pilot.ACCOUNT:
                raise ValueError('ordinary ABP only')
            if name in used or m['video_sha256'] in used_hashes or m['video_sha256'] in hashes:
                raise ValueError('published, used or duplicate creative')
            video = batch / 'final' / f'{name}-REVIEW_ONLY.mp4'
            if video.resolve() != Path(m['video_path']).resolve() or hashlib.sha256(video.read_bytes()).hexdigest() != m['video_sha256']:
                raise ValueError('approved bytes changed')
            item = next(x for x in json.loads((batch / 'briefs.json').read_text())['items'] if x['concept_id'] == name)
            standalone(validate(dict(item))); meta = json.loads(video.with_suffix('.manifest.json').read_text())
            if meta.get('verification', {}).get('decode') != 'PASS':
                raise ValueError('technical QA missing')
            hashes.add(m['video_sha256']); result.append(m)
    if not result or len(result) > 30 or sum(Path(m['video_path']).stat().st_size for m in result) > MAX_BATCH_BYTES:
        raise ValueError('no human-approved assets or bounded release budget exceeded')
    return result


def stage(hosted_dir, output, release_after):
    rolling_queue.instant(release_after)
    output = Path(output); output.mkdir(parents=True, exist_ok=True); result = []
    for path in sorted(Path(hosted_dir).glob('*.json')):
        m = pilot.load_manifest(path)
        if m['trial'] or not str(m['video_url']).startswith('https://' + hosted.HOST + '/instagram/reels/'):
            raise ValueError('ordinary verified Blob queue required')
        hosted.source_check(m)
        m.update(release_after=release_after, release_status='APPROVED_HOSTED_QUEUED')
        target = output / path.name; text = json.dumps(m, indent=2) + '\n'
        if target.exists() and target.read_text() != text:
            raise ValueError('release already frozen differently')
        target.write_text(text); result.append(target)
    return result


def gh(method, route, body=None):
    command = ['gh', 'api', '--method', method, f'repos/{REPO}/{route}']
    if body is not None:
        command += ['--input', '-']
    return json.loads(subprocess.check_output(command, input=json.dumps(body) if body is not None else None, text=True))


def submit(paths, release_root):
    """Create a scoped PR through Git data, preserving the entire local worktree."""
    release_root = Path(release_root); receipt = release_root / 'queue-pr.json'
    if receipt.exists():
        return json.loads(receipt.read_text())
    base = gh('GET', 'git/ref/heads/main')['object']['sha']
    commit = gh('GET', 'git/commits/' + base)
    entries = []
    for path in paths:
        m = pilot.load_manifest(path)
        if m['trial']:
            raise ValueError('Trial parked')
        route = 'scripts/instagram_growth/approved/' + path.name
        # Existing published manifests may never be replaced by a release batch.
        existing = subprocess.run(['gh', 'api', f'repos/{REPO}/contents/{route}?ref=main'], capture_output=True)
        if existing.returncode == 0:
            raise ValueError('queue concept already registered')
        if b'404' not in existing.stderr:
            raise ValueError('cannot verify queue path absence')
        entries.append({'path': route, 'mode': '100644', 'type': 'blob', 'content': path.read_text()})
    tree = gh('POST', 'git/trees', {'base_tree': commit['tree']['sha'], 'tree': entries})
    new = gh('POST', 'git/commits', {'message': 'Replenish explicitly reviewed ordinary ABP Reels', 'tree': tree['sha'], 'parents': [base]})
    branch = 'codex/abp-reviewed-' + digest([p.read_text() for p in paths])[:12]
    gh('POST', 'git/refs', {'ref': 'refs/heads/' + branch, 'sha': new['sha']})
    pr = gh('POST', 'pulls', {'title': f'Replenish {len(paths)} human-reviewed ordinary ABP Reels', 'base': 'main', 'head': branch,
                             'body': 'Explicit batch playback/source/rights decisions recorded locally. Immutable Blob SHA hashes verified before staging. Ordinary ABP only. Requires exact-head CI and scoped review before merge; this command does not publish or merge.'})
    result = {'url': pr['html_url'], 'head': new['sha'], 'assets': len(paths)}
    receipt.write_text(json.dumps(result, indent=2) + '\n'); return result


def release(root, state, release_after, confirmed_free_quota=False, submit_pr=False):
    if not confirmed_free_quota:
        raise ValueError('verify existing Hobby free storage/transfer allowance before release')
    root = Path(root).resolve(); items = approved(root, state)
    out = root / 'release'; out.mkdir(exist_ok=True)
    plan = {'release_after': release_after, 'items': items}
    lock = out / 'release-plan.json'
    if lock.exists() and json.loads(lock.read_text()) != plan:
        raise ValueError('release frozen; preserve prior plan')
    lock.write_text(json.dumps(plan, indent=2) + '\n')
    groups = [[]]
    for m in items:
        size = Path(m['video_path']).stat().st_size
        if size > 25 * 1024 * 1024:
            raise ValueError('one asset exceeds bounded upload invocation')
        if len(groups[-1])>=24 or sum(Path(x['video_path']).stat().st_size for x in groups[-1]) + size > 25 * 1024 * 1024:
            groups.append([])
        groups[-1].append(m)
    staged = []
    for i, group in enumerate(groups):
        input_dir = out / f'upload-{i}'; input_dir.mkdir(exist_ok=True)
        hosted_dir = out / f'hosted-{i}'
        for m in group:
            (input_dir / f"{m['concept_id']}.json").write_text(json.dumps(m, indent=2) + '\n')
        subprocess.run(['node', 'scripts/instagram_growth/upload_blob.mjs', str(input_dir), str(hosted_dir)], check=True)
        staged += stage(hosted_dir, out / 'queue', release_after)
    result = {'queue_files': [str(p) for p in staged], 'published': 0}
    if submit_pr:
        result['pull_request'] = submit(staged, out)
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--root', type=Path, required=True)
    p.add_argument('--state', type=Path, required=True); p.add_argument('--release-after', required=True)
    p.add_argument('--confirm-free-quota', action='store_true'); p.add_argument('--submit-pr', action='store_true'); a = p.parse_args()
    print(json.dumps(release(a.root, json.loads(a.state.read_text()), a.release_after, a.confirm_free_quota, a.submit_pr), indent=2))


if __name__ == '__main__':
    main()
