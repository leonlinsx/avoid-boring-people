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
META_CTA_RE = re.compile(r"\b(?:the (?:analysis|study|article|essay|full text)|this (?:analysis|article|essay|piece))\s+(?:explores|examines|discusses|covers|delves into)\b", re.I)


def validate_linkedin_draft(body: str, post: dict) -> str:
    """Validate model prose, then attach the one canonical tagged URL ourselves."""
    if not isinstance(body, str) or not body.strip():
        raise SocialCopyError("LinkedIn draft is empty")
    body = body.strip()
    paragraphs = re.split(r"\n\s*\n", body)
    words = re.findall(r"\b[\w’'-]+\b", body)
    problems = []
    if not 3 <= len(paragraphs) <= 5 or any("\n" in p for p in paragraphs):
        problems.append("expected 3–5 ordinary prose paragraphs")
    if not 80 <= len(words) <= 300:
        problems.append("word count outside 80–300")
    if URL_RE.search(body):
        problems.append("model copy contains a URL")
    if "#" in body:
        problems.append("hashtags or hash markers")
    if MARKDOWN_RE.search(body):
        problems.append("markdown")
    if OPENING_RE.search(paragraphs[0].strip()):
        problems.append("generic promotional opening")
    if ENDING_RE.search(body):
        problems.append("engagement-bait ending")
    if META_CTA_RE.search(paragraphs[-1]):
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

    url = tagged_url(post.get("url", ""), "linkedin", post.get("id"))
    parts = urlsplit(url)
    query = parse_qs(parts.query)
    if (parts.scheme != "https" or parts.hostname not in {"leonlins.com", "www.leonlins.com"}
            or query.get("utm_source") != ["linkedin"] or query.get("utm_medium") != ["social"]
            or query.get("utm_campaign") != [post.get("id")]):
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
        Write one LinkedIn post in the author's voice from the complete article below.
        Return JSON with one field: {{"paragraphs": ["paragraph one", "paragraph two", "paragraph three"]}}. Each array item must be one complete prose paragraph with no embedded line breaks.

        Aim for 150–250 words in exactly 3 or 4 ordinary prose paragraphs. A shorter strong post is fine. Do not add a standalone heading or CTA item.
        Open with a substantive insight, explain why it matters, and use one concrete
        source-supported example, number, qualification, or comparison. Teach one useful
        idea while leaving a specific deeper argument, evidence, framework, or implication
        for the full article. End with a natural, article-specific reason to read further.
        The article URL will be appended after your final sentence; do not include any URL.

        Write as Leon speaking directly to investors, founders, senior operators, and analytical professionals. Do not sound like an analyst summarizing Leon from outside. Preserve a distinctive source observation or caveat rather than generic business advice.
        Preserve the author's reasoning, uncertainty, voice, numbers, and time context. Use one specific detail from the source and do not add projected losses, benefits, or advice absent from it.
        Do not invent facts, examples, personal experience, or stronger certainty.
        Do not imply old observations are current. Avoid "recent", "today", "now", "currently", or applying the original market conditions to the present. Anchor time-sensitive analysis to the publication period ({_format_publication_date(post)}).
        Avoid clickbait, generic promotion, engagement questions, emojis, hashtags,
        markdown, listicles, one-sentence-per-line formatting, and article taxonomy.
        Never open by announcing an article or say "check out my latest piece". Do not use "the analysis explores", "the study examines", "the full text explores", "understanding this is vital", or similar generic summary language. The final sentence should be in my voice ("I examine..." is fine) and name a specific source-supported question, mechanism, example, or caveat developed further, rather than saying only "read further".
        Do not repeat the entire article or manufacture a curiosity gap.

        TITLE: {post.get('title', '')}
        PUBLICATION DATE: {_format_publication_date(post)}
        FULL ARTICLE:
        {content}
    """).strip()
    data = complete_json(
        prompt,
        system="You are the author adapting your own article into precise, professional LinkedIn prose. Return JSON only.",
        temperature=0.25,
        max_tokens=900,
    )
    paragraphs = data.get("paragraphs")
    if not isinstance(paragraphs, list) or not 3 <= len(paragraphs) <= 4 or any(
        not isinstance(paragraph, str) or "\n" in paragraph for paragraph in paragraphs
    ):
        raise SocialCopyError("LinkedIn model returned malformed paragraphs")
    return validate_linkedin_draft("\n\n".join(paragraphs), post)
