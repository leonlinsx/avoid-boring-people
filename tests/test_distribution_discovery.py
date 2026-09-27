"""Deterministic platform renderers from shared social copy."""
from scripts.automation.content import SocialPost
from scripts.automation.formatters.thread_formatter import (
    MAX_TWEET_LEN,
    format_as_thread,
)
from scripts.automation.renderers.social import (
    FARCASTER_CAST_LIMIT,
    MASTODON_STATUS_LIMIT,
    NOSTR_NOTE_LIMIT,
    THREADS_TEXT_LIMIT,
    hashtag_suffix,
    render_farcaster,
    render_mastodon,
    render_nostr,
    render_threads,
)

URL = "https://leonlins.com/writing/x/"


def _post(hook="Hook", body="Point one", tags=()):
    return SocialPost(hook, body, URL, (), tags)


def test_hashtag_suffix_caps_dedupes_and_empties():
    assert hashtag_suffix(()) == ""
    assert hashtag_suffix(["investing"]) == " #investing"
    assert hashtag_suffix(["a", "b", "c", "d"]) == " #a #b #c"
    assert hashtag_suffix(["a", "a", "b"]) == " #a #b"
    assert hashtag_suffix(["  ", "x"]) == " #x"


def test_thread_root_omits_article_taxonomy_tags():
    post = {"title": "Title", "url": URL}
    summary = {"teaser": "Short hook", "points": ["A useful point."]}
    rooted = format_as_thread(post, summary)
    assert rooted == ["Short hook\n\nA useful point.", f"Full piece: {URL}"]
    assert "#investing" not in "\n".join(rooted)
    long_hook = {"teaser": "H" * (MAX_TWEET_LEN - 5), "points": []}
    assert format_as_thread(post, long_hook)[0] == "H" * (MAX_TWEET_LEN - 5)


def test_mastodon_prefers_two_points_then_tags():
    post = _post(
        hook="Hook",
        body="First point here.\n\nSecond point here.",
        tags=("investing",),
    )
    rendered = render_mastodon(post)[0]
    assert "First point here." in rendered
    assert "Second point here." in rendered
    assert rendered.endswith(f"#investing\n\n{URL}")
    assert len(rendered) <= MASTODON_STATUS_LIMIT


def test_mastodon_drops_tags_before_content():
    # 4 + 2 + 460 + 2 + 27 = 495 without tags (fits); +11 with tags (over).
    body = "P" * 460
    tagged = _post(hook="Hook", body=body, tags=("investing",))
    assert "#investing" not in render_mastodon(tagged)[0]
    # Tagless long posts keep the exact old trim behavior.
    assert render_mastodon(_post(hook="Hook", body=body))[0].endswith(URL)


def test_mastodon_single_point_unchanged_without_tags():
    rendered = render_mastodon(_post(hook="Hook", body="Body text here."))[0]
    assert rendered == f"Hook\n\nBody text here.\n\n{URL}"


def test_farcaster_uses_clean_whole_supporting_copy():
    rendered = render_farcaster(_post(body="First point.\n\nSecond point.", tags=("behaviour",)))
    assert rendered == "Hook\n\nFirst point."
    assert URL not in rendered and "#behaviour" not in rendered
    crowded = _post(hook="H" * 200, body="B" * 240, tags=("behaviour",))
    assert render_farcaster(crowded) == "H" * 200
    assert len(render_farcaster(crowded)) <= FARCASTER_CAST_LIMIT


def test_nostr_uses_two_whole_points_and_tagged_link():
    post = _post(body="First point.\n\nSecond point.\n\nThird point.", tags=("behaviour",))
    assert render_nostr(post) == f"Hook\n\nFirst point.\n\nSecond point.\n\n{URL}"
    long = _post(body="A" * 470 + ".\n\nShort second point.", tags=("behaviour",))
    assert render_nostr(long) == f"Hook\n\nShort second point.\n\n{URL}"
    assert len(render_nostr(long)) <= NOSTR_NOTE_LIMIT
    crowded = _post(body="First point.\n\n" + "B" * 470 + ".\n\nThird point.")
    assert render_nostr(crowded) == f"Hook\n\nFirst point.\n\n{URL}"


def test_threads_omits_article_taxonomy_tags_from_visible_copy():
    main, reply = render_threads(_post(tags=("behaviour", "risk")))
    assert main == "Hook\n\nPoint one"
    assert "behaviour" not in main
    assert "risk" not in main
    assert reply == f"Full piece: {URL}"
    assert len(main) <= THREADS_TEXT_LIMIT
