from scripts.automation.routing import DEFAULT_PLATFORMS


def test_default_platforms_enable_only_configured_providers():
    assert DEFAULT_PLATFORMS == ("twitter", "bluesky", "mastodon", "devto", "farcaster")
    assert "linkedin" not in DEFAULT_PLATFORMS
    assert "reddit" not in DEFAULT_PLATFORMS
