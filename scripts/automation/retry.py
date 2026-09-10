"""Bounded retries for transient social-distribution failures.

Only transient signals are retried: HTTP 429, timeouts/connection errors, and
HTTP 500/502/503/504. Permanent client errors (400/401/403/404/422 and other
4xx) and local validation errors (ValueError) are raised immediately so a
doomed request is never repeated.
"""
from __future__ import annotations

import re
import time
from typing import Callable, TypeVar

TRANSIENT_STATUSES = frozenset({408, 429, 500, 502, 503, 504})
PERMANENT_STATUSES = frozenset({400, 401, 402, 403, 404, 405, 422})
MAX_ATTEMPTS = 3
BASE_DELAY_SECONDS = 2.0

_STATUS_RE = re.compile(r"\b([45]\d\d)\b")

T = TypeVar("T")


def status_code(error: BaseException) -> int | None:
    """Best-effort HTTP status extraction from provider and wrapper errors."""
    for attr in ("status_code", "status"):
        value = getattr(error, attr, None)
        if isinstance(value, int) and 100 <= value <= 599:
            return value
    response = getattr(error, "response", None)
    if response is not None:
        value = getattr(response, "status_code", None)
        if isinstance(value, int) and 100 <= value <= 599:
            return value
    match = _STATUS_RE.search(str(error))
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def is_transient(error: BaseException) -> bool:
    """Whether one failed attempt is worth retrying."""
    if isinstance(error, ValueError):
        return False
    code = status_code(error)
    if code is not None:
        if code in TRANSIENT_STATUSES:
            return True
        if code in PERMANENT_STATUSES or 400 <= code < 500:
            return False
        return code >= 500
    text = f"{type(error).__name__} {error}".lower()
    if "missing" in text:
        return False
    if any(token in text for token in ("timeout", "timed out", "connection", "network", "proxy", "temporarily", "rate limit", "too many requests", "service unavailable", "bad gateway", "gateway timeout")):
        return True
    return True


def run_with_retries(
    func: Callable[[], T],
    *,
    attempts: int | None = None,
    base_delay: float | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> T:
    """Call func, retrying transient failures with exponential backoff."""
    max_attempts = MAX_ATTEMPTS if attempts is None else attempts
    delay = BASE_DELAY_SECONDS if base_delay is None else base_delay
    last_error: BaseException | None = None
    for attempt in range(1, max(max_attempts, 1) + 1):
        try:
            return func()
        except Exception as error:  # noqa: BLE001 - classification decides
            last_error = error
            if not is_transient(error) or attempt >= max(max_attempts, 1):
                raise
            sleep(delay * (2 ** (attempt - 1)))
    assert last_error is not None
    raise last_error
