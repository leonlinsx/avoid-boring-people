"""Select, render, and independently publish one article to eligible channels."""
from __future__ import annotations
import os
import re
from hashlib import sha256
from dotenv import load_dotenv
from scripts.automation import fetch_posts, mark_posted, select_next_post
from scripts.automation.engagement import engagement_totals, load_engagement
from scripts.automation.content import ArticleSyndication, CommunityPost, PublishResult, SocialPost
from scripts.automation.formatters import format_as_thread
from scripts.automation.formatters.instagram_storyboard import InstagramStoryboard, build_storyboard
from scripts.automation.ranking import filter_posts, score_posts
from scripts.automation.renderers import (
    render_farcaster,
    render_linkedin,
    render_mastodon,
    render_thread,
    render_threads,
    supporting_point,
)
from scripts.automation.retry import run_with_retries
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

def _thread_root(response):
    """Thread state must reference the root post, not the final reply."""
    if isinstance(response, list): return response[0] if response else None
    return response

def _remote_id(response) -> str | None:
    response = _thread_root(response)
    if isinstance(response, PublishResult): return response.remote_id
    if isinstance(response, dict): return response.get("id") or response.get("uri")
    data = getattr(response, "data", None)
    return data.get("id") if isinstance(data, dict) else getattr(response, "uri", None)

def _remote_url(response) -> str | None:
    response = _thread_root(response)
    if isinstance(response, PublishResult): return response.remote_url
    if isinstance(response, dict): return response.get("url")
    return getattr(response, "uri", None)

def _record_success(post: dict, platform: str, response, model: str | None = None) -> None:
    mark_posted(post["id"], platform, DISTRIBUTION_MODE, _remote_id(response), _remote_url(response), model=model)

def _summarize(post: dict) -> dict:
    if USE_LLM:
        from scripts.automation.summarizers import llm_summarize as summarize
    else:
        from scripts.automation.summarizers.summarizer_stub import summarize_post as summarize
    return summarize(post, mode=THREAD_MODE, max_points=4)


def _summary_for(post: dict) -> dict:
    """Summarize at most once per run: threads and the carousel share one summary."""
    if POST_MODE == "thread" or "instagram" in PLATFORM:
        return _summarize(post)
    return {"teaser": "", "points": []}


def _build_content(post: dict, summary: dict | None = None) -> tuple[SocialPost, ArticleSyndication, CommunityPost]:
    if POST_MODE not in {"single", "thread"}: raise ValueError(f"Unknown POST_MODE: {POST_MODE}")
    summary = _summary_for(post) if summary is None else summary
    tags = tuple(sanitize_tags(post.get("tags", [])))
    thread = tuple(format_as_thread(post, summary, mode=THREAD_MODE, max_tweets=5, tags=tags)) if POST_MODE == "thread" else ()
    social = SocialPost(summary.get("teaser") or post["title"], "\n\n".join(summary.get("points", [])) or post["title"], post["url"], thread, tags)
    article = ArticleSyndication(post["title"], post.get("content", ""), tuple(sanitize_tags(post.get("tags", []))), post["url"])
    return social, article, CommunityPost(post["title"], post["url"])


def _build_storyboard(post: dict, summary: dict) -> InstagramStoryboard | None:
    """Build the carousel storyboard only when Instagram is actually targeted."""
    if "instagram" not in PLATFORM:
        return None
    return build_storyboard(post, summary)


def _publish(platform: str, social: SocialPost, article: ArticleSyndication, community: CommunityPost, post_id: str, storyboard: InstagramStoryboard | None = None):
    if platform == "twitter":
        from scripts.automation.publishers import get_twitter_client, post_single, post_thread
        return post_thread(get_twitter_client(), render_thread(social)) if POST_MODE == "thread" else post_single(get_twitter_client(), {"title": social.hook, "url": social.url})
    if platform == "bluesky":
        from scripts.automation.publishers.bluesky import post_single_to_bluesky, post_thread_to_bluesky
        return post_thread_to_bluesky(render_thread(social)) if POST_MODE == "thread" else post_single_to_bluesky(render_thread(social)[0])
    if platform == "mastodon":
        from scripts.automation.publishers.mastodon import post_single_to_mastodon, post_thread_to_mastodon
        rendered = render_mastodon(social)
        if POST_MODE == "thread" and len(rendered) > 1:
            return post_thread_to_mastodon(rendered)
        return post_single_to_mastodon(rendered[0])
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
    if platform == "weibo":
        from scripts.automation.publishers.weibo import post_to_weibo
        from scripts.automation.summarizers.llm_summarizer import localize_zh_cn
        # The shared argument body carries the ideas; the X/Bluesky thread ends
        # with the canonical link and must never be localized as article copy.
        point = supporting_point(social) or social.body
        return post_to_weibo(localize_zh_cn(article.title, social.hook, point, article.canonical_url))
    if platform == "nostr":
        from scripts.automation.publishers.nostr import post_to_nostr
        rendered = render_thread(social)
        return post_to_nostr(rendered[0] if len(rendered) == 1 else "\n\n".join(rendered))
    if platform == "threads":
        from scripts.automation.publishers.threads import post_to_threads
        # Threads is always a standalone idea plus a link reply, so POST_MODE
        # does not change its shape.
        return post_to_threads(render_threads(social))
    if platform == "instagram":
        from scripts.automation.publishers.instagram import post_carousel
        if storyboard is None:
            raise ValueError("Instagram publishing requires a carousel storyboard")
        # The publisher owns rendering, hosting checks, and the three API
        # steps, so every local failure happens before the first network call.
        return post_carousel(storyboard)
    raise ValueError(f"Unknown platform: {platform}")


def _print_instagram_dry_run(storyboard: InstagramStoryboard | None) -> None:
    """Show what a carousel would publish, rendering slides but never sending."""
    print("  format: carousel")
    if storyboard is None:
        print("  storyboard: unavailable for this article")
        return
    print(f"  caption ({len(storyboard.caption)} chars):\n{storyboard.caption}")
    print(f"  hashtags: {' '.join(storyboard.hashtags) or '(none)'}")
    for slide in storyboard.slides:
        print(f"  Slide {slide.index} [{slide.kind}]")
        print(f"    Title: {slide.title or '(empty)'}")
        print(f"    Body: {slide.body or '(empty)'}")
        print()
    try:
        from scripts.automation.renderers.instagram import render_storyboard
        carousel = render_storyboard(storyboard)
    except Exception as error:  # noqa: BLE001 - a dry run reports, it does not fail
        print(f"  renderer: unavailable ({error})")
        return
    print(f"  renderer: {carousel.renderer}")
    for slide in carousel.slides:
        print(f"    {slide.path} {slide.width}x{slide.height} {slide.size_bytes} bytes sha256:{slide.sha256[:12]}")
    from scripts.automation.media_host import get_media_host, resolve_media_urls
    try:
        host = get_media_host(post_id=storyboard.post_id)
        print(f"  media host: {host.name}")
        if host.uploads:
            # A dry run never uploads, so an uploading host is asked only where
            # its content-addressed objects would go.
            for destination in host.upload_plan(carousel.slides):
                print(f"    would upload: {destination}")
        else:
            for url in resolve_media_urls(carousel.slides, host=host):
                print(f"    reachable: {url}")
    except Exception as error:  # noqa: BLE001 - live publishing is what fails closed
        print(f"  would publish: nothing until a media host is configured ({error})")


def _print_dry_run(post: dict, eligible: list[str], social: SocialPost, article: ArticleSyndication, storyboard: InstagramStoryboard | None = None, summary: dict | None = None) -> None:
    print(f"\nArticle: {post['title']}\nCategory: {post.get('category') or 'Uncategorized'}\nMode: {DISTRIBUTION_MODE}")
    candidates = (summary or {}).get("teaser_candidates") or []
    if len(candidates) > 1:
        print(f"Teaser: {social.hook}")
        for candidate in candidates:
            marker = "selected" if candidate == social.hook else "considered"
            print(f"  [{marker}] {candidate}")
    for platform in PLATFORM:
        print(f"\n{platform}\n  eligible: {'yes' if platform in eligible else 'no'}")
        if platform not in eligible: continue
        if platform == "twitter":
            if POST_MODE == "thread": print("  format: thread\n  would publish: " + "\n---\n".join(render_thread(social)))
            else: print(f"  format: single\n  would publish: {social.hook} {social.url}")
        elif platform == "bluesky":
            rendered = render_thread(social)
            if POST_MODE == "thread": print("  format: thread\n  would publish: " + "\n---\n".join(rendered))
            else: print(f"  format: single\n  would publish: {rendered[0]}")
        elif platform == "mastodon":
            rendered = render_mastodon(social)
            shape = "thread" if POST_MODE == "thread" and len(rendered) > 1 else "single"
            print(f"  format: {shape}\n  would publish: " + "\n---\n".join(rendered))
        elif platform == "linkedin": print(f"  format: social_post\n  length: {len(render_linkedin(social))} chars")
        elif platform == "farcaster": print(f"  format: social_post\n  would publish: {render_farcaster(social)}")
        elif platform == "devto": print(f"  format: article syndication\n  canonical URL: {article.canonical_url}")
        elif platform == "reddit": print("  format: link post\n  subreddit: r/" + os.getenv("REDDIT_SUBREDDIT", "AvoidBoringPeople"))
        elif platform == "weibo": print("  format: Simplified-Chinese localized post")
        elif platform == "nostr": print("  format: signed NIP-01 note")
        elif platform == "threads": print("  format: standalone post + link reply\n  would publish: " + "\n---\n".join(render_threads(social)))
        elif platform == "instagram": _print_instagram_dry_run(storyboard)
        else: print(f"  format: {'thread' if POST_MODE == 'thread' else 'single'}")

def main() -> None:
    if DISTRIBUTION_MODE not in {"new", "evergreen"}: raise ValueError(f"Unknown DISTRIBUTION_MODE: {DISTRIBUTION_MODE}")
    posts = fetch_posts()
    if not posts:
        if TARGET_POST_ID: raise RuntimeError(f"Target article '{TARGET_POST_ID}' is not present in the deployed search index; retry after deployment completes.")
        print("No posts found."); return
    ranked = score_posts(filter_posts(posts), engagement=engagement_totals(load_engagement()))
    if TARGET_POST_ID:
        selected = next((p for p in ranked if p.get("id") == TARGET_POST_ID), None)
        if selected is None: raise RuntimeError(f"Target article '{TARGET_POST_ID}' is not present in the deployed search index; retry after deployment completes.")
        selected = dict(selected); selected["eligible_platforms"] = [p for p in PLATFORM if eligible_for_category(selected, p) and platform_is_eligible(selected, p, DISTRIBUTION_MODE)]
    else:
        routed = [post for post in ranked if any(eligible_for_category(post, platform) for platform in PLATFORM)]
        selected = select_next_post(routed, PLATFORM, DISTRIBUTION_MODE)
        if selected: selected["eligible_platforms"] = [p for p in selected["eligible_platforms"] if eligible_for_category(selected, p)]
    if not selected or not selected["eligible_platforms"]: print("No eligible post to publish."); return
    try:
        summary = _summary_for(selected)
    except Exception as error:
        # Generation happens before any platform is attempted, so failing here
        # cannot duplicate a social post. Report it and let the run fail.
        log_summary(f"❌ social copy generation failed: {error}")
        raise
    social, article, community = _build_content(selected, summary)
    storyboard = _build_storyboard(selected, summary)
    if DRY_RUN: _print_dry_run(selected, selected["eligible_platforms"], social, article, storyboard, summary); return
    if USE_LLM:
        from scripts.automation.summarizers.llm_summarizer import llm_identity
        model_label: str | None = llm_identity()
    else:
        model_label = "textrank-stub"
    failures = []
    for platform in selected["eligible_platforms"]:
        try:
            # Each platform is independent: transient failures are retried with
            # backoff, state is written only after confirmed API success, and a
            # failed platform never stops the remaining platforms from running.
            response = run_with_retries(lambda p=platform: _publish(p, social, article, community, selected["id"], storyboard))
            _record_success(selected, platform, response, model_label)
            log_summary(f"✅ {platform} posting completed")
        except Exception as error:
            failures.append(platform)
            log_summary(f"❌ {platform} posting failed: {error}")
    if failures and os.getenv("FAIL_ON_PUBLISH_ERROR", "false").lower() == "true":
        raise RuntimeError("Publication failed for: " + ", ".join(failures))

if __name__ == "__main__": main()
