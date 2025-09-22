# scripts/automation/publishers/devto.py

import os
import requests

DEVTO_API_KEY = os.getenv("DEVTO_API_KEY")  # generated from dev.to settings

BASE_URL = "https://dev.to/api/articles"


def post_to_devto(title: str, body_markdown: str, tags: list[str], canonical_url: str, published: bool = True):
    if not DEVTO_API_KEY:
        raise RuntimeError("❌ DEVTO_API_KEY missing")

    headers = {
        "api-key": DEVTO_API_KEY.strip(),
        "Content-Type": "application/json",
    }

    payload = {
        "article": {
            "title": title,
            "published": published,
            "body_markdown": body_markdown,
            "tags": tags,
            "canonical_url": canonical_url,
        }
    }

    resp = requests.post(BASE_URL, headers=headers, json=payload)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"❌ Dev.to API error: {resp.status_code} {resp.text}")

    data = resp.json()
    print(f"✅ Dev.to post created: {data.get('url')}")
    return data
