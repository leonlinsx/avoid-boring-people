"""Publisher adapters, imported lazily.

Every adapter pulls in third-party SDKs and credentials, and most adapters
are dormant (out of ``DEFAULT_PLATFORMS`` until their setup is verified).
Importing them eagerly at package import time would let a bit-rotted dormant
adapter break unrelated runs: ``check_tokens`` imports this package for the
Meta probes, and ``auto_post`` resolves it on the Twitter path, so a broken
``twitter`` import used to fail token health checks that never touch X.

Attribute access defers to the adapter module, so only the platform actually
being published (or probed) pays its import cost. ``auto_post`` already
imports each adapter inside its own branch; this keeps the package itself
from reintroducing the coupling at module scope.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
    "bluesky",
    "devto",
    "farcaster",
    "instagram",
    "linkedin",
    "mastodon",
    "nostr",
    "reddit",
    "threads",
    "twitter",
    "weibo",
]


# Historical re-exports from the Twitter adapter, kept so the only consumer
# (`auto_post`'s Twitter branch) and the test doubles that stub this package
# keep working. They resolve through the same lazy path as the submodules.
_LAZY_ATTRS = {
    "get_twitter_client": ("twitter", "get_twitter_client"),
    "post_single": ("twitter", "post_single"),
    "post_thread": ("twitter", "post_thread"),
}


def __getattr__(name: str) -> Any:
    if name in __all__:
        return import_module(f"{__name__}.{name}")
    if name in _LAZY_ATTRS:
        module_name, attr = _LAZY_ATTRS[name]
        return getattr(import_module(f"{__name__}.{module_name}"), attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(list(globals().keys()) + __all__)
