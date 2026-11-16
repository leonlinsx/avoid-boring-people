"""Refresh Meta user tokens and persist only verified replacements.

One scoped GitHub App with repository Secrets:write supplies GH_TOKEN. The
regular GITHUB_TOKEN cannot update Actions secrets. No token is logged, stored
in artifacts, passed in command-line arguments, or committed to the repository.
Nothing refreshes unless --refresh is explicitly selected.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import os
import subprocess
import sys

import requests

REPOSITORY = "leonlinsx/avoid-boring-people"
TIMEOUT = 20
MIN_REFRESHED_LIFETIME = 30 * 24 * 60 * 60
MIN_SECRET_AGE = timedelta(hours=36)


class RefreshError(RuntimeError):
    """Operator-safe diagnostics: never embed a token or response body."""


@dataclass(frozen=True)
class Platform:
    name: str
    secret: str
    refresh_host: str
    grant_type: str
    profile_url: str


PLATFORMS = {
    "threads": Platform(
        "Threads", "THREADS_ACCESS_TOKEN",
        "https://graph.threads.net/refresh_access_token",
        "th_refresh_token", "https://graph.threads.net/v1.0/me",
    ),
    "instagram": Platform(
        "Instagram", "INSTAGRAM_ACCESS_TOKEN",
        "https://graph.instagram.com/refresh_access_token",
        "ig_refresh_token", "https://graph.instagram.com/v26.0/me",
    ),
}


def _get_json(url: str, *, token: str, params: dict[str, str]) -> dict:
    # The refresh endpoints require access_token as a GET query parameter.
    # Never raise_for_status: requests.HTTPError includes the full token URL.
    try:
        response = requests.get(
            url, params=params, headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        raise RefreshError(f"Meta request failed ({type(exc).__name__}); no token changed") from None
    if response.status_code != 200:
        code = "unknown"
        try:
            error = response.json().get("error", {})
            if isinstance(error, dict):
                # Only surface Meta's numeric code; response fields are untrusted
                # and might otherwise echo a credential into Actions logs.
                raw_code = error.get("code")
                if type(raw_code) is int and 0 <= raw_code <= 999999:
                    code = str(raw_code)
        except (ValueError, AttributeError, TypeError):
            pass
        raise RefreshError(f"Meta rejected request (HTTP {response.status_code}, code {code}); no token changed")
    try:
        body = response.json()
    except ValueError:
        raise RefreshError("Meta returned non-JSON data; no token changed") from None
    if not isinstance(body, dict):
        raise RefreshError("Meta returned invalid response shape; no token changed")
    return body


def _profile(config: Platform, token: str) -> str:
    # The accounts are deliberately distinct:
    # Threads @leon.lin.s and Instagram @avoidboringpeople.
    # Instagram Login's /me.id is APP-SCOPED, whereas /me.user_id is the
    # professional account ID stored in INSTAGRAM_USER_ID and used for posting.
    instagram = config.name == "Instagram"
    fields = "id,user_id,username" if instagram else "id,username"
    body = _get_json(config.profile_url, token=token, params={"fields": fields})

    expected_handle = "avoidboringpeople" if instagram else "leon.lin.s"
    username = body.get("username")
    if not isinstance(username, str) or username.casefold() != expected_handle:
        raise RefreshError(f"{config.name} token is not for the expected @{expected_handle} account")

    identity = body.get("user_id" if instagram else "id")
    if not isinstance(identity, str) or not identity.strip():
        raise RefreshError(f"{config.name} profile did not contain the required account ID")
    if instagram:
        expected_id = (os.getenv("INSTAGRAM_USER_ID") or "").strip()
        if not expected_id or identity != expected_id:
            raise RefreshError("Instagram professional user_id differs from INSTAGRAM_USER_ID")
    return identity


def _github(args: list[str], *, stdin: str | None = None) -> str:
    # Capture errors rather than printing stderr, which could contain a token.
    try:
        result = subprocess.run(
            ["gh", *args], input=stdin, capture_output=True, text=True,
            timeout=30, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RefreshError(f"GitHub CLI failed ({type(exc).__name__}); check App permissions") from None
    if result.returncode != 0:
        raise RefreshError(f"GitHub CLI failed (exit {result.returncode}); check App Secrets:write permission")
    return result.stdout.strip()


def _recently_updated(secret: str, now: datetime) -> bool:
    timestamp = _github([
        "api", f"repos/{REPOSITORY}/actions/secrets/{secret}",
        "--jq", ".updated_at",
    ])
    try:
        updated = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        raise RefreshError("Could not read GitHub secret update time") from None
    age = now - updated
    if age < timedelta(0):
        raise RefreshError("GitHub secret update time is in the future")
    return age < MIN_SECRET_AGE


def _persist(secret: str, value: str) -> None:
    # gh secret set encrypts locally; stdin avoids command-line exposure.
    _github(["secret", "set", secret, "--repo", REPOSITORY], stdin=value)


def _refresh_one(config: Platform, *, now: datetime, check_only: bool) -> str:
    token = (os.getenv(config.secret) or "").strip()
    if not token:
        raise RefreshError(f"{config.secret} is missing")
    old_account = _profile(config, token)
    if check_only:
        return "authenticated (preview only; no refresh)"
    if _recently_updated(config.secret, now):
        return "authenticated; updated less than 36h ago, refresh deferred"
    response = _get_json(
        config.refresh_host, token=token,
        params={"grant_type": config.grant_type, "access_token": token},
    )
    replacement = response.get("access_token")
    expires = response.get("expires_in")
    if (not isinstance(replacement, str) or len(replacement) < 10
            or any(ch in replacement for ch in "\r\n\x00")):
        raise RefreshError("Meta supplied an invalid replacement token; previous secret retained")
    if not isinstance(expires, (int, float)) or expires < MIN_REFRESHED_LIFETIME:
        raise RefreshError("Meta did not confirm at least 30 days of token life; previous secret retained")
    # Mask before verification, future output, or writing the secret.
    if os.getenv("GITHUB_ACTIONS") == "true":
        print(f"::add-mask::{replacement}", flush=True)
    new_account = _profile(config, replacement)
    if new_account != old_account:
        raise RefreshError("Refreshed token belongs to a different account; previous secret retained")
    _persist(config.secret, replacement)
    return f"refreshed and saved (Meta reports ~{int(expires // 86400)} days)"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check or securely refresh Meta user tokens")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check-only", action="store_true")
    mode.add_argument("--refresh", action="store_true")
    parser.add_argument("--platform", choices=("both", "threads", "instagram"), default="both")
    args = parser.parse_args(argv)
    if args.refresh and (
        os.getenv("GITHUB_REPOSITORY") != REPOSITORY or not os.getenv("GH_TOKEN")
    ):
        print("ERROR: scoped GitHub App token and exact repository are required", file=sys.stderr)
        return 1
    selected = PLATFORMS.values() if args.platform == "both" else [PLATFORMS[args.platform]]
    failures = []
    for config in selected:
        try:
            status = _refresh_one(config, now=datetime.now(timezone.utc), check_only=args.check_only)
            print(f"OK {config.name}: {status}")
        except RefreshError as exc:
            failures.append(config.name)
            print(f"ERROR {config.name}: {exc}", file=sys.stderr)
    if failures:
        print("::error::Meta token maintenance requires attention: " + ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
