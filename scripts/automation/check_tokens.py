"""Check that the social credentials which silently expire are still valid.

Threads and Instagram issue long-lived tokens (about 60 days). Nothing warns
before one lapses: the first symptom is a failed production post, which for the
push-triggered run can land while nobody is watching. This probe asks both APIs
which account the stored token belongs to, daily, so a lapse surfaces as a
scheduled failure with rotation instructions instead of as a missing post.

The probe is read-only and never refreshes a token: a refresh returns a new
token that would have to be persisted, and the repository secrets are the only
place these values live. A platform whose credentials are not configured at all
is reported as skipped rather than failed, so this stays correct before an
account exists.

Only the Meta tokens are probed. Bluesky app passwords, Mastodon tokens, Twitter
OAuth 1.0a tokens and the Nostr key do not expire on a schedule, so a failure
there is already reported by the publish run that tries to use them.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Callable, Dict, List, NamedTuple, Optional, Sequence

from scripts.automation.publishers import instagram, threads


class Probe(NamedTuple):
    platform: str
    user_id_env: str
    token_env: str
    verify: Callable[[str, str], dict]
    rotation: str


PROBES: tuple[Probe, ...] = (
    Probe(
        platform="Threads",
        user_id_env="THREADS_USER_ID",
        token_env="THREADS_ACCESS_TOKEN",
        verify=threads.verify_credentials,
        rotation=(
            "Mint a new long-lived Threads token (Meta app dashboard → Threads API → "
            "long-lived tokens) and replace the THREADS_ACCESS_TOKEN repository secret."
        ),
    ),
    Probe(
        platform="Instagram",
        user_id_env="INSTAGRAM_USER_ID",
        token_env="INSTAGRAM_ACCESS_TOKEN",
        verify=instagram.verify_credentials,
        rotation=(
            "Refresh the Instagram long-lived token for the professional account and replace "
            "the INSTAGRAM_ACCESS_TOKEN repository secret. The remaining lifetime cannot be "
            "read here because that needs an app access token, which is deliberately not "
            "stored in this repository."
        ),
    ),
)

STATUS_LABELS = {"ok": "✅", "failed": "❌", "skipped": "⏭️"}


class ProbeResult(NamedTuple):
    platform: str
    status: str
    detail: str
    rotation: str


def log_summary(message: str) -> None:
    path = os.getenv("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as file:
            file.write(message + "\n")
    print(message)


def run_probe(probe: Probe, environ: Optional[Dict[str, str]] = None) -> ProbeResult:
    """Probe one platform without ever echoing the credential."""
    env = os.environ if environ is None else environ
    values = {
        probe.user_id_env: (env.get(probe.user_id_env) or "").strip(),
        probe.token_env: (env.get(probe.token_env) or "").strip(),
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        return ProbeResult(
            probe.platform,
            "skipped",
            f"not configured ({', '.join(missing)})",
            probe.rotation,
        )

    try:
        probe.verify(values[probe.user_id_env], values[probe.token_env])
    except Exception as error:  # any error means this token cannot publish
        return ProbeResult(probe.platform, "failed", str(error), probe.rotation)

    return ProbeResult(probe.platform, "ok", "authenticated", probe.rotation)


def check_tokens(
    probes: Optional[Sequence[Probe]] = None, environ: Optional[Dict[str, str]] = None
) -> List[ProbeResult]:
    # Resolved at call time so the probe list stays overridable.
    selected = PROBES if probes is None else probes
    return [run_probe(probe, environ) for probe in selected]


def report(results: Sequence[ProbeResult]) -> int:
    """Print the report and return the process exit code."""
    log_summary("### Token health")
    log_summary("")

    failures = [result for result in results if result.status == "failed"]
    for result in results:
        label = STATUS_LABELS.get(result.status, result.status)
        log_summary(f"{label} **{result.platform}**: {result.detail}")
        if result.status == "failed":
            log_summary("")
            log_summary(f"   → {result.rotation}")

    if failures:
        names = ", ".join(result.platform for result in failures)
        log_summary("")
        log_summary(f"::error::{names} credential check failed; rotate before the next publish run.")
        return 1

    skipped = [result.platform for result in results if result.status == "skipped"]
    if skipped:
        log_summary("")
        log_summary(f"Not configured (skipped): {', '.join(skipped)}")
    return 0


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the long-lived social tokens that expire silently."
    )
    parser.parse_args(argv)
    return report(check_tokens())


if __name__ == "__main__":
    sys.exit(main())
