import feedparser
import requests
from typing import List, Dict

FEED_URL = "https://leonlins.com/rss.xml"
LOCAL_SEARCH_INDEX_URL = "http://localhost:4321/search-index.json"
LIVE_SEARCH_INDEX_URL = "https://leonlins.com/search-index.json"
SITE_URL = "https://leonlins.com"

def load_search_index() -> Dict[str, str]:
    urls = [LOCAL_SEARCH_INDEX_URL, LIVE_SEARCH_INDEX_URL]

    for url in urls:
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            print(f"✅ Loaded search index from {url}")
            index = {}
            for entry in data:
                raw_link = entry.get("link")
                if not raw_link:
                    continue
                # Fix: prefix domain if relative link
                full_url = raw_link if raw_link.startswith("http") else SITE_URL + raw_link
                content = entry.get("content", "")
                index[full_url] = content
            return index
        except Exception as e:
            print(f"⚠️ Could not load search index from {url}: {e}")

    return {}

def fetch_posts() -> List[Dict]:
    feed = feedparser.parse(FEED_URL)
    posts = []

    search_index = load_search_index()

    for entry in feed.entries:
        post_id = entry.id if "id" in entry else entry.link
        content = search_index.get(entry.link, "")

        posts.append({
            "id": post_id,
            "title": entry.title,
            "url": entry.link,
            "date": entry.get("published", ""),
            "content": content
        })

    return posts

if __name__ == "__main__":
    posts = fetch_posts()
    print(f"Found {len(posts)} posts")
    for p in posts[:2]:
        print(p["title"], "→", p["url"])
        print("Excerpt:", (p["content"][:150] + "...") if p["content"] else "[No content]")
