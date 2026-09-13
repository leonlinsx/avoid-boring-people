"""Deterministic Instagram carousel storyboard derived from one article.

A storyboard is presentation-neutral: text plus a caption. It reuses the same
article summary the other destinations consume (teaser + points) and never
invents facts, so every slide is a verbatim slice of the article title, the
generated summary, the tags, or the canonical URL.

Slide limits are editorial, not platform limits. Meta documents at most ten
carousel children and does not document a minimum, so the renderer's supported
range is 2-10 while the default shape stays 5-8 slides: a cover, body slides,
and a closing slide that carries the canonical link.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal, Sequence

SlideKind = Literal["cover", "body", "final"]

# Slide copy limits (characters), enforced before rendering and before any API
# call so an over-long slide fails locally instead of in Meta's renderer.
COVER_TITLE_MAX = 90
COVER_TEASER_MAX = 200
BODY_TITLE_MAX = 60
BODY_BODY_MAX = 200
FINAL_TITLE_MAX = 60
FINAL_TEXT_MAX = 120
KICKER_MAX = 40

# Caption limits. 2200 is Meta's documented maximum; the 500-character target
# keeps the caption readable under Instagram's "more" fold.
CAPTION_TARGET_MAX = 500
CAPTION_HARD_MAX = 2200
HASHTAG_LIMIT = 30
HASHTAG_MAX = 4

# Alt text is documented at 1000 characters for image media, carousel children
# included. Generated alt text stays far below it; the limit is enforced anyway.
ALT_TEXT_MAX = 1000

# Carousel shape. MIN/MAX_SLIDES are the editorial default; the publisher
# accepts the wider documented range.
MIN_SLIDES = 5
MAX_SLIDES = 8
MIN_BODY_SLIDES = 3
MAX_BODY_SLIDES = 6
MIN_CAROUSEL_ITEMS = 2
MAX_CAROUSEL_ITEMS = 10

# Meta requires sRGB JPEG within 4:5-1.91:1, at most 8 MB. 1080x1350 is exactly
# 4:5 and is the largest standard Instagram portrait size.
SLIDE_WIDTH = 1080
SLIDE_HEIGHT = 1350
MAX_IMAGE_BYTES = 8 * 1024 * 1024

BRAND = "leonlins.com"
FINAL_TITLE = "Read the full essay"
DEFAULT_KICKER = "Essay"

_MARKDOWN_HEADING = re.compile(r"^#{1,6}\s*", re.MULTILINE)
_MARKDOWN_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
# Inline links keep their text; the destination (and its optional title, with
# either quoting style) is dropped. The target may be wrapped in <> and may
# itself contain parentheses, which appears in older articles on this site.
_INLINE_LINK = re.compile(
    r"!?\[([^\[\]]*)\]\(\s*<?[^>\s]*>?(?:\s+(?:\"[^\"]*\"|'[^']*'|\([^)]*\)))?\s*\)"
)
# A link whose opening bracket was already consumed by an earlier pass.
_LINK_TAIL = re.compile(r"\]\(\s*<?[^>\s]*>?(?:\s+(?:\"[^\"]*\"|'[^']*'))?\s*\)")
_FOOTNOTE_MARKER = re.compile(r"\[\^[^\]]*\]")
_CITATION_MARKER = re.compile(r"\[\d{1,2}\]")
# The local summarizer truncates long sentences, which can leave a link opened
# but never closed. Drop the orphaned destination and the opener bracket, and
# keep the visible link text.
_DANGLING_LINK_TARGET = re.compile(r"\]\([^)]*$")
_DANGLING_LINK_OPEN = re.compile(r"\[([^\[\]]*)$")
_EMPHASIS = re.compile(r"\*{1,3}")
_MARKDOWN_CODE = re.compile(r"`{1,3}")
_HTML_TAG = re.compile(r"<[^>]+>")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_CLAUSE_DELIMITER = re.compile(r"[;:—]")
_COMMA_DELIMITER = re.compile(r",")
_SPACE_BEFORE_PUNCTUATION = re.compile(r"\s+([,.;:!?])")
_WORD = re.compile(r"[^\s]+")

# A headline shorter than this reads like a fragment; a detail shorter than this
# is not worth its own slide paragraph.
_MIN_HEADLINE_WORDS = 4
_MIN_DETAIL_WORDS = 3
# Words a headline should not end on when the limit falls mid-clause.
_TRAILING_STOPWORDS = frozenset(
    {
        "a", "about", "an", "and", "are", "as", "at", "be", "because", "but", "by",
        "for", "from", "his", "her", "if", "in", "into", "is", "it", "its", "of",
        "on", "or", "our", "over", "so", "than", "that", "the", "their", "these",
        "then", "this", "those", "to", "was", "were", "when", "which", "while",
        "with", "your",
    }
)
# Words that leave a headline reading as an unfinished phrase when the split
# lands right after them. Structural connectors only, because a phrase or clause
# boundary can legitimately close on a word that a bare word boundary cannot
# (for example "priced in", where "in" belongs to the verb).
_TRAILING_CONNECTORS = frozenset(
    {
        "and", "as", "because", "but", "by", "for", "from", "if", "nor", "not",
        "of", "or", "so", "than", "that", "then", "to", "when", "which", "while",
        "who", "whom", "whose", "with", "yet",
    }
)
# Words that open a new clause or phrase inside a sentence, so breaking in front
# of one leaves a headline that reads as a whole heading instead of a fragment
# cut off at the character limit. Relative pronouns (that, which, who) and
# coordinating conjunctions (and, or, but) are deliberately absent: a detail
# starting with one of those continues the headline's own clause and reads as an
# accidental cut. "of" is absent for the same reason, since it cannot open a
# phrase that stands on its own ("of our identity?"). "not" is here because a
# negated reason is a heading of its own ("...exist" | "not because X, but
# because Y").
_PHRASE_STARTERS = frozenset(
    {
        # subordinating conjunctions
        "after", "although", "as", "because", "before", "if", "not", "once",
        "since", "than", "though", "unless", "until", "when", "whenever",
        "where", "whereas", "wherever", "whether", "while",
        # prepositions
        "about", "above", "across", "against", "along", "among", "around", "at",
        "behind", "below", "beneath", "beside", "between", "beyond", "by",
        "despite", "down", "during", "except", "for", "from", "in", "inside",
        "into", "like", "near", "off", "on", "onto", "outside", "over", "past",
        "per", "through", "throughout", "to", "toward", "towards", "under",
        "underneath", "up", "upon", "via", "with", "within", "without",
        # auxiliaries and modals
        "am", "are", "be", "been", "being", "can", "could", "did", "do", "does",
        "had", "has", "have", "is", "may", "might", "must", "shall", "should",
        "was", "were", "will", "would",
    }
)
# Copulas, auxiliaries and modals: a detail opening on one of these resumes the
# headline's own clause, so it only reads as a heading break while the headline
# is still the bare subject ("Management conferences and expert networks" | "are
# not insider trading"). Once the headline has a verb of its own the break lands
# mid-clause ("The point is that markets" | "are efficient"), which reads worse
# than a plain word boundary.
_PREDICATE_OPENERS = frozenset(
    {
        "am", "are", "be", "been", "being", "can", "could", "did", "do", "does",
        "had", "has", "have", "is", "may", "might", "must", "shall", "should",
        "was", "were", "will", "would",
    }
)
# Pronouns that cannot close a headline: breaking in front of one strands the
# subject of the next clause at the end of the headline ("...exist not because
# they" | "have secret data"). Auxiliaries are excluded for the same reason on
# the other side of the break ("...networks are" | "not insider trading").
_STRANDED_SUBJECTS = frozenset(
    {
        "he", "her", "him", "i", "it", "she", "them", "these", "they", "this",
        "those", "us", "we", "what", "who", "you",
    }
)


@dataclass(frozen=True)
class InstagramSlide:
    """One carousel image: the text a renderer must fit, plus its alt text."""

    index: int
    kind: SlideKind
    kicker: str
    title: str
    body: str
    alt_text: str
    footer: str = BRAND


@dataclass(frozen=True)
class InstagramStoryboard:
    post_id: str
    title: str
    canonical_url: str
    caption: str
    hashtags: tuple[str, ...]
    slides: tuple[InstagramSlide, ...]


def plain_text(value: str) -> str:
    """Flatten Markdown/HTML into readable prose without changing the words.

    Article bodies reach the summarizer as raw Markdown, and the local
    summarizer returns sentence slices of that raw text, so link syntax and
    citation markers have to be removed here rather than assumed away.
    """
    if not value:
        return ""
    truncated = value.rstrip().endswith("…")
    text = _MARKDOWN_IMAGE.sub("", value)
    text = _INLINE_LINK.sub(r"\1", text)
    text = _LINK_TAIL.sub("", text)
    text = _DANGLING_LINK_TARGET.sub("", text)
    text = _DANGLING_LINK_OPEN.sub(r"\1", text)
    text = _FOOTNOTE_MARKER.sub("", text)
    text = _CITATION_MARKER.sub("", text)
    text = _MARKDOWN_HEADING.sub("", text)
    text = _EMPHASIS.sub("", text)
    text = _MARKDOWN_CODE.sub("", text)
    text = _HTML_TAG.sub("", text)
    text = _SPACE_BEFORE_PUNCTUATION.sub(r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    if truncated and text and not text.endswith("…"):
        text = f"{text}…"
    return text


def truncate_words(text: str, limit: int) -> str:
    """Trim to a word boundary at or below limit, marking the cut with an ellipsis."""
    text = text.strip()
    if len(text) <= limit:
        return text
    if limit <= 1:
        return "…"[:limit]
    window = text[: limit - 1]
    head = window.rsplit(" ", 1)[0].rstrip(" ,;:.!?-—") if " " in window else window
    return f"{head}…"


def _sentences(text: str) -> list[str]:
    return [sentence.strip() for sentence in _SENTENCE_SPLIT.split(text.strip()) if sentence.strip()]


def _key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _word_key(word: str) -> str:
    return word.strip("\"“”'‘’.,;:!?—()").lower()


def _is_stopword(word: str) -> bool:
    return _word_key(word) in _TRAILING_STOPWORDS


def _is_connector(word: str) -> bool:
    return _word_key(word) in _TRAILING_CONNECTORS


def _resumes_the_headline(headline: str, detail: str) -> bool:
    """Whether a detail opening on an auxiliary continues a headline clause."""
    if _word_key(detail.split()[0]) not in _PREDICATE_OPENERS:
        return False
    return any(_word_key(word) in _PREDICATE_OPENERS for word in headline.split())


def _strands_a_clause(headline: str) -> bool:
    """Whether a headline ends on the subject or verb owning the detail's clause."""
    last = _word_key(headline.split()[-1])
    return last in _STRANDED_SUBJECTS or last in _PREDICATE_OPENERS


def _boundary_offsets(point: str, pattern: re.Pattern[str]) -> list[int]:
    """Offsets just past each delimiter match, furthest into the point first."""
    return sorted((match.end() for match in pattern.finditer(point)), reverse=True)


def _phrase_offsets(point: str) -> list[int]:
    """Offsets where a new clause or phrase starts, furthest into the point first."""
    return sorted(
        (
            match.start()
            for match in _WORD.finditer(point)
            if _word_key(match.group()) in _PHRASE_STARTERS
        ),
        reverse=True,
    )


def _reads_as_a_whole_heading(headline: str, detail: str) -> bool:
    """Whether a candidate boundary leaves two readable halves."""
    words = headline.split()
    return (
        len(headline) <= BODY_TITLE_MAX
        and len(words) >= _MIN_HEADLINE_WORDS
        and len(detail.split()) >= _MIN_DETAIL_WORDS
        and not _is_connector(words[-1])
    )


def _headline_and_detail(point: str) -> tuple[str, str]:
    """Split one summary point into a short headline and its supporting detail.

    Both halves are verbatim slices of the point, so no word is rewritten or
    invented. Boundaries are preferred in order: a sentence break, then the last
    clause delimiter that fits the headline limit (semicolon, colon and em dash
    first, commas second because they are the weakest signal), then the last
    word that opens a new clause or phrase, then a plain word boundary. The
    clause and phrase passes exist so the headline ends where the point itself
    changes direction rather than wherever the character limit happens to fall.
    A phrase break is skipped when the detail would only resume the headline's
    own clause: on an auxiliary verb, or on a verb whose subject would be left
    stranded at the end of the headline. Truncation is only a fallback.
    """
    sentences = _sentences(point)
    if len(sentences) > 1 and len(sentences[0]) <= BODY_TITLE_MAX:
        # A complete sentence makes the better headline, even when what follows
        # it is shorter than a full detail sentence.
        return sentences[0], " ".join(sentences[1:])

    for pattern in (_CLAUSE_DELIMITER, _COMMA_DELIMITER):
        for offset in _boundary_offsets(point, pattern):
            headline, detail = point[:offset].rstrip(" ,;:—"), point[offset:].strip()
            if _reads_as_a_whole_heading(headline, detail):
                return headline, detail

    if len(point) <= BODY_TITLE_MAX:
        # The point already fits a headline on its own; breaking it in front of a
        # phrase would only strand a fragment on the next line.
        return point, ""

    for offset in _phrase_offsets(point):
        headline, detail = point[:offset].strip(), point[offset:].strip()
        if not _reads_as_a_whole_heading(headline, detail):
            continue
        if _strands_a_clause(headline) or _resumes_the_headline(headline, detail):
            continue
        return headline, detail

    words = point.split()
    take = 0
    for position in range(1, len(words) + 1):
        if len(" ".join(words[:position])) > BODY_TITLE_MAX:
            break
        take = position
    while take > _MIN_HEADLINE_WORDS and _is_stopword(words[take - 1]):
        take -= 1
    if take >= _MIN_HEADLINE_WORDS and len(words) - take >= _MIN_DETAIL_WORDS:
        return " ".join(words[:take]), " ".join(words[take:])
    return truncate_words(point, BODY_TITLE_MAX), ""


def _body_points(post: dict, summary: dict) -> list[str]:
    """Collect body-slide points, topping up from the article when needed."""
    points: list[str] = []
    seen: set[str] = set()

    def add(candidate: str) -> None:
        text = plain_text(candidate).strip(" \"'“”")
        key = _key(text)
        if text and key and key not in seen:
            seen.add(key)
            points.append(text)

    for point in summary.get("points") or ():
        add(str(point))
    if len(points) < MIN_BODY_SLIDES:
        for sentence in _sentences(plain_text(post.get("content") or "")):
            if len(points) >= MIN_BODY_SLIDES:
                break
            if len(sentence) >= 40:
                add(sentence)
    return points[:MAX_BODY_SLIDES]


def _kicker(post: dict) -> str:
    category = str(post.get("category") or "").strip()
    if not category:
        tags = [str(tag).strip() for tag in post.get("tags") or () if str(tag).strip()]
        category = tags[0] if tags else DEFAULT_KICKER
    return truncate_words(plain_text(category).upper(), KICKER_MAX)


def _hashtags(tags: Sequence[str]) -> tuple[str, ...]:
    hashtags: list[str] = []
    for tag in tags:
        value = re.sub(r"[^A-Za-z0-9]", "", str(tag))
        if value and f"#{value}" not in hashtags:
            hashtags.append(f"#{value}")
        if len(hashtags) >= HASHTAG_MAX:
            break
    return tuple(hashtags[:HASHTAG_LIMIT])


def _build_caption(title: str, teaser: str, url: str, hashtags: Sequence[str]) -> str:
    tail = f"Full essay → {url}"
    if hashtags:
        tail = f"{tail}\n\n{' '.join(hashtags)}"

    def compose(headline: str, body: str) -> str:
        return "\n\n".join(part for part in (headline, body, tail) if part)

    caption = compose(title, teaser)
    if len(caption) > CAPTION_TARGET_MAX and teaser:
        budget = CAPTION_TARGET_MAX - len(compose(title, "")) - 2
        caption = compose(title, truncate_words(teaser, max(budget, 0)))
    if len(caption) > CAPTION_TARGET_MAX:
        budget = CAPTION_TARGET_MAX - len(compose("", "")) - 2
        caption = compose(truncate_words(title, max(budget, 0)), "")
    return caption


def _slide_alt_text(kind: SlideKind, position: str, title: str, body: str) -> str:
    label = {
        "cover": "Cover slide",
        "body": f"Slide {position}",
        "final": "Final slide",
    }[kind]
    text = f"{label}: {title}".strip()
    if body:
        text = f"{text}. {body}"
    return truncate_words(plain_text(text), ALT_TEXT_MAX)


def build_storyboard(post: dict, summary: dict) -> InstagramStoryboard:
    """Build the deterministic carousel storyboard for one article.

    The same post and summary always produce the same storyboard: no timestamps,
    no randomness, and no API calls.
    """
    post_id = str(post.get("id") or "").strip()
    if not post_id:
        raise ValueError("Instagram storyboard requires a post id")
    url = str(post.get("url") or "").strip()
    if not url:
        raise ValueError("Instagram storyboard requires a canonical article URL")
    title = plain_text(str(post.get("title") or "")).strip()
    if not title:
        raise ValueError("Instagram storyboard requires an article title")

    points = _body_points(post, summary or {})
    if not points:
        raise ValueError("Instagram storyboard requires article text to fill body slides")

    teaser = plain_text(str((summary or {}).get("teaser") or "")).strip()
    if not teaser:
        first = _sentences(plain_text(post.get("content") or ""))
        teaser = first[0] if first else ""

    slides: list[InstagramSlide] = []
    # The cover sells the idea rather than the article's metadata: the sharpest
    # social hook leads, and the literal title becomes secondary context.
    cover_title = truncate_words(teaser or title, COVER_TITLE_MAX)
    cover_body = truncate_words(title, COVER_TEASER_MAX) if teaser else ""
    slides.append(
        InstagramSlide(
            index=1,
            kind="cover",
            kicker=_kicker(post),
            title=cover_title,
            body=cover_body,
            alt_text=_slide_alt_text("cover", "", cover_title, cover_body),
        )
    )
    for point in points:
        headline, detail = _headline_and_detail(point)
        headline = truncate_words(headline, BODY_TITLE_MAX)
        detail = truncate_words(detail, BODY_BODY_MAX)
        index = len(slides) + 1
        slides.append(
            InstagramSlide(
                index=index,
                kind="body",
                kicker=_kicker(post),
                title=headline,
                body=detail,
                alt_text=_slide_alt_text("body", str(index - 1), headline, detail),
            )
        )

    display_url = re.sub(r"^https?://", "", url).rstrip("/")
    slides.append(
        InstagramSlide(
            index=len(slides) + 1,
            kind="final",
            kicker=_kicker(post),
            title=truncate_words(FINAL_TITLE, FINAL_TITLE_MAX),
            body=truncate_words(display_url, FINAL_TEXT_MAX),
            alt_text=_slide_alt_text("final", "", FINAL_TITLE, display_url),
        )
    )

    hashtags = _hashtags(post.get("tags") or ())
    storyboard = InstagramStoryboard(
        post_id=post_id,
        title=title,
        canonical_url=url,
        caption=_build_caption(title, teaser, url, hashtags),
        hashtags=hashtags,
        slides=tuple(slides),
    )
    validate_storyboard(storyboard)
    return storyboard


def validate_storyboard(storyboard: InstagramStoryboard) -> None:
    """Refuse a storyboard that would render badly or be rejected by Meta."""
    count = len(storyboard.slides)
    if not MIN_CAROUSEL_ITEMS <= count <= MAX_CAROUSEL_ITEMS:
        raise ValueError(
            f"Instagram carousel needs {MIN_CAROUSEL_ITEMS}-{MAX_CAROUSEL_ITEMS} slides, got {count}"
        )
    if not MIN_SLIDES <= count <= MAX_SLIDES:
        raise ValueError(f"Instagram carousel defaults to {MIN_SLIDES}-{MAX_SLIDES} slides, got {count}")
    if storyboard.slides[0].kind != "cover" or storyboard.slides[-1].kind != "final":
        raise ValueError("Instagram storyboard must start with a cover and end with a final slide")
    for position, slide in enumerate(storyboard.slides, start=1):
        if slide.index != position:
            raise ValueError(f"Instagram slide indexes must be sequential; expected {position}, got {slide.index}")
        expected_kind = "cover" if position == 1 else "final" if position == count else "body"
        if slide.kind != expected_kind:
            raise ValueError(
                f"Instagram slide {position} must be kind '{expected_kind}', got '{slide.kind}'"
            )
        limits = {
            "kicker": KICKER_MAX,
            "title": COVER_TITLE_MAX,
            "body": max(COVER_TEASER_MAX, BODY_BODY_MAX, FINAL_TEXT_MAX),
            "alt_text": ALT_TEXT_MAX,
        }
        for field_name, limit in limits.items():
            value = getattr(slide, field_name)
            if len(value) > limit:
                raise ValueError(
                    f"Instagram slide {position} {field_name} exceeds {limit} characters ({len(value)})"
                )
        if not slide.title.strip():
            raise ValueError(f"Instagram slide {position} needs a title")
        if not slide.alt_text.strip():
            raise ValueError(f"Instagram slide {position} needs alt text")
    if not storyboard.caption.strip():
        raise ValueError("Instagram caption must not be empty")
    if len(storyboard.caption) > CAPTION_HARD_MAX:
        raise ValueError(
            f"Instagram caption exceeds Meta's {CAPTION_HARD_MAX}-character limit ({len(storyboard.caption)})"
        )
    if storyboard.canonical_url not in storyboard.caption:
        raise ValueError("Instagram caption must carry the canonical article URL")
    if not storyboard.canonical_url.startswith("https://"):
        raise ValueError("Instagram storyboard canonical URL must be absolute HTTPS")
