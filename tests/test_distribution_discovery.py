"""Discovery hashtags and richer single-status surfaces.

Hashtags come only from sanitized article metadata, never from the model, and
ride along only when everything fits: discovery must not steal content space.
Mastodon prefers two whole points over one when the 500-character budget
allows; the trim fallback stays tagless.
"""
from scripts.automation.content import SocialPost
from scripts.automation.formatters.thread_formatter import (
    MAX_TWEET_LEN,
    format_as_thread,
)
from scripts.automation.renderers.social import (
    FARCASTER_CAST_LIMIT,
    MASTODON_STATUS_LIMIT,
    THREADS_TEXT_LIMIT,
    hashtag_suffix,
    render_farcaster,
    render_mastodon,
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


def test_thread_root_carries_tags_only_when_they_fit():
    post = {"title": "Title", "url": URL}
    summary = {"teaser": "Short hook", "points": []}
    rooted = format_as_thread(post, summary, tags=["investing", "risk"])
    assert rooted[0] == "Short hook #investing #risk"
    assert rooted[-1] == URL
    long_hook = {"teaser": "H" * (MAX_TWEET_LEN - 5), "points": []}
    assert format_as_thread(post, long_hook, tags=["investing"])[0] == "H" * (
        MAX_TWEET_LEN - 5
    )
    # Tagless output is byte-identical to the old shape.
    assert format_as_thread(post, summary) == ["Short hook", URL]


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


def test_farcaster_carries_tags_within_limit():
    rendered = render_farcaster(_post(tags=("investing",)))
    assert "#investing" in rendered
    assert rendered.endswith(URL)
    assert len(rendered) <= FARCASTER_CAST_LIMIT
    # 200 + 2 + 80 + 2 + 27 = 311 without tags (fits); +11 with tags (over).
    crowded = _post(hook="H" * 200, body="B" * 80, tags=("investing",))
    assert "#investing" not in render_farcaster(crowded)


def test_threads_appends_tags_to_main_post():
    main, reply = render_threads(_post(tags=("investing", "risk")))
    assert main.endswith("#investing #risk")
    assert reply == f"Full piece: {URL}"
    assert len(main) <= THREADS_TEXT_LIMIT
    full = _post(hook="H" * 480, tags=("investing",))
    assert "#investing" not in render_threads(full)[0]
