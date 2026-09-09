import os
import re
from scripts.automation import fetch_posts, select_next_post, mark_posted
from scripts.automation.state_manager import platform_is_eligible
from scripts.automation.ranking import filter_posts, score_posts
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
DISTRIBUTION_MODE = os.getenv("DISTRIBUTION_MODE", "new").strip().lower()
TARGET_POST_ID = os.getenv("TARGET_POST_ID", "").strip()

SUMMARY_FILE = os.getenv("GITHUB_STEP_SUMMARY")

def log_summary(message: str):
    """Write to GitHub Actions summary if available, else print."""
    if SUMMARY_FILE:
        with open(SUMMARY_FILE, "a") as f:
            f.write(message + "\n")
    print(message)


def sanitize_tags(tags):
    """Convert tags into Dev.to-friendly format (lowercase, alphanumeric/dash only)."""
    clean_tags = []
    for tag in tags:
        t = tag.lower().strip()
        t = re.sub(r"[^a-z0-9]+", "-", t)  # replace spaces/invalid chars with dash
        t = t.strip("-")
        if t and t not in clean_tags:
            clean_tags.append(t)
    return clean_tags[:4]  # Dev.to max 4 tags


def _remote_id(response):
    """Extract a cheap stable identifier from the publishers' existing return values."""
    if isinstance(response, list):
        response = response[-1] if response else None
    if isinstance(response, dict):
        return response.get("id") or response.get("uri")
    if response is not None:
        data = getattr(response, "data", None)
        if isinstance(data, dict) and data.get("id") is not None:
            return data["id"]
        return getattr(response, "uri", None)
    return None


def _record_success(post, platform, response):
    """Persist only after the platform publisher returned successfully."""
    mark_posted(post["id"], platform, DISTRIBUTION_MODE, _remote_id(response))


def main():
    if DISTRIBUTION_MODE not in {"new", "evergreen"}:
        print(f"❌ Unknown DISTRIBUTION_MODE: {DISTRIBUTION_MODE}")
        return

    # Step 1: Fetch posts
    posts = fetch_posts()
    if not posts:
        if TARGET_POST_ID:
            raise RuntimeError(
                f"Target article '{TARGET_POST_ID}' is not present in the deployed search index; retry after deployment completes."
            )
        print("❌ No posts found.")
        return

    # Step 1b: Apply hygiene filters + heuristic scoring for prioritisation
    filtered_posts = filter_posts(posts)
    if not filtered_posts:
        print("❌ No posts passed digest filters (check DIGEST_* env vars).")
        return

    ranked_posts = score_posts(filtered_posts)

    # Step 2: Select next post
    if TARGET_POST_ID:
        next_post = next((post for post in ranked_posts if post.get("id") == TARGET_POST_ID), None)
        if next_post is None:
            raise RuntimeError(
                f"Target article '{TARGET_POST_ID}' is not present in the deployed search index; retry after deployment completes."
            )
        next_post = dict(next_post)
        next_post["eligible_platforms"] = [
            platform
            for platform in PLATFORM
            if platform_is_eligible(next_post, platform, DISTRIBUTION_MODE)
        ]
    else:
        next_post = select_next_post(ranked_posts, PLATFORM, DISTRIBUTION_MODE)
    if not next_post:
        print("❌ No eligible post to publish.")
        return

    if not next_post["eligible_platforms"]:
        print(f"ℹ️ No eligible platforms for {next_post['id']}; nothing to publish.")
        return

    # Step 3: Build content
    if POST_MODE == "single":
        posts_out = [f"{next_post['title']}\n\n{next_post['url']}"]

    elif POST_MODE == "thread":
        from scripts.automation.formatters import format_as_thread
        if USE_LLM:
            from scripts.automation.summarizers import llm_summarize as summarize_post
        else:
            from scripts.automation.summarizers.summarizer_stub import summarize_post

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
    if "twitter" in next_post["eligible_platforms"]:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Twitter):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nTweet {i}:\n{t}")
            else:
                from scripts.automation.publishers import get_twitter_client, post_single, post_thread

                client = get_twitter_client()
                if POST_MODE == "single":
                    response = post_single(client, next_post)
                else:
                    response = post_thread(client, posts_out)
                _record_success(next_post, "twitter", response)
            log_summary("✅ Twitter posting completed")
        except Exception as e:
            log_summary(f"❌ Twitter posting failed: {e}")

    if "bluesky" in next_post["eligible_platforms"]:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Bluesky):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nSkeet {i}:\n{t}")
            else:
                from scripts.automation.publishers.bluesky import post_single_to_bluesky, post_thread_to_bluesky

                if POST_MODE == "single":
                    response = post_single_to_bluesky(posts_out[0])
                else:
                    response = post_thread_to_bluesky(posts_out)
                _record_success(next_post, "bluesky", response)
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
                from scripts.automation.publishers import post_single_to_threads, post_thread_to_threads

                if POST_MODE == "single":
                    post_single_to_threads(posts_out[0])
                else:
                    post_thread_to_threads(posts_out)
            log_summary("✅ Threads posting completed")
        except Exception as e:
            log_summary(f"❌ Threads posting failed: {e}")

    if "mastodon" in next_post["eligible_platforms"]:
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Mastodon):")
                for i, t in enumerate(posts_out, 1):
                    print(f"\nToot {i}:\n{t}")
            else:
                from scripts.automation.publishers.mastodon import post_single_to_mastodon, post_thread_to_mastodon

                if POST_MODE == "single":
                    response = post_single_to_mastodon(posts_out[0])
                else:
                    response = post_thread_to_mastodon(posts_out)
                _record_success(next_post, "mastodon", response)
            log_summary("✅ Mastodon posting completed")
        except Exception as e:
            log_summary(f"❌ Mastodon posting failed: {e}")

    if "devto" in next_post["eligible_platforms"]:
        try:
            category = (
                (
                    next_post.get("category")
                    or next_post.get("data", {}).get("category")
                    or ""
                )
                .strip()
                .lower()
            )

            if category != "technology":
                print(f"ℹ️ Skipping Dev.to posting (category='{category}')")
            else:
                if USE_LLM:
                    from scripts.automation.summarizers import llm_summarize as summarize_post
                else:
                    from scripts.automation.summarizers.summarizer_stub import summarize_post

                summary = summarize_post(next_post, mode="narrative", max_points=3)
                teaser = summary.get("teaser", "")
                points = summary.get("points", [])
                body_md = f"## {next_post['title']}\n\n{teaser}\n\n"
                if points:
                    body_md += "\n".join(f"- {p}" for p in points)
                body_md += f"\n\n👉 [Read full article]({next_post['url']})"

                # ✅ sanitize + dedupe tags
                raw_tags = next_post.get("tags", []) or next_post.get("data", {}).get(
                    "tags", []
                )
                safe_tags = sanitize_tags(raw_tags)

                if not safe_tags:
                    print("⚠️ No valid tags found, posting without tags")

                if DRY_RUN:
                    print("\n📝 Dry-run (Dev.to):")
                    print(body_md)
                    print("Tags:", safe_tags)
                else:
                    from scripts.automation.publishers.devto import post_to_devto

                    response = post_to_devto(
                        title=next_post["title"],
                        body_markdown=body_md,
                        tags=safe_tags,
                        canonical_url=next_post["url"],
                    )
                    _record_success(next_post, "devto", response)
                log_summary("✅ Dev.to posting completed")
        except Exception as e:
            log_summary(f"❌ Dev.to posting failed: {e}")

    if "publish0x" in PLATFORM:  # ✅ NEW
        try:
            if DRY_RUN:
                print("\n📝 Dry-run (Publish0x):")
                print(f"Title: {next_post['title']}")
                print(f"Tags: {next_post.get('tags', [])}")
            else:
                from scripts.automation.publishers.publish0x import post_to_publish0x

                post_to_publish0x(next_post)
            log_summary("✅ Publish0x posting attempted")
        except Exception as e:
            log_summary(f"❌ Publish0x posting failed: {e}")

if __name__ == "__main__":
    main()
