"""Send outbound Webmentions for newly published or updated articles.

Sender-only: after the canonical article is live, fetch its production HTML,
collect the unique external links from the article content, discover each
target's Webmention endpoint (HTTP `Link` header or HTML `rel="webmention"`),
and POST `source=<article URL>` / `target=<linked URL>`.

Webmentions are best-effort. One broken or unsupported site never fails the run:
per-target problems are recorded as failed/unsupported and the command still
exits 0. There is no database, queue, retry system, or state file; resending
after an article update is harmless.

Outbound HTTP is kept safe: only public HTTP(S) destinations are fetched
(hostnames that resolve to localhost, private, or link-local addresses are
rejected, including on redirects), with bounded timeouts, redirect hops, and
response sizes. No credentials or cookies are ever sent.
"""

import argparse
import os
import re
import socket
import sys
from html.parser import HTMLParser
from ipaddress import ip_address
from typing import Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import (
    urldefrag,
    urlencode,
    urljoin,
    urlparse,
)
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
    urlopen,
)

from scripts.automation.fetch_post import SEARCH_INDEX_USER_AGENT, SITE_URL

REQUEST_TIMEOUT_SECONDS = 10
MAX_REDIRECTS = 5
MAX_ARTICLE_BYTES = 2 * 1024 * 1024
MAX_DISCOVERY_BYTES = 1024 * 1024
DNS_TIMEOUT_SECONDS = 10

USER_AGENT = SEARCH_INDEX_USER_AGENT

# Asset links can never carry a Webmention endpoint; skip them without a fetch.
STATIC_ASSET_EXTENSIONS = frozenset(
    {
        "png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "avif", "bmp",
        "css", "js", "mjs", "map",
        "woff", "woff2", "ttf", "otf", "eot",
        "mp4", "webm", "mov", "mp3", "wav", "ogg",
        "zip", "gz", "tar", "br",
    }
)

REDIRECT_STATUSES = (301, 302, 303, 307, 308)


class WebmentionError(RuntimeError):
    """A single fetch, discovery, or delivery step failed (fail-soft)."""


def _resolve_ips(hostname: str) -> List[str]:
    """Return the IPs a hostname resolves to, with a bounded DNS wait."""
    previous = socket.getdefaulttimeout()
    socket.setdefaulttimeout(DNS_TIMEOUT_SECONDS)
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    finally:
        socket.setdefaulttimeout(previous)
    return [info[4][0] for info in infos]


def is_public_http_url(url: str) -> bool:
    """Return True only for an http(s) URL that resolves to public addresses.

    Fail-closed: unparsable URLs, non-HTTP schemes, embedded credentials, and
    hostnames that do not resolve (or resolve to loopback, private,
    link-local, multicast, reserved, or otherwise non-global addresses) are
    rejected, so neither targets nor endpoints nor redirect hops can reach the
    local network.
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    if parsed.username or parsed.password:
        return False
    hostname = parsed.hostname
    if not hostname:
        return False
    try:
        ips = _resolve_ips(hostname)
    except (socket.gaierror, socket.herror, socket.timeout, OSError):
        return False
    if not ips:
        return False
    try:
        return all(ip_address(ip).is_global for ip in ips)
    except ValueError:
        return False


class _NoRedirect(HTTPRedirectHandler):
    """Disable automatic redirects so every hop can be validated first."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001, ANN202
        return None


def _open_noredirect(request: Request, timeout: int):
    return build_opener(_NoRedirect).open(request, timeout=timeout)


def _read_bounded(response, max_bytes: int) -> bytes:
    chunks = []
    remaining = max_bytes + 1
    while remaining > 0:
        chunk = response.read(min(65536, remaining))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    body = b"".join(chunks)
    if len(body) > max_bytes:
        raise WebmentionError(f"response exceeds the {max_bytes}-byte limit")
    return body


def http_get(url: str, *, max_bytes: int) -> Tuple[str, object, bytes]:
    """GET a public URL, following validated redirects; return (url, headers, body)."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        if not is_public_http_url(current):
            raise WebmentionError(f"refusing non-public destination: {current}")
        request = Request(
            current,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
        )
        try:
            with _open_noredirect(request, REQUEST_TIMEOUT_SECONDS) as response:
                status = response.status
                if status in REDIRECT_STATUSES:
                    location = response.headers.get("Location")
                    if not location:
                        raise WebmentionError(f"redirect without a Location from {current}")
                    current = urljoin(current, location)
                    continue
                if not 200 <= status < 300:
                    raise WebmentionError(f"GET {current} answered HTTP {status}")
                return current, response.headers, _read_bounded(response, max_bytes)
        except HTTPError as error:
            # With redirects disabled, only non-redirect errors arrive here.
            raise WebmentionError(f"GET {current} answered HTTP {error.code}") from error
        except (URLError, TimeoutError, socket.timeout, OSError) as error:
            raise WebmentionError(f"GET {current} failed: {error}") from error
    raise WebmentionError(f"too many redirects fetching {url}")


def http_post(endpoint: str, data: bytes) -> bool:
    """POST form data to a Webmention endpoint; True on any 2xx status."""
    current = endpoint
    for _ in range(MAX_REDIRECTS + 1):
        if not is_public_http_url(current):
            raise WebmentionError(f"refusing non-public endpoint: {current}")
        request = Request(
            current,
            data=data,
            method="POST",
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        try:
            with _open_noredirect(request, REQUEST_TIMEOUT_SECONDS) as response:
                status = response.status
                if status in (307, 308):
                    location = response.headers.get("Location")
                    if not location:
                        return False
                    current = urljoin(current, location)
                    continue
                return 200 <= status < 300
        except HTTPError:
            return False
        except (URLError, TimeoutError, socket.timeout, OSError):
            return False
    return False


class _ContentLinkParser(HTMLParser):
    """Collect links, preferring `<article>`, then `<main>`, over the whole page.

    Site chrome (header, footer, nav) lives outside those containers, so
    scoping to them keeps sidebar/footer links out of the mention set.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._article_depth = 0
        self._main_depth = 0
        self.saw_article = False
        self.saw_main = False
        self.article_links: List[str] = []
        self.main_links: List[str] = []
        self.all_links: List[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        name = tag.lower()
        if name == "article":
            self._article_depth += 1
            self.saw_article = True
        elif name == "main":
            self._main_depth += 1
            self.saw_main = True
        elif name == "a":
            href = dict(attrs).get("href")
            if href:
                self.all_links.append(href)
                if self._article_depth:
                    self.article_links.append(href)
                elif self._main_depth:
                    self.main_links.append(href)

    def handle_endtag(self, tag: str) -> None:
        name = tag.lower()
        if name == "article" and self._article_depth:
            self._article_depth -= 1
        elif name == "main" and self._main_depth:
            self._main_depth -= 1

    def content_links(self) -> List[str]:
        if self.saw_article:
            return self.article_links
        if self.saw_main:
            return self.main_links
        return self.all_links


def _site_host(site_url: str) -> str:
    return (urlparse(site_url).hostname or "").lower()


def _strip_www(host: str) -> str:
    return host[4:] if host.startswith("www.") else host


def normalize_target(href: str, base_url: str, site_host: str) -> Optional[str]:
    """Resolve one raw href to a canonical external target, or None to skip."""
    candidate = (href or "").strip()
    if not candidate or candidate.startswith("#"):
        return None
    resolved = urljoin(base_url, candidate)
    try:
        parsed = urlparse(resolved)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    if parsed.username or parsed.password:
        return None
    host = (parsed.hostname or "").lower()
    if not host:
        return None
    if _strip_www(host) == _strip_www(site_host):
        return None
    target, _ = urldefrag(resolved)
    path = urlparse(target).path
    extension = path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""
    if extension in STATIC_ASSET_EXTENSIONS:
        return None
    return target


def extract_targets(html: str, base_url: str, site_url: str = SITE_URL) -> List[str]:
    """Return the unique external targets linked from the article content."""
    parser = _ContentLinkParser()
    parser.feed(html)
    site_host = _site_host(site_url)
    targets: List[str] = []
    for href in parser.content_links():
        target = normalize_target(href, base_url, site_host)
        if target and target not in targets:
            targets.append(target)
    return targets


def parse_link_header(values: List[str]) -> Optional[str]:
    """Return the first webmention endpoint URI in Link header values, if any."""
    for value in values:
        # Split on commas that are not inside quotes.
        parts = re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', value)
        for part in parts:
            match = re.match(r'\s*<([^<>\s]+)>\s*(.*)', part)
            if not match:
                continue
            uri, params = match.groups()
            for param in re.split(r';(?=(?:[^"]*"[^"]*")*[^"]*$)', params):
                name, _, val = param.partition("=")
                if name.strip().lower() != "rel":
                    continue
                rels = val.strip().strip('"').lower().split()
                if "webmention" in rels:
                    return uri
    return None


class _EndpointParser(HTMLParser):
    """Find the first `<link>` or `<a>` tag whose rel includes webmention."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.endpoint: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if self.endpoint is not None:
            return
        if tag.lower() not in ("link", "a"):
            return
        data = {name.lower(): (value or "") for name, value in attrs}
        if "webmention" in data.get("rel", "").lower().split() and data.get("href"):
            self.endpoint = data["href"].strip()


def discover_endpoint(target_url: str) -> Optional[str]:
    """Return the target's validated Webmention endpoint, or None if unsupported."""
    final_url, headers, body = http_get(target_url, max_bytes=MAX_DISCOVERY_BYTES)
    link_values: List[str] = []
    get_all = getattr(headers, "get_all", None)
    if callable(get_all):
        link_values = get_all("Link", []) or []
    elif headers.get("Link"):
        link_values = [headers.get("Link")]
    raw = parse_link_header(link_values)
    if raw is None:
        parser = _EndpointParser()
        try:
            parser.feed(body.decode("utf-8", "replace"))
        except (RecursionError, MemoryError) as error:
            raise WebmentionError(f"could not parse {target_url}: {error}") from error
        raw = parser.endpoint
    if raw is None:
        return None
    # Resolve against the post-redirect URL: a relative endpoint advertised by
    # a redirecting target belongs to the final page, not the original URL.
    endpoint = urljoin(final_url, raw)
    if not is_public_http_url(endpoint):
        raise WebmentionError(f"endpoint for {target_url} is not a public URL")
    return endpoint


def deliver(source_url: str, target_url: str, endpoint: str) -> bool:
    """Send one mention; True only when the endpoint answers 2xx."""
    payload = urlencode({"source": source_url, "target": target_url}).encode("ascii")
    return http_post(endpoint, payload)


def process_article(source_url: str, *, dry_run: bool = False) -> Dict:
    """Fetch one live article and mention every supported external target."""
    result: Dict = {
        "source": source_url,
        "targets": [],
        "endpoints": {},
        "sent": [],
        "failed": [],
        "unsupported": [],
        "error": None,
    }
    try:
        final_url, _, body = http_get(source_url, max_bytes=MAX_ARTICLE_BYTES)
        html = body.decode("utf-8", "replace")
    except WebmentionError as error:
        result["error"] = str(error)
        return result
    targets = extract_targets(html, final_url)
    result["targets"] = targets
    for target in targets:
        try:
            if not is_public_http_url(target):
                result["unsupported"].append({"target": target, "reason": "non-public address"})
                continue
            endpoint = discover_endpoint(target)
        except WebmentionError as error:
            result["failed"].append({"target": target, "reason": str(error)})
            continue
        if endpoint is None:
            result["unsupported"].append({"target": target, "reason": "no webmention endpoint"})
            continue
        result["endpoints"][target] = endpoint
        if dry_run:
            result["sent"].append({"target": target, "endpoint": endpoint, "dry_run": True})
            continue
        try:
            if deliver(final_url, target, endpoint):
                result["sent"].append({"target": target, "endpoint": endpoint})
            else:
                result["failed"].append({"target": target, "reason": "endpoint did not answer 2xx"})
        except WebmentionError as error:
            result["failed"].append({"target": target, "reason": str(error)})
    return result


def read_urls(path: str) -> List[str]:
    """Read URLs from a plain list or from `wait_for_deploy`'s TSV output."""
    urls = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            fields = line.split()
            if fields:
                urls.append(fields[-1])
    return urls


def summarize(results: List[Dict]) -> str:
    """Render the concise Actions summary for a batch of articles."""
    lines = ["### Webmentions", ""]
    if not results:
        lines.append("No articles to mention from.")
        return "\n".join(lines)
    for result in results:
        if result["error"] is not None:
            lines.append(f'- {result["source"]}: skipped ({result["error"]})')
            continue
        lines.append(
            f'- {result["source"]}: {len(result["targets"])} target(s), '
            f'{len(result["endpoints"])} endpoint(s) found, '
            f'{len(result["sent"])} sent, '
            f'{len(result["failed"])} failed, '
            f'{len(result["unsupported"])} unsupported'
        )
        for entry in result["sent"]:
            lines.append(f'  - sent: {entry["target"]} via {entry["endpoint"]}')
        for entry in result["failed"]:
            lines.append(f'  - failed: {entry["target"]} ({entry["reason"]})')
        for entry in result["unsupported"]:
            lines.append(f'  - unsupported: {entry["target"]} ({entry["reason"]})')
    return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", action="append", default=[], help="deployed article URL (repeatable)")
    parser.add_argument("--urls-file", help="file with URLs, or wait_for_deploy's '<id>\\t<url>' output")
    parser.add_argument("--dry-run", action="store_true", help="discover endpoints without sending")
    args = parser.parse_args(argv)

    urls = list(args.url)
    if args.urls_file:
        try:
            urls += read_urls(args.urls_file)
        except OSError as error:
            print(f"::error::Could not read --urls-file {args.urls_file}: {error}")
            return 1

    # De-duplicate while keeping order; an empty set is a clean no-op.
    seen = set()
    sources = [url for url in urls if url not in seen and not seen.add(url)]  # type: ignore[func-returns-value]
    if not sources:
        summary = "### Webmentions\n\nNo articles to mention from."
        print(summary)
        _write_step_summary(summary)
        return 0

    results = [process_article(url, dry_run=args.dry_run) for url in sources]
    summary = summarize(results)
    print(summary)
    _write_step_summary(summary)
    # Best-effort by design: per-target failures are recorded above and never
    # fail the run, so IndexNow and the deployment stay green.
    return 0


def _write_step_summary(summary: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(summary + "\n")
    except OSError as error:
        print(f"::warning::Could not write the step summary: {error}")


if __name__ == "__main__":
    sys.exit(main())
