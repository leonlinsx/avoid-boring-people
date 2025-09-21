from typing import Dict, Literal
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
import nltk
import re

# Global character cap for tweet safety (default 200)
TWEET_CHAR_LIMIT = 200

# Ensure required tokenizers are available
try:
    nltk.data.find("tokenizers/punkt")
    nltk.data.find("tokenizers/punkt_tab")
except LookupError:
    print("📥 Downloading NLTK resources: punkt, punkt_tab...")
    nltk.download("punkt")
    nltk.download("punkt_tab")


def summarize_post(
    post: Dict,
    mode: Literal["bullets", "narrative"] = "bullets",
    max_points: int = 4
) -> Dict:
    """
    Local summarizer using TextRank (via Sumy).
    Extracts key sentences from post content without LLM.
    Returns teaser + summary points, all within TWEET_CHAR_LIMIT.
    """
    content = post.get("content", "")
    if not content:
        return {
            "teaser": "[No content available]",
            "points": ["[No content available]"]
        }

    parser = PlaintextParser.from_string(content, Tokenizer("english"))
    summarizer = TextRankSummarizer()
    sentences = summarizer(parser.document, max_points + 1)  # +1 so first is teaser

    # Convert to plain strings and apply character limits
    sentences = [str(s).strip() for s in sentences if s and str(s).strip()]
    
    # Apply tweet character limit to all sentences
    sentences = [s[:TWEET_CHAR_LIMIT] for s in sentences]

    teaser = sentences[0] if sentences else "Summary unavailable"
    points = sentences[1:max_points+1] if len(sentences) > 1 else sentences

    return {
        "teaser": teaser,
        "points": points
    }


def truncate_to_tweet_limit(text: str, limit: int = TWEET_CHAR_LIMIT) -> str:
    """
    Truncate text to tweet character limit, preserving word boundaries.
    """
    if len(text) <= limit:
        return text
    
    # Truncate and add ellipsis if needed
    truncated = text[:limit].rsplit(' ', 1)[0]  # Break at last space
    if len(truncated) < len(text):
        return truncated + "…"
    return truncated


def summarize_post_with_smart_truncation(
    post: Dict,
    mode: Literal["bullets", "narrative"] = "bullets",
    max_points: int = 4,
    char_limit: int = TWEET_CHAR_LIMIT
) -> Dict:
    """
    Alternative version with smart truncation that preserves word boundaries.
    """
    content = post.get("content", "")
    if not content:
        return {
            "teaser": "[No content available]",
            "points": ["[No content available]"]
        }

    parser = PlaintextParser.from_string(content, Tokenizer("english"))
    summarizer = TextRankSummarizer()
    sentences = summarizer(parser.document, max_points + 1)

    # Convert to plain strings and apply smart truncation
    sentences = [str(s).strip() for s in sentences if s and str(s).strip()]
    sentences = [truncate_to_tweet_limit(s, char_limit) for s in sentences]

    teaser = sentences[0] if sentences else "Summary unavailable"
    points = sentences[1:max_points+1] if len(sentences) > 1 else sentences

    return {
        "teaser": teaser,
        "points": points
    }


def clean_content(text: str) -> str:
    """
    Minimal cleaner to strip Markdown/HTML artifacts for testing.
    - Remove headings (##, ###, etc.)
    - Remove image tags ![...](...)
    - Convert links [text](url) -> text
    - Strip leftover Markdown symbols
    """
    if not text:
        return ""

    # Remove headings like ## or ###
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)

    # Remove images ![alt](url)
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)

    # Replace [text](url) with just 'text'
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)

    # Remove leftover inline HTML tags
    text = re.sub(r"<[^>]+>", "", text)

    # Collapse multiple spaces/newlines
    text = re.sub(r"\s+", " ", text).strip()

    return text

# Debug example
if __name__ == "__main__":
    sample_post = {
        "id": "123",
        "title": "Sample Post",
        "url": "https://example.com",
        "date": "2024-01-01",
        "content": "## Heading\n\nThis is a test. Here is a [link](http://example.com). ![img](pic.png) Done. " + 
                  "This is a very long sentence that should definitely exceed the two hundred character limit " +
                  "imposed by Twitter for individual tweets to ensure that we are properly testing the truncation " +
                  "functionality of our summarizer system which is crucial for social media automation."
    }

    print(f"\n--- Bullets Mode (Max {TWEET_CHAR_LIMIT} chars) ---")
    result = summarize_post(sample_post, mode="bullets")
    print("Teaser:", result["teaser"])
    for i, p in enumerate(result["points"]):
        print(f"• {p} ({len(p)} chars)")

    print(f"\n--- Smart Truncation Mode (Max {TWEET_CHAR_LIMIT} chars) ---")
    result_smart = summarize_post_with_smart_truncation(sample_post, mode="bullets")
    print("Teaser:", result_smart["teaser"])
    for i, p in enumerate(result_smart["points"]):
        print(f"• {p} ({len(p)} chars)")