"""Tests for the Medium draft renderer.

The canonical URL is derived offline, so the derivation is checked against
content ids and URLs read from the deployed search index.
"""

import glob
import re
from pathlib import Path

import nltk
import pytest

from scripts.automation import medium_prep
from scripts.automation.summarizers import summarizer_stub

# (content id, deployed URL slug) pairs taken from /search-index.json.
DEPLOYED_SLUGS = [
    ("2016_03_17_excel/index.md", "excel"),
    ("2017_02_23_random/index.md", "random"),
    ("2017_07_24_ib/index.md", "ib"),
    ("2019_03_24_time_illusion/index.md", "time_illusion"),
    ("2020_05_07_relative_billionaire/index.md", "relative_billionaire"),
    ("2021_05_02_art_history/index.md", "art_history"),
]

ARTICLE = """---
title: Test Article
description: A description
tags: [one, two, three, four, five, six, seven]
---

Body text with a [link](https://example.com 'link title').
"""


def _write_article(tmp_path, text=ARTICLE, folder="2016_03_17_excel"):
    directory = tmp_path / folder
    directory.mkdir()
    path = directory / "index.md"
    path.write_text(text, encoding="utf-8")
    return str(path)


@pytest.mark.parametrize("post_id,slug", DEPLOYED_SLUGS)
def test_canonical_url_matches_the_deployed_slug(post_id, slug):
    assert medium_prep.derive_slug(post_id) == slug
    assert medium_prep.canonical_url(post_id) == f"https://leonlins.com/writing/{slug}/"


@pytest.mark.parametrize("post_id,slug", DEPLOYED_SLUGS)
def test_repository_paths_and_content_ids_agree(post_id, slug):
    assert medium_prep.derive_slug(f"src/content/blog/{post_id}") == slug
    assert medium_prep.derive_slug(f"./src/content/blog/{post_id}") == slug


def test_only_a_single_date_prefix_is_stripped():
    # Mirrors computeCleanSlug: a slug that itself starts with a date keeps it.
    assert medium_prep.derive_slug("2020_05_07_2020_review/index.md") == "2020_review"


def test_mdx_and_flat_files_are_supported():
    assert medium_prep.derive_slug("2016_03_17_excel/index.mdx") == "excel"
    assert medium_prep.derive_slug("src/content/blog/2021_01_01_standalone.md") == "standalone"


def test_explicit_frontmatter_slug_wins():
    assert (
        medium_prep.derive_slug("2016_03_17_excel/index.md", "/custom-slug/") == "custom-slug"
    )
    # A blank slug falls back to the derived one, as it does for the site.
    assert medium_prep.derive_slug("2016_03_17_excel/index.md", "   ") == "excel"


def test_every_article_derives_a_usable_slug():
    paths = sorted(
        glob.glob("src/content/blog/*/index.md") + glob.glob("src/content/blog/*/index.mdx")
    )
    assert len(paths) > 50

    for path in paths:
        slug = medium_prep.derive_slug(path)
        assert slug, path
        assert not re.match(r"^\d{4}_\d{2}_\d{2}_", slug), path
        assert slug == slug.strip("/") and " " not in slug, path


def test_render_summary_html_renders_the_mapping_without_a_python_repr():
    rendered = medium_prep.render_summary_html(
        {
            "teaser": "A teaser with a [link](https://example.com 'title') in it.",
            "points": ["First point", "Second <point> & more"],
        }
    )

    assert "<h3>Summary</h3>" in rendered
    assert "{'teaser'" not in rendered
    assert '<a href="https://example.com">link</a>' in rendered
    assert "<li>First point</li>" in rendered
    assert "<li>Second &lt;point&gt; &amp; more</li>" in rendered


def test_render_summary_html_accepts_a_plain_string():
    rendered = medium_prep.render_summary_html("just a teaser")

    assert "<p>just a teaser</p>" in rendered
    assert "<ul>" not in rendered


def test_render_summary_html_skips_empty_content():
    assert "<ul>" not in medium_prep.render_summary_html({"teaser": "t", "points": []})
    assert "<ul>" not in medium_prep.render_summary_html({"teaser": "t", "points": [None, ""]})


def test_render_inline_html_preserves_angle_bracket_links():
    rendered = medium_prep.render_inline_html(
        "see [docs](<https://example.com/a(b)> 'the title')"
    )

    assert rendered == 'see <a href="https://example.com/a(b)">docs</a>'


def test_prepare_medium_post_renders_a_pasteable_draft(tmp_path, monkeypatch):
    monkeypatch.setattr(
        medium_prep,
        "stub_summarize",
        lambda post: {"teaser": "Teaser text", "points": ["Point one", "Point two"]},
    )

    draft = medium_prep.prepare_medium_post(_write_article(tmp_path))

    assert draft.startswith("<!--")
    assert "Title: Test Article" in draft
    assert "Description: A description" in draft
    # Medium allows five tags.
    assert "Tags: one, two, three, four, five" in draft
    assert "six" not in draft
    assert "Canonical URL: https://leonlins.com/writing/excel/" in draft
    assert "<li>Point one</li>" in draft
    assert '<a href="https://leonlins.com/writing/excel/">Read the full post here</a>' in draft


def test_prepare_medium_post_uses_the_llm_summarizer_when_asked(tmp_path, monkeypatch):
    calls = {}

    def fake_llm(post, **kwargs):
        calls["post"] = post
        calls["kwargs"] = kwargs
        return {"teaser": "LLM teaser", "points": []}

    monkeypatch.setattr(medium_prep, "llm_summarize", fake_llm)

    draft = medium_prep.prepare_medium_post(_write_article(tmp_path), dry_run=False)

    assert calls["kwargs"] == {"max_words": 250}
    assert "LLM teaser" in draft


def test_prepare_medium_post_rejects_a_missing_article(tmp_path):
    with pytest.raises(FileNotFoundError):
        medium_prep.prepare_medium_post(str(tmp_path / "missing" / "index.md"))


def test_double_hyphens_in_metadata_do_not_break_the_comment(tmp_path, monkeypatch):
    monkeypatch.setattr(
        medium_prep,
        "stub_summarize",
        lambda post: {"teaser": "Teaser", "points": []},
    )

    article = ARTICLE.replace("A description", "A -- description")
    draft = medium_prep.prepare_medium_post(_write_article(tmp_path, article))

    header = draft.split("-->", 1)[0]
    assert "--" not in header[len("<!--"):]
    assert "A - description" in draft


def test_main_prints_the_draft(tmp_path, capsys, monkeypatch):
    monkeypatch.delenv("DRY_RUN", raising=False)

    assert medium_prep.main([_write_article(tmp_path)]) == 0

    assert "Canonical URL: https://leonlins.com/writing/excel/" in capsys.readouterr().out


def test_main_reports_a_missing_article(tmp_path, capsys):
    assert medium_prep.main([str(tmp_path / "missing" / "index.md")]) == 1
    assert "::error::Article not found" in capsys.readouterr().out


def test_a_cold_nltk_cache_never_writes_to_stdout(monkeypatch, capsys):
    """stdout is the draft itself in CI, so progress notices must go to stderr."""
    stub_path = Path(summarizer_stub.__file__)

    def missing(resource_name):
        raise LookupError(resource_name)

    monkeypatch.setattr(nltk.data, "find", missing)
    monkeypatch.setattr(nltk, "download", lambda *args, **kwargs: True)

    # Re-run the module body the way a cold CI cache would: find() raises, so the
    # download branch executes while stdout is captured.
    source = compile(stub_path.read_text(encoding="utf-8"), str(stub_path), "exec")
    exec(source, {"__name__": "cold_cache_probe"})

    captured = capsys.readouterr()
    assert "Downloading NLTK resources" not in captured.out
    assert "Downloading NLTK resources" in captured.err
