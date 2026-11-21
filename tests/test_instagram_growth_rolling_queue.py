"""Rolling Reel queue stays dry unless explicitly opted in, never duplicates."""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

from scripts.instagram_growth import rolling_queue as q


NOW = datetime(2026, 11, 21, 15, 0, tzinfo=timezone.utc)


def manifest(concept, *, release_after="2026-11-21T12:00:00Z"):
    return {
        "account": "avoidboringpeople",
        "concept_id": concept,
        "source_url": "https://leonlins.com/writing/ergodicity/",
        "video_url": f"https://leonlins.com/social/abp/{concept}.mp4",
        "video_path": f"/tmp/{concept}.mp4",
        "video_sha256": "a" * 64,
        "caption": "A useful idea, explained. Follow Avoid Boring People.",
        "review_status": "approved",
        "approved_by": "editor",
        "format": "REELS",
        "ai_generated": True,
        "trial": True,
        "graduation_strategy": "MANUAL",
        "release_after": release_after,
    }


def put(queue_dir, concept, **extra):
    queue_dir.mkdir(parents=True, exist_ok=True)
    d = manifest(concept, **extra)
    (queue_dir / f"{concept}.json").write_text(json.dumps(d))


def receipt(state_dir, concept, *, created_at="2026-11-21T10:00:00Z", status="published"):
    state_dir.mkdir(parents=True, exist_ok=True)
    d = {"concept_id": concept, "created_at": created_at, "status": status,
         "media_id": "123456789012", "published_at": created_at}
    (state_dir / f"{concept}.json").write_text(json.dumps(d))


def test_queue_earliest_due_first(tmp_path):
    queue, state = tmp_path / "queue", tmp_path / "receipts"
    put(queue, "late-item", release_after="2026-11-21T14:00:00Z")
    put(queue, "early-item", release_after="2026-11-21T11:00:00Z")
    entry, status = q.choose(queue, state, NOW)
    assert status == "READY"
    assert entry["concept_id"] == "early-item"


def test_queue_respects_future_release(tmp_path):
    queue, state = tmp_path / "queue", tmp_path / "receipts"
    put(queue, "tomorrow", release_after="2026-11-22T15:00:00Z")
    entry, status = q.choose(queue, state, NOW)
    assert entry is None and status == "NO_DUE_APPROVED_ITEMS"


def test_queue_does_not_resend_published_concepts(tmp_path):
    queue, state = tmp_path / "queue", tmp_path / "receipts"
    put(queue, "already-done")
    put(queue, "new-item")
    receipt(state, "already-done", created_at="2026-11-19T14:00:00Z")
    entry, status = q.choose(queue, state, NOW)
    assert status == "READY"
    assert entry["concept_id"] == "new-item"


def test_ambiguous_receipt_halts_everything(tmp_path):
    queue, state = tmp_path / "queue", tmp_path / "receipts"
    put(queue, "not-yet")
    receipt(state, "uncertain", status="reconciliation_required")
    entry, status = q.choose(queue, state, NOW)
    assert entry is None and "HALT" in status


def test_throttling_and_spacing(tmp_path):
    queue, state = tmp_path / "queue", tmp_path / "receipts"
    put(queue, "waiting")
    receipt(state, "recent", created_at="2026-11-21T13:00:00Z")
    entry, status = q.choose(queue, state, NOW)
    assert entry is None and "spacing" in status
    receipt(state, "second", created_at="2026-11-21T09:00:00Z")
    entry, status = q.choose(queue, state, NOW)
    assert entry is None and "24h" in status


def test_sampler_records_missing_as_missing_and_does_not_refetch(monkeypatch, tmp_path):
    receipt(tmp_path, "test-one", created_at="2026-11-20T12:00:00Z")
    calls = []
    def fetch(_):
        calls.append(1)
        return {"media_id": "123456789012", "metrics": {"reach": 120, "follows": None}}
    monkeypatch.setattr(q.pilot, "fetch_insights", fetch)
    found = q.measure_due(tmp_path, NOW)
    assert len(found) == 1
    assert found[0]["window"] == "24h"
    body = json.loads((tmp_path / "observations" / "test-one-24h.json").read_text())
    assert body["metrics"]["follows"] is None
    assert len(q.measure_due(tmp_path, NOW)) == 0
    assert len(calls) == 1


def test_timestamp_needs_offset():
    with pytest.raises(ValueError, match="UTC offset"):
        q.instant("2026-11-21T09:00:00")
