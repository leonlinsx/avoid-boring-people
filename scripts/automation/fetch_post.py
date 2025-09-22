import feedparser
import requests
from typing import List, Dict

FEED_URL = "https://leonlins.com/rss.xml"
LOCAL_SEARCH_INDEX_URL = "http://localhost:4321/search-index.json"
LIVE_SEARCH_INDEX_URL = "https://leonlins.com/search-index.json"
SITE_URL = "https://leonlins.com"


def load_search_index() -> List[Dict]:
    urls = [LOCAL_SEARCH_INDEX_URL, LIVE_SEARCH_INDEX_URL]

    for url in urls:
        try:
            resp = requests.get(url, timeout=10, headers={"Cache-Control": "no-cache"})
            resp.raise_for_status()
            data = resp.json()
            print(f"✅ Loaded search index from {url}")
            return data  # ✅ return full list of dicts (with category, tags, etc.)
        except Exception as e:
            print(f"⚠️ Could not load search index from {url}: {e}")

    return []


def fetch_posts() -> List[Dict]:
    feed = feedparser.parse(FEED_URL)
    posts = []

    search_index = load_search_index()
    search_index_by_url = {}

    # Normalize search index into a dict keyed by full URL
    for entry in search_index:
        raw_link = entry.get("url") or entry.get("link")
        if not raw_link:
            continue
        full_url = raw_link if raw_link.startswith("http") else SITE_URL + raw_link
        search_index_by_url[full_url] = entry

    for entry in feed.entries:
        post_id = entry.id if "id" in entry else entry.link
        enriched = search_index_by_url.get(entry.link, {})

        posts.append({
            "id": post_id,
            "title": entry.title,
            "url": entry.link,
            "date": entry.get("published", ""),
            "content": enriched.get("content", ""),
            "category": enriched.get("category", ""),
            "tags": enriched.get("tags", []),
            "count": len(enriched.get("content", "").split()),
        })

    return posts


if __name__ == "__main__":
    posts = fetch_posts()
    print(f"Found {len(posts)} posts")
    for p in posts[:2]:
        print(p["title"], "→", p["url"])
        print("Category:", p.get("category"))
        print("Tags:", p.get("tags"))
        print("Excerpt:", (p["content"][:150] + "...") if p["content"] else "[No content]")
