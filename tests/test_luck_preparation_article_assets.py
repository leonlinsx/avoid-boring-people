"""Article PNG export smoke checks (no publication or index.md changes)."""
from pathlib import Path

import pytest

from analyses.luck_preparation import article_assets


def test_baseline_export_colocates_with_astro_post_without_markdown(tmp_path):
    target = tmp_path / "2026_10_24_luck_preparation" / "assets"
    output = article_assets.render_article_assets(out_dir=target)
    assert len(output) == 16
    assert len(list(target.glob("*.png"))) == 16
    assert all(p.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n" for p in output)
    assert (target / "single_additive_base_1.png").exists()
    assert (target / "single_additive_base_10000.png").exists()
    assert (target / "cohort_multiplicative_reversing_base.png").exists()
    assert not list(tmp_path.rglob("*.md"))
    assert not (target.parent / "index.md").exists()
    with pytest.raises(FileExistsError, match="Refusing to overwrite"):
        article_assets.render_article_assets(out_dir=target)


def test_default_target_matches_existing_astro_article_directory():
    assert str(article_assets.ARTICLE_ASSET_DIR).startswith(
        "src/content/blog/2026_10_24_luck_preparation/"
    )
