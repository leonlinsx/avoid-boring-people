"""Wait for a push-triggered deployment before acting on the new article.

`social-new.yml` runs on the same push that triggers the Vercel deployment, but
the distribution code reads the article from the deployed `/search-index.json`.
A fixed sleep was used to bridge that gap: it cannot tell whether the deployment
finished, whether it failed, or whether it is still serving an older build, and
it spent the same minute regardless of how fast the deploy was.

This polls the deployed search index (the automation's canonical source for
content ids and their public URLs) until every requested article is present and
its page answers 200, then reports the resolved ids and URLs. It gives up loudly
after a bounded wait, so a deployment that never lands fails this step with a
`::error::` annotation instead of letting `auto_post` reject the post later.
"""

import argparse
import sys
import time
from typing import Callable, Dict, Iterable, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from scripts.automation.fetch_post import (
    SITE_URL,
    SEARCH_INDEX_USER_AGENT,
    fetch_index_json,
    normalize_posts,
)

DEFAULT_TIMEOUT_SECONDS = 600
DEFAULT_INTERVAL_SECONDS = 15

# `git diff --name-only` reports repository paths; search index ids are the same
# paths relative to the content directory (`2016_03_17_excel/index.md`).
CONTENT_DIR_PREFIX = "src/content/blog/"


class DeployTimeout(RuntimeError):
    """The deployment did not serve the requested articles in time."""


def normalize_post_id(raw: str) -> str:
    """Accept a search index id or a repository path and return the index id."""
    candidate = (raw or "").strip().lstrip("./")
    if candidate.startswith(CONTENT_DIR_PREFIX):
        candidate = candidate[len(CONTENT_DIR_PREFIX):]
    return candidate


def read_post_ids(path: str) -> List[str]:
    """Read one post id per line from a file, ignoring blank lines."""
    with open(path, "r", encoding="utf-8") as handle:
        return [normalize_post_id(line) for line in handle if line.strip()]


def fetch_deployed_posts(site_url: str) -> List[Dict]:
    """Read the posts served by a specific deployment, without local fallback."""
    return normalize_posts(fetch_index_json(f"{site_url}/search-index.json"))


def url_is_live(url: str, timeout: int = 15) -> bool:
    """Return True when the deployed page answers 200."""
    request = Request(
        url,
        headers={
            "Cache-Control": "no-cache",
            "User-Agent": SEARCH_INDEX_USER_AGENT,
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status == 200
    except (HTTPError, URLError, TimeoutError):
        return False


def wait_for_post_urls(
    post_ids: Iterable[str],
    *,
    site_url: str = SITE_URL,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    interval: int = DEFAULT_INTERVAL_SECONDS,
    fetch: Callable[[str], List[Dict]] = fetch_deployed_posts,
    is_live: Callable[[str], bool] = url_is_live,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
    log: Callable[[str], None] = print,
) -> Dict[str, str]:
    """Return `{post id: deployed url}` once every article is live.

    Raises DeployTimeout with the still-missing ids when the deadline passes.
    """
    wanted: List[str] = []
    for raw in post_ids:
        candidate = normalize_post_id(raw)
        if candidate and candidate not in wanted:
            wanted.append(candidate)

    if not wanted:
        log("No articles to wait for; nothing to do.")
        return {}

    deadline = monotonic() + timeout
    attempt = 0
    last_error = None

    while True:
        attempt += 1
        missing = list(wanted)
        try:
            posts = fetch(site_url)
            by_id = {post.get("id"): post.get("url") for post in posts if post.get("id")}
            missing = [post_id for post_id in wanted if not by_id.get(post_id)]
            if not missing:
                # The index can be served before every page is reachable, so a
                # resolved id is confirmed against the live page before we act.
                missing = [post_id for post_id in wanted if not is_live(by_id[post_id])]
            if not missing:
                urls = {post_id: by_id[post_id] for post_id in wanted}
                log(f"✅ Deployment is serving {len(urls)} article(s) after {attempt} check(s).")
                return urls
            last_error = None
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            # A deployment in flight can answer 404 or a partial body; retry.
            missing = list(wanted)
            last_error = error

        if monotonic() >= deadline:
            detail = [f"Deployment is not serving these articles after {timeout}s:"]
            detail += [f"  - {post_id}" for post_id in missing]
            detail.append(f"Checked {site_url}/search-index.json {attempt} time(s).")
            if last_error is not None:
                detail.append(f"Last index read failed with: {last_error}")
            detail.append(
                "Re-run this workflow with workflow_dispatch once the deployment is healthy."
            )
            raise DeployTimeout("\n".join(detail))

        log(
            f"⏳ Waiting for the deployment to serve {len(missing)} article(s): "
            f"{', '.join(missing)} (check {attempt})"
        )
        sleep(min(interval, max(0.0, deadline - monotonic())))


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--post-id", action="append", default=[], help="content id or repository path")
    parser.add_argument("--post-id-file", help="file with one content id or repository path per line")
    parser.add_argument("--urls-file", help="write resolved '<id>\\t<url>' lines to this file")
    parser.add_argument("--site-url", default=SITE_URL, help=f"deployed site origin (default {SITE_URL})")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL_SECONDS)
    args = parser.parse_args(argv)

    post_ids = list(args.post_id)
    if args.post_id_file:
        try:
            post_ids += read_post_ids(args.post_id_file)
        except OSError as error:
            print(f"::error::Could not read --post-id-file {args.post_id_file}: {error}")
            return 1

    try:
        urls = wait_for_post_urls(
            post_ids,
            site_url=args.site_url,
            timeout=args.timeout,
            interval=args.interval,
        )
    except DeployTimeout as error:
        # A deployment that never arrives is an operator problem: surface it as
        # one GitHub error annotation so the failure is actionable.
        print(f"::error::{str(error).replace(chr(10), '%0A')}")
        return 1

    for post_id, url in urls.items():
        print(f"   {post_id} -> {url}")

    if args.urls_file:
        with open(args.urls_file, "w", encoding="utf-8") as handle:
            for post_id, url in urls.items():
                handle.write(f"{post_id}\t{url}\n")
        print(f"Wrote {len(urls)} resolved URL(s) to {args.urls_file}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
