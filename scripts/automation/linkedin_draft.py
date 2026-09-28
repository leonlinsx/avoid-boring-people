"""One source-faithful LinkedIn draft for manual review and posting."""
from __future__ import annotations

import re
from textwrap import dedent
from urllib.parse import parse_qs, urlsplit

from scripts.automation.attribution import tagged_url
from scripts.automation.summarizers.llm_summarizer import (
    MAX_ARTICLE_CHARS, SocialCopyError, _format_publication_date, complete_json,
)

URL_RE = re.compile(r"(?:https?://|www\.)\S+|\b[\w.-]+\.(?:com|org|net|io|edu|gov|co)\b(?:/\S*)?", re.IGNORECASE)
MARKDOWN_RE = re.compile(r"(?m)^\s*(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s)|\*\*|__|`|(?<!\w)[*_][^*_\n]+[*_]|!?\[[^\]\n]*\]\(")
OPENING_RE = re.compile(
    r"^(?:i (?:wrote|published|posted)|my (?:new|latest) (?:article|post|piece)|"
    r"(?:new|latest) (?:article|post|piece)|check out|you won't believe|"
    r"this changes everything|here (?:are|is) (?:my|the) \d+|"
    r"(?:this article|this essay|this post|the author|the writer)\b)", re.I,
)
ENDING_RE = re.compile(r"(?:agree\??|thoughts\??|what do you think\??|let me know|comment below)\s*[.!?]?\s*$", re.I)
GENERIC_CTA_RE = re.compile(r"\b(?:i (?:explore|examine|discuss) (?:this|it|the implications|that mechanism) further|read the full article|linked (?:post|piece)|the full article details)\b", re.I)
META_CTA_RE = re.compile(r"\b(?:the (?:analysis|study|article|essay|full text)|this (?:analysis|article|essay|piece))\s+(?:explores|examines|discusses|covers|delves into)\b", re.I)


def validate_linkedin_draft(body: str, post: dict) -> str:
    """Validate model prose, then attach the one canonical tagged URL ourselves."""
    if not isinstance(body, str) or not body.strip():
        raise SocialCopyError("LinkedIn draft is empty")
    body = body.strip()
    paragraphs = re.split(r"\n\s*\n", body)
    words = re.findall(r"\b[\w’'-]+\b", body)
    problems = []
    if len(paragraphs) != 3 or any("\n" in p for p in paragraphs):
        problems.append("expected three ordinary prose paragraphs")
    if not 75 <= len(words) <= 240:
        problems.append("word count outside 75–240")
    if URL_RE.search(body):
        problems.append("model copy contains a URL")
    if "#" in body:
        problems.append("hashtags or hash markers")
    if MARKDOWN_RE.search(body):
        problems.append("markdown")
    if OPENING_RE.search(paragraphs[0].strip()):
        problems.append("generic promotional opening")
    if re.search(r"\bthe author\b", body, re.I):
        problems.append("outside-author voice")
    if ENDING_RE.search(body):
        problems.append("engagement-bait ending")
    if META_CTA_RE.search(paragraphs[-1]) or GENERIC_CTA_RE.search(paragraphs[-1]):
        problems.append("generic outside-summary CTA")
    normalized = [re.sub(r"\W+", "", p).casefold() for p in paragraphs]
    if len(normalized) != len(set(normalized)):
        problems.append("duplicated paragraphs")
    if any(not re.search(r"[.!?:”’]$", p.strip()) or p.strip().endswith(("…", "...")) for p in paragraphs):
        problems.append("incomplete or truncated paragraph")
    # Taxonomy labels are index metadata, not prose or LinkedIn topic tags.
    taxonomy = [str(post.get("category") or ""), *(str(t) for t in post.get("tags", []))]
    if any(label and re.search(rf"(?im)^\s*(?:category|tags?)\s*:\s*{re.escape(label)}\s*$", body) for label in taxonomy):
        problems.append("article taxonomy leaked into copy")

    # The URL slug is the visible manual campaign; the shared UTM helper and
    # first-touch attribution semantics are unchanged.
    article_path = urlsplit(post.get("url", "")).path.strip("/").split("/")
    campaign = article_path[-1] if len(article_path) >= 2 and article_path[0] == "writing" else ""
    url = tagged_url(post.get("url", ""), "linkedin", campaign)
    parts = urlsplit(url)
    query = parse_qs(parts.query)
    if (parts.scheme != "https" or parts.hostname not in {"leonlins.com", "www.leonlins.com"}
            or query.get("utm_source") != ["linkedin"] or query.get("utm_medium") != ["social"]
            or not campaign or query.get("utm_campaign") != [campaign]):
        problems.append("invalid LinkedIn-tagged leonlins.com article URL")
    result = f"{body}\n{url}"
    if len(result) > 3000:
        problems.append("LinkedIn 3,000-character ceiling exceeded")
    if problems:
        raise SocialCopyError("LinkedIn draft failed validation: " + "; ".join(problems))
    return result


def generate_linkedin_draft(post: dict) -> str:
    """Read the full indexed article and make exactly one provider completion."""
    content = post.get("content") or ""
    if not content.strip() or len(content) > MAX_ARTICLE_CHARS:
        raise SocialCopyError("LinkedIn draft requires a non-empty, complete article")
    prompt = dedent(f"""
        Select one useful idea from the complete article below for a manual LinkedIn post.
        Do not summarize the article. Return JSON with exactly these string fields:
        {{"core_insight": "...", "explanation": "...", "concrete_detail": "...",
          "implication": "...", "click_reason": "..."}}

        Each field is plain prose with complete sentences and no line breaks.
        Core insight: state ONE source-supported claim directly, in Leon's voice.
        Explanation: briefly show why that one claim holds. Do not introduce a second theme.
        Concrete detail: choose ONE source-supported number, example, comparison, or
        qualification that makes this idea credible. Preserve its time context and caveats.
        Implication: give the reader one useful consequence that Leon actually draws
        in the source. Do not add advice to investors or organizations that he did not give.
        Click reason: name ONE specific additional argument, example, mechanism, caveat,
        or implication that is actually developed in the article but NOT explained in the
        other fields. Say naturally that the full article develops it, and lead into the
        link that will be appended after this sentence. This should sound like Leon
        inviting a colleague to follow a named thread of the argument, not like a
        summary of what "the article" or "the author" does. Do not withhold basic understanding.

        The fields will be assembled into three paragraphs: insight; explanation plus
        detail; implication plus click reason. Aim for 120–200 words total, with no filler.
        Write for analytically minded professionals. Use plain English, relatively short
        sentences, and Leon's own terminology where useful. Stay in the source's voice,
        rather than sounding like an analyst reporting on the source. Do not retell the
        article from beginning to end or invent a personal experience or source fact.
        Avoid abstract filler such as "the critical insight lies in", "this distinction
        is critical", "offers a more robust framework", "provides a foundation",
        "ultimately", "it is crucial to", "this approach allows us to", and
        "empirical evidence demonstrates". Do not write a generic CTA such as
        "I explore this further", "the full article details", or "in the linked post".
        Never refer to Leon as "the author". Do not repeat a field in another field.
        Prefer "I work through <specific omitted material> in the full piece:" or a
        natural variation that names the actual material and ends before the URL.
        No clickbait, engagement bait, emojis, hashtags, markdown, listicles, article
        taxonomy, promotional opening, or URLs. Do not manufacture a curiosity gap.
        This article was published on {_format_publication_date(post)}. Anchor old
        time-sensitive facts to that period; do not imply they are current.

        TITLE: {post.get('title', '')}
        FULL ARTICLE:
        {content}
    """).strip()
    data = complete_json(
        prompt,
        system="You are the author adapting your own article into precise, professional LinkedIn prose. Return JSON only.",
        temperature=0.25,
        max_tokens=900,
    )
    fields = ("core_insight", "explanation", "concrete_detail", "implication", "click_reason")
    if set(data) != set(fields) or any(
        not isinstance(data[field], str) or not data[field].strip() or "\n" in data[field]
        for field in fields
    ):
        raise SocialCopyError("LinkedIn model returned malformed editorial selection")
    paragraphs = (
        data["core_insight"].strip(),
        f"{data['explanation'].strip()} {data['concrete_detail'].strip()}",
        f"{data['implication'].strip()} {data['click_reason'].strip()}",
    )
    return validate_linkedin_draft("\n\n".join(paragraphs), post)
