"""Render one article into a Medium-ready draft.

Runs offline: the canonical URL is derived from the article's content id with
the same rule the site uses (computeCleanSlug in src/utils/slug-helpers.ts), so
the snippet does not depend on a deployment being reachable. The draft is
written to stdout; the workflow captures it as a build artifact.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys

import frontmatter

from scripts.automation.summarizers import llm_summarize, stub_summarize
from scripts.automation.wait_for_deploy import normalize_post_id

SITE_URL = "https://leonlins.com"

DATED_PREFIX_RE = re.compile(r"^\d{4}_\d{2}_\d{2}_")
# Markdown links emitted by the stub summarizer keep the source markdown, e.g.
# [text](<https://example.com> 'optional title').
MARKDOWN_LINK_RE = re.compile(
    r"\[([^\]]+)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[\"'][^\"')]*[\"'])?\s*\)"
)


def derive_slug(file_path: str, explicit_slug: str | None = None) -> str:
    """Mirror computeCleanSlug() in src/utils/slug-helpers.ts.

    Accepts a content id, a repository path, or any path to an article, because
    only the last two path segments identify the article.
    """
    explicit = (explicit_slug or "").strip().strip("/")
    if explicit:
        return explicit

    raw = content_id(file_path)
    raw = re.sub(r"/index\.(md|mdx)$", "", raw, flags=re.I)
    raw = re.sub(r"\.(md|mdx)$", "", raw, flags=re.I)
    return DATED_PREFIX_RE.sub("", raw)


def content_id(file_path: str) -> str:
    """Reduce a path to the `<folder>/index.md` form the content loader uses."""
    segments = normalize_post_id(file_path).split("/")
    if len(segments) > 1 and re.match(r"index\.(md|mdx)$", segments[-1], flags=re.I):
        return "/".join(segments[-2:])
    return segments[-1]


def canonical_url(file_path: str, explicit_slug: str | None = None) -> str:
    return f"{SITE_URL}/writing/{derive_slug(file_path, explicit_slug)}/"


def render_inline_html(text: str) -> str:
    """Escape text, keeping markdown links clickable."""
    collapsed = " ".join(str(text or "").split())
    parts = []
    last = 0
    for match in MARKDOWN_LINK_RE.finditer(collapsed):
        parts.append(html.escape(collapsed[last:match.start()]))
        url = match.group(2) or match.group(3) or ""
        parts.append(
            f'<a href="{html.escape(url, quote=True)}">{html.escape(match.group(1))}</a>'
        )
        last = match.end()
    parts.append(html.escape(collapsed[last:]))
    return "".join(parts)


def render_summary_html(summary) -> str:
    """Render a summarizer result as HTML.

    Summarizers return a mapping with a teaser and bullet points; interpolating
    it directly leaked a Python dict repr into the draft.
    """
    if isinstance(summary, str):
        teaser, points = summary, []
    else:
        teaser = str(summary.get("teaser") or "")
        points = [str(point) for point in summary.get("points") or [] if point]

    lines = ["<h3>Summary</h3>", f"<p>{render_inline_html(teaser)}</p>"]
    rendered_points = [point for point in map(render_inline_html, points) if point]
    if rendered_points:
        lines.append("<ul>")
        lines.extend(f"  <li>{point}</li>" for point in rendered_points)
        lines.append("</ul>")
    return "\n".join(lines)


def render_draft(title, description, tags, article_url, summary) -> str:
    metadata = [
        f"Title: {title}",
        f"Description: {description}",
        f"Tags: {', '.join(tags) if tags else 'None'}",
        f"Canonical URL: {article_url}",
    ]
    lines = ["<!--"]
    # An HTML comment cannot contain a double hyphen, so strip them rather than
    # emit broken markup.
    lines.extend(line.replace("--", "-") for line in metadata)
    lines.append("-->")
    lines.append(render_summary_html(summary))
    lines.append(
        f'<p>👉 <a href="{html.escape(article_url, quote=True)}">Read the full post here</a></p>'
    )
    return "\n".join(lines) + "\n"


def prepare_medium_post(file_path: str, dry_run: bool = True) -> str:
    """Return the Medium-ready draft for one article."""
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Article not found: {file_path}")

    post = frontmatter.load(file_path)
    title = str(post.get("title") or "Untitled")
    description = str(post.get("description") or "")
    # Medium allows max 5 tags.
    tags = [str(tag) for tag in list(post.get("tags") or [])[:5]]

    post_dict = {"content": post.content}
    summary = (
        stub_summarize(post_dict) if dry_run else llm_summarize(post_dict, max_words=250)
    )

    return render_draft(
        title,
        description,
        tags,
        canonical_url(file_path, post.get("slug")),
        summary,
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Render a Medium-ready draft for one article."
    )
    parser.add_argument(
        "path", help="Article path, e.g. src/content/blog/2017_02_23_random/index.md"
    )
    args = parser.parse_args(argv)

    dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
    try:
        draft = prepare_medium_post(args.path, dry_run=dry_run)
    except FileNotFoundError as error:
        print(f"::error::{error}")
        return 1

    sys.stdout.write(draft)
    return 0


if __name__ == "__main__":
    sys.exit(main())
