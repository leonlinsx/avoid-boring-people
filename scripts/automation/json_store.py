"""Atomic, deterministic JSON documents for the committed state files.

Distribution state (`posted.json`) and Scout state (`scout-state.json`) are small
documents written by scheduled jobs that can be interrupted at any moment. Both
therefore need the same discipline: serialize deterministically, then move the
finished file into place in a single step, so a killed run can never leave a
truncated document behind. This module is that discipline, once.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
from typing import Any, Dict, Optional


def load_json_object(path: Path) -> Optional[Dict[str, Any]]:
    """Read a JSON object, or return None when the file does not exist yet."""
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as document:
        raw = json.load(document)
    if not isinstance(raw, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return raw


def save_json_object(path: Path, payload: Dict[str, Any]) -> None:
    """Atomically persist deterministic JSON so interrupted writes cannot truncate state."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as document:
            json.dump(payload, document, indent=2, sort_keys=True)
            document.write("\n")
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise
