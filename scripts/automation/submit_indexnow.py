"""Submit changed article URLs to IndexNow, and refuse to submit blind.

Google's and Bing's sitemap ping endpoints are retired, so the old
`ping-search-engines.yml` job was green while achieving nothing. IndexNow is the
remaining supported push mechanism (Bing, Yandex, Seznam, Naver); Google has no
replacement and relies on the sitemap plus Search Console.

IndexNow only accepts URLs for a host whose key file is publicly served at the
key location. Submitting anyway would look like spam and, on a mismatch, earn a
403/422 for the whole batch. So this verifies the live key file first and fails
loudly when the endpoint answers with anything unexpected.
"""

import argparse
import json
import re
import sys
from typing import Dict, Iterable, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from scripts.automation.fetch_post import SEARCH_INDEX_USER_AGENT, SITE_URL

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

# IndexNow accepts 8-128 characters, limited to the key alphabet.
KEY_PATTERN = re.compile(r"^[a-zA-Z0-9-]{8,128}$")

# 200: accepted. 202: accepted, key validation still pending.
ACCEPTED_STATUSES = (200, 202)

STATUS_MEANINGS = {
    400: "the request format was invalid",
    403: "the key is not valid for this host (is the key file deployed?)",
    422: "the URLs do not belong to the host, or the key does not match it",
    429: "too many submissions; wait before retrying",
}


def read_key(key_file: str) -> str:
    """Read and validate the IndexNow key from its key file."""
    with open(key_file, "r", encoding="utf-8") as handle:
        key = handle.read().strip()
    if not KEY_PATTERN.match(key):
        raise ValueError(f"IndexNow key in {key_file} must be 8-128 characters of [a-zA-Z0-9-]")
    return key


def read_urls(path: str) -> List[str]:
    """Read URLs from a plain list or from `wait_for_deploy`'s TSV output."""
    urls = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            fields = line.split()
            if fields:
                urls.append(fields[-1])
    return urls


def key_location_for(host: str, key: str) -> str:
    return f"https://{host}/{key}.txt"


def build_payload(host: str, key: str, urls: Iterable[str]) -> Dict:
    """Build the IndexNow request body, rejecting URLs that belong to another host."""
    url_list = []
    for url in urls:
        if not url.startswith(f"https://{host}/"):
            raise ValueError(f"URL {url!r} does not belong to host {host}")
        if url not in url_list:
            url_list.append(url)

    if not url_list:
        raise ValueError("no URLs to submit")

    return {
        "host": host,
        "key": key,
        "keyLocation": key_location_for(host, key),
        "urlList": url_list,
    }


def verify_key_location(key_location: str, key: str, *, timeout: int = 15) -> None:
    """Require the deployed key file to serve exactly the key before submitting."""
    request = Request(
        key_location,
        headers={"Cache-Control": "no-cache", "User-Agent": SEARCH_INDEX_USER_AGENT},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            served = response.read().decode("utf-8", "replace").strip()
            status = response.status
    except (HTTPError, URLError, TimeoutError) as error:
        raise RuntimeError(
            f"IndexNow key file {key_location} is not reachable ({error}); "
            "deploy it before submitting URLs."
        ) from error

    if status != 200:
        raise RuntimeError(f"IndexNow key file {key_location} returned HTTP {status}.")
    if served != key:
        raise RuntimeError(
            f"IndexNow key file {key_location} does not serve the configured key; "
            "the host would reject every submitted URL."
        )


def submit(payload: Dict, *, endpoint: str = INDEXNOW_ENDPOINT, timeout: int = 30) -> int:
    """POST one batch to IndexNow and return the accepted status code."""
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": SEARCH_INDEX_USER_AGENT,
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.status
    except HTTPError as error:
        meaning = STATUS_MEANINGS.get(error.code, "unexpected response")
        raise RuntimeError(f"IndexNow rejected the submission with HTTP {error.code}: {meaning}") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"IndexNow submission failed: {error}") from error

    if status not in ACCEPTED_STATUSES:
        raise RuntimeError(f"IndexNow answered HTTP {status}, which is not an accepted submission.")

    return status


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key-file", required=True, help="deployed key file, e.g. public/<key>.txt")
    parser.add_argument("--host", default=SITE_URL.removeprefix("https://"))
    parser.add_argument("--url", action="append", default=[], help="URL to submit (repeatable)")
    parser.add_argument("--urls-file", help="file with URLs, or wait_for_deploy's '<id>\\t<url>' output")
    parser.add_argument("--endpoint", default=INDEXNOW_ENDPOINT)
    parser.add_argument("--dry-run", action="store_true", help="verify the key file and print the payload")
    args = parser.parse_args(argv)

    urls = list(args.url)
    if args.urls_file:
        try:
            urls += read_urls(args.urls_file)
        except OSError as error:
            print(f"::error::Could not read --urls-file {args.urls_file}: {error}")
            return 1

    try:
        key = read_key(args.key_file)
        payload = build_payload(args.host, key, urls)
        verify_key_location(payload["keyLocation"], key)
        if args.dry_run:
            print(f"Key file {payload['keyLocation']} is live; would submit:")
            print(json.dumps(payload, indent=2))
            return 0
        status = submit(payload, endpoint=args.endpoint)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"::error::{error}")
        return 1

    print(f"✅ IndexNow accepted {len(payload['urlList'])} URL(s) with HTTP {status} for {args.host}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
