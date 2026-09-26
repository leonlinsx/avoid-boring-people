"""Tests for the sender-only outbound Webmention flow."""

import pytest

from scripts.automation import send_webmentions as wm

SOURCE = "https://leonlins.com/writing/kelly"
TARGET = "https://example.blog/posts/kelly-criterion"


def _article_html(*links):
    anchors = "\n".join(f'<p><a href="{link}">read more</a></p>' for link in links)
    return (
        "<html><body>"
        "<header><a href='https://external.example/nav'>nav</a></header>"
        f"<article><h1>Kelly</h1>{anchors}</article>"
        "<footer><a href='https://external.example/footer'>footer</a></footer>"
        "</body></html>"
    )


class _FakeHeaders(dict):
    def get_all(self, name, default=None):
        for key, value in self.items():
            if key.lower() == name.lower():
                return [value] if isinstance(value, str) else list(value)
        return default


def _run_article(monkeypatch, html, *, targets=None, endpoints=None, post_ok=True):
    """Drive process_article with a canned article fetch and discovery map."""
    endpoints = endpoints or {}

    def fake_get(url, **kwargs):
        if url == SOURCE:
            return SOURCE, _FakeHeaders(), html.encode("utf-8")
        if targets is not None and url in targets:
            return targets[url]
        raise AssertionError(f"unexpected fetch of {url}")

    posts = []

    def fake_post(endpoint, data):
        posts.append((endpoint, data))
        return post_ok

    monkeypatch.setattr(wm, "http_get", fake_get)
    monkeypatch.setattr(wm, "http_post", fake_post)
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    monkeypatch.setattr(
        wm, "discover_endpoint", lambda target: endpoints.get(target)
    )
    result = wm.process_article(SOURCE)
    return result, posts


# --- external-link filtering / deduplication ----------------------------------

def test_only_article_links_are_collected_not_site_chrome():
    targets = wm.extract_targets(
        _article_html(TARGET, "https://leonlins.com/writing/other"),
        SOURCE,
    )
    assert targets == [TARGET]


def test_main_scoping_applies_without_an_article_element():
    html = (
        "<html><body>"
        "<nav><a href='https://external.example/nav'>nav</a></nav>"
        "<main><a href='https://external.example/essay'>essay</a></main>"
        "</body></html>"
    )
    assert wm.extract_targets(html, SOURCE) == ["https://external.example/essay"]


def test_internal_non_http_and_asset_links_are_ignored():
    targets = wm.extract_targets(
        _article_html(
            "https://leonlins.com/writing/other",
            "https://www.leonlins.com/about",
            "/writing/kelly#section",
            "mailto:someone@example.com",
            "tel:+123456",
            "https://cdn.example/hero.PNG?width=800",
            "https://cdn.example/app.js",
            "https://fonts.example/face.woff2",
            "https://media.example/clip.mp4",
        ),
        SOURCE,
    )
    assert targets == []


def test_targets_are_deduplicated_and_fragments_stripped():
    first = "https://external.example/essay#part-1"
    second = "https://external.example/essay#part-2"
    targets = wm.extract_targets(_article_html(first, second, first), SOURCE)
    assert targets == ["https://external.example/essay"]


def test_relative_article_links_resolve_against_the_final_url():
    html = "<html><body><article><a href='/posts/elsewhere'>x</a></article></body></html>"
    # A relative link on the canonical host stays internal and is skipped.
    assert wm.extract_targets(html, SOURCE) == []


# --- endpoint discovery --------------------------------------------------------

def test_link_header_endpoint_is_preferred_over_html(monkeypatch):
    headers = _FakeHeaders(
        {"Link": '</webmention-endpoint>; rel="webmention", </other>; rel="other"'}
    )
    html = (
        "<html><head>"
        '<link rel="webmention" href="/html-endpoint">'
        "</head><body></body></html>"
    )

    def fake_get(url, **kwargs):
        return url, headers, html.encode("utf-8")

    monkeypatch.setattr(wm, "http_get", fake_get)
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    assert wm.discover_endpoint(TARGET) == "https://example.blog/webmention-endpoint"


def test_html_rel_discovery_resolves_relative_endpoints(monkeypatch):
    html = (
        "<html><head>"
        '<link rel="webmention" href="/mention">'
        "</head><body></body></html>"
    )

    def fake_get(url, **kwargs):
        # The target redirects; the relative endpoint belongs to the final page.
        assert url == TARGET
        return "https://www.example.blog/post", _FakeHeaders(), html.encode()

    monkeypatch.setattr(wm, "http_get", fake_get)
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    assert wm.discover_endpoint(TARGET) == "https://www.example.blog/mention"


def test_anchor_rel_discovery_is_supported(monkeypatch):
    html = "<html><body><a rel='webmention' href='https://wm.example/inbox'>m</a></body></html>"
    monkeypatch.setattr(
        wm, "http_get", lambda url, **kwargs: (url, _FakeHeaders(), html.encode())
    )
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    assert wm.discover_endpoint(TARGET) == "https://wm.example/inbox"


def test_missing_endpoint_means_unsupported_not_failure(monkeypatch):
    monkeypatch.setattr(
        wm, "http_get", lambda url, **kwargs: (url, _FakeHeaders(), b"<html></html>")
    )
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    assert wm.discover_endpoint(TARGET) is None


# --- delivery ------------------------------------------------------------------

def test_successful_send_posts_source_and_target_as_form_data(monkeypatch):
    from urllib.parse import parse_qs

    result, posts = _run_article(
        monkeypatch,
        _article_html(TARGET),
        endpoints={TARGET: "https://example.blog/webmention"},
    )
    assert [entry["target"] for entry in result["sent"]] == [TARGET]
    assert result["failed"] == [] and result["unsupported"] == []
    assert len(posts) == 1
    endpoint, body = posts[0]
    assert endpoint == "https://example.blog/webmention"
    fields = parse_qs(body.decode("ascii"))
    assert fields == {"source": [SOURCE], "target": [TARGET]}


def test_non_2xx_delivery_is_a_recorded_failure(monkeypatch):
    result, _ = _run_article(
        monkeypatch,
        _article_html(TARGET),
        endpoints={TARGET: "https://example.blog/webmention"},
        post_ok=False,
    )
    assert result["sent"] == []
    assert [entry["target"] for entry in result["failed"]] == [TARGET]
    assert "2xx" in result["failed"][0]["reason"]


def test_broken_target_does_not_fail_the_article(monkeypatch):
    def fail_discovery(target):
        raise wm.WebmentionError("connection refused")

    monkeypatch.setattr(
        wm, "http_get", lambda url, **kw: (SOURCE, _FakeHeaders(), _article_html(TARGET).encode())
    )
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    monkeypatch.setattr(wm, "discover_endpoint", fail_discovery)
    result = wm.process_article(SOURCE)
    assert result["failed"] and result["failed"][0]["target"] == TARGET
    assert result["sent"] == []


def test_unreachable_article_is_a_clean_skip(monkeypatch):
    def fail_get(url, **kwargs):
        raise wm.WebmentionError("deployment not serving the page yet")

    monkeypatch.setattr(wm, "http_get", fail_get)
    result = wm.process_article(SOURCE)
    assert result["error"] is not None
    assert result["sent"] == [] and result["targets"] == []


def test_main_exits_zero_with_failures_and_reports_a_summary(monkeypatch, capsys, tmp_path):
    urls_file = tmp_path / "urls.tsv"
    urls_file.write_text(f"some-id\t{SOURCE}\n", encoding="utf-8")

    def fail_get(url, **kwargs):
        raise wm.WebmentionError("boom")

    monkeypatch.setattr(wm, "http_get", fail_get)
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: True)
    assert wm.main(["--urls-file", str(urls_file)]) == 0
    out = capsys.readouterr().out
    assert "### Webmentions" in out
    assert SOURCE in out


def test_main_without_articles_is_a_noop(monkeypatch, capsys):
    assert wm.main([]) == 0
    assert "No articles to mention from" in capsys.readouterr().out


# --- private / local target rejection ------------------------------------------

PRIVATE_HOSTS = {
    "localhost": ["127.0.0.1"],
    "internal.example": ["10.1.2.3"],
    "linklocal.example": ["169.254.10.20"],
    "v6loop.example": ["::1"],
}


@pytest.mark.parametrize("hostname,ips", list(PRIVATE_HOSTS.items()))
def test_non_public_destinations_are_rejected(monkeypatch, hostname, ips):
    monkeypatch.setattr(wm, "_resolve_ips", lambda host: ips)
    assert wm.is_public_http_url(f"http://{hostname}/post") is False


def test_public_destination_passes_when_dns_resolves_globally(monkeypatch):
    monkeypatch.setattr(wm, "_resolve_ips", lambda host: ["93.184.216.34"])
    assert wm.is_public_http_url("https://example.blog/post") is True


def test_resolve_failure_is_fail_closed(monkeypatch):
    import socket

    def fail(host):
        raise socket.gaierror("no such host")

    monkeypatch.setattr(wm, "_resolve_ips", fail)
    assert wm.is_public_http_url("https://missing.invalid/post") is False


def test_private_target_is_unsupported_and_never_fetched(monkeypatch):
    fetched = []

    def fake_get(url, **kwargs):
        fetched.append(url)
        return SOURCE, _FakeHeaders(), _article_html("http://localhost:8000/post").encode()

    monkeypatch.setattr(wm, "http_get", fake_get)
    monkeypatch.setattr(wm, "is_public_http_url", lambda url: "localhost" not in url)
    result = wm.process_article(SOURCE)
    assert [entry["target"] for entry in result["unsupported"]] == ["http://localhost:8000/post"]
    assert fetched == [SOURCE]


def test_non_http_schemes_never_leave_the_process(monkeypatch):
    assert wm.is_public_http_url("file:///etc/passwd") is False
    assert wm.is_public_http_url("gopher://example.blog/1") is False
    html = (
        "<html><body><article>"
        "<a href='file:///etc/passwd'>x</a>"
        "<a href='javascript:alert(1)'>y</a>"
        "</article></body></html>"
    )
    assert wm.extract_targets(html, SOURCE) == []
