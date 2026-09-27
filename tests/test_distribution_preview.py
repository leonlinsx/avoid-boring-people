"""Targeted preview uses fixed shared copy and never reads or writes posting state."""
from scripts.automation import auto_post, state_manager
from scripts.automation.attribution import tagged_url
from scripts.automation.formatters import format_as_thread
from scripts.automation.renderers import render_threads


def test_target_preview_renders_requested_platforms_without_state_or_publish(monkeypatch, tmp_path, capsys):
    post = {
        "id": "2019_02_02_dunning/index.md",
        "title": "Dunning-Kruger",
        "url": "https://leonlins.com/writing/dunning/",
        "content": "The full article.",
        "category": "Culture",
        "tags": ["behaviour"],
        "evergreen": True,
    }
    summary = {"teaser": "A fixed hook.", "points": ["A fixed point.", "Another fixed point."]}
    state_file = tmp_path / "posted.json"
    state_file.write_text('{"version":2,"posts":{"2019_02_02_dunning/index.md":{"threads":{"count":1}}}}')
    original_state = state_file.read_bytes()
    monkeypatch.setattr(state_manager, "STATE_FILE", state_file)
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "thread")
    monkeypatch.setattr(auto_post, "PLATFORM", ["bluesky", "threads", "devto"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", post["id"])
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [post])
    monkeypatch.setattr(auto_post, "_summarize", lambda _: summary)

    def forbidden(*args, **kwargs):
        raise AssertionError("preview touched state, ranking, or a publisher")

    for name in ("platform_is_eligible", "score_posts", "load_engagement", "mark_posted", "_publish"):
        monkeypatch.setattr(auto_post, name, forbidden)

    auto_post.main()

    output = capsys.readouterr().out
    thread = format_as_thread(post, summary)
    thread = [part.replace(post["url"], tagged_url(post["url"], "bluesky", post["id"])) for part in thread]
    assert "\n---\n".join(thread) in output
    threads_main, threads_reply = render_threads(auto_post._tagged_social(
        auto_post._build_content(post, summary)[0], "threads", post["id"]
    ))
    assert threads_main == "A fixed hook.\n\nA fixed point.\n\nAnother fixed point."
    assert threads_reply in output
    assert "normal routing (category/mode): ineligible" in output  # DEV for Culture
    assert "body:\nThe full article." in output  # still rendered on request
    assert "Normal article filter: ineligible" in output
    assert "posting history: ignored for preview" in output
    assert state_file.read_bytes() == original_state


def test_target_preview_matches_changed_channel_payloads(monkeypatch, tmp_path, capsys):
    from scripts.automation.renderers import render_nostr
    from scripts.automation.publishers.tumblr import render_tumblr_post
    import json

    post = {
        "id": "article/index.md",
        "title": "Article title",
        "url": "https://leonlins.com/writing/article/",
        "content": "Article text " * 200,
        "category": "Culture",
        "tags": ["behaviour"],
        "evergreen": True,
    }
    summary = {"teaser": "A fixed hook.", "points": ["First fixed point.", "Second fixed point."]}
    monkeypatch.setattr(state_manager, "STATE_FILE", tmp_path / "posted.json")
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "thread")
    monkeypatch.setattr(auto_post, "PLATFORM", ["twitter", "bluesky", "farcaster", "nostr", "tumblr"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", post["id"])
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [post])
    monkeypatch.setattr(auto_post, "_summarize", lambda _: summary)

    auto_post.main()

    output = capsys.readouterr().out
    social = auto_post._build_content(post, summary)[0]
    for platform in ("twitter", "bluesky"):
        rendered = auto_post.render_thread(auto_post._tagged_social(social, platform, post["id"]))
        assert "\n---\n".join(rendered) in output
        assert "#behaviour" not in "\n".join(rendered)
    farcaster = auto_post._tagged_social(social, "farcaster", post["id"])
    assert f"format: cast (tagged embed: {farcaster.url})" in output
    assert auto_post.render_farcaster(farcaster) == "A fixed hook.\n\nFirst fixed point."
    assert auto_post.render_farcaster(farcaster) in output
    nostr = auto_post._tagged_social(social, "nostr", post["id"])
    assert render_nostr(nostr) == f"A fixed hook.\n\nFirst fixed point.\n\nSecond fixed point.\n\n{nostr.url}"
    assert render_nostr(nostr) in output
    tumblr = auto_post._tagged_social(social, "tumblr", post["id"])
    payload = render_tumblr_post(tumblr, post["url"])
    assert payload["content"][2]["url"] == tagged_url(post["url"], "tumblr", post["id"])
    assert payload["source_url"] == post["url"]
    assert json.dumps(payload, ensure_ascii=False, indent=2) in output
    assert not (tmp_path / "posted.json").exists()
