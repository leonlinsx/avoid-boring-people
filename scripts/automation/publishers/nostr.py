"""Nostr adapter: signed kind-1 notes published to WebSocket relays (NIP-01).

No API approval exists: anyone holding a private key can publish. Signing is
implemented with the standard library only (secp256k1 + BIP-340 Schnorr), so
unit tests and event construction never need a network or extra dependency.
Relay delivery uses the already-pinned ``websockets`` package, imported lazily
so signing stays usable without it.
"""
from __future__ import annotations

import hashlib
import json
import os
import time

from scripts.automation.content import PublishResult

NOSTR_DEFAULT_RELAYS = (
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.band",
)
RELAY_TIMEOUT_SECONDS = 15

# --- secp256k1 domain parameters -------------------------------------------

_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
_GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
_GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
_G = (_GX, _GY)


def _point_double(point):
    if point is None:
        return None
    x, y = point
    if y == 0:
        return None
    slope = ((3 * x * x) * pow(2 * y, _P - 2, _P)) % _P
    x3 = (slope * slope - 2 * x) % _P
    return (x3, (slope * (x - x3) - y) % _P)


def _point_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2:
        if (y1 + y2) % _P != 0:
            return None
        return _point_double(p1)
    slope = ((y2 - y1) * pow(x2 - x1, _P - 2, _P)) % _P
    x3 = (slope * slope - x1 - x2) % _P
    return (x3, (slope * (x1 - x3) - y1) % _P)


def _point_mul(point, scalar: int):
    result = None
    addend = point
    scalar %= _N
    while scalar:
        if scalar & 1:
            result = _point_add(result, addend)
        addend = _point_double(addend)
        scalar >>= 1
    return result


def _lift_x(x: int):
    if x >= _P:
        return None
    y_sq = (pow(x, 3, _P) + 7) % _P
    y = pow(y_sq, (_P + 1) // 4, _P)
    if (y * y) % _P != y_sq:
        return None
    return (x, y if y % 2 == 0 else _P - y)


def _tagged_hash(tag: bytes, message: bytes) -> bytes:
    tag_hash = hashlib.sha256(tag).digest()
    return hashlib.sha256(tag_hash + tag_hash + message).digest()


def schnorr_sign(message: bytes, seckey: bytes, aux_rand: bytes | None = None) -> bytes:
    """BIP-340 Schnorr signature; deterministic when ``aux_rand`` is fixed."""
    if len(message) != 32:
        raise ValueError("BIP-340 signs exactly 32 bytes")
    secret = int.from_bytes(seckey, "big")
    if not 1 <= secret <= _N - 1:
        raise ValueError("Secret key is outside the valid range")
    point = _point_mul(_G, secret)
    assert point is not None
    effective = secret if point[1] % 2 == 0 else _N - secret
    if aux_rand is None:
        aux_rand = os.urandom(32)
    if len(aux_rand) != 32:
        raise ValueError("aux_rand must be 32 bytes")
    masked = bytes(a ^ b for a, b in zip(effective.to_bytes(32, "big"), _tagged_hash(b"BIP0340/aux", aux_rand)))
    even_point = _point_mul(_G, effective)
    assert even_point is not None
    nonce = int.from_bytes(
        _tagged_hash(b"BIP0340/nonce", masked + even_point[0].to_bytes(32, "big") + message), "big"
    ) % _N
    if nonce == 0:
        raise RuntimeError("BIP-340 nonce came out zero; retry with fresh randomness")
    big_r = _point_mul(_G, nonce)
    assert big_r is not None
    k = nonce if big_r[1] % 2 == 0 else _N - nonce
    challenge = (
        int.from_bytes(
            _tagged_hash(
                b"BIP0340/challenge",
                big_r[0].to_bytes(32, "big") + even_point[0].to_bytes(32, "big") + message,
            ),
            "big",
        )
        % _N
    )
    return big_r[0].to_bytes(32, "big") + ((k + challenge * effective) % _N).to_bytes(32, "big")


def schnorr_verify(message: bytes, pubkey: bytes, signature: bytes) -> bool:
    """BIP-340 verification; returns False instead of raising on bad input."""
    if len(message) != 32 or len(pubkey) != 32 or len(signature) != 64:
        return False
    point = _lift_x(int.from_bytes(pubkey, "big"))
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    if point is None or r >= _P or s >= _N:
        return False
    challenge = (
        int.from_bytes(_tagged_hash(b"BIP0340/challenge", signature[:32] + pubkey + message), "big") % _N
    )
    candidate = _point_add(_point_mul(_G, s), _point_mul(point, (_N - challenge) % _N))
    return candidate is not None and candidate[1] % 2 == 0 and candidate[0] == r


# --- bech32 (BIP-173) for nsec keys -----------------------------------------

_BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _bech32_polymod(values: list[int]) -> int:
    generator = (0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3)
    check = 1
    for value in values:
        top = check >> 25
        check = ((check & 0x1FFFFFF) << 5) ^ value
        for i in range(5):
            check ^= generator[i] if ((top >> i) & 1) else 0
    return check


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _convertbits(data: list[int], frombits: int, tobits: int, pad: bool) -> list[int] | None:
    accumulator = 0
    bits = 0
    result: list[int] = []
    max_value = (1 << tobits) - 1
    for value in data:
        accumulator = (accumulator << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            result.append((accumulator >> bits) & max_value)
    if pad:
        if bits:
            result.append((accumulator << (tobits - bits)) & max_value)
    elif bits >= frombits or ((accumulator << (tobits - bits)) & max_value):
        return None
    return result


def bech32_decode(value: str) -> tuple[str, bytes]:
    """Decode a bech32 string; used for ``nsec`` private keys."""
    if not 8 <= len(value) <= 90 or (value.lower() != value and value.upper() != value):
        raise ValueError("Malformed bech32 string")
    value = value.lower()
    position = value.rfind("1")
    if position < 1 or position + 7 > len(value):
        raise ValueError("Malformed bech32 string")
    hrp, payload = value[:position], value[position + 1:]
    if any(c not in _BECH32_CHARSET for c in payload):
        raise ValueError("Malformed bech32 string")
    values = [_BECH32_CHARSET.index(c) for c in payload]
    if _bech32_polymod(_bech32_hrp_expand(hrp) + values) != 1:
        raise ValueError("Invalid bech32 checksum")
    raw = _convertbits(values[:-6], 5, 8, False)
    if raw is None:
        raise ValueError("Malformed bech32 payload")
    return hrp, bytes(raw)


def bech32_encode(hrp: str, payload: bytes) -> str:
    values = _convertbits(list(payload), 8, 5, True)
    assert values is not None
    polymod = _bech32_polymod(_bech32_hrp_expand(hrp) + values + [0, 0, 0, 0, 0, 0]) ^ 1
    checksum = [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]
    return hrp + "1" + "".join(_BECH32_CHARSET[d] for d in values + checksum)


def nsec_from_seckey(seckey_hex: str) -> str:
    raw = bytes.fromhex(seckey_hex.strip())
    if len(raw) != 32:
        raise ValueError("Secret key must be 32 bytes")
    return bech32_encode("nsec", raw)


def seckey_from_nsec(value: str) -> str:
    """Accept an ``nsec1...`` key or a raw 64-character hex secret."""
    text = (value or "").strip()
    if text.lower().startswith("nsec1"):
        hrp, raw = bech32_decode(text)
        if hrp != "nsec" or len(raw) != 32:
            raise ValueError("Not a valid nsec private key")
        return raw.hex()
    raw = bytes.fromhex(text)
    if len(raw) != 32:
        raise ValueError("Secret key must be 32 bytes")
    return raw.hex()


def pubkey_from_seckey(seckey_hex: str) -> str:
    secret = int(seckey_hex, 16)
    if not 1 <= secret <= _N - 1:
        raise ValueError("Secret key is outside the valid range")
    point = _point_mul(_G, secret)
    assert point is not None
    return f"{point[0]:064x}"


# --- NIP-01 events and relay delivery ----------------------------------------

def build_note_event(content: str, seckey_hex: str, created_at: int | None = None, tags: tuple = ()) -> dict:
    """Build and sign a kind-1 text note; pure computation, no network."""
    if not (content or "").strip():
        raise ValueError("Nostr note content must not be empty")
    timestamp = int(time.time()) if created_at is None else int(created_at)
    tag_list = [list(tag) for tag in tags]
    pubkey = pubkey_from_seckey(seckey_hex)
    payload = [0, pubkey, timestamp, 1, tag_list, content]
    event_id = hashlib.sha256(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    signature = schnorr_sign(bytes.fromhex(event_id), bytes.fromhex(seckey_hex)).hex()
    return {
        "id": event_id,
        "pubkey": pubkey,
        "created_at": timestamp,
        "kind": 1,
        "tags": tag_list,
        "content": content,
        "sig": signature,
    }


def _default_relays() -> list[str]:
    configured = (os.getenv("NOSTR_RELAYS") or "").strip()
    if configured:
        return [relay.strip() for relay in configured.split(",") if relay.strip()]
    return list(NOSTR_DEFAULT_RELAYS)


def _send_to_relay(relay_url: str, event: dict, timeout: int = RELAY_TIMEOUT_SECONDS) -> None:
    """Publish one event to one relay; raises unless the relay returns OK."""
    from websockets.sync.client import connect

    with connect(relay_url, open_timeout=timeout, close_timeout=timeout) as socket:
        socket.send(json.dumps(["EVENT", event]))
        raw = socket.recv(timeout=timeout)
    try:
        response = json.loads(raw)
    except (TypeError, ValueError):
        raise RuntimeError(f"Nostr relay {relay_url} returned a non-JSON response")
    if not isinstance(response, list) or len(response) < 3 or response[0] != "OK" or response[1] != event["id"]:
        raise RuntimeError(f"Nostr relay {relay_url} rejected the event: {raw}")
    if response[2] is not True:
        detail = response[3] if len(response) > 3 else "no reason given"
        raise RuntimeError(f"Nostr relay {relay_url} rejected the event: {detail}")


def post_to_nostr(content: str, created_at: int | None = None, relays: list[str] | None = None) -> PublishResult:
    """Sign a kind-1 note and fan it out; succeeds when one relay accepts it."""
    nsec = (os.getenv("NOSTR_NSEC") or "").strip()
    if not nsec:
        raise RuntimeError("NOSTR_NSEC is missing; it holds the publishing private key")
    seckey_hex = seckey_from_nsec(nsec)  # fail closed before any network use
    event = build_note_event(content, seckey_hex, created_at=created_at)
    targets = list(relays) if relays else _default_relays()
    if not targets:
        raise RuntimeError("No Nostr relays are configured")
    accepted: list[str] = []
    failures: list[str] = []
    for relay_url in targets:
        try:
            _send_to_relay(relay_url, event)
            accepted.append(relay_url)
            print(f"✅ Nostr note accepted by {relay_url}")
        except Exception as error:
            failures.append(f"{relay_url}: {error}")
    if not accepted:
        raise RuntimeError("Nostr publish failed on every relay: " + "; ".join(failures))
    return PublishResult("nostr", remote_id=event["id"])
