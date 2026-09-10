from scripts.automation.content import SocialPost
from scripts.automation.renderers import render_farcaster, render_linkedin
from scripts.automation.routing import eligible_for_category
from scripts.automation import state_manager


def test_category_policy_keeps_dev_selective_and_reddit_new_only():
    technology = {"category": "Technology"}
    investing = {"category": "Investing"}
    assert eligible_for_category(technology, "devto")
    assert eligible_for_category(technology, "reddit")
    assert not eligible_for_category(investing, "devto")
    assert state_manager.platform_is_eligible({"id": "a", "evergreen": True}, "reddit", "evergreen") is False


def test_social_renderers_adapt_one_argument_without_losing_the_canonical_url():
    post = SocialPost("A useful hook", "A longer explanation.", "https://example.test/article", ("A useful hook", "Supporting point"))
    assert "Full piece: https://example.test/article" in render_linkedin(post)
    assert render_farcaster(post).endswith("https://example.test/article")
