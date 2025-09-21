import os
from scripts.automation import fetch_posts, select_next_post, mark_posted
from scripts.automation.publishers import (
    get_twitter_client, post_single, post_thread,
    post_single_to_threads, post_thread_to_threads
)
from scripts.automation.formatters import format_as_thread
from scripts.automation.summarizers import llm_summarize, stub_summarize

# Toggles
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
POST_MODE = os.getenv("POST_MODE", "single")  # "single" or "thread"
THREAD_MODE = os.getenv("THREAD_MODE", "bullets")  # "bullets" or "narrative"
USE_LLM = os.getenv("USE_LLM", "false").lower() == "true"
PLATFORM = os.getenv("PLATFORM", "twitter")  # twitter | threads | both

# Summarizer selection
summarize_post = llm_summarize if USE_LLM else stub_summarize


def main():
    # Step 1: Fetch posts
    posts = fetch_posts()
    if not posts:
        print("❌ No posts found.")
        return

    # Step 2: Select next post
    next_post = select_next_post(posts)
    if not next_post:
        print("❌ No eligible post to publish.")
        return

    # Step 3: Build content
    if POST_MODE == "single":
        tweets = [f"{next_post['title']}\n\n{next_post['url']}"]

    elif POST_MODE == "thread":
        summary = summarize_post(next_post, mode=THREAD_MODE, max_points=4)
        teaser, points = summary.get("teaser", ""), summary.get("points", [])
        print("\n🔍 Generated summary:")
        print(f"Teaser: {teaser}")
        for i, p in enumerate(points, 1):
            print(f"{i}. {p}")
        tweets = format_as_thread(next_post, summary, mode=THREAD_MODE, max_tweets=5)

    else:
        print(f"❌ Unknown POST_MODE: {POST_MODE}")
        return

    # Step 4: Dispatch
    if "twitter" in PLATFORM:
        if DRY_RUN:
            print("\n📝 Dry-run (Twitter):")
            for i, t in enumerate(tweets, 1):
                print(f"\nTweet {i}:\n{t}")
        else:
            client = get_twitter_client()
            (post_single if POST_MODE == "single" else post_thread)(client, tweets if POST_MODE == "thread" else next_post)

    if "threads" in PLATFORM:
        if DRY_RUN:
            print("\n📝 Dry-run (Threads):")
            for i, t in enumerate(tweets, 1):
                print(f"\nPost {i}:\n{t}")
        else:
            if POST_MODE == "single":
                post_single_to_threads(tweets[0])
            else:
                post_thread_to_threads(tweets)

    # Step 5: Update state
    mark_posted(next_post)


if __name__ == "__main__":
    main()
