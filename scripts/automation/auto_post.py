import os
from scripts.automation import fetch_posts, select_next_post, mark_posted
from scripts.automation.publishers import (
    get_twitter_client,
    post_single,
    post_thread,
    post_single_to_threads,
    post_thread_to_threads,
)
from scripts.automation.publishers.bluesky import (
    post_single_to_bluesky,
    post_thread_to_bluesky,
)
from scripts.automation.publishers.mastodon import (
    post_single_to_mastodon,
    post_thread_to_mastodon,
)
from scripts.automation.publishers.devto import post_to_devto
from scripts.automation.formatters import format_as_thread
from scripts.automation.summarizers import llm_summarize, stub_summarize
from dotenv import load_dotenv

load_dotenv()

# Toggles
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
POST_MODE = os.getenv("POST_MODE", "single")  # "single" or "thread"
THREAD_MODE = os.getenv("THREAD_MODE", "bullets")  # "bullets" or "narrative"
USE_LLM = os.getenv("USE_LLM", "false").lower() == "true"
# Comma-separated list of platforms → normalize to list of lowercase strings
PLATFORM = [
    p.strip().lower() for p in os.getenv("PLATFORM", "twitter").split(",") if p.strip()
]

SUMMARY_FILE = os.getenv("GITHUB_STEP_SUMMARY")

# Summarizer selection
summarize_post = llm_summarize if USE_LLM else stub_summarize


def log_summary(message: str):
    """Write to GitHub Actions summary if available, else print."""
    if SUMMARY_FILE:
        with open(SUMMARY_FILE, "a") as f:
            f.write(message + "\n")
    print(message)


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
        posts_out = [f"{next_post['title']}\n\n{next_post['url']}"]

    elif POST_MODE == "thread":
        summary = summarize_post(next_post, mode=THREAD_MODE, max_points=4)
        teaser, points = summary.get("teaser", ""), summary.get("points", [])
        print("\n🔍 Generated summary:")
        print(f"Teaser: {teaser}")
        for i, p in enumerate(points, 1):
            print(f"{i}. {p}")
        posts_out = format_as_thread(next_post, summary, mode=THREAD_MODE, max_tweets=5)

    else:
        print(f"❌ Unknown POST_MODE: {POST_MODE}")
        return

    # Step 4: Dispatch
    if "twitter" in PLATFORM:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Twitter):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nTweet {i}:\n{t}")
            else:
                client = get_twitter_client()
                if POST_MODE == "single":
                    post_single(client, next_post)
                else:
                    post_thread(client, posts_out)
            log_summary("✅ Twitter posting completed")
        except Exception as e:
            log_summary(f"❌ Twitter posting failed: {e}")

    if "bluesky" in PLATFORM:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Bluesky):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nSkeet {i}:\n{t}")
            else:
                if POST_MODE == "single":
                    post_single_to_bluesky(posts_out[0])
                else:
                    post_thread_to_bluesky(posts_out)
            log_summary("✅ Bluesky posting completed")
        except Exception as e:
            log_summary(f"❌ Bluesky posting failed: {e}")

    if "threads" in PLATFORM:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Threads):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nPost {i}:\n{t}")
            else:
                if POST_MODE == "single":
                    post_single_to_threads(posts_out[0])
                else:
                    post_thread_to_threads(posts_out)
            log_summary("✅ Threads posting completed")
        except Exception as e:
            log_summary(f"❌ Threads posting failed: {e}")

    if "mastodon" in PLATFORM:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Mastodon):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nToot {i}:\n{t}")
            else:
                if POST_MODE == "single":
                    post_single_to_mastodon(posts_out[0])
                else:
                    post_thread_to_mastodon(posts_out)
            log_summary("✅ Mastodon posting completed")
        except Exception as e:
            log_summary(f"❌ Mastodon posting failed: {e}")

    if "devto" in PLATFORM:
        try:
            category = (
                next_post.get("category")
                or next_post.get("data", {}).get("category")
                or ""
            ).strip().lower()

            print(f"DEBUG next_post keys: {list(next_post.keys())}")
            print(f"DEBUG next_post.data: {next_post.get('data')}")
            print(f"DEBUG: category resolved as '{category}'")

            if category != "tech":
                print(f"ℹ️ Skipping Dev.to posting (category='{category}')")
            else:
                summary = summarize_post(next_post, mode="narrative", max_points=3)
                teaser = summary.get("teaser", "")
                points = summary.get("points", [])
                body_md = f"## {next_post['title']}\n\n{teaser}\n\n"
                if points:
                    body_md += "\n".join(f"- {p}" for p in points)
                body_md += f"\n\n👉 [Read full article]({next_post['url']})"

                if DRY_RUN:
                    print("\n📝 Dry-run (Dev.to):")
                    print(body_md)
                else:
                    post_to_devto(
                        title=next_post["title"],
                        body_markdown=body_md,
                        tags=next_post.get("tags", []) or next_post.get("data", {}).get("tags", []),
                        canonical_url=next_post["url"],
                    )
                log_summary("✅ Dev.to posting completed")
        except Exception as e:
            log_summary(f"❌ Dev.to posting failed: {e}")



    # Step 5: Update state
    mark_posted(next_post)


if __name__ == "__main__":
    main()
