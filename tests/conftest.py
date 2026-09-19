"""Shared scaffolding for the Python automation suite.

Imported by pytest before any test module is collected, which is what makes the
import-time stubs below work: every distribution test module that pulls in the
publisher package needs them, and previously each one installed its own copy.
The fixtures name the module whose `STATE_FILE` they patch, because the
distribution suite and the scout suite each have their own state module.
"""
import sys
import types

import pytest

# tweepy/atproto are installed in CI but not in every local venv; stub them so
# the publisher submodules import. A module that needs the real SDK
# (test_distribution_bluesky_richtext) drops the stub before importing and puts
# it back when the real one is unavailable.
_tweepy_stub = types.ModuleType("tweepy")
sys.modules.setdefault("tweepy", _tweepy_stub)
_atproto_stub = types.ModuleType("atproto")
_atproto_stub.Client = type("AtprotoClient", (), {})
_atproto_stub.models = types.SimpleNamespace()
sys.modules.setdefault("atproto", _atproto_stub)

from scripts.automation import state_manager  # noqa: E402
from scripts.scout import state as scout_state  # noqa: E402


@pytest.fixture
def use_temp_distribution_state(monkeypatch, tmp_path):
    """Point scripts/automation/state_manager.py at a per-test state file."""
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    return path


@pytest.fixture
def use_temp_scout_state(monkeypatch, tmp_path):
    """Point scripts/scout/state.py at a per-test state file."""
    path = tmp_path / "scout-state.json"
    monkeypatch.setattr(scout_state, "STATE_FILE", path)
    return path
