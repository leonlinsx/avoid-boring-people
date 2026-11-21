"""Disposable local review decisions; never real human approvals or live uploads."""
import copy
import hashlib
import json
from pathlib import Path
import pytest
from scripts.instagram_growth.factory import review, replenish
from scripts.instagram_growth.factory.allocation import plan
from tests.test_instagram_factory import sample


def fixture(tmp_path, monkeypatch):
    item = sample(tmp_path, monkeypatch)
    item.update(source_url='https://leonlins.com/writing/example', visual='cards', presenter=False,
                standalone_context={'subject':'steps','situation':'Examining a process','payoff':'Observe before changing'})
    root = tmp_path / 'render'; root.mkdir(); video = root / 'final' / 'example-reel-REVIEW_ONLY.mp4'
    video.parent.mkdir(); video.write_bytes(b'disposable fixture, not a real media file')
    sha = hashlib.sha256(video.read_bytes()).hexdigest()
    (root / 'briefs.json').write_text(json.dumps({'items': [item]}))
    meta = {'sha256': sha, 'audio': {'voice': 'af_heart', 'duration': 22, 'seconds': 1},
            'verification': {'decode': 'PASS'}, 'rights': 'Disposable test fixture'}
    video.with_suffix('.manifest.json').write_text(json.dumps(meta))
    q = root / 'review-queue'; q.mkdir()
    (q / 'example-reel.json').write_text(json.dumps({'concept_id': 'example-reel', 'review_status': 'needs_human_review', 'video_sha256': sha}))
    directory = review.package(root, approved_dir=tmp_path / 'empty')
    snapshot = json.loads((directory / 'review-manifest.json').read_text())
    decision = {'account': 'avoidboringpeople', 'batch_id': snapshot['batch_id'], 'reviewer': 'TEST FIXTURE ONLY',
                'confirmed_review': True, 'decisions': [{'concept_id': 'example-reel', 'decision': 'approve', 'video_sha256': sha, 'notes': ''}]}
    return root, directory, decision


def test_no_default_approval_and_explicit_decision_required(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch)
    html = (package / 'index.html').read_text()
    assert 'value="pending" checked' in html and 'value="approve" checked' not in html
    with pytest.raises(ValueError, match='confirmation'):
        review.apply(package, decision)
    assert not (root / 'approved').exists()


def test_approved_fixture_has_durable_hash_bound_receipt(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch)
    a = review.apply(package, decision, True); b = review.apply(package, decision, True)
    assert a == b and len(list((root / 'review-decisions').glob('*.json'))) == 1
    m = json.loads(Path(a['approved'][0]).read_text())
    assert m['trial'] is False and m['video_url'] is None and m['release_after'] is None
    assert replenish.approved(root, {'account': 'avoidboringpeople', 'receipts': {}})[0]['approved_by'] == 'TEST FIXTURE ONLY'


@pytest.mark.parametrize('change', ['hash', 'batch', 'reviewer', 'confirmed'])
def test_invalid_decision_cannot_create_approval(tmp_path, monkeypatch, change):
    root, package, decision = fixture(tmp_path, monkeypatch)
    if change == 'hash': decision['decisions'][0]['video_sha256'] = 'b' * 64
    if change == 'batch': decision['batch_id'] = 'different'
    if change == 'reviewer': decision['reviewer'] = ''
    if change == 'confirmed': decision['confirmed_review'] = False
    with pytest.raises(ValueError): review.apply(package, decision, True)
    assert not (root / 'approved').exists()


@pytest.mark.parametrize('action', ['reject', 'revise'])
def test_rejected_or_revise_cannot_enter_release(tmp_path, monkeypatch, action):
    root, package, decision = fixture(tmp_path, monkeypatch)
    decision['decisions'][0].update(decision=action, notes='Needs a corrected new creative')
    review.apply(package, decision, True)
    decision['decisions'][0]['decision'] = 'approve'
    with pytest.raises(ValueError, match='rejected/used'): review.apply(package, decision, True)
    with pytest.raises(ValueError): replenish.approved(root, {'account': 'avoidboringpeople', 'receipts': {}})
    assert not (root / 'approved').exists()


def test_changed_media_and_source_fail_before_release(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch)
    review.apply(package, decision, True)
    path = next((root / 'final').glob('*.mp4')); path.write_bytes(b'changed')
    with pytest.raises(ValueError, match='bytes changed'):
        replenish.approved(root, {'account': 'avoidboringpeople', 'receipts': {}})
    with pytest.raises(ValueError, match='changed after review'): review.apply(package, decision, True)


def test_used_hash_and_unreviewed_manifest_are_blocked(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch)
    review.apply(package, decision, True)
    state = {'account': 'avoidboringpeople', 'receipts': {'different-name': {'sha256': decision['decisions'][0]['video_sha256'], 'status': 'published'}}}
    with pytest.raises(ValueError, match='duplicate'): replenish.approved(root, state)
    q = root / 'review-queue' / 'example-reel.json'; row = json.loads(q.read_text()); row.pop('human_decision'); q.write_text(json.dumps(row))
    with pytest.raises(ValueError, match='human approval'): replenish.approved(root, {'account': 'avoidboringpeople', 'receipts': {}})


def test_complete_replenish_path_uses_existing_uploader_without_live_calls(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch); review.apply(package, decision, True)
    calls = []
    def uploader(command, check):
        calls.append(command)
        incoming, outgoing = Path(command[-2]), Path(command[-1]); outgoing.mkdir()
        for path in incoming.glob('*.json'):
            m = json.loads(path.read_text()); m['video_url'] = 'https://' + replenish.hosted.HOST + '/instagram/reels/example-reel/' + m['video_sha256'] + '.mp4'
            m['video_path'] = 'downloads/' + m['video_sha256'] + '.mp4'
            (outgoing / path.name).write_text(json.dumps(m))
    monkeypatch.setattr(replenish.subprocess, 'run', uploader)
    with pytest.raises(ValueError, match='free storage'):
        replenish.release(root, {'account': 'avoidboringpeople', 'receipts': {}}, '2026-12-01T12:00:00Z')
    result = replenish.release(root, {'account': 'avoidboringpeople', 'receipts': {}}, '2026-12-01T12:00:00Z', True)
    assert result['published'] == 0 and len(result['queue_files']) == 1
    assert calls[0][1] == 'scripts/instagram_growth/upload_blob.mjs'
    row = json.loads(Path(result['queue_files'][0]).read_text())
    assert row['release_status'] == 'APPROVED_HOSTED_QUEUED' and row['release_after'] == '2026-12-01T12:00:00Z'


def test_allocation_is_bounded_and_does_not_invent_winners():
    p = plan(40, {})
    assert p['planned_counts'] == {'exploration': 24, 'exploitation': 10, 'control': 6}
    assert sum(x['experiment_bucket'] == 'exploration' for x in p['slots']) == 34
    assert len(p['slots']) == 40
    assert set(x['voice'] for x in p['slots']) == {'af_heart', 'af_nicole'}
    assert set(x['visual_style'] for x in p['slots']) == {'cards', 'statement'}
    assert sum(x['planned_bucket'] == 'control' for x in p['slots'][:21]) in (3, 4)
    evidence = {'hypothesis': 'contrast', 'source_articles': ['one', 'two'], 'encouraging_source_articles':['one','two'], 'replication_eligible':True, 'n_reels': 2, 'reach': 800, 'shares_per_1000_reached': 10}
    p = plan(40, {'weekly_review': {'replication_candidates': [evidence]}})
    assert sum(x['experiment_bucket'] == 'exploitation' for x in p['slots']) == 10


def test_review_package_tampering_is_rejected(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch)
    p = package / 'review-manifest.json'; m = json.loads(p.read_text()); m['items'][0]['blocked'] = True; p.write_text(json.dumps(m))
    with pytest.raises(ValueError, match='manifest changed'): review.apply(package, decision, True)


def test_user_editorial_hold_blocks_even_explicit_approval(tmp_path, monkeypatch):
    root, package, decision = fixture(tmp_path, monkeypatch)
    (root / 'editorial-hold.json').write_text('{"reason":"context missing"}')
    with pytest.raises(ValueError, match='editorial revision'): review.apply(package, decision, True)
    with pytest.raises(ValueError, match='editorial revision'): replenish.approved(root, {'account':'avoidboringpeople'})


def test_context_check_rejects_unseen_references_but_allows_spatial_words(tmp_path, monkeypatch):
    from scripts.instagram_growth.factory.run import validate
    item = sample(tmp_path, monkeypatch)
    item['standalone_context'] = {'subject':'steps','situation':'a process','payoff':'a better question'}
    assert validate(item)
    item['scenes'][0]['narration'] = 'From the above, observe the steps in your process. ' + item['scenes'][0]['narration']
    with pytest.raises(ValueError, match='unseen context'): validate(item)
    item['scenes'][0]['narration'] = 'Observe the steps from above. ' + ' '.join(['Observe the process carefully.']*9)
    assert validate(item)


def test_source_context_anchor_change_is_rejected(tmp_path, monkeypatch):
    from scripts.instagram_growth.factory.run import validate
    item = sample(tmp_path, monkeypatch); item['context_anchors'] = ['invented setup not found in the article']
    with pytest.raises(ValueError, match='context mismatch'): validate(item)


def test_local_generator_has_one_evidence_based_context_repair(tmp_path, monkeypatch):
    from scripts.instagram_growth.factory import draft as d
    item = sample(tmp_path, monkeypatch)
    claim = {k:item[k] for k in ('source_file','source_sha256','source_anchor')}
    claim.update(title='Process review', source_url='https://leonlins.com/writing/example')
    bad = {'label':'Observe the steps','graphic_labels':['OBSERVE','CHANGE','REVIEW'],'scenes':item['scenes'],
           'standalone_context':{'subject':'invisible subject','situation':'A process','payoff':'Observe first'}}
    good = {**bad, 'standalone_context':{**bad['standalone_context'],'subject':'steps'}}
    responses = [bad, good, {'unsupported_claims':[], 'missing_qualifications':[]}]; calls=[]
    def generate(prompt, **kwargs):
        calls.append(prompt); return responses.pop(0), {'model':'local-test'}
    monkeypatch.setattr(d, 'generate', generate)
    result = d.draft(claim, 0, 7)
    assert len(calls)==3 and 'EDITORIAL REPAIR' in calls[1]
    assert len(result['editorial_revisions'])==1 and result['review_status']=='needs_review'


def test_future_render_budget_contains_six_matched_presentation_pairs():
    from scripts.instagram_growth.factory.allocation import presentation_pairs
    items=[{'concept_id':f'example-{i}','source_file':f'article-{i}','scenes':[{'narration':f'Example {i}'}],
            'voice':'af_heart','caption_words':5,'presenter':bool(i%2),'duration_target':'25-40s'} for i in range(30)]
    selected=presentation_pairs(items,21)
    assert len(selected)==21 and len({x['concept_id'] for x in selected})==21
    paired={x['pair_id'] for x in selected if x.get('pair_id')};assert len(paired)==6
    for pair_id in paired:
        a,b=[x for x in selected if x.get('pair_id')==pair_id]
        assert a['presenter']!=b['presenter']
        assert all(a[k]==b[k] for k in ('scenes','voice','caption_words','source_file','duration_target'))
