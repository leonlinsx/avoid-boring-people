"""Create or inspect the Neynar-managed signer used by the Farcaster publisher.

Run locally only. This command never publishes a cast and does not persist an
API key or signer UUID. Approval must be completed in the Farcaster wallet app.
"""
from __future__ import annotations

import argparse
import os

import requests

BASE_URL = "https://api.neynar.com/v2/farcaster/signer"


def _headers() -> dict[str, str]:
    api_key = os.getenv("NEYNAR_API_KEY")
    if not api_key:
        raise RuntimeError("NEYNAR_API_KEY is required in the local environment")
    return {"x-api-key": api_key}


def _request(method: str, **kwargs) -> dict:
    response = requests.request(method, BASE_URL, headers=_headers(), timeout=20, **kwargs)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Neynar signer API error: {response.status_code} {response.text}")
    return response.json()


def create_signer() -> dict:
    return _request("POST")


def signer_status(signer_uuid: str) -> dict:
    return _request("GET", params={"signer_uuid": signer_uuid})


def print_signer(signer: dict) -> None:
    print(f"Status: {signer.get('status', 'unknown')}")
    print(f"Signer UUID: {signer.get('signer_uuid', '')}")
    if signer.get("signer_approval_url"):
        print(f"Approval URL: {signer['signer_approval_url']}")
    if signer.get("fid") is not None:
        print(f"Farcaster ID: {signer['fid']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up a Neynar-managed Farcaster signer")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--create", action="store_true", help="create a signer requiring mobile approval")
    action.add_argument("--status", metavar="SIGNER_UUID", help="inspect an existing signer")
    args = parser.parse_args()
    print_signer(create_signer() if args.create else signer_status(args.status))


if __name__ == "__main__":
    main()
