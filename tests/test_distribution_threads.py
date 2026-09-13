"""Coverage for the Meta Threads distribution channel.

The Threads Graph API is exercised through fakes; no test touches the network.
The two behaviors worth protecting beyond the happy path are that the link
never occupies the main post and that credential/validation failures happen
before any publish attempt.
"""
import json
import sys
import types

import pytest

# tweepy/atproto/requests are installed in CI but not in every local venv;
# stub them so the publisher submodules import, matching the other distribution tests.
_tweepy_stub = types.ModuleType("tweepy")
sys.modules.setdefault("tweepy", _tweepy_stub)
_atproto_stub = types.ModuleType("atproto")
_atproto_stub.Client = type("AtprotoClient", (), {})
_atproto_stub.models = types.SimpleNamespace()
sys.modules.setdefault("atproto", _atproto_stub)
try:
    import requests as _requests_lib  # noqa: F401
except ImportError:
    _requests_stub = types.ModuleType("requests")
    _requests_stub.RequestException = type("RequestException", (Exception,), {})
    _requests_stub.post = lambda *args, **kwargs: (_ for _ in ()).throw(
        AssertionError("unexpected HTTP call")
    )
    sys.modules.setdefault("requests", _requests_stub)

from scripts.automation import auto_post, retry, state_manager
from scripts.automation.content import SocialPost
from scripts.automation.publishers import threads
from scripts.automation.renderers import render_threads
from scripts.automation.routing import DEFAULT_PLATFORMS, PLATFORMS, SOCIAL_PLATFORMS, eligible_for_category

URL = "https://leonlins.com/writing/sample/"


@pytest.fixture(autouse=True)
def _no_retry_delay(monkeypatch):
    monkeypatch.setattr(retry, "BASE_DELAY_SECONDS", 0)


def _post(hook="Systems fail where ownership is unclear.", body="Point one\n\nPoint two", url=URL):
    return SocialPost(hook, body, url, ())


def _response(status_code, payload, text=""):
    response = types.SimpleNamespace(
        status_code=status_code,
        text=text or json.dumps(payload if payload is not None else {}),
    )

    def fake_json():
        if payload is None:
            raise ValueError("No JSON here")
        return payload

    response.json = fake_json
    return response


def _threads_calls(monkeypatch, *, gets=None, posts=None):
    """Script requests.get/post with response queues and record every call."""
    import requests

    get_queue = list(gets or [])
    post_queue = list(posts or [])
    calls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append({"method": "GET", "url": url, "params": params, "headers": headers})
        assert get_queue, f"unexpected GET {url}"
        return get_queue.pop(0)

    def fake_post(url, data=None, headers=None, timeout=None):
        calls.append({"method": "POST", "url": url, "data": data, "headers": headers})
        assert post_queue, f"unexpected POST {url}"
        return post_queue.pop(0)

    monkeypatch.setattr(requests, "get", fake_get)
    monkeypatch.setattr(requests, "post", fake_post)
    return calls


def _credentials(monkeypatch):
    monkeypatch.setenv("THREADS_USER_ID", "user-1")
    monkeypatch.setenv("THREADS_ACCESS_TOKEN", "token-1")


# --- Rendering --------------------------------------------------------------

def test_render_threads_keeps_the_link_in_a_self_reply():
    rendered = render_threads(_post())
    assert rendered[0] == "Systems fail where ownership is unclear.\n\nPoint one\n\nPoint two"
    assert rendered[1] == f"Full piece: {URL}"
    assert URL not in rendered[0]


def test_render_threads_fits_as_many_whole_points_as_the_limit_allows():
    rendered = render_threads(_post(body="A" * 200 + "\n\n" + "B" * 200 + "\n\n" + "C" * 200))
    main = rendered[0]
    assert len(main) <= threads.THREADS_TEXT_LIMIT
    assert "A" * 200 in main and "B" * 200 in main
    # C does not fit, so it is dropped rather than cut off mid-sentence.
    assert "C" * 200 not in main
    assert not main.endswith("…")


def test_render_threads_trims_a_lone_overlong_point_at_a_word_boundary():
    words = [f"segment{index:02d}" for index in range(60)]
    rendered = render_threads(_post(hook="Hook", body=" ".join(words)))
    main = rendered[0]
    assert len(main) <= threads.THREADS_TEXT_LIMIT
    assert main.endswith("…")
    tail = main.split("\n\n", 1)[1][:-1].strip()
    assert tail.split()[-1] in words
    assert words[-1] not in main


def test_render_threads_stays_within_the_character_limit():
    rendered = render_threads(_post(hook="H" * 400, body="P" * 400))
    assert len(rendered[0]) <= threads.THREADS_TEXT_LIMIT
    assert rendered[0].startswith("H" * 400)
    assert rendered[0].endswith("…")


def test_render_threads_shortens_a_hook_that_alone_overflows():
    rendered = render_threads(_post(hook="H" * 900, body="Point one"))
    assert len(rendered[0]) == threads.THREADS_TEXT_LIMIT
    assert rendered[0].endswith("…")


def test_render_threads_drops_a_supporting_point_that_repeats_the_hook():
    # POST_MODE=single leaves the summary empty, so hook and body are both the title.
    rendered = render_threads(_post(hook="A Useful Essay", body="A Useful Essay"))
    assert rendered[0] == "A Useful Essay"


def test_render_threads_omits_the_reply_without_a_url():
    rendered = render_threads(_post(url=""))
    assert len(rendered) == 1


def test_render_threads_strips_leaked_markdown_quote_markers():
    rendered = render_threads(
        _post(
            hook="Systems fail where ownership is unclear.",
            body="> Traits shared include: > Overestimation of beliefs > Tendency to keep positions",
        )
    )
    assert rendered[0] == (
        "Systems fail where ownership is unclear.\n\n"
        "Traits shared include: Overestimation of beliefs Tendency to keep positions"
    )


def test_render_threads_keeps_comparison_operators():
    rendered = render_threads(
        _post(hook="Risk first.", body="Expected return > realised return, always.")
    )
    assert "return > realised return" in rendered[0]


# --- Credentials and validation --------------------------------------------

def test_threads_requires_user_id_and_token(monkeypatch):
    monkeypatch.delenv("THREADS_USER_ID", raising=False)
    monkeypatch.delenv("THREADS_ACCESS_TOKEN", raising=False)
    calls = _threads_calls(monkeypatch)
    with pytest.raises(RuntimeError, match="THREADS_USER_ID or THREADS_ACCESS_TOKEN missing"):
        threads.post_to_threads(["hello"])
    assert calls == []


def test_threads_rejects_empty_and_overlong_text(monkeypatch):
    _credentials(monkeypatch)
    calls = _threads_calls(monkeypatch)
    with pytest.raises(ValueError):
        threads.post_to_threads(["   "])
    with pytest.raises(ValueError, match="500"):
        threads.post_to_threads(["x" * 501])
    assert calls == []


def test_threads_validates_every_post_before_the_first_api_call(monkeypatch):
    _credentials(monkeypatch)
    calls = _threads_calls(monkeypatch)
    with pytest.raises(ValueError, match="500"):
        threads.post_to_threads(["short", "x" * 501])
    assert calls == []


# --- Publishing -------------------------------------------------------------

def test_threads_publishes_the_root_post_then_a_link_reply(monkeypatch, capsys):
    _credentials(monkeypatch)
    calls = _threads_calls(
        monkeypatch,
        gets=[
            _response(200, {"id": "user-1", "username": "avoidboringpeople"}),  # /me
            _response(200, {"permalink": "https://www.threads.net/@x/post/1"}),  # permalink
        ],
        posts=[
            _response(200, {"id": "container-1"}),
            _response(200, {"id": "media-1"}),
            _response(200, {"id": "container-2"}),
            _response(200, {"id": "media-2"}),
        ],
    )
    result = threads.post_to_threads(["Main idea", f"Full piece: {URL}"])

    assert result == threads.PublishResult(
        "threads", remote_id="media-1", remote_url="https://www.threads.net/@x/post/1"
    )
    assert calls[0]["url"] == f"{threads.THREADS_API_BASE}/me"
    assert calls[1]["url"] == f"{threads.THREADS_API_BASE}/user-1/threads"
    assert calls[1]["data"] == {"media_type": "TEXT", "text": "Main idea"}
    assert calls[2]["url"] == f"{threads.THREADS_API_BASE}/user-1/threads_publish"
    assert calls[2]["data"] == {"creation_id": "container-1"}
    assert calls[3]["data"] == {
        "media_type": "TEXT",
        "text": f"Full piece: {URL}",
        "reply_to_id": "media-1",
    }
    assert "Authenticated as Threads user: avoidboringpeople" in capsys.readouterr().out


def test_threads_authenticates_once_per_unit(monkeypatch):
    _credentials(monkeypatch)
    calls = _threads_calls(
        monkeypatch,
        gets=[_response(200, {"id": "user-1", "username": "x"}), _response(200, {"permalink": None})],
        posts=[
            _response(200, {"id": "c1"}),
            _response(200, {"id": "m1"}),
            _response(200, {"id": "c2"}),
            _response(200, {"id": "m2"}),
        ],
    )
    threads.post_to_threads(["one", "two"])
    assert [call["url"] for call in calls].count(f"{threads.THREADS_API_BASE}/me") == 1


def test_threads_sends_the_token_as_a_header_not_in_the_request(monkeypatch):
    _credentials(monkeypatch)
    calls = _threads_calls(
        monkeypatch,
        gets=[_response(200, {"id": "user-1", "username": "x"}), _response(200, {"permalink": None})],
        posts=[_response(200, {"id": "c1"}), _response(200, {"id": "m1"})],
    )
    threads.post_to_threads(["one"])
    for call in calls:
        assert call["headers"]["Authorization"] == "Bearer token-1"
        assert "token-1" not in call["url"]
        assert "token-1" not in json.dumps(call.get("data") or {})


def test_threads_reports_a_missing_media_id_with_container_state(monkeypatch):
    _credentials(monkeypatch)
    _threads_calls(
        monkeypatch,
        gets=[
            _response(200, {"id": "user-1", "username": "x"}),
            _response(200, {"status": "ERROR", "error_message": "media upload failed"}),
        ],
        posts=[_response(200, {"id": "container-9"}), _response(200, {})],
    )
    with pytest.raises(RuntimeError, match="container-9.*ERROR: media upload failed"):
        threads.post_to_threads(["one"])


def test_threads_error_status_is_classified_for_retry(monkeypatch):
    _credentials(monkeypatch)
    _threads_calls(
        monkeypatch,
        gets=[_response(200, {"id": "user-1", "username": "x"})],
        posts=[_response(429, {"error": {"message": "rate limit reached"}})],
    )
    with pytest.raises(RuntimeError) as error:
        threads.post_to_threads(["one"])
    assert "429" in str(error.value) and "rate limit reached" in str(error.value)
    assert retry.is_transient(error.value)

    _threads_calls(
        monkeypatch,
        gets=[_response(200, {"id": "user-1", "username": "x"})],
        posts=[_response(401, {"error": {"message": "invalid token"}})],
    )
    with pytest.raises(RuntimeError) as error:
        threads.post_to_threads(["one"])
    assert not retry.is_transient(error.value)


def test_threads_does_not_retry_an_ambiguous_publish(monkeypatch):
    """A 200 publish with no media id must not be repeated: Threads cannot dedupe."""
    _credentials(monkeypatch)
    calls = _threads_calls(
        monkeypatch,
        gets=[
            _response(200, {"id": "user-1", "username": "x"}),
            _response(200, {"status": "ERROR", "error_message": "boom"}),
        ],
        posts=[_response(200, {"id": "container-9"}), _response(200, {})],
    )
    with pytest.raises(RuntimeError) as error:
        retry.run_with_retries(lambda: threads.post_to_threads(["one"]))
    assert not retry.is_transient(error.value)
    assert [call["url"] for call in calls].count(f"{threads.THREADS_API_BASE}/user-1/threads_publish") == 1


def test_threads_authentication_failure_is_permanent(monkeypatch):
    _credentials(monkeypatch)
    _threads_calls(monkeypatch, gets=[_response(401, {"error": {"message": "invalid token"}})])
    with pytest.raises(RuntimeError, match="401"):
        threads.post_to_threads(["one"])


# --- Routing, state, and orchestration -------------------------------------

def test_threads_is_opt_in_until_live_verification():
    assert "threads" in PLATFORMS
    assert "threads" in SOCIAL_PLATFORMS
    assert "threads" not in DEFAULT_PLATFORMS
    assert eligible_for_category({"category": "Technology"}, "threads")
    assert not eligible_for_category({"category": "Culture"}, "threads")


def test_state_tracks_threads_and_evergreen_cooldown(monkeypatch, tmp_path):
    monkeypatch.setattr(state_manager, "STATE_FILE", tmp_path / "posted.json")
    post = {"id": "post", "evergreen": True}
    assert state_manager.platform_is_eligible(post, "threads", "new")
    assert state_manager.platform_is_eligible(post, "threads", "evergreen")
    state_manager.mark_posted("post", "threads", "new", "media-1", "https://www.threads.net/@x/post/1")
    stored = state_manager.get_platform_state("post", "threads")
    assert stored["remote_id"] == "media-1"
    assert stored["remote_url"] == "https://www.threads.net/@x/post/1"
    assert not state_manager.platform_is_eligible(post, "threads", "new")
    assert not state_manager.platform_is_eligible(post, "threads", "evergreen")


def test_auto_post_dispatches_threads_ignoring_post_mode(monkeypatch, tmp_path):
    monkeypatch.setattr(state_manager, "STATE_FILE", tmp_path / "posted.json")
    published = []
    fake = types.ModuleType("fake-threads")
    fake.post_to_threads = lambda posts: (
        published.append(list(posts)) or threads.PublishResult("threads", "media-1", None)
    )
    monkeypatch.setitem(sys.modules, "scripts.automation.publishers.threads", fake)
    monkeypatch.setattr(auto_post, "DRY_RUN", False)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "PLATFORM", ["threads"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [{"id": "post", "title": "T", "url": URL, "category": "Technology"}])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)

    auto_post.main()

    assert published == [["T", f"Full piece: {URL}"]]
    assert state_manager.get_platform_state("post", "threads")["remote_id"] == "media-1"


def test_auto_post_dry_run_describes_the_threads_format(monkeypatch, capsys):
    monkeypatch.setattr(auto_post, "DRY_RUN", True)
    monkeypatch.setattr(auto_post, "POST_MODE", "single")
    monkeypatch.setattr(auto_post, "PLATFORM", ["threads"])
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", "new")
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [{"id": "post", "title": "T", "url": URL, "category": "Technology"}])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)

    auto_post.main()

    output = capsys.readouterr().out
    assert "standalone post + link reply" in output
    assert f"Full piece: {URL}" in output
