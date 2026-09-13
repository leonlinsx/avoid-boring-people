"""Hardening coverage for Phase 1 social distribution.

Covers the behaviors the task requires beyond the earlier state/routing
tests: root-post persistence for threads, transient retries vs permanent
errors, rerun-after-partial-success, DEV syndication rules, Farcaster
evergreen/idempotency, Mastodon single-post behavior, dry-run immutability,
failure propagation, and production-workflow hygiene.
"""
import sys
import types
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.automation import auto_post, state_manager
from scripts.automation import retry as retry_module
from scripts.automation.content import PublishResult, SocialPost
from scripts.automation.renderers import render_farcaster, render_mastodon, render_thread
from scripts.automation.routing import DEFAULT_PLATFORMS, PLATFORMS, eligible_for_category

# The real publisher package __init__ imports tweepy, and the Bluesky adapter
# imports atproto; neither is installed in the test env, so provide import-time
# stubs. Tests that need the real adapters import the submodules, which only
# touch these dependencies inside network-touching helpers.
_tweepy_stub = types.ModuleType("tweepy")
sys.modules.setdefault("tweepy", _tweepy_stub)
_atproto_stub = types.ModuleType("atproto")
_atproto_stub.Client = type("AtprotoClient", (), {})
_atproto_stub.models = types.SimpleNamespace()
sys.modules.setdefault("atproto", _atproto_stub)


@pytest.fixture(autouse=True)
def _no_retry_delay(monkeypatch):
    monkeypatch.setattr(retry_module, "BASE_DELAY_SECONDS", 0)


def _use_temp_state(monkeypatch, tmp_path):
    path = tmp_path / "posted.json"
    monkeypatch.setattr(state_manager, "STATE_FILE", path)
    return path


def _post(**overrides):
    base = {
        "id": "post",
        "title": "A Useful Essay",
        "url": "https://leonlins.com/writing/sample/",
        "content": "Full article body with several sentences. " * 20,
        "category": "Technology",
        "tags": ["Systems"],
        "evergreen": False,
    }
    base.update(overrides)
    return base


def _drive_main(monkeypatch, post, platforms, fakes, mode="new", post_mode="single", dry_run=False):
    monkeypatch.setattr(auto_post, "DRY_RUN", dry_run)
    monkeypatch.setattr(auto_post, "POST_MODE", post_mode)
    monkeypatch.setattr(auto_post, "THREAD_MODE", "bullets")
    monkeypatch.setattr(auto_post, "USE_LLM", False)
    monkeypatch.setattr(auto_post, "PLATFORM", list(platforms))
    monkeypatch.setattr(auto_post, "DISTRIBUTION_MODE", mode)
    monkeypatch.setattr(auto_post, "TARGET_POST_ID", "")
    monkeypatch.setattr(auto_post, "fetch_posts", lambda: [dict(post)])
    monkeypatch.setattr(auto_post, "filter_posts", lambda posts: posts)
    monkeypatch.setattr(auto_post, "score_posts", lambda posts: posts)
    for name, module in fakes.items():
        monkeypatch.setitem(sys.modules, name, module)


def _fake_module(**attrs):
    module = types.ModuleType("fake-publisher")
    for key, value in attrs.items():
        setattr(module, key, value)
    return module


# --- Thread root persistence ------------------------------------------------

def test_remote_id_records_thread_root_not_final_reply():
    first = SimpleNamespace(data={"id": "tweet-root"})
    last = SimpleNamespace(data={"id": "tweet-last"})
    assert auto_post._remote_id([first, last]) == "tweet-root"

    root = SimpleNamespace(uri="at://root-post", cid="cid-1")
    reply = SimpleNamespace(uri="at://reply-post", cid="cid-2")
    assert auto_post._remote_id([root, reply]) == "at://root-post"
    assert auto_post._remote_url([root, reply]) == "at://root-post"

    assert auto_post._remote_id({"id": "status-9", "url": "https://mastodon/x/9"}) == "status-9"
    assert auto_post._remote_id(PublishResult("farcaster", remote_id="0xabc")) == "0xabc"


def test_x_thread_persists_root_post_id(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    calls = []
    responses = [SimpleNamespace(data={"id": f"tweet-{i}"}) for i in range(3)]

    def post_thread(client, tweets):
        calls.append(list(tweets))
        return responses

    twitter = _fake_module(get_twitter_client=lambda: object(), post_single=lambda c, p: responses[0], post_thread=post_thread)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: {"teaser": "Hook", "points": ["Point one", "Point two"]})
    _drive_main(monkeypatch, _post(), ["twitter"], {"scripts.automation.publishers": twitter}, post_mode="thread")

    auto_post.main()

    stored = state_manager.get_platform_state("post", "twitter")
    assert stored["remote_id"] == "tweet-0"
    assert len(calls[0]) == 3


def test_bluesky_thread_persists_root_uri(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    responses = [SimpleNamespace(uri=f"at://post-{i}", cid=f"cid-{i}") for i in range(3)]
    bluesky = _fake_module(
        post_single_to_bluesky=lambda text: responses[0],
        post_thread_to_bluesky=lambda posts: responses,
    )
    monkeypatch.setattr(auto_post, "_summarize", lambda post: {"teaser": "Hook", "points": ["Point one"]})
    _drive_main(monkeypatch, _post(), ["bluesky"], {"scripts.automation.publishers.bluesky": bluesky}, post_mode="thread")

    auto_post.main()

    stored = state_manager.get_platform_state("post", "bluesky")
    assert stored["remote_id"] == "at://post-0"
    assert stored["remote_url"] == "at://post-0"


# --- Partial failure, rerun, propagation ------------------------------------

def test_failed_platform_does_not_stop_remaining_platforms(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    bluesky = _fake_module(
        post_single_to_bluesky=lambda text: (_ for _ in ()).throw(RuntimeError("Bluesky API error: 500 boom")),
        post_thread_to_bluesky=lambda posts: (_ for _ in ()).throw(RuntimeError("Bluesky API error: 500 boom")),
    )
    twitter = _fake_module(get_twitter_client=lambda: object(), post_single=lambda c, p: {"id": "tweet-1"}, post_thread=lambda c, t: [{"id": "tweet-1"}])
    _drive_main(monkeypatch, _post(), ["bluesky", "twitter"], {"scripts.automation.publishers": twitter, "scripts.automation.publishers.bluesky": bluesky})

    auto_post.main()  # must not raise without FAIL_ON_PUBLISH_ERROR

    state = state_manager.load_state()
    assert state_manager.get_platform_state("post", "bluesky", state) is None
    assert state_manager.get_platform_state("post", "twitter", state)["remote_id"] == "tweet-1"


def test_rerun_after_partial_success_attempts_only_missing(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    twitter_calls = []
    twitter = _fake_module(
        get_twitter_client=lambda: object(),
        post_single=lambda c, p: twitter_calls.append(p) or {"id": "tweet-1"},
        post_thread=lambda c, t: twitter_calls.append(t) or [{"id": "tweet-1"}],
    )
    failing = _fake_module(
        post_single_to_bluesky=lambda text: (_ for _ in ()).throw(RuntimeError("Bluesky API error: 500 boom")),
        post_thread_to_bluesky=lambda posts: (_ for _ in ()).throw(RuntimeError("Bluesky API error: 500 boom")),
    )
    _drive_main(monkeypatch, _post(), ["twitter", "bluesky"], {"scripts.automation.publishers": twitter, "scripts.automation.publishers.bluesky": failing})
    auto_post.main()
    assert len(twitter_calls) == 1

    def exploding_twitter(client, post):
        raise AssertionError("already-succeeded platform must not be reposted")

    twitter2 = _fake_module(get_twitter_client=lambda: object(), post_single=exploding_twitter, post_thread=lambda c, t: exploding_twitter(c, t))
    working = _fake_module(post_single_to_bluesky=lambda text: {"uri": "at://recovered"}, post_thread_to_bluesky=lambda posts: [{"uri": "at://recovered"}])
    _drive_main(monkeypatch, _post(), ["twitter", "bluesky"], {"scripts.automation.publishers": twitter2, "scripts.automation.publishers.bluesky": working})
    auto_post.main()

    state = state_manager.load_state()
    assert state_manager.platform_post_count("post", "twitter", state) == 1
    assert state_manager.get_platform_state("post", "bluesky", state)["remote_id"] == "at://recovered"


def test_fail_on_publish_error_raises_after_partial_state(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    monkeypatch.setenv("FAIL_ON_PUBLISH_ERROR", "true")
    bluesky = _fake_module(
        post_single_to_bluesky=lambda text: (_ for _ in ()).throw(RuntimeError("Bluesky API error: 400 bad request")),
        post_thread_to_bluesky=lambda posts: (_ for _ in ()).throw(RuntimeError("Bluesky API error: 400 bad request")),
    )
    _drive_main(monkeypatch, _post(), ["bluesky"], {"scripts.automation.publishers.bluesky": bluesky})

    with pytest.raises(RuntimeError, match="bluesky"):
        auto_post.main()
    assert state_manager.get_platform_state("post", "bluesky") is None


def test_dry_run_never_modifies_state(monkeypatch, tmp_path):
    path = _use_temp_state(monkeypatch, tmp_path)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: {"teaser": "Hook", "points": ["Point one"]})
    _drive_main(monkeypatch, _post(), ["twitter", "bluesky", "mastodon", "devto"], {}, post_mode="thread", dry_run=True)

    auto_post.main()

    assert not path.exists()


# --- Retry behavior ----------------------------------------------------------

def test_transient_failures_are_retried_then_recorded(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    attempts = []

    def flaky(text):
        attempts.append(text)
        if len(attempts) < 3:
            raise RuntimeError("Bluesky API error: 503 Service Unavailable")
        return {"uri": "at://eventual"}

    bluesky = _fake_module(post_single_to_bluesky=flaky, post_thread_to_bluesky=lambda posts: flaky(posts[0]))
    _drive_main(monkeypatch, _post(), ["bluesky"], {"scripts.automation.publishers.bluesky": bluesky})

    auto_post.main()

    assert len(attempts) == 3
    assert state_manager.get_platform_state("post", "bluesky")["remote_id"] == "at://eventual"


@pytest.mark.parametrize("status", [400, 401, 403, 422])
def test_permanent_errors_are_not_retried(status):
    assert not retry_module.is_transient(RuntimeError(f"Provider API error: {status} rejected"))
    assert not retry_module.is_transient(ValueError("over the character limit"))


@pytest.mark.parametrize("message", ["API error: 429 rate limited", "API error: 500 boom", "API error: 502 bad gateway", "API error: 504 timeout", "connection reset", "request timed out"])
def test_transient_signals_are_retried(message):
    assert retry_module.is_transient(RuntimeError(message))


def test_retry_gives_up_after_bounded_attempts():
    attempts = []

    def always_fails():
        attempts.append(1)
        raise RuntimeError("API error: 503 down")

    with pytest.raises(RuntimeError):
        retry_module.run_with_retries(always_fails, sleep=lambda seconds: None)
    assert len(attempts) == 3


def test_permanent_error_runs_once_and_leaves_no_state(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    attempts = []

    def rejected(client, post):
        attempts.append(post)
        raise RuntimeError("Twitter API error: 403 forbidden")

    twitter = _fake_module(get_twitter_client=lambda: object(), post_single=rejected, post_thread=lambda c, t: rejected(c, t))
    _drive_main(monkeypatch, _post(), ["twitter"], {"scripts.automation.publishers": twitter})

    auto_post.main()

    assert len(attempts) == 1
    assert state_manager.get_platform_state("post", "twitter") is None


# --- Routing -----------------------------------------------------------------

def test_technology_and_system_design_get_dev_by_default():
    assert eligible_for_category({"category": "Technology"}, "devto")
    assert eligible_for_category({"category": "System Design"}, "devto")
    assert not eligible_for_category({"category": "Investing"}, "devto")
    assert eligible_for_category({"category": "Investing", "devto": True}, "devto")


def test_evergreen_never_recycles_dev():
    assert not state_manager.platform_is_eligible({"id": "a", "evergreen": True}, "devto", "evergreen")
    assert not state_manager.platform_is_eligible({"id": "a", "evergreen": True}, "reddit", "evergreen")


def test_evergreen_cooldowns_are_per_platform(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    from datetime import datetime, timedelta, timezone
    fresh = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    state = {"version": 2, "posts": {"post": {
        "twitter": {"count": 1, "last_posted_at": fresh, "last_mode": "evergreen"},
        "mastodon": {"count": 1, "last_posted_at": (datetime.now(timezone.utc) - timedelta(days=91)).isoformat(), "last_mode": "evergreen"},
    }}}
    post = {"id": "post", "evergreen": True}
    assert not state_manager.platform_is_eligible(post, "twitter", "evergreen", state)
    assert state_manager.platform_is_eligible(post, "mastodon", "evergreen", state)
    assert state_manager.platform_is_eligible(post, "farcaster", "evergreen", state)


# --- DEV ---------------------------------------------------------------------

def test_dev_receives_full_content_with_canonical_url(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    captured = {}

    def fake_devto(title, body, tags, canonical_url, published=True):
        captured.update(title=title, body=body, tags=tags, canonical_url=canonical_url)
        return PublishResult("devto", remote_id="4242", remote_url="https://dev.to/x")

    devto = _fake_module(post_to_devto=fake_devto)
    content = "Full article body with several sentences. " * 20
    _drive_main(monkeypatch, _post(content=content), ["devto"], {"scripts.automation.publishers.devto": devto})

    auto_post.main()

    assert captured["body"] == content  # the article itself, never an LLM teaser
    assert captured["canonical_url"] == "https://leonlins.com/writing/sample/"
    assert len(captured["tags"]) <= 4
    stored = state_manager.get_platform_state("post", "devto")
    assert stored["remote_id"] == "4242"


def test_dev_sanitizes_markdown_and_enforces_canonical_host():
    from scripts.automation.publishers import devto as devto_module

    dirty = "Hello<script>alert(1)</script> world <iframe src='https://evil.test'></iframe> end."
    cleaned = devto_module.sanitize_markdown(dirty)
    assert "<script" not in cleaned and "<iframe" not in cleaned
    assert "Hello" in cleaned and "end." in cleaned

    with pytest.raises(ValueError):
        devto_module.validate_article("Title", "Body", [], "https://example.com/stolen")
    with pytest.raises(ValueError):
        devto_module.validate_article("Title", "   ", [], "https://leonlins.com/writing/x/")
    with pytest.raises(ValueError):
        devto_module.validate_article("Title", "Body", ["a", "b", "c", "d", "e"], "https://leonlins.com/writing/x/")
    assert devto_module.validate_article("Title", "Body", ["a"], "https://leonlins.com/writing/x/") == "Body"


# --- Farcaster ---------------------------------------------------------------

def test_farcaster_uses_deterministic_idempotency_key(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    captured = {}

    def fake_farcaster(text, idempotency_key=None):
        captured.update(text=text, idempotency_key=idempotency_key)
        return PublishResult("farcaster", remote_id="0xcast")

    farcaster = _fake_module(post_to_farcaster=fake_farcaster)
    monkeypatch.setattr(auto_post, "_summarize", lambda post: {"teaser": "Hook", "points": ["Point one"]})
    _drive_main(monkeypatch, _post(evergreen=True), ["farcaster"], {"scripts.automation.publishers.farcaster": farcaster}, mode="evergreen", post_mode="thread")

    auto_post.main()

    expected = sha256("post:farcaster:evergreen".encode()).hexdigest()[:16]
    assert captured["idempotency_key"] == expected
    assert state_manager.get_platform_state("post", "farcaster")["remote_id"] == "0xcast"


def test_farcaster_validates_cast_before_submission(monkeypatch):
    from scripts.automation.publishers import farcaster as farcaster_module

    with pytest.raises(ValueError):
        farcaster_module.validate_cast("x" * 321)
    with pytest.raises(ValueError):
        farcaster_module.validate_cast("   ")
    farcaster_module.validate_cast("x" * 320)

    monkeypatch.setenv("NEYNAR_API_KEY", "key")
    monkeypatch.setenv("NEYNAR_SIGNER_UUID", "uuid")
    calls = []
    monkeypatch.setattr(farcaster_module.requests, "post", lambda *a, **k: calls.append(k) or SimpleNamespace(status_code=200, json=lambda: {"cast": {"hash": "0x1"}}))
    result = farcaster_module.post_to_farcaster("Hello Farcaster", idempotency_key="abc123")
    assert result.remote_id == "0x1"
    assert calls[0]["json"]["idem"] == "abc123"
    assert not calls[0]["json"].get("text", "") == ""


def test_farcaster_requires_cast_hash(monkeypatch):
    from scripts.automation.publishers import farcaster as farcaster_module

    monkeypatch.setenv("NEYNAR_API_KEY", "key")
    monkeypatch.setenv("NEYNAR_SIGNER_UUID", "uuid")
    monkeypatch.setattr(farcaster_module.requests, "post", lambda *a, **k: SimpleNamespace(status_code=200, json=lambda: {"cast": {}}))
    with pytest.raises(RuntimeError, match="cast hash"):
        farcaster_module.post_to_farcaster("Hello")


# --- Mastodon ----------------------------------------------------------------

def test_mastodon_prefers_one_suitable_post(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    singles, threads = [], []
    mastodon = _fake_module(
        post_single_to_mastodon=lambda text, idempotency_key=None: singles.append(text) or {"id": "m-1", "url": "https://mastodon/x"},
        post_thread_to_mastodon=lambda posts, idempotency_key=None: threads.append(posts) or [{"id": "m-1"}],
    )
    monkeypatch.setattr(auto_post, "_summarize", lambda post: {"teaser": "Hook", "points": ["Point one", "Point two", "Point three"]})
    _drive_main(monkeypatch, _post(), ["mastodon"], {"scripts.automation.publishers.mastodon": mastodon}, post_mode="thread")

    auto_post.main()

    assert threads == []  # one suitable post, not a blind thread copy
    assert len(singles) == 1
    assert len(singles[0]) <= 500
    assert "https://leonlins.com/writing/sample/" in singles[0]


def test_mastodon_rendering_is_platform_appropriate():
    post = SocialPost("Hook", "Body text here.", "https://leonlins.com/writing/x/", ("Hook", "Point one", "Point two"))
    rendered = render_mastodon(post)
    assert len(rendered) == 1
    assert len(rendered[0]) <= 500
    assert rendered[0] != "\n".join(render_thread(post)) or len(render_thread(post)) == 1
    long_post = SocialPost("H" * 100, "B" * 2000, "https://leonlins.com/writing/x/", ())
    assert len(render_mastodon(long_post)[0]) <= 500
    assert render_mastodon(long_post)[0].endswith("https://leonlins.com/writing/x/")


def test_mastodon_thread_verifies_once_and_chains_replies(monkeypatch):
    import scripts.automation.publishers.mastodon as mastodon_module

    monkeypatch.setenv("MASTODON_INSTANCE", "https://mastodon.test")
    monkeypatch.setenv("MASTODON_ACCESS_TOKEN", "token")
    verify_calls, posts, keys = [], [], []

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload
            self.text = ""
        def json(self):
            return self._payload

    created = []

    def fake_get(url, headers=None, timeout=None):
        verify_calls.append(url)
        return FakeResponse(200, {"username": "leon", "acct": "leon"})

    def fake_post(url, headers=None, json=None, timeout=None):
        posts.append(json)
        keys.append((headers or {}).get("Idempotency-Key"))
        created.append({"id": f"m-{len(created)}", "url": f"https://mastodon.test/{len(created)}"})
        return FakeResponse(200, created[-1])

    monkeypatch.setattr(mastodon_module.requests, "get", fake_get)
    monkeypatch.setattr(mastodon_module.requests, "post", fake_post)

    results = mastodon_module.post_thread_to_mastodon(["one", "two"], idempotency_key="run-1")

    assert len(verify_calls) == 1  # single auth check for the whole thread
    assert [p.get("in_reply_to_id") for p in posts] == [None, "m-0"]
    assert keys == ["run-1:0", "run-1:1"]
    assert [r["id"] for r in results] == ["m-0", "m-1"]

    with pytest.raises(ValueError):
        mastodon_module.post_single_to_mastodon("x" * 501)


# --- Search-index fetch ------------------------------------------------------

def test_search_index_request_identifies_itself(monkeypatch):
    from scripts.automation import fetch_post as fetch_post_module

    seen = {}

    class FakeResponse:
        status = 200
        def __init__(self, payload):
            self._payload = payload
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def read(self):
            import json as json_module
            return json_module.dumps(self._payload).encode()

    import json as json_module

    def fake_urlopen(request, timeout=None):
        seen.update(request.header_items())
        if "localhost" in request.full_url:
            raise Exception("no dev server")
        return FakeResponse([{"id": "a", "title": "T", "url": "/writing/a/", "content": "x"}])

    monkeypatch.setattr(fetch_post_module, "urlopen", fake_urlopen)
    data = fetch_post_module.load_search_index()

    assert data and data[0]["id"] == "a"
    user_agent = seen.get("User-agent") or seen.get("User-Agent")
    assert user_agent and "Python-urllib" not in user_agent
    assert "avoid-boring-people" in user_agent


# --- Publisher constraints ----------------------------------------------------

def test_platform_constraints_reject_before_submission(monkeypatch):
    import types as stdlib_types

    tweepy_stub = stdlib_types.ModuleType("tweepy")
    monkeypatch.setitem(sys.modules, "tweepy", tweepy_stub)
    import scripts.automation.publishers.twitter as twitter_module

    class FakeClient:
        def __init__(self):
            self.calls = []
        def create_tweet(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(data={"id": f"t-{len(self.calls)}"})

    client = FakeClient()
    with pytest.raises(ValueError):
        twitter_module.post_thread(client, ["ok", "x" * 281])
    assert client.calls == []  # nothing submitted when any tweet is invalid
    assert len(twitter_module.post_thread(client, ["one", "two"]) or []) == 2

    atproto_stub = stdlib_types.ModuleType("atproto")
    atproto_stub.Client = object
    atproto_stub.models = SimpleNamespace()
    monkeypatch.setitem(sys.modules, "atproto", atproto_stub)
    import scripts.automation.publishers.bluesky as bluesky_module

    with pytest.raises(ValueError):
        bluesky_module.post_single_to_bluesky("x" * 301)


def test_local_summarizer_truncates_at_a_word_boundary():
    """USE_LLM is unset locally, so the stub summarizer shapes local dry runs."""
    from scripts.automation.summarizers import summarizer_stub

    words = [f"segment{index:02d}" for index in range(60)]
    text = summarizer_stub.truncate_to_tweet_limit(" ".join(words), 100)

    assert len(text) <= 100
    assert text.endswith("…")
    assert text[:-1].rstrip().split()[-1] in words


def test_summary_generated_once_then_rendered_per_platform(monkeypatch, tmp_path):
    _use_temp_state(monkeypatch, tmp_path)
    summaries = []
    monkeypatch.setattr(auto_post, "_summarize", lambda post: summaries.append(post["id"]) or {"teaser": "Hook", "points": ["P1", "P2"]})
    twitter = _fake_module(get_twitter_client=lambda: object(), post_single=lambda c, p: {"id": "t"}, post_thread=lambda c, t: [{"id": "t"}])
    bluesky = _fake_module(post_single_to_bluesky=lambda text: {"uri": "at://x"}, post_thread_to_bluesky=lambda posts: [{"uri": "at://x"}])
    _drive_main(monkeypatch, _post(), ["twitter", "bluesky"], {"scripts.automation.publishers": twitter, "scripts.automation.publishers.bluesky": bluesky}, post_mode="thread")

    auto_post.main()

    assert summaries == ["post"]


def test_deferred_platforms_are_manual_only_in_production_workflows():
    """Deferred providers stay reachable only through an explicit manual run.

    The manual `platforms` input is validated against a workflow allowlist, so
    deferred names legitimately appear there; what must never happen is an
    unattended run *selecting* them. The scheduled workflow has no manual
    override, and `DEFAULT_PLATFORMS` is the only automatic path.
    """
    root = Path(__file__).resolve().parent.parent
    new = (root / ".github" / "workflows" / "social-new.yml").read_text(encoding="utf-8").lower()
    evergreen = (root / ".github" / "workflows" / "social-evergreen.yml").read_text(encoding="utf-8").lower()

    for token in ("reddit", "linkedin", "publish0x"):
        assert token not in evergreen, f"social-evergreen.yml must not reference deferred platform {token}"
    assert "inputs.platforms" not in evergreen, "the scheduled workflow must not offer a platform override"

    allowlist = new.split("allowed=", 1)[1].splitlines()[0]
    assert "threads" in allowlist
    assert 'if [ -n "${{ inputs.platforms }}" ]' in new, "the allowlist must only apply to manual runs"

    assert "threads" in PLATFORMS
    assert "threads" not in DEFAULT_PLATFORMS
