"""Neynar-backed Farcaster adapter; the orchestration layer remains vendor-neutral."""
from __future__ import annotations

import os
import requests

from scripts.automation.content import PublishResult


def post_to_farcaster(text: str, idempotency_key: str | None = None) -> PublishResult:
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
