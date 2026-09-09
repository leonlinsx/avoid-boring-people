"""Select, render, and independently publish one article to eligible channels."""
from __future__ import annotations
import os
import re
from hashlib import sha256
from dotenv import load_dotenv
from scripts.automation import fetch_posts, mark_posted, select_next_post
from scripts.automation.content import ArticleSyndication, CommunityPost, PublishResult, SocialPost
from scripts.automation.formatters import format_as_thread
from scripts.automation.ranking import filter_posts, score_posts
from scripts.automation.renderers import render_farcaster, render_linkedin, render_mastodon, render_thread
from scripts.automation.routing import DEFAULT_PLATFORMS, eligible_for_category
from scripts.automation.state_manager import platform_is_eligible

load_dotenv()
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
POST_MODE = os.getenv("POST_MODE", "single")
THREAD_MODE = os.getenv("THREAD_MODE", "bullets")
USE_LLM = os.getenv("USE_LLM", "false").lower() == "true"
PLATFORM = [
    p.strip().lower()
    for p in os.getenv("PLATFORM", ",".join(DEFAULT_PLATFORMS)).split(",")
    if p.strip()
]
DISTRIBUTION_MODE = os.getenv("DISTRIBUTION_MODE", "new").strip().lower()
TARGET_POST_ID = os.getenv("TARGET_POST_ID", "").strip()
SUMMARY_FILE = os.getenv("GITHUB_STEP_SUMMARY")

def log_summary(message: str) -> None:
    if SUMMARY_FILE:
        with open(SUMMARY_FILE, "a", encoding="utf-8") as file: file.write(message + "\n")
    print(message)

def sanitize_tags(tags: list[str]) -> list[str]:
    clean = []
    for tag in tags:
        value = re.sub(r"[^a-z0-9]+", "-", str(tag).lower().strip()).strip("-")
        if value and value not in clean: clean.append(value)
    return clean[:4]

def _remote_id(response) -> str | None:
    if isinstance(response, PublishResult): return response.remote_id
    if isinstance(response, list): response = response[-1] if response else None
    if isinstance(response, dict): return response.get("id") or response.get("uri")
    data = getattr(response, "data", None)
    return data.get("id") if isinstance(data, dict) else getattr(response, "uri", None)

def _remote_url(response) -> str | None:
    if isinstance(response, PublishResult): return response.remote_url
    if isinstance(response, dict): return response.get("url")
    return getattr(response, "uri", None)

def _record_success(post: dict, platform: str, response) -> None:
    mark_posted(post["id"], platform, DISTRIBUTION_MODE, _remote_id(response), _remote_url(response))

def _summarize(post: dict) -> dict:
    if USE_LLM:
        from scripts.automation.summarizers import llm_summarize as summarize
    else:
        from scripts.automation.summarizers.summarizer_stub import summarize_post as summarize
    return summarize(post, mode=THREAD_MODE, max_points=4)

def _build_content(post: dict) -> tuple[SocialPost, ArticleSyndication, CommunityPost]:
    if POST_MODE not in {"single", "thread"}: raise ValueError(f"Unknown POST_MODE: {POST_MODE}")
    summary = _summarize(post) if POST_MODE == "thread" else {"teaser": "", "points": []}
    thread = tuple(format_as_thread(post, summary, mode=THREAD_MODE, max_tweets=5)) if POST_MODE == "thread" else ()
    social = SocialPost(summary.get("teaser") or post["title"], "\n\n".join(summary.get("points", [])) or post["title"], post["url"], thread)
    article = ArticleSyndication(post["title"], post.get("content", ""), tuple(sanitize_tags(post.get("tags", []))), post["url"])
    return social, article, CommunityPost(post["title"], post["url"])

def _publish(platform: str, social: SocialPost, article: ArticleSyndication, community: CommunityPost, post_id: str):
    if platform == "twitter":
        from scripts.automation.publishers import get_twitter_client, post_single, post_thread
        return post_thread(get_twitter_client(), render_thread(social)) if POST_MODE == "thread" else post_single(get_twitter_client(), {"title": social.hook, "url": social.url})
    if platform == "bluesky":
        from scripts.automation.publishers.bluesky import post_single_to_bluesky, post_thread_to_bluesky
        return post_thread_to_bluesky(render_thread(social)) if POST_MODE == "thread" else post_single_to_bluesky(render_thread(social)[0])
    if platform == "mastodon":
        from scripts.automation.publishers.mastodon import post_single_to_mastodon, post_thread_to_mastodon
        rendered = render_mastodon(social); return post_thread_to_mastodon(rendered) if POST_MODE == "thread" else post_single_to_mastodon(rendered[0])
    if platform == "linkedin":
        from scripts.automation.publishers.linkedin import post_to_linkedin
        return post_to_linkedin(render_linkedin(social))
    if platform == "farcaster":
        from scripts.automation.publishers.farcaster import post_to_farcaster
        idem = sha256(f"{post_id}:{platform}:{DISTRIBUTION_MODE}".encode()).hexdigest()[:16]
        return post_to_farcaster(render_farcaster(social), idempotency_key=idem)
    if platform == "devto":
        from scripts.automation.publishers.devto import post_to_devto
        return post_to_devto(article.title, article.markdown_body, list(article.tags), article.canonical_url)
    if platform == "reddit":
        from scripts.automation.publishers.reddit import post_to_reddit
        return post_to_reddit(community.title, community.url)
    raise ValueError(f"Unknown platform: {platform}")

def _print_dry_run(post: dict, eligible: list[str], social: SocialPost, article: ArticleSyndication) -> None:
    print(f"\nArticle: {post['title']}\nCategory: {post.get('category') or 'Uncategorized'}\nMode: {DISTRIBUTION_MODE}")
    for platform in PLATFORM:
        print(f"\n{platform}\n  eligible: {'yes' if platform in eligible else 'no'}")
        if platform not in eligible: continue
        if platform == "linkedin": print(f"  format: social_post\n  length: {len(render_linkedin(social))} chars")
        elif platform == "farcaster": print(f"  format: social_post\n  would publish: {render_farcaster(social)}")
        elif platform == "devto": print(f"  format: article syndication\n  canonical URL: {article.canonical_url}")
        elif platform == "reddit": print("  format: link post\n  subreddit: r/" + os.getenv("REDDIT_SUBREDDIT", "AvoidBoringPeople"))
        else: print(f"  format: {'thread' if POST_MODE == 'thread' else 'single'}")

def main() -> None:
    if DISTRIBUTION_MODE not in {"new", "evergreen"}: raise ValueError(f"Unknown DISTRIBUTION_MODE: {DISTRIBUTION_MODE}")
    posts = fetch_posts()
    if not posts:
        if TARGET_POST_ID: raise RuntimeError(f"Target article '{TARGET_POST_ID}' is not present in the deployed search index; retry after deployment completes.")
        print("No posts found."); return
    ranked = score_posts(filter_posts(posts))
    if TARGET_POST_ID:
        selected = next((p for p in ranked if p.get("id") == TARGET_POST_ID), None)
        if selected is None: raise RuntimeError(f"Target article '{TARGET_POST_ID}' is not present in the deployed search index; retry after deployment completes.")
        selected = dict(selected); selected["eligible_platforms"] = [p for p in PLATFORM if eligible_for_category(selected, p) and platform_is_eligible(selected, p, DISTRIBUTION_MODE)]
    else:
        routed = [post for post in ranked if any(eligible_for_category(post, platform) for platform in PLATFORM)]
        selected = select_next_post(routed, PLATFORM, DISTRIBUTION_MODE)
        if selected: selected["eligible_platforms"] = [p for p in selected["eligible_platforms"] if eligible_for_category(selected, p)]
    if not selected or not selected["eligible_platforms"]: print("No eligible post to publish."); return
    social, article, community = _build_content(selected)
    if DRY_RUN: _print_dry_run(selected, selected["eligible_platforms"], social, article); return
    failures = []
    for platform in selected["eligible_platforms"]:
        try:
            _record_success(selected, platform, _publish(platform, social, article, community, selected["id"]))
            log_summary(f"✅ {platform} posting completed")
        except Exception as error:
            failures.append(platform)
            log_summary(f"❌ {platform} posting failed: {error}")
    if failures and os.getenv("FAIL_ON_PUBLISH_ERROR", "false").lower() == "true":
        raise RuntimeError("Publication failed for: " + ", ".join(failures))

if __name__ == "__main__": main()
