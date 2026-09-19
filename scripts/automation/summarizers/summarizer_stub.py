from typing import Dict, Literal
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
import nltk
import sys

# Global character cap for tweet safety (default 200)
TWEET_CHAR_LIMIT = 200

# Ensure required tokenizers are available
try:
    nltk.data.find("tokenizers/punkt")
    nltk.data.find("tokenizers/punkt_tab")
except LookupError:
    # stderr: stdout carries the rendered draft when the caller redirects it.
    print("📥 Downloading NLTK resources: punkt, punkt_tab...", file=sys.stderr)
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
    sentences = [truncate_to_tweet_limit(s, TWEET_CHAR_LIMIT) for s in sentences]

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
