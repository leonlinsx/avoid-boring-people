from scripts.automation.routing import DEFAULT_PLATFORMS


def test_default_platforms_enable_only_configured_providers():
    assert DEFAULT_PLATFORMS == ("bluesky", "mastodon", "devto", "farcaster", "nostr")
    assert "twitter" not in DEFAULT_PLATFORMS  # excluded while API credits are depleted
    assert "linkedin" not in DEFAULT_PLATFORMS
    assert "reddit" not in DEFAULT_PLATFORMS
    assert "weibo" not in DEFAULT_PLATFORMS
