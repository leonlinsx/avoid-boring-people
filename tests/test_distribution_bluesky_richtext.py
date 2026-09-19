"""Bluesky rich-text coverage: link/hashtag facets and preview-card embeds.

Plain-text posts are the failure this file guards against: without facets a
URL is unadorned text that strict clients may not link, and without an
external embed there is no preview card to earn the click. Facet math is pure
computation (no network); publishing is exercised through a fake client with a
stubbed metadata fetch, so no test touches the network or real credentials.
"""
import sys
import types

import pytest

# conftest.py stubs `atproto` when the SDK is missing from the venv; this module
# needs the real SDK for facet/embed models, and the stub (already installed by
# conftest) would shadow it. Since that stub is installed only once, put it back
# when the SDK is unavailable: the later-collected modules that import the
# Bluesky adapter need it.
_atproto_stub = sys.modules.pop("atproto", None)
try:
    atproto = pytest.importorskip("atproto")
except BaseException:  # pytest's Skipped is not an Exception subclass
    if _atproto_stub is not None:
        sys.modules["atproto"] = _atproto_stub
    raise

from scripts.automation.publishers import bluesky as bluesky_module  # noqa: E402

URL = "https://leonlins.com/writing/sample/"


def _facet_texts(text, facets):
    """Decode every facet span back to the substring it covers."""
    raw = text.encode("utf-8")
    return [raw[facet.index.byte_start:facet.index.byte_end].decode("utf-8") for facet in facets]


class _FakeResponse:
    def __init__(self, n):
        self.uri = f"at://did:example/post/{n}"
        self.cid = f"cid-{n}"


class _FakeClient:
    def __init__(self):
        self.calls = []

    def login(self, handle, password):
        pass

    def send_post(self, text, reply_to=None, embed=None, facets=None, langs=None):
        self.calls.append(
            {"text": text, "reply_to": reply_to, "embed": embed, "facets": facets}
        )
        return _FakeResponse(len(self.calls))


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(bluesky_module, "BLUESKY_HANDLE", "handle")
    monkeypatch.setattr(bluesky_module, "BLUESKY_PASSWORD", "password")
    fake = _FakeClient()
    monkeypatch.setattr(bluesky_module, "Client", lambda: fake)
    # Card metadata never hits the network in tests.
    monkeypatch.setattr(bluesky_module, "fetch_link_meta", lambda url, timeout=15: ("Sample Title", "Sample description"))
    return fake


def test_link_facet_covers_exactly_the_url():
    text = f"Full piece: {URL}"
    facets = bluesky_module.build_facets(text)
    assert len(facets) == 1
    assert _facet_texts(text, facets) == [URL]
    assert facets[0].features[0].uri == URL


def test_facet_offsets_count_utf8_bytes_not_characters():
    # The ellipsis and em dash before the link are multibyte in UTF-8; byte
    # offsets computed in characters would slice mid-link.
    text = f"… Hook — read more: {URL}"
    facets = bluesky_module.build_facets(text)
    assert _facet_texts(text, facets) == [URL]


def test_hashtag_facet_covers_the_tag_without_the_hash_in_its_reference():
    text = "A sharp hook #investing"
    facets = bluesky_module.build_facets(text)
    assert len(facets) == 1
    assert _facet_texts(text, facets) == ["#investing"]
    assert facets[0].features[0].tag == "investing"


def test_url_fragments_are_not_hashtagged():
    text = f"See {URL}#section-2 for details"
    facets = bluesky_module.build_facets(text)
    assert len(facets) == 1
    assert facets[0].features[0].uri == f"{URL}#section-2"


def test_link_card_carries_uri_title_and_description():
    card = bluesky_module.build_link_card(URL, "Sample Title", "Sample description")
    assert card.external.uri == URL
    assert card.external.title == "Sample Title"
    assert card.external.description == "Sample description"


def test_thread_attaches_the_preview_card_to_the_link_reply(client):
    posts = ["A sharp hook #investing", "A supporting point.", f"Full piece: {URL}"]
    bluesky_module.post_thread_to_bluesky(posts)

    assert len(client.calls) == 3
    root, _, reply = client.calls
    # The root keeps its hashtag facet but gets no card: the link lives last.
    assert root["embed"] is None
    assert _facet_texts(posts[0], root["facets"]) == ["#investing"]
    # The link reply gets both facets and the preview card.
    assert _facet_texts(posts[2], reply["facets"]) == [URL]
    assert reply["embed"].external.uri == URL
    assert reply["embed"].external.title == "Sample Title"
    # Replies stay chained root-first like the old shape.
    assert client.calls[1]["reply_to"] is not None


def test_failed_preview_fetch_still_posts_with_facets(monkeypatch, client, capsys):
    def _boom(url, timeout=15):
        raise RuntimeError("og fetch down")

    monkeypatch.setattr(bluesky_module, "fetch_link_meta", _boom)
    bluesky_module.post_single_to_bluesky(f"Hook text {URL}")

    assert len(client.calls) == 1
    assert client.calls[0]["embed"] is None
    assert _facet_texts(f"Hook text {URL}", client.calls[0]["facets"]) == [URL]
    assert "link preview unavailable" in capsys.readouterr().out


def test_overlong_posts_are_rejected_before_any_client_use(monkeypatch):
    monkeypatch.setattr(bluesky_module, "BLUESKY_HANDLE", "handle")
    monkeypatch.setattr(bluesky_module, "BLUESKY_PASSWORD", "password")
    created = []
    monkeypatch.setattr(bluesky_module, "Client", lambda: created.append(True) or _FakeClient())
    with pytest.raises(ValueError, match="300"):
        bluesky_module.post_single_to_bluesky("x" * 301)
    assert created == []
