"""`scripts/link-report.js` internal mode used to treat absolute same-site URLs
as external and skip them, so a link to a 404 such as
https://leonlins.com/writing/2020_12_02_kelly/ could pass CI. These tests pin
the rewrite/skip policy the checker now relies on: leonlins.com and
www.leonlins.com are rewritten onto the local static server and checked, while
genuinely external hosts stay out of the deterministic internal gate.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

SNIPPET = """
import {
  isInternalLink,
  localOrigin,
  shouldSkipLink,
  urlRewriteExpressions,
} from './scripts/lib/link-policy.mjs';

const legacy = 'https://leonlins.com/writing/2020_12_02_kelly/';
const rewrites = urlRewriteExpressions(4321);
const rewrite = (href) =>
  rewrites.reduce((value, exp) => value.replace(exp.pattern, exp.replacement), href);

console.log(JSON.stringify({
  local: localOrigin(4321),
  rewritten: {
    apex: rewrite(legacy),
    www: rewrite('https://www.leonlins.com/writing/kelly/'),
    httpApex: rewrite('http://leonlins.com/writing/kelly'),
    external: rewrite('https://example.com/writing/kelly/'),
    relative: rewrite('/writing/kelly/'),
  },
  internal: {
    apex: isInternalLink(legacy),
    www: isInternalLink('https://www.leonlins.com/writing/kelly/'),
    localhost: isInternalLink('http://localhost:4321/writing/kelly'),
    external: isInternalLink('https://example.com/writing/kelly/'),
    relative: isInternalLink('/writing/kelly'),
  },
  skip: {
    externalDuringInternal: shouldSkipLink('https://example.com/writing/kelly/', 'internal'),
    apexDuringInternal: shouldSkipLink(legacy, 'internal'),
    rewrittenDuringInternal: shouldSkipLink(rewrite(legacy), 'internal'),
    externalDuringExternal: shouldSkipLink('https://example.com/writing/kelly/', 'external'),
    apexDuringExternal: shouldSkipLink(legacy, 'external'),
    missingArticle: shouldSkipLink(
      'http://localhost:4321/writing/2019_01_01_nonexistent/',
      'internal',
    ),
    missingArticleAbsolute: shouldSkipLink(
      'https://leonlins.com/writing/2019_01_01_nonexistent/',
      'internal',
    ),
  },
}));
"""


@pytest.fixture(scope="module")
def policy() -> dict:
    node = shutil.which("node")
    if node is None:  # pragma: no cover - Node is a build prerequisite
        pytest.skip("node is not installed")

    result = subprocess.run(
        [node, "--input-type=module", "-e", SNIPPET],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_same_site_absolute_urls_are_internal(policy):
    assert policy["internal"]["apex"] is True
    assert policy["internal"]["www"] is True
    assert policy["internal"]["localhost"] is True
    assert policy["internal"]["external"] is False
    assert policy["internal"]["relative"] is False


def test_same_site_urls_are_rewritten_to_the_local_server(policy):
    local = policy["local"]
    assert local == "http://localhost:4321"

    # The legacy URL that shipped a 404 has to become checkable, not skipped.
    assert policy["rewritten"]["apex"] == f"{local}/writing/2020_12_02_kelly/"
    assert policy["rewritten"]["www"] == f"{local}/writing/kelly/"
    assert policy["rewritten"]["httpApex"] == f"{local}/writing/kelly"


def test_external_and_relative_urls_are_not_rewritten(policy):
    assert (
        policy["rewritten"]["external"] == "https://example.com/writing/kelly/"
    )
    assert policy["rewritten"]["relative"] == "/writing/kelly/"


def test_internal_gate_skips_only_external_hosts(policy):
    assert policy["skip"]["externalDuringInternal"] is True
    assert policy["skip"]["apexDuringInternal"] is False
    assert policy["skip"]["rewrittenDuringInternal"] is False


def test_external_mode_checks_every_host(policy):
    assert policy["skip"]["externalDuringExternal"] is False
    assert policy["skip"]["apexDuringExternal"] is False


def test_missing_article_urls_stay_checkable(policy):
    # Real same-site article URLs must stay checkable, including ones that
    # currently 404, so a regression is caught rather than skipped.
    assert policy["skip"]["missingArticle"] is False
    assert policy["skip"]["missingArticleAbsolute"] is False
