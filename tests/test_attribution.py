"""UTM tagging for distributed social links.

Links posted to social platforms must carry a platform-specific utm_source so
first-touch attribution can credit the channel, while canonical article URLs
(dev.to syndication, Farcaster embeds, Weibo localization) stay untagged.
"""
import re
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.automation import auto_post
from scripts.automation.attribution import SOCIAL_SOURCES, tagged_url
from scripts.automation.content import SocialPost
from scripts.automation.renderers import render_thread

ATTRIBUTION_MODULE = (
    Path(__file__).resolve().parents[1] / "src" / "lib" / "newsletter" / "attribution.ts"
)

ARTICLE_URL = "https://leonlins.com/writing/sample/"


@pytest.fixture(autouse=True)
def _no_retry_delay(monkeypatch):
    from scripts.automation import retry as retry_module

    monkeypatch.setattr(retry_module, "BASE_DELAY_SECONDS", 0)


def _post(**overrides):
    base = {
        "id": "post",
        "title": "A Useful Essay",
        "url": ARTICLE_URL,
        "content": "Full article body with several sentences. " * 20,
        "category": "Technology",
        "tags": ["Systems"],
        "evergreen": False,
    }
    base.update(overrides)
    return base


def _drive_main(monkeypatch, post, platforms, fakes, dry_run=False, post_mode="single"):
    monkeypatch.setattr(auto_post, "DRY_RUN", dry_run)
    monkeypatch.setattr(auto_post, "POST_MODE", post_mode)
    monkeypatch.setattr(auto_post, "THREAD_MODE", "bullets")
    monkeypatch.setattr(auto_post, "USE_LLM", False)
    monkeypatch.setattr(auto_post, "PLATFORM", list(platforms))
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [dict(post)])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts, engagement=None: posts)
    monkeypatch.setattr(
        auto_post,
        "_summarize",
        lambda selected: {"teaser": "Hook", "points": ["Point one"]},
    )
    for name, module in fakes.items():
        monkeypatch.setitem(sys.modules, name, module)


def _fake_module(**attrs):
    module = types.ModuleType("fake-publisher")
    for key, value in attrs.items():
        setattr(module, key, value)
    return module


def _fake_publishers(platform, published):
    """Return the module name and a fake publisher that records the link used.

    Thread publishers record every entry joined, because the tagged link travels
    in the final reply rather than in the root.
    """
    if platform == "twitter":
        return (
            "scripts.automation.publishers",
            _fake_module(
                get_twitter_client=lambda: SimpleNamespace(),
                post_single=lambda client, payload: published.append(payload["url"]) or {"id": "t-1"},
                post_thread=lambda client, texts: published.append("\n".join(texts)) or {"id": "t-1"},
            ),
        )
    if platform == "bluesky":
        return (
            "scripts.automation.publishers.bluesky",
            _fake_module(
                post_single_to_bluesky=lambda text, **kwargs: published.append(text) or {"id": "b-1"},
                post_thread_to_bluesky=lambda posts, **kwargs: published.append("\n".join(posts)) or {"id": "b-1"},
            ),
        )
    if platform == "nostr":
        return (
            "scripts.automation.publishers.nostr",
            _fake_module(post_to_nostr=lambda content, **kwargs: published.append(content) or {"id": "n-1"}),
        )
    return (
        "scripts.automation.publishers.mastodon",
        _fake_module(
            post_single_to_mastodon=lambda text, **kwargs: published.append(text) or {"id": "m-1"},
            post_thread_to_mastodon=lambda posts, **kwargs: published.append("\n".join(posts)) or {"id": "m-1"},
        ),
    )


# --- tagged_url --------------------------------------------------------------

def test_tagged_url_adds_platform_source_medium_and_campaign():
    tagged = tagged_url(ARTICLE_URL, "twitter", "post")
    assert tagged == f"{ARTICLE_URL}?utm_source=x&utm_medium=social&utm_campaign=post"


def test_tagged_url_maps_every_configured_platform():
    for platform, source in SOCIAL_SOURCES.items():
        assert f"utm_source={source}" in tagged_url(ARTICLE_URL, platform, "post")


def test_tagged_url_preserves_existing_query_and_fragment():
    tagged = tagged_url(f"{ARTICLE_URL}?ref=newsletter#section", "reddit", "post")
    assert "ref=newsletter" in tagged
    assert "utm_source=reddit" in tagged
    assert tagged.endswith("#section")


def test_tagged_url_is_idempotent_and_skips_unusable_input():
    already = f"{ARTICLE_URL}?utm_source=bluesky"
    assert tagged_url(already, "bluesky", "post") == already
    assert tagged_url(already, "twitter", "post") == already
    assert tagged_url(ARTICLE_URL, "devto", "post") == ARTICLE_URL
    assert tagged_url("", "twitter", "post") == ""
    assert tagged_url("/writing/sample/", "twitter", "post") == "/writing/sample/"


def test_tagged_url_omits_campaign_when_absent():
    assert "utm_campaign" not in tagged_url(ARTICLE_URL, "threads", None)


def test_every_tagged_source_is_a_named_attribution_source():
    """A tagged link must report as its own channel, never as a generic referral."""
    text = ATTRIBUTION_MODULE.read_text()
    vocabulary = re.search(r"export const acquisitionSources = \[(.*?)\]", text, re.S)
    assert vocabulary, "the TypeScript source vocabulary moved or was renamed"
    names = set(re.findall(r"'([\w.]+)'", vocabulary.group(1)))
    mapping = text[text.index("const utmSourceMap"):text.index("const referrerSourceMap")]
    mapped = dict(re.findall(r"^\s*'?([\w.]+)'?:\s*'([\w.]+)',", mapping, re.M))

    for platform, source in SOCIAL_SOURCES.items():
        assert source in names, f"{platform} tags utm_source={source}, which is not a source name"
        assert mapped.get(source) == source, f"{platform} tags utm_source={source}, which is unmapped"


# --- publishing --------------------------------------------------------------

def test_each_platform_publishes_its_own_tagged_link(monkeypatch, use_temp_distribution_state):
    for platform in ("twitter", "bluesky", "mastodon"):
        published = []
        module_name, fake = _fake_publishers(platform, published)
        _drive_main(monkeypatch, _post(), [platform], {module_name: fake})

        auto_post.main()

        assert len(published) == 1, platform
        assert tagged_url(ARTICLE_URL, platform, "post") in str(published[0]), platform


def test_thread_mode_publishes_the_tagged_link(monkeypatch, capsys, use_temp_distribution_state):
    """Thread mode is what production runs, so its link reply must be tagged too."""
    for platform in ("twitter", "bluesky", "mastodon", "nostr"):
        published = []
        module_name, fake = _fake_publishers(platform, published)
        _drive_main(monkeypatch, _post(), [platform], {module_name: fake}, post_mode="thread")

        auto_post.main()

        link = tagged_url(ARTICLE_URL, platform, "post")
        assert len(published) == 1, platform
        assert link in published[0], platform
        assert f"✅ {platform} posting completed ({link})" in capsys.readouterr().out, platform


def test_pre_tagged_link_is_reported_not_silently_retagged(monkeypatch, capsys, use_temp_distribution_state):
    pre_tagged = f"{ARTICLE_URL}?utm_source=manual-campaign"
    published = []
    module_name, fake = _fake_publishers("bluesky", published)
    _drive_main(monkeypatch, _post(url=pre_tagged), ["bluesky"], {module_name: fake})

    auto_post.main()

    output = capsys.readouterr().out
    assert pre_tagged in published[0]
    assert "already carries utm_source" in output


def test_canonical_url_stays_untagged_for_syndication(monkeypatch, use_temp_distribution_state):
    received = []
    devto = _fake_module(
        post_to_devto=lambda title, body, tags, canonical_url: received.append(canonical_url)
        or {"id": "d-1"}
    )
    _drive_main(monkeypatch, _post(), ["devto"], {"scripts.automation.publishers.devto": devto})

    auto_post.main()

    assert received == [ARTICLE_URL]


def test_dry_run_shows_the_tagged_link(monkeypatch, capsys, use_temp_distribution_state):
    _drive_main(monkeypatch, _post(), ["twitter", "mastodon"], {}, dry_run=True)

    auto_post.main()

    output = capsys.readouterr().out
    for platform in ("twitter", "mastodon"):
        assert tagged_url(ARTICLE_URL, platform, "post") in output


def test_published_text_is_the_rendered_tagged_copy(monkeypatch, use_temp_distribution_state):
    published = []
    _drive_main(
        monkeypatch,
        _post(),
        ["bluesky"],
        {"scripts.automation.publishers.bluesky": _fake_publishers("bluesky", published)[1]},
    )

    auto_post.main()

    social = SocialPost(
        _post()["title"],
        _post()["title"],
        tagged_url(ARTICLE_URL, "bluesky", "post"),
        (),
        tuple(auto_post.sanitize_tags(_post()["tags"])),
    )
    assert published == [render_thread(social)[0]]
