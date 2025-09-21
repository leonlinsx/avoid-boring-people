import os
from fetch_post import fetch_posts
from state_manager import select_next_post, mark_posted
from publishers.twitter import get_twitter_client, post_single

# Toggle dry-run with env var
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

def main():
    posts = fetch_posts()
    if not posts:
        print("❌ No posts found.")
        return

    next_post = select_next_post(posts)
    if not next_post:
        print("❌ No eligible post to publish.")
        return

    text = f"{next_post['title']}\n\n{next_post['url']}"

    if DRY_RUN:
        print("📝 Dry-run (not posting):")
        print(text)
    else:
        client = get_twitter_client()
        post_single(client, next_post)

    # Update state
    mark_posted(next_post)

    # Write GitHub Actions Summary if available
    summary_file = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a") as f:
            f.write(f"### 📝 Next Post (Dry Run)\n")
            f.write(f"- **Title:** {next_post['title']}\n")
            f.write(f"- **URL:** {next_post['url']}\n")

if __name__ == "__main__":
    main()
