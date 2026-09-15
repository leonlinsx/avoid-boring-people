"""Neynar-backed Farcaster adapter; the orchestration layer remains vendor-neutral.

Casts carry the canonical article URL twice: inline in the text (always
clickable) and as a link embed (which renders the rich preview card that
drives click-through). Neynar fetches embed targets server-side, so an embed
is a URL reference, never an upload.
"""
from __future__ import annotations

import os
import requests

from scripts.automation.content import PublishResult

FARCASTER_CAST_LIMIT = 320
# Farcaster allows at most two embeds per cast; one article needs one.
FARCASTER_MAX_EMBEDS = 2


def validate_cast(text: str) -> None:
    if not text.strip():
        raise ValueError("Farcaster cast text must not be empty")
    if len(text) > FARCASTER_CAST_LIMIT:
        raise ValueError(
            f"Farcaster cast exceeds its {FARCASTER_CAST_LIMIT}-character limit "
            f"({len(text)} characters)"
        )


def post_to_farcaster(
    text: str,
    idempotency_key: str | None = None,
    embeds: list[dict] | None = None,
) -> PublishResult:
    """Publish one cast, attaching link embeds so the article renders a preview card.

    `embeds` is a list of `{"url": ...}` references (at most two per cast);
    pass the canonical article URL so readers see a rich preview, not a bare link.
    """
    validate_cast(text)
    if embeds is not None:
        if len(embeds) > FARCASTER_MAX_EMBEDS:
            raise ValueError(
                f"Farcaster accepts at most {FARCASTER_MAX_EMBEDS} embeds ({len(embeds)} given)"
            )
        for embed in embeds:
            if not isinstance(embed, dict) or not (embed.get("url") or "").strip():
                raise ValueError("Farcaster embeds must be {\"url\": ...} references")
    api_key = os.getenv("NEYNAR_API_KEY")
    signer_uuid = os.getenv("NEYNAR_SIGNER_UUID")
    if not api_key or not signer_uuid:
        raise RuntimeError("NEYNAR_API_KEY or NEYNAR_SIGNER_UUID missing")
    response = requests.post(
        "https://api.neynar.com/v2/farcaster/cast",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json={
            "signer_uuid": signer_uuid,
            "text": text,
            **({"idem": idempotency_key} if idempotency_key else {}),
            **({"embeds": embeds} if embeds else {}),
        },
        timeout=20,
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Farcaster API error: {response.status_code} {response.text}")
    cast = response.json().get("cast", {})
    remote_id = cast.get("hash")
    if not remote_id:
        raise RuntimeError("Farcaster accepted the request without returning a cast hash")
    return PublishResult("farcaster", remote_id=str(remote_id))
