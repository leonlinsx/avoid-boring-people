import os
from atproto import Client, models

BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE")       # e.g. yourname.bsky.social
BLUESKY_PASSWORD = os.getenv("BLUESKY_PASSWORD")   # app password, not account password

BLUESKY_POST_LIMIT = 300


def _validate_post(text: str) -> None:
    if len(text) > BLUESKY_POST_LIMIT:
        raise ValueError(
            f"Bluesky post exceeds the {BLUESKY_POST_LIMIT}-character limit ({len(text)} characters)"
        )


def _get_client() -> Client:
    if not BLUESKY_HANDLE or not BLUESKY_PASSWORD:
        raise RuntimeError("❌ BLUESKY_HANDLE or BLUESKY_PASSWORD missing")
    client = Client()
    client.login(BLUESKY_HANDLE, BLUESKY_PASSWORD)
    return client

def post_single_to_bluesky(text: str):
    _validate_post(text)
    client = _get_client()
    resp = client.send_post(text)
    print(f"✅ Bluesky post created: {resp.uri}")
    return resp

def post_thread_to_bluesky(posts: list[str]):
    for text in posts:
        _validate_post(text)
    client = _get_client()
    root = None
    reply_ref = None
    results = []

    for i, text in enumerate(posts):
        if i == 0:
            resp = client.send_post(text)
            root = resp
            reply_ref = resp
        else:
            reply = models.AppBskyFeedPost.ReplyRef(
                root={"uri": root.uri, "cid": root.cid},
                parent={"uri": reply_ref.uri, "cid": reply_ref.cid},
            )
            resp = client.send_post(text, reply_to=reply)
            reply_ref = resp
        results.append(resp)

    print("✅ Bluesky thread posted")
    return results
