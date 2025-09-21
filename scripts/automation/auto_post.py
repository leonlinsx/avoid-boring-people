import os
from .fetch_post import fetch_posts
from .state_manager import select_next_post, mark_posted
from .publishers.twitter import get_twitter_client, post_single, post_thread
from .formatters.thread_formatter import format_as_thread

# Toggles
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
POST_MODE = os.getenv("POST_MODE", "single")  # "single" or "thread"
THREAD_MODE = os.getenv("THREAD_MODE", "bullets")  # "bullets" or "narrative"
USE_LLM = os.getenv("USE_LLM", "false").lower() == "true"

# Summarizer selection
if USE_LLM:
    from .summarizers.llm_summarizer import summarize_post
else:
    from .summarizers.summarizer_stub import summarize_post


def main():
    # Step 1: Fetch all posts
    posts = fetch_posts()
    if not posts:
        print("❌ No posts found.")
        return

    # Step 2: Select next post
    next_post = select_next_post(posts)
    if not next_post:
        print("❌ No eligible post to publish.")
        return

    if POST_MODE == "single":
        # Format single tweet
        text = f"{next_post['title']}\n\n{next_post['url']}"
        if DRY_RUN:
            print("📝 Dry-run (single tweet):")
            print(text)
        else:
            client = get_twitter_client()
            post_single(client, next_post)

    elif POST_MODE == "thread":
        # Summarize post content
        summary = summarize_post(next_post, mode=THREAD_MODE, max_points=4)

        teaser = summary.get("teaser", "")
        points = summary.get("points", [])

        if not points or "[Summarizer returned no usable content]" in points[0]:
            print("⚠️ Summarizer returned no usable content. Falling back to stub.")
            from .summarizers.summarizer_stub import summarize_post as fallback_summarizer
            summary = fallback_summarizer(next_post, mode=THREAD_MODE, max_points=4)

        # Debug preview
        print("\n🔍 Generated summary:")
        print(f"Teaser: {summary.get('teaser','')}")
        for i, p in enumerate(summary.get("points", []), start=1):
            print(f"{i}. {p}")

        tweets = format_as_thread(
            next_post, summary, mode=THREAD_MODE, max_tweets=5
        )

        if DRY_RUN:
            print(f"\n📝 Dry-run (thread mode: {THREAD_MODE}, LLM={USE_LLM})")
            for i, t in enumerate(tweets, start=1):
                print(f"\nTweet {i}:\n{t}")
        else:
            client = get_twitter_client()
            post_thread(client, tweets)

    else:
        print(f"❌ Unknown POST_MODE: {POST_MODE}")

    # Step 5: Update state (even in dry-run, so rotation is correct)
    mark_posted(next_post)


if __name__ == "__main__":
    main()
