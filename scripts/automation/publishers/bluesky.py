"""Bluesky adapter: threads with rich-text facets and link preview cards.

Plain-text posts are not enough on Bluesky: without facets a URL is stored as
unadorned text and may not render clickable on strict clients, and without an
external embed there is no preview card to earn the click. Every post that
contains a URL therefore gets link facets (exact UTF-8 byte offsets, which is
what the protocol counts), `#tag` tokens get hashtag facets for discovery, and
the canonical article URL additionally gets an external embed card built from
the article's own Open Graph metadata.

The metadata fetch is best-effort: a page that cannot be read still posts with
facets, so a flaky fetch can never lose the thread. Link placement itself is
unchanged — the shared thread keeps the canonical URL in its final reply, and
this adapter only makes that reply (and any other URL-bearing post) rich.
"""
from __future__ import annotations

import html
import os
import re

import requests
from atproto import Client, models

BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE")       # e.g. yourname.bsky.social
BLUESKY_PASSWORD = os.getenv("BLUESKY_PASSWORD")   # app password, not account password

BLUESKY_POST_LIMIT = 300

# A URL runs to whitespace or a closing delimiter; trailing punctuation that
# the regex sweeps up (a sentence-final period, a wrapped parenthesis) is
# trimmed after the match so the facet covers only the link.
_URL_PATTERN = re.compile(r"https?://[^\s<>\")\]]+")
_URL_TRAILING_PUNCTUATION = ".,;:!?)'\"'…"
_TAG_PATTERN = re.compile(r"(?<![\w/])#([A-Za-z][A-Za-z0-9_-]*)")

# The embed lexicon carries no client-side maxima here, so these are generous
# display guardrails, not protocol limits.
CARD_TITLE_MAX = 300
CARD_DESCRIPTION_MAX = 2000
META_TIMEOUT_SECONDS = 15

_OG_TITLE = re.compile(
    r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']', re.IGNORECASE | re.DOTALL
)
_OG_TITLE_ALT = re.compile(
    r'<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']og:title["\']', re.IGNORECASE | re.DOTALL
)
_OG_DESCRIPTION = re.compile(
    r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']',
    re.IGNORECASE | re.DOTALL,
)
_OG_DESCRIPTION_ALT = re.compile(
    r'<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']og:description["\']',
    re.IGNORECASE | re.DOTALL,
)
_META_DESCRIPTION = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', re.IGNORECASE | re.DOTALL
)
_TITLE_TAG = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_TAG_STRIP = re.compile(r"<[^>]+>")


def _validate_post(text: str) -> None:
    if len(text) > BLUESKY_POST_LIMIT:
        raise ValueError(
            f"Bluesky post exceeds the {BLUESKY_POST_LIMIT}-character limit ({len(text)} characters)"
        )


def _byte_span(text: str, start: int, end: int) -> tuple[int, int]:
    """Facet offsets count UTF-8 bytes, not characters: an ellipsis or em dash
    before the link would otherwise shift every offset that follows it."""
    return len(text[:start].encode("utf-8")), len(text[:end].encode("utf-8"))


def _post_urls(text: str) -> list[tuple[str, int, int]]:
    """All URLs in a post with their character spans, trailing punctuation trimmed."""
    found = []
    for match in _URL_PATTERN.finditer(text):
        url = match.group(0).rstrip(_URL_TRAILING_PUNCTUATION)
        if url:
            found.append((url, match.start(), match.start() + len(url)))
    return found


def build_facets(text: str) -> list:
    """Link facets for every URL and hashtag facets for every `#tag` token.

    Pure computation over the final post text, so tests cover it without a
    network. Tag matches inside URL spans are skipped: the `#fragment` of a
    link is link text, not a hashtag.
    """
    facets = []
    url_spans = []
    for url, start, end in _post_urls(text):
        byte_start, byte_end = _byte_span(text, start, end)
        facets.append(
            models.AppBskyRichtextFacet.Main(
                features=[models.AppBskyRichtextFacet.Link(uri=url)],
                index=models.AppBskyRichtextFacet.ByteSlice(
                    byte_start=byte_start, byte_end=byte_end
                ),
            )
        )
        url_spans.append((start, end))
    for match in _TAG_PATTERN.finditer(text):
        if any(start <= match.start() < end for start, end in url_spans):
            continue
        byte_start, byte_end = _byte_span(text, match.start(), match.end())
        facets.append(
            models.AppBskyRichtextFacet.Main(
                features=[models.AppBskyRichtextFacet.Tag(tag=match.group(1))],
                index=models.AppBskyRichtextFacet.ByteSlice(
                    byte_start=byte_start, byte_end=byte_end
                ),
            )
        )
    return facets


def build_link_card(uri: str, title: str, description: str):
    """An external embed (preview card) for the canonical article URL.

    No thumbnail: uploading a blob would add an upload round-trip for a card
    that already converts on title, description, and domain. The card is what
    makes the final thread reply tappable at a glance.
    """
    clean_title = (title or "").strip() or uri
    return models.AppBskyEmbedExternal.Main(
        external=models.AppBskyEmbedExternal.External(
            uri=uri,
            title=clean_title[:CARD_TITLE_MAX],
            description=(description or "").strip()[:CARD_DESCRIPTION_MAX],
        )
    )


def _meta_content(patterns: list, page: str) -> str:
    for pattern in patterns:
        match = pattern.search(page)
        if match:
            text = html.unescape(_TAG_STRIP.sub("", match.group(1))).strip()
            if text:
                return text
    return ""


def fetch_link_meta(url: str, timeout: int = META_TIMEOUT_SECONDS) -> tuple[str, str]:
    """Read a page's Open Graph title/description for the preview card.

    Best-effort by design: raises on any failure and lets the caller post
    without a card rather than losing the thread over metadata.
    """
    response = requests.get(
        url,
        headers={"User-Agent": "avoid-boring-people-socialbot/1.0"},
        timeout=timeout,
    )
    if response.status_code != 200:
        raise RuntimeError(f"link preview fetch failed with HTTP {response.status_code}")
    page = response.text
    title = _meta_content([_OG_TITLE, _OG_TITLE_ALT, _TITLE_TAG], page)
    description = _meta_content([_OG_DESCRIPTION, _OG_DESCRIPTION_ALT, _META_DESCRIPTION], page)
    return title or url, description


def _rich_extras(text: str) -> tuple[list | None, object | None]:
    """Facets plus, for URL-bearing posts, a preview card for the first URL."""
    facets = build_facets(text) or None
    embed = None
    urls = _post_urls(text)
    if urls:
        uri = urls[0][0]
        try:
            title, description = fetch_link_meta(uri)
            embed = build_link_card(uri, title, description)
        except Exception as error:  # noqa: BLE001 - facets alone still post rich text
            print(f"⚠️ Bluesky link preview unavailable for {uri}: {error}")
    return facets, embed


def _get_client() -> Client:
    if not BLUESKY_HANDLE or not BLUESKY_PASSWORD:
        raise RuntimeError("❌ BLUESKY_HANDLE or BLUESKY_PASSWORD missing")
    client = Client()
    client.login(BLUESKY_HANDLE, BLUESKY_PASSWORD)
    return client


def post_single_to_bluesky(text: str):
    _validate_post(text)
    client = _get_client()
    facets, embed = _rich_extras(text)
    resp = client.send_post(text, embed=embed, facets=facets)
    print(f"✅ Bluesky post created: {resp.uri}")
    return resp


def post_thread_to_bluesky(posts: list[str]):
    for text in posts:
        _validate_post(text)
    client = _get_client()
    root = None
    reply_ref = None
    results = []

    for i, text in enumerate(posts):
        facets, embed = _rich_extras(text)
        if i == 0:
            resp = client.send_post(text, embed=embed, facets=facets)
            root = resp
            reply_ref = resp
        else:
            reply = models.AppBskyFeedPost.ReplyRef(
                root={"uri": root.uri, "cid": root.cid},
                parent={"uri": reply_ref.uri, "cid": reply_ref.cid},
            )
            resp = client.send_post(text, reply_to=reply, embed=embed, facets=facets)
            reply_ref = resp
        results.append(resp)

    print("✅ Bluesky thread posted")
    return results
