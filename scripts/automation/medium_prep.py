import os
import sys
import frontmatter
from scripts.automation.summarizers import llm_summarize, stub_summarize

def prepare_medium_post(file_path, dry_run=True):
    # Load markdown + frontmatter
    post = frontmatter.load(file_path)
    title = post.get("title", "Untitled")
    description = post.get("description", "")
    tags = post.get("tags", [])[:5]  # Medium allows max 5 tags

    # Use summary generator
    # Wrap content in a dict since summarizers expect {"content": ...}
    post_dict = {"content": post.content}

    summary = (
        stub_summarize(post_dict)
        if dry_run
        else llm_summarize(post_dict, max_words=250)
    )


    # Slug = parent folder name (since filename is always index.md)
    slug = os.path.basename(os.path.dirname(file_path))
    canonical_url = f"https://leonlins.com/writing/{slug}/"

    # Build Medium-ready snippet
    medium_body = f"""
<h3>Summary</h3>
<p>{summary}</p>

<p>👉 <a href="{canonical_url}">Read the full post here</a></p>
"""

    # Output
    print("\n" + "=" * 60)
    print(f"📌 Title: {title}\n")
    print(f"📝 Description: {description}\n")
    print(f"🏷 Tags: {', '.join(tags) if tags else 'None'}\n")
    print("🔗 Canonical URL (already set by Medium import):")
    print(canonical_url + "\n")
    print("📄 Medium-ready content:\n")
    print(medium_body)
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/automation/medium_prep.py <path-to-blog-index.md>")
        sys.exit(1)

    file_path = sys.argv[1]
    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    prepare_medium_post(file_path, dry_run=dry_run)
