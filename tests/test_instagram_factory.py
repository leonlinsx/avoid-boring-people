"""Source and review boundary controls for the reusable local GPU factory."""
import hashlib
from pathlib import Path
import pytest
from scripts.instagram_growth.factory.run import validate
from scripts.instagram_growth.factory.draft import claim_pool


def sample(tmp_path,monkeypatch):
    monkeypatch.chdir(tmp_path);p=Path('src/content/blog/2020_01_01_example/index.md');p.parent.mkdir(parents=True);p.write_text('---\ntitle: Example\npubDate: 2020-01-01\n---\nA source claim about observing the steps in a process before changing them. This is only the author framework, not a guarantee of success.\n')
    narration='Observe the steps in your process before making a change. This is a framework to try and evaluate, rather than a guarantee that every change will work. Follow for practical ideas about making decisions and learning from your results.'
    return {'source_file':str(p),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_anchor':'A source claim about observing','concept_id':'example-reel','scenes':[{'narration':narration if i==0 else 'Record the change.','headline':'A process to test','detail':'Observe and evaluate'} for i in range(4)]}


def test_valid_source_retains_narration(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);assert validate(item)['text'].startswith('Observe the steps')


def test_changed_source_is_refused(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);Path(item['source_file']).write_text('changed')
    with pytest.raises(ValueError,match='mismatch'):validate(item)


def test_invented_anchor_is_refused(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);item['source_anchor']='this was never written'
    with pytest.raises(ValueError,match='mismatch'):validate(item)


def test_unsafe_concept_is_refused(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);item['concept_id']='../../other'
    with pytest.raises(ValueError,match='unsafe'):validate(item)


def test_overflow_copy_is_refused(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);item['scenes'][0]['headline']='x'*81
    with pytest.raises(ValueError,match='scene copy'):validate(item)


def test_pool_excludes_drafts_and_future_sources(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);source=Path(item['source_file'])
    assert claim_pool()==[]  # Thin source fragments cannot support a full script.
    source.write_text(source.read_text().rstrip()+' Additional context describes writing down the input, the action, the feedback and the reason each step exists before choosing a small change. The example is a proposed exercise to examine a process carefully, and it makes no claim that one method guarantees a successful outcome. A record helps the reader compare what was intended with what actually happened when trying the exercise in practice.\n')
    assert len(claim_pool())==1
    data=source.read_text();source.write_text(data.replace('pubDate: 2020-01-01','draft: true\npubDate: 2020-01-01'));assert claim_pool()==[]
    source.write_text(data.replace('2020-01-01','2099-01-01'));assert claim_pool()==[]


def test_approval_cannot_be_implicit(tmp_path):
    from scripts.instagram_growth.factory.approve import approve
    with pytest.raises(ValueError,match='explicit'):
        approve(tmp_path,'some-concept','operator',False)
    with pytest.raises(ValueError,match='named reviewer'):
        approve(tmp_path,'some-concept','',True)


def test_rejected_asset_cannot_be_approved(tmp_path):
    import json
    from scripts.instagram_growth.factory.approve import approve
    folder=tmp_path/'review-queue';folder.mkdir();(folder/'some-concept.json').write_text(json.dumps({'review_status':'rejected'}))
    with pytest.raises(ValueError,match='rejected'):
        approve(tmp_path,'some-concept','operator',True)


def test_source_path_cannot_escape_the_article_tree(tmp_path,monkeypatch):
    item=sample(tmp_path,monkeypatch);outside=tmp_path/'src/outside.md';outside.write_text('private unrelated data')
    item.update(source_file='src/content/blog/../../outside.md',source_sha256=hashlib.sha256(outside.read_bytes()).hexdigest(),source_anchor='private')
    with pytest.raises(ValueError,match='invalid source'):validate(item)
