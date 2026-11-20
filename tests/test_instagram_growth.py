"""No-cost ABP Instagram creative lab: input safety and offline boundaries."""
import json
from pathlib import Path

import pytest

from scripts.instagram_growth.render import PALETTES, validate_spec

ROOT = Path(__file__).resolve().parents[1] / "scripts" / "instagram_growth" / "specs"


@pytest.mark.parametrize("slug", ["ergodicity", "anthropic", "kelly"])
def test_curated_specs_are_valid_and_source_grounded(slug):
    data = json.loads((ROOT / (slug + ".json")).read_text(encoding="utf-8"))
    validate_spec(data)
    assert data["id"]
    assert data["source_url"].startswith("https://leonlins.com/writing/")
    assert len(data["scenes"]) >= 3
    assert 20 <= sum(scene["seconds"] for scene in data["scenes"]) <= 45
    assert len(data["narration"].split()) >= 30


@pytest.mark.parametrize("palette", ["ink", "paper", "signal"])
def test_all_variants_exist(palette):
    assert len(PALETTES[palette]) == 3


def base():
    return {
        "id": "safe-slug",
        "source_url": "https://leonlins.com/writing/ergodicity/",
        "narration": "Something valuable and sourced.",
        "scenes": [{"seconds": 3, "headline": "A"}, {"seconds": 3, "headline": "B"}, {"seconds": 3, "headline": "C"}],
    }


def test_refuses_external_source():
    value = base()
    value["source_url"] = "https://untrusted.example/something"
    with pytest.raises(ValueError, match="source_url"):
        validate_spec(value)


def test_refuses_unsafe_slug():
    value = base()
    value["id"] = "../../anywhere"
    with pytest.raises(ValueError, match="unsafe"):
        validate_spec(value)


def test_refuses_empty_headlines_and_too_many_scenes():
    value = base()
    value["scenes"][0]["headline"] = ""
    with pytest.raises(ValueError, match="empty"):
        validate_spec(value)
    value["scenes"][0]["headline"] = "A"
    value["scenes"] *= 4
    with pytest.raises(ValueError, match="3 to 8"):
        validate_spec(value)


def test_refuses_long_runtime():
    value = base()
    value["scenes"] = [{"seconds": 9, "headline": "A"}] * 8
    with pytest.raises(ValueError, match="60 seconds"):
        validate_spec(value)


def test_render_module_has_no_involuntary_publish_or_network_calls():
    source = (ROOT.parent / "render.py").read_text(encoding="utf-8")
    assert "requests.post(" not in source
    assert "graph.instagram.com" not in source
    assert "media_publish" not in source
    assert "qwen_tts" not in source
    assert "s3://" not in source
