import textwrap
from typing import List, Dict, Literal, Sequence

from scripts.automation.renderers.social import hashtag_suffix

# One shared thread representation serves both X (280) and Bluesky (300), so the
# formatter must fit the tighter platform. Publishers keep their own validation
# as defense in depth.
MAX_TWEET_LEN = 280


def _one_line(value) -> str:
    return " ".join(str(value or "").split())


def _clip(text: str, limit: int) -> str:
    """Shorten a single idea at a word boundary.

    Used only where a reply cannot be dropped: the hook and the canonical link.
    """
    if len(text) <= limit:
        return text
    return textwrap.shorten(text, width=limit, placeholder="…", break_long_words=False) or text[:limit]


def format_as_thread(post: Dict, summary: Dict, mode: Literal["bullets", "narrative"] = "bullets",
                     max_tweets: int = 5, tags: Sequence[str] = ()) -> List[str]:
    """Compose the shared X/Bluesky thread from an article and its social copy.

    The root states the hook, plus the strongest supporting point when both fit,
    so the thread delivers an idea even if nobody clicks. Later replies carry
    whole standalone points, and the canonical link is always the final reply.
    Nothing is ever split mid-sentence; a point that cannot stand as its own
    reply is skipped instead. Deterministic hashtags append to the root only
    when they fit; over-long tag sets drop out instead of stealing reply
    space. `mode` is accepted for callers that still pass it.
    """
    if max_tweets < 2:
        raise ValueError(f"A thread needs room for its canonical link: max_tweets={max_tweets}")

    url = _one_line(post.get("url"))
    if not url:
        raise ValueError("Thread mode requires a canonical article URL")
    if len(url) > MAX_TWEET_LEN:
        raise ValueError(f"Canonical URL exceeds {MAX_TWEET_LEN} characters: {url}")

    hook = _clip(_one_line(summary.get("teaser") or post.get("title", "")), MAX_TWEET_LEN)
    if not hook:
        raise ValueError("Thread mode requires a teaser or article title to open with")

    points = [_one_line(point) for point in summary.get("points", []) if _one_line(point)]

    tweets = [hook]
    if points and len(f"{hook}\n\n{points[0]}") <= MAX_TWEET_LEN:
        tweets[0] = f"{hook}\n\n{points.pop(0)}"
    tag_suffix = hashtag_suffix(tags)
    if tag_suffix and len(f"{tweets[0]}{tag_suffix}") <= MAX_TWEET_LEN:
        tweets[0] = f"{tweets[0]}{tag_suffix}"

    # Reserve the last slot for the canonical link.
    for point in points:
        if len(tweets) >= max_tweets - 1:
            break
        if len(point) > MAX_TWEET_LEN:
            continue
        tweets.append(point)

    tweets.append(url)
    return tweets

def split_into_tweets(text: str) -> List[str]:
    """
    Split long text into chunks <= MAX_TWEET_LEN.
    """
    return textwrap.wrap(text, width=MAX_TWEET_LEN, break_long_words=False)


# Debug example
if __name__ == "__main__":
    post = {"title": "Specialists vs Generalists", "url": "https://example.com"}
    summary = {
        "teaser": "Specialization has a hidden cost.",
        "points": [
            "Being a generalist gives you adaptability across problems.",
            "Specialists go deeper, but into an increasingly narrow class of problems.",
            "The best careers often blend both approaches over time.",
            "Choose based on your goals, not just trends.",
        ],
    }

    bullets_thread = format_as_thread(post, summary, mode="bullets")
    print("\n--- Bullets Mode ---")
    for t in bullets_thread:
        print(t, "\n")

    narrative_thread = format_as_thread(post, summary, mode="narrative")
    print("\n--- Narrative Mode ---")
    for t in narrative_thread:
        print(t, "\n")
