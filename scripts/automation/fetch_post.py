import feedparser
from typing import List, Dict

FEED_URL = "https://leonlins.com/rss.xml"  # replace with your live RSS URL

def fetch_posts() -> List[Dict]:
    """
    Fetch posts from the Astro blog RSS feed.
    Returns a list of dicts with keys: {id, title, url, date}.
    """
    feed = feedparser.parse(FEED_URL)
    posts = []

    for entry in feed.entries:
        post_id = entry.id if "id" in entry else entry.link
        posts.append({
            "id": post_id,
            "title": entry.title,
            "url": entry.link,
            "date": entry.get("published", "")
        })

    return posts

# Debug run
if __name__ == "__main__":
    posts = fetch_posts()
    print(f"Found {len(posts)} posts")
    for p in posts[:3]:  # show first 3
        print(p)
