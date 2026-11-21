"""Offline tests for the separate, explicitly gated ABP Reel path."""
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.instagram_growth import reel_pilot as pilot


def item():
    return {
        "account": "avoidboringpeople",
        "concept_id": "ergodicity-v01",
        "source_url": "https://leonlins.com/writing/ergodicity/",
        "video_url": "https://leonlins.com/social/abp/ergodicity-v01.mp4",
        "video_path": "/tmp/ergodicity-v01.mp4",
        "video_sha256": "a" * 64,
        "caption": "One question about risk. Follow for more.",
        "review_status": "approved",
        "approved_by": "editor",
        "format": "REELS",
        "ai_generated": True,
        "trial": True,
        "graduation_strategy": "MANUAL",
    }


def get_item(tmp_path, **patch):
    obj = {**item(), **patch}
    path = tmp_path / "reel.json"
    path.write_text(json.dumps(obj))
    return path


def test_manifest_valid(tmp_path):
    assert pilot.load_manifest(get_item(tmp_path)) == item()


@pytest.mark.parametrize("patch, fragment", [
    ({"account": "leon.lin.s"}, "avoidboringpeople"),
    ({"concept_id": "../escape"}, "concept_id"),
    ({"video_url": "http://leonlins.com/clip.mp4"}, "video_url"),
    ({"video_url": "https://127.0.0.1/clip.mp4"}, "video_url"),
    ({"video_url": "https://cdn.bad-example.com/clip.mp4"}, "video_url"),
    ({"source_url": "https://other.example/essay"}, "source_url"),
    ({"review_status": "draft"}, "approved"),
    ({"approved_by": ""}, "approved_by"),
    ({"ai_generated": None}, "ai_generated"),
    ({"trial": "yes"}, "trial"),
    ({"graduation_strategy": "SS_PERFORMANCE"}, "MANUAL"),
    ({"format": "CAROUSEL"}, "REELS"),
    ({"caption": "a" * 2201}, "caption"),
])
def test_manifest_rejects_unapproved_or_unsafe_cases(tmp_path, patch, fragment):
    with pytest.raises(ValueError, match=fragment):
        pilot.load_manifest(get_item(tmp_path, **patch))


def test_trial_and_disclosure_are_sent_without_facebook_login(monkeypatch):
    recorded = []
    class Response:
        status_code = 200
        def json(self):
            return {"id": "container123"}
    def fake_post(url, data, headers, timeout):
        recorded.append((url, data, headers))
        return Response()
    monkeypatch.setattr(pilot.requests, "post", fake_post)
    result = pilot.create_reel_container(item(), "account123", "token-secret")
    assert result == "container123"
    assert recorded[0][0] == f"{pilot.ig.INSTAGRAM_API_BASE}/account123/media"
    assert recorded[0][1]["trial_params"] == '{"graduation_strategy":"MANUAL"}'
    assert recorded[0][1]["is_ai_generated"] == "true"
    assert recorded[0][1]["media_type"] == "REELS"
    assert recorded[0][2]["Authorization"] == "Bearer token-secret"
    assert "token-secret" not in recorded[0][0]


def test_non_trial_avoids_trial_params_and_ai_flag(monkeypatch):
    captured = []
    class Response:
        status_code = 200
        def json(self):
            return {"id": "c"}
    monkeypatch.setattr(pilot.requests, "post", lambda url, data, headers, timeout: captured.append(data) or Response())
    pilot.create_reel_container({**item(), "trial": False, "ai_generated": False}, "123", "secret")
    assert "trial_params" not in captured[0]
    assert "is_ai_generated" not in captured[0]


def test_hosted_hash_is_checked_not_just_headers():
    content = b"f" * 2048
    entry = {**item(), "video_sha256": hashlib.sha256(content).hexdigest()}
    class Response:
        status_code = 200
        headers = {"Content-Type": "video/mp4"}
        closed = False
        def iter_content(self, chunk_size):
            yield content
        def close(self):
            self.closed = True
    response = Response()
    session = SimpleNamespace(get=lambda *a, **k: response)
    assert pilot.hosted_video_preflight(entry, session=session) == len(content)
    assert response.closed
    with pytest.raises(ValueError, match="differs"):
        pilot.hosted_video_preflight(item(), session=session)


def test_first_publish_saves_receipt_and_blocks_duplicates(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(pilot, "local_video_preflight", lambda v: {"sha256": v["video_sha256"]})
    monkeypatch.setattr(pilot, "hosted_video_preflight", lambda v: 2048)
    monkeypatch.setattr(pilot, "confirmed_account", lambda: ("123", "token"))
    monkeypatch.setattr(pilot, "create_reel_container", lambda *a: calls.append("create") or "container")
    monkeypatch.setattr(pilot.ig, "wait_for_container", lambda *a: calls.append("wait"))
    def publish(uid, token, cid):
        receipt = json.loads((tmp_path / "ergodicity-v01.json").read_text())
        assert receipt["status"] == "publish_attempted"
        calls.append("publish")
        return "123456789012345"
    monkeypatch.setattr(pilot.ig, "publish_container", publish)
    monkeypatch.setattr(pilot.ig, "_permalink", lambda *a: "https://www.instagram.com/reel/example/")
    result = pilot.publish(item(), state_dir=tmp_path)
    assert result["status"] == "published"
    assert result["media_id"] == "123456789012345"
    assert calls == ["create", "wait", "publish"]
    with pytest.raises(ValueError, match="existing receipt"):
        pilot.publish(item(), state_dir=tmp_path)
    assert calls == ["create", "wait", "publish"]


def test_ambiguous_publish_requires_reconciliation_and_no_retry(monkeypatch, tmp_path):
    monkeypatch.setattr(pilot, "local_video_preflight", lambda v: {"sha256": v["video_sha256"]})
    monkeypatch.setattr(pilot, "hosted_video_preflight", lambda v: 2048)
    monkeypatch.setattr(pilot, "confirmed_account", lambda: ("123", "token"))
    monkeypatch.setattr(pilot, "create_reel_container", lambda *a: "container")
    monkeypatch.setattr(pilot.ig, "wait_for_container", lambda *a: None)
    attempts = []
    def failed(*args):
        attempts.append(1)
        raise pilot.ig.AmbiguousPublishError("timeout", container_id="container", child_ids=())
    monkeypatch.setattr(pilot.ig, "publish_container", failed)
    with pytest.raises(pilot.ig.AmbiguousPublishError):
        pilot.publish(item(), state_dir=tmp_path)
    receipt = json.loads((tmp_path / "ergodicity-v01.json").read_text())
    assert receipt["status"] == "reconciliation_required"
    assert receipt["container_id"] == "container"
    assert attempts == [1]
    with pytest.raises(ValueError, match="existing receipt"):
        pilot.publish(item(), state_dir=tmp_path)
    assert attempts == [1]


def test_reel_insights_never_invents_per_reel_follows(monkeypatch):
    monkeypatch.setattr(pilot, "confirmed_account", lambda: ("123", "token"))
    class Response:
        status_code = 200
        def json(self):
            return {"data": [{"values": [{"value": 42}]}]}
    monkeypatch.setattr(pilot.requests, "get", lambda *a, **k: Response())
    data = pilot.fetch_insights("123456789012345")
    assert data["metrics"]["reach"] == 42
    assert data["metrics"]["follows"] is None


def test_account_snapshot_is_exactly_abp_and_includes_follower_count(monkeypatch):
    monkeypatch.setattr(pilot, "confirmed_account", lambda: ("123", "token"))
    class Response:
        status_code = 200
        def json(self):
            return {"id": "123", "username": "avoidboringpeople",
                    "followers_count": 7, "media_count": 29}
    monkeypatch.setattr(pilot.requests, "get", lambda *a, **k: Response())
    snap = pilot.account_snapshot()
    assert snap["account"] == "avoidboringpeople"
    assert snap["followers_count"] == 7
    assert snap["media_count"] == 29


def test_account_snapshot_refuses_personal_account(monkeypatch):
    monkeypatch.setattr(pilot, "confirmed_account", lambda: ("123", "token"))
    class Response:
        status_code = 200
        def json(self):
            return {"id": "123", "username": "leon.lin.s",
                    "followers_count": 418}
    monkeypatch.setattr(pilot.requests, "get", lambda *a, **k: Response())
    with pytest.raises(ValueError, match="different Instagram identity"):
        pilot.account_snapshot()


def test_renamed_identical_video_is_rejected_before_network(monkeypatch, tmp_path):
    (tmp_path / 'previous-name.json').write_text(json.dumps({
        'concept_id': 'previous-name', 'sha256': 'a' * 64,
        'status': 'published', 'media_id': '123456789012345',
    }))
    def unexpected_network(*args):
        pytest.fail('a duplicate or unresolved publish must be refused before network preflight')
    monkeypatch.setattr(pilot, 'local_video_preflight', unexpected_network)
    with pytest.raises(ValueError, match='identical video'):
        pilot.publish(item(), state_dir=tmp_path)


def test_unresolved_receipt_blocks_manual_publish_too(monkeypatch, tmp_path):
    (tmp_path / 'different-video.json').write_text(json.dumps({
        'concept_id': 'different-video', 'sha256': 'b' * 64,
        'status': 'reconciliation_required',
    }))
    monkeypatch.setattr(pilot, 'local_video_preflight', lambda *_: pytest.fail('must halt before preflight'))
    with pytest.raises(ValueError, match='reconciliation'):
        pilot.publish(item(), state_dir=tmp_path)


def test_concurrent_publisher_is_refused_before_network(monkeypatch, tmp_path):
    import fcntl
    with (tmp_path / '.publish.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        monkeypatch.setattr(pilot, 'local_video_preflight', lambda *_: pytest.fail('must halt before preflight'))
        with pytest.raises(ValueError, match='another publisher'):
            pilot.publish(item(), state_dir=tmp_path)


def test_distinct_video_can_publish_after_completed_history(monkeypatch, tmp_path):
    (tmp_path / 'previous-name.json').write_text(json.dumps({
        'concept_id': 'previous-name', 'sha256': 'b' * 64,
        'status': 'published', 'media_id': '123456789012345',
    }))
    monkeypatch.setattr(pilot, 'local_video_preflight', lambda v: {'sha256': v['video_sha256']})
    monkeypatch.setattr(pilot, 'hosted_video_preflight', lambda v: 2048)
    monkeypatch.setattr(pilot, 'confirmed_account', lambda: ('123', 'token'))
    monkeypatch.setattr(pilot, 'create_reel_container', lambda *a: 'container')
    monkeypatch.setattr(pilot.ig, 'wait_for_container', lambda *a: None)
    monkeypatch.setattr(pilot.ig, 'publish_container', lambda *a: '123456789012346')
    monkeypatch.setattr(pilot.ig, '_permalink', lambda *a: 'https://www.instagram.com/reel/mock/')
    result = pilot.publish(item(), state_dir=tmp_path)
    assert result['status'] == 'published'
    assert result['media_id'] == '123456789012346'
