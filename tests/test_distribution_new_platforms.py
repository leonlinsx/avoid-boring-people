"""Coverage for the Weibo and Nostr distribution channels.

Nostr signing is pure standard library, so its cryptography is tested
directly, including the secp256k1 generator-vector ground truth. Relay I/O
and the Weibo HTTP API are exercised through fakes; no test touches a
network.
"""
import hashlib
import json
import sys
import types

import pytest

# tweepy/atproto/requests are installed in CI but not in every local venv;
# stub them so the publisher submodules import, matching test_distribution_hardening.
_tweepy_stub = types.ModuleType("tweepy")
sys.modules.setdefault("tweepy", _tweepy_stub)
_atproto_stub = types.ModuleType("atproto")
_atproto_stub.Client = type("AtprotoClient", (), {})
_atproto_stub.models = types.SimpleNamespace()
sys.modules.setdefault("atproto", _atproto_stub)
try:
    import requests as _requests_lib  # noqa: F401
except ImportError:
    _requests_stub = types.ModuleType("requests")
    _requests_stub.post = lambda *args, **kwargs: (_ for _ in ()).throw(
        AssertionError("unexpected HTTP call")
    )
    sys.modules.setdefault("requests", _requests_stub)

from scripts.automation import state_manager
from scripts.automation.publishers import nostr
from scripts.automation.publishers import weibo
from scripts.automation.routing import DEFAULT_PLATFORMS, PLATFORMS, SOCIAL_PLATFORMS, eligible_for_category


GENERATOR_PUBKEY = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
FIXED_SECKEY = "0000000000000000000000000000000000000000000000000000000000000002"
FIXED_AUX = bytes(32)


def test_bech32_reference_vector():
    assert nostr.bech32_decode("A12UEL5L") == ("a", b"")


def test_bech32_roundtrip():
    encoded = nostr.bech32_encode("nsec", bytes.fromhex(FIXED_SECKEY))
    assert encoded.startswith("nsec1")
    assert nostr.seckey_from_nsec(encoded) == FIXED_SECKEY


def test_bech32_rejects_bad_checksum():
    with pytest.raises(ValueError):
        nostr.bech32_decode("A12UEL5M")


def test_pubkey_derivation_matches_generator_vector():
    assert nostr.pubkey_from_seckey("00" * 31 + "01") == GENERATOR_PUBKEY


def test_schnorr_sign_is_deterministic_and_verifiable():
    message = hashlib.sha256(b"nostr test message").digest()
    first = nostr.schnorr_sign(message, bytes.fromhex(FIXED_SECKEY), aux_rand=FIXED_AUX)
    second = nostr.schnorr_sign(message, bytes.fromhex(FIXED_SECKEY), aux_rand=FIXED_AUX)
    assert first == second
    pubkey = bytes.fromhex(nostr.pubkey_from_seckey(FIXED_SECKEY))
    assert nostr.schnorr_verify(message, pubkey, first)


def test_schnorr_verify_rejects_tampering():
    message = hashlib.sha256(b"nostr test message").digest()
    signature = nostr.schnorr_sign(message, bytes.fromhex(FIXED_SECKEY), aux_rand=FIXED_AUX)
    pubkey = bytes.fromhex(nostr.pubkey_from_seckey(FIXED_SECKEY))
    tampered = hashlib.sha256(b"nostr test messagf").digest()
    assert not nostr.schnorr_verify(tampered, pubkey, signature)
    assert not nostr.schnorr_verify(message, bytes.fromhex(nostr.pubkey_from_seckey("00" * 31 + "03")), signature)
    assert not nostr.schnorr_verify(b"short", pubkey, signature)


def test_build_note_event_id_and_signature():
    event = nostr.build_note_event("Hello Nostr", FIXED_SECKEY, created_at=1700000000)
    assert event["kind"] == 1
    assert event["created_at"] == 1700000000
    payload = [0, event["pubkey"], 1700000000, 1, [], "Hello Nostr"]
    assert event["id"] == hashlib.sha256(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    assert nostr.schnorr_verify(
        bytes.fromhex(event["id"]), bytes.fromhex(event["pubkey"]), bytes.fromhex(event["sig"])
    )


def test_note_content_must_not_be_empty():
    with pytest.raises(ValueError):
        nostr.build_note_event("   ", FIXED_SECKEY, created_at=1)


def test_nsec_accepts_hex_and_rejects_garbage():
    assert nostr.seckey_from_nsec(FIXED_SECKEY) == FIXED_SECKEY
    with pytest.raises(ValueError):
        nostr.seckey_from_nsec("not-a-key")


def test_post_requires_a_private_key(monkeypatch):
    monkeypatch.delenv("NOSTR_NSEC", raising=False)
    with pytest.raises(RuntimeError, match="NOSTR_NSEC"):
        nostr.post_to_nostr("Hello", created_at=1)


def test_relay_fanout_succeeds_on_partial_acceptance(monkeypatch):
    monkeypatch.setenv("NOSTR_NSEC", FIXED_SECKEY)
    seen = []

    def fake_send(relay_url, event, timeout=nostr.RELAY_TIMEOUT_SECONDS):
        seen.append(relay_url)
        if relay_url == "wss://first.test":
            raise RuntimeError("connection refused")

    monkeypatch.setattr(nostr, "_send_to_relay", fake_send)
    result = nostr.post_to_nostr("Hello", created_at=1, relays=["wss://first.test", "wss://second.test"])
    assert result.platform == "nostr"
    assert seen == ["wss://first.test", "wss://second.test"]
    expected = nostr.build_note_event("Hello", FIXED_SECKEY, created_at=1)["id"]
    assert result.remote_id == expected


def test_relay_fanout_fails_when_every_relay_rejects(monkeypatch):
    monkeypatch.setenv("NOSTR_NSEC", FIXED_SECKEY)
    monkeypatch.setattr(
        nostr, "_send_to_relay", lambda relay_url, event, timeout=nostr.RELAY_TIMEOUT_SECONDS: (_ for _ in ()).throw(
            RuntimeError("rejected: permission denied"))
    )
    with pytest.raises(RuntimeError, match="every relay"):
        nostr.post_to_nostr("Hello", created_at=1, relays=["wss://only.test"])


class _FakeSocket:
    def __init__(self, replies):
        self.sent = []
        self._replies = list(replies)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def send(self, raw):
        self.sent.append(raw)

    def recv(self, timeout=None):
        return self._replies.pop(0)


def _stub_websocket(monkeypatch, replies):
    socket = _FakeSocket(replies)
    connect_module = types.ModuleType("websockets.sync.client")
    connect_module.connect = lambda *args, **kwargs: socket
    sync_module = types.ModuleType("websockets.sync")
    root_module = types.ModuleType("websockets")
    monkeypatch.setitem(sys.modules, "websockets", root_module)
    monkeypatch.setitem(sys.modules, "websockets.sync", sync_module)
    monkeypatch.setitem(sys.modules, "websockets.sync.client", connect_module)
    return socket


def test_send_to_relay_accepts_ok(monkeypatch):
    event = nostr.build_note_event("Hello", FIXED_SECKEY, created_at=1)
    socket = _stub_websocket(monkeypatch, [json.dumps(["OK", event["id"], True, ""])])
    nostr._send_to_relay("wss://relay.test", event)
    assert json.loads(socket.sent[0]) == ["EVENT", event]


def test_send_to_relay_rejects_ok_false(monkeypatch):
    event = nostr.build_note_event("Hello", FIXED_SECKEY, created_at=1)
    reply = json.dumps(["OK", event["id"], False, "blocked: spam"])
    _stub_websocket(monkeypatch, [reply])
    with pytest.raises(RuntimeError, match="blocked"):
        nostr._send_to_relay("wss://relay.test", event)


def _weibo_calls(monkeypatch, script):
    """Replace requests.post with a scripted sequence of responses."""
    import requests

    calls = []
    queue = list(script)

    def fake_post(url, data=None, timeout=None):
        calls.append({"url": url, "data": data})
        status_code, payload, text = queue.pop(0)
        response = types.SimpleNamespace(status_code=status_code, text=text or json.dumps(payload or {}))

        def fake_json():
            if payload is None:
                raise ValueError("No JSON here")
            return payload

        response.json = fake_json
        return response

    monkeypatch.setattr(requests, "post", fake_post)
    return calls


def test_weibo_requires_an_access_token(monkeypatch):
    monkeypatch.delenv("WEIBO_ACCESS_TOKEN", raising=False)
    with pytest.raises(RuntimeError, match="WEIBO_ACCESS_TOKEN"):
        weibo.post_to_weibo("hello")


def test_weibo_validates_length():
    with pytest.raises(ValueError):
        weibo.post_to_weibo("   ")
    with pytest.raises(ValueError, match="2000"):
        weibo.post_to_weibo("x" * 2001)


def test_weibo_success_returns_post_id(monkeypatch):
    monkeypatch.setenv("WEIBO_ACCESS_TOKEN", "token-123")
    calls = _weibo_calls(monkeypatch, [(200, {"id": 4812594321, "text": "hello"}, "")])
    result = weibo.post_to_weibo("hello")
    assert result == weibo.PublishResult("weibo", remote_id="4812594321", remote_url=None)
    assert calls[0]["url"] == weibo.WEIBO_UPDATE_URL
    assert calls[0]["data"] == {"access_token": "token-123", "status": "hello"}


def test_weibo_refreshes_an_expired_token_once(monkeypatch, capsys):
    monkeypatch.setenv("WEIBO_ACCESS_TOKEN", "stale-token")
    monkeypatch.setenv("WEIBO_APP_KEY", "app-key")
    monkeypatch.setenv("WEIBO_APP_SECRET", "app-secret")
    monkeypatch.setenv("WEIBO_REFRESH_TOKEN", "refresh-token")
    calls = _weibo_calls(
        monkeypatch,
        [
            (200, {"error": "expired_token: access token is expired", "error_code": 21327}, ""),
            (200, {"access_token": "fresh-token", "expires_in": 123456}, ""),
            (200, {"id": 99}, ""),
        ],
    )
    result = weibo.post_to_weibo("hello")
    assert result.remote_id == "99"
    assert [call["url"] for call in calls] == [
        weibo.WEIBO_UPDATE_URL,
        weibo.WEIBO_TOKEN_URL,
        weibo.WEIBO_UPDATE_URL,
    ]
    assert calls[2]["data"]["access_token"] == "fresh-token"
    assert "fresh-token" in capsys.readouterr().out


def test_weibo_non_token_error_does_not_refresh(monkeypatch):
    monkeypatch.setenv("WEIBO_ACCESS_TOKEN", "token-123")
    monkeypatch.delenv("WEIBO_APP_KEY", raising=False)
    calls = _weibo_calls(monkeypatch, [(200, {"error": "content too long", "error_code": 20012}, "")])
    with pytest.raises(RuntimeError, match="rejected"):
        weibo.post_to_weibo("hello")
    assert len(calls) == 1


def test_weibo_refresh_failure_raises(monkeypatch):
    monkeypatch.setenv("WEIBO_ACCESS_TOKEN", "stale-token")
    monkeypatch.setenv("WEIBO_APP_KEY", "app-key")
    monkeypatch.setenv("WEIBO_APP_SECRET", "app-secret")
    monkeypatch.setenv("WEIBO_REFRESH_TOKEN", "refresh-token")
    _weibo_calls(
        monkeypatch,
        [
            (200, {"error": "invalid token", "error_code": 21314}, ""),
            (401, None, "unauthorized"),
        ],
    )
    with pytest.raises(RuntimeError, match="refresh failed"):
        weibo.post_to_weibo("hello")


def test_new_platforms_join_routing_but_not_defaults():
    assert "weibo" in PLATFORMS and "nostr" in PLATFORMS
    assert "weibo" in SOCIAL_PLATFORMS and "nostr" in SOCIAL_PLATFORMS
    assert "weibo" not in DEFAULT_PLATFORMS
    assert "nostr" in DEFAULT_PLATFORMS
    assert eligible_for_category({"category": "Technology"}, "weibo")
    assert eligible_for_category({"category": "Technology"}, "nostr")
    assert eligible_for_category({"category": "Investing"}, "weibo")


def test_state_tracks_new_platforms(monkeypatch, tmp_path):
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    post = {"id": "post", "evergreen": False}
    assert state_manager.platform_is_eligible(post, "weibo", "new")
    assert state_manager.platform_is_eligible(post, "nostr", "new")
    state_manager.mark_posted("post", "weibo", "new", "weibo-1")
    state_manager.mark_posted("post", "nostr", "new", "note-1")
    assert state_manager.platform_post_count("post", "weibo") == 1
    assert state_manager.platform_post_count("post", "nostr") == 1
    assert not state_manager.platform_is_eligible(post, "weibo", "new")

