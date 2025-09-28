import json
import os
from typing import List, Dict

PRIORITY_DEFAULT = 0.0

STATE_FILE = "posted.json"

def load_state() -> Dict[str, int]:
    if not os.path.exists(STATE_FILE):
        return {}
    with open(STATE_FILE, "r") as f:
        return json.load(f)

def save_state(state: Dict[str, int]):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def select_next_post(posts: List[Dict]) -> Dict:
    """
    posts: list of dicts, each with keys {id, title, url}
    Returns the post with lowest count in posted.json.
    Prioritizes unposted posts (count = 0).
    """
    state = load_state()

    # Assign count = 0 for posts not in state yet
    for post in posts:
        post["count"] = state.get(post["id"], 0)
        post.setdefault("priority_score", PRIORITY_DEFAULT)

    # Sort by lowest usage count, highest priority score, then oldest first
    sorted_posts = sorted(
        posts,
        key=lambda x: (
            x["count"],
            -float(x.get("priority_score", PRIORITY_DEFAULT) or PRIORITY_DEFAULT),
            x.get("date", ""),
        ),
    )

    return sorted_posts[0] if sorted_posts else None

def mark_posted(post: Dict):
    """
    Increment the counter for a post after posting.
    """
    state = load_state()
    state[post["id"]] = state.get(post["id"], 0) + 1
    save_state(state)

# Debug run
if __name__ == "__main__":
    sample_posts = [
        {"id": "post-1", "title": "First Blog", "url": "https://example.com/1"},
        {"id": "post-2", "title": "Second Blog", "url": "https://example.com/2"},
    ]

    next_post = select_next_post(sample_posts)
    print("Next post:", next_post)
    mark_posted(next_post)
