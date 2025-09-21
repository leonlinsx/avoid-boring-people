import textwrap
from typing import List, Dict, Literal

# Max characters per tweet (leave some buffer for safety)
MAX_TWEET_LEN = 200  

def format_as_thread(post, summary, mode="bullets", max_tweets=5):
    """
    Format a blog post + summary (teaser + points) into a Twitter thread.
    """
    title = post.get("title", "")
    url = post.get("url", "")

    teaser = summary.get("teaser", "")
    points = summary.get("points", [])

    tweets = []

    # First tweet: title + teaser + link
    first_tweet = f"{title}\n\n{teaser}\n\n{url}".strip()
    tweets.append(first_tweet)

    # Following tweets from points
    for i, point in enumerate(points, start=2):
        tweets.append(f"{point} ({i}/{max_tweets})")
        if len(tweets) >= max_tweets:
            break

    return tweets

def split_into_tweets(text: str) -> List[str]:
    """
    Split long text into chunks <= MAX_TWEET_LEN.
    """
    return textwrap.wrap(text, width=MAX_TWEET_LEN, break_long_words=False)


# Debug example
if __name__ == "__main__":
    post = {"title": "Specialists vs Generalists", "url": "https://example.com"}
    summary_points = [
        "Being a generalist gives you adaptability.",
        "Specialists can go deeper in one domain.",
        "The best careers often blend both approaches.",
        "Choose based on your goals, not just trends."
    ]

    bullets_thread = format_as_thread(post, summary_points, mode="bullets")
    print("\n--- Bullets Mode ---")
    for t in bullets_thread:
        print(t, "\n")

    narrative_thread = format_as_thread(post, summary_points, mode="narrative")
    print("\n--- Narrative Mode ---")
    for t in narrative_thread:
        print(t, "\n")
