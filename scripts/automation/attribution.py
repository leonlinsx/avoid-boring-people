"""Canonical UTM tagging for links the distribution pipeline publishes.

Social links carry tags so the site's first-touch attribution can tell which
channel produced a signup. Canonical article URLs stay untagged on purpose:
dev.to cross-posts, Farcaster embeds, and the localized Weibo post all point at
the canonical essay rather than at a campaign, so tagging them would blur the
canonical reference without adding attribution.
"""
from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

UTM_MEDIUM = "social"

# Pipeline platform name -> utm_source.
SOCIAL_SOURCES: dict[str, str] = {
    "twitter": "x",
    "bluesky": "bluesky",
    "mastodon": "mastodon",
    "linkedin": "linkedin",
    "farcaster": "farcaster",
    "nostr": "nostr",
    "threads": "threads",
    "reddit": "reddit",
}


def tagged_url(url: str, platform: str, campaign: str | None) -> str:
    """Return ``url`` tagged for ``platform``.

    URLs that already carry a ``utm_source`` are returned unchanged, as are
    unknown platforms and unusable URLs, so tagging is idempotent and safe to
    apply to content built earlier in the pipeline.
    """
    source = SOCIAL_SOURCES.get(platform)
    if not source or not url:
        return url
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        return url
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if query.get("utm_source"):
        return url
    query["utm_source"] = source
    query["utm_medium"] = UTM_MEDIUM
    if campaign:
        query["utm_campaign"] = campaign
    return urlunsplit(parts._replace(query=urlencode(query)))
