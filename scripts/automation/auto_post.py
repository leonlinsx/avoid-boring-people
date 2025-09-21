import os
from fetch_post import fetch_posts
from state_manager import select_next_post, mark_posted
from publishers.twitter import get_twitter_client, post_single

# Toggle dry-run with env var
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

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

    # Step 3: Format text
    text = f"{next_post['title']}\n\n{next_post['url']}"

    # Step 4: Dry-run or live post
    if DRY_RUN:
        print("📝 Dry-run (not posting):")
        print(text)
    else:
        client = get_twitter_client()
        post_single(client, next_post)

    # Step 5: Update state
    mark_posted(next_post)

if __name__ == "__main__":
    main()
