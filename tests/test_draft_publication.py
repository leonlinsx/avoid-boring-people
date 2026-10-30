"""Draft selection is exercised against real commit transitions, without publishing."""
from pathlib import Path
import subprocess
import pytest
from scripts.automation.new_articles import is_draft, newly_published, local_article_is_draft
from scripts.automation.fetch_post import normalize_posts
from scripts.automation.ranking import filter_posts
from scripts.automation.routing import eligible_for_category


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def test_draft_to_published_and_regular_edit(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    git('init', '-q')
    git('config', 'user.email', 'fixture@example.test')
    git('config', 'user.name', 'Fixture')
    path = Path('src/content/blog/2099_01_01_fixture/index.md')
    path.parent.mkdir(parents=True)
    path.write_text('---\ntitle: Private\ndraft: true # hidden\n---\nBody')
    git('add', str(path)); git('commit', '-qm', 'draft')
    first = git('rev-parse', 'HEAD')
    path.write_text('---\ntitle: Published\ndraft: false\n---\nBody')
    git('add', str(path)); git('commit', '-qm', 'publish')
    second = git('rev-parse', 'HEAD')
    assert newly_published(first, second) == ['2099_01_01_fixture/index.md']
    path.write_text(path.read_text() + '\nEdited')
    git('add', str(path)); git('commit', '-qm', 'edit')
    assert newly_published(second, 'HEAD') == []
    path.write_text('---\ntitle: Private again\ndraft: true\n---\nBody')
    git('add', str(path)); git('commit', '-qm', 'hide')
    assert newly_published(second, 'HEAD') == []
    added = path.parent.parent / '2099_01_02_added/index.md'
    added.parent.mkdir(); added.write_text('---\ntitle: New published\n---\nBody')
    draft = path.parent.parent / '2099_01_03_draft/index.md'
    draft.parent.mkdir(); draft.write_text('---\ntitle: New draft\ndraft: true\n---\nBody')
    before = git('rev-parse', 'HEAD')
    git('add', 'src'); git('commit', '-qm', 'add two')
    assert newly_published(before, 'HEAD') == ['2099_01_02_added/index.md']
    assert newly_published('', 'HEAD') == []
    before_rename = git('rev-parse', 'HEAD')
    git('mv', str(added.parent), 'src/content/blog/2099_01_04_renamed')
    git('commit', '-qm', 'rename published article')
    assert newly_published(before_rename, 'HEAD') == []
    assert local_article_is_draft('2099_01_03_draft/index.md')
    post = {'id': '2099_01_03_draft/index.md', 'url': '/writing/draft', 'content': 'word ' * 300}
    assert normalize_posts([post]) == [], 'stale deployed index cannot override a local draft'



def test_draft_guard_across_selection(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    draft = {'id': 'private/index.md', 'url': '/writing/private', 'draft': True, 'category': 'Technology', 'content': 'word ' * 300}
    assert normalize_posts([draft]) == []
    assert filter_posts([draft]) == []
    assert not eligible_for_category(draft, 'bluesky')
    assert is_draft('---\n"draft": true # unpublished\n---\nBody')
    assert not is_draft('---\ndraft: false\n---\nBody')
    assert not is_draft('---\ntitle: Old published\n---\nBody')
    with pytest.raises(ValueError):
        is_draft('---\ndraft: "false"\n---\n')
