from scripts.automation.routing import DEFAULT_PLATFORMS


def test_default_platforms_enable_only_configured_providers():
    assert DEFAULT_PLATFORMS == ("twitter", "bluesky", "mastodon", "devto")
    assert "linkedin" not in DEFAULT_PLATFORMS
    assert "reddit" not in DEFAULT_PLATFORMS
    # Farcaster rejoins the defaults only after its signer is approved (routing.py).
    assert "farcaster" not in DEFAULT_PLATFORMS
