import requests
from typing import List, Dict

LOCAL_SEARCH_INDEX_URL = "http://localhost:4321/search-index.json"
LIVE_SEARCH_INDEX_URL = "https://leonlins.com/search-index.json"
SITE_URL = "https://leonlins.com"


def load_search_index() -> List[Dict]:
    """Load the search index JSON, preferring local dev server if running."""
    urls = [LOCAL_SEARCH_INDEX_URL, LIVE_SEARCH_INDEX_URL]

    for url in urls:
        try:
            resp = requests.get(url, timeout=10, headers={"Cache-Control": "no-cache"})
            resp.raise_for_status()
            data = resp.json()
            print(f"✅ Loaded search index from {url}")
            print("DEBUG first raw post:", data[0])
            return data  # return full list of dicts with category, tags, etc.
        except Exception as e:
            print(f"⚠️ Could not load search index from {url}: {e}")

    return []


def fetch_posts() -> List[Dict]:
    """Fetch posts directly from search index, keeping all metadata."""
    data = load_search_index()
    posts = []

    for entry in data:
        raw_link = entry.get("url") or entry.get("link")
        if not raw_link:
            continue
        full_url = raw_link if raw_link.startswith("http") else SITE_URL + raw_link

        posts.append(
            {
                "id": entry.get("id"),
                "title": entry.get("title"),
                "url": full_url,
                "date": entry.get("date", ""),
                "content": entry.get("content", ""),
                "category": (entry.get("category") or "").strip(),
                "tags": entry.get("tags", []),
                "count": len(entry.get("content", "").split()),
            }
        )

    return posts


if __name__ == "__main__":
    posts = fetch_posts()
    print(f"Found {len(posts)} posts")
    for p in posts[:2]:
        print(p["title"], "→", p["url"])
        print("Category:", p.get("category"))
        print("Tags:", p.get("tags"))
        print(
            "Excerpt:", (p["content"][:150] + "...") if p["content"] else "[No content]"
        )
