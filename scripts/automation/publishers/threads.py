import os
import requests

BASE_URL = "https://graph.threads.net/v1.0"

ACCESS_TOKEN = os.getenv("THREADS_ACCESS_TOKEN")
USER_ID = os.getenv("THREADS_USER_ID")  # numeric ID of your Threads account


def _create_media(text: str, reply_to_id: str = None) -> str:
    """
    Step 1: Create a media container for a Threads post.
    Returns the container ID.
    """
    url = f"{BASE_URL}/{USER_ID}/media"
    payload = {
        "text": text,
        "access_token": ACCESS_TOKEN,
    }
    if reply_to_id:
        payload["reply_to_id"] = reply_to_id

    resp = requests.post(url, data=payload)
    try:
        resp.raise_for_status()
    except Exception:
        print(f"❌ Media creation failed: {resp.status_code} {resp.text}")
        raise
    data = resp.json()
    return data.get("id")


def _publish_media(container_id: str) -> dict:
    """
    Step 2: Publish a previously created media container.
    """
    url = f"{BASE_URL}/{USER_ID}/media_publish"
    payload = {
        "creation_id": container_id,
        "access_token": ACCESS_TOKEN,
    }
    resp = requests.post(url, data=payload)
    try:
        resp.raise_for_status()
    except Exception:
        print(f"❌ Media publish failed: {resp.status_code} {resp.text}")
        raise
    return resp.json()


def post_single_to_threads(text: str) -> dict:
    """
    Create and publish a single text-only Threads post.
    """
    if not ACCESS_TOKEN or not USER_ID:
        raise RuntimeError("❌ THREADS_ACCESS_TOKEN or THREADS_USER_ID missing")

    container_id = _create_media(text)
    return _publish_media(container_id)


def post_thread_to_threads(posts: list[str]) -> list[dict]:
    """
    Post a thread (sequence of replies).
    """
    results = []
    reply_to = None

    for i, text in enumerate(posts):
        if not ACCESS_TOKEN or not USER_ID:
            raise RuntimeError("❌ THREADS_ACCESS_TOKEN or THREADS_USER_ID missing")

        container_id = _create_media(text, reply_to_id=reply_to)
        data = _publish_media(container_id)
        results.append(data)
        reply_to = data.get("id")  # published post ID for chaining

    return results
