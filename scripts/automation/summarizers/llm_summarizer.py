from typing import Dict, Literal
import os, json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

def _client() -> OpenAI:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("❌ DEEPSEEK_API_KEY is missing")
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")

def _fallback_stub() -> Dict:
    return {
        "teaser": "⚠️ Fallback teaser (LLM unavailable).",
        "points": [
            "Fallback summary point 1",
            "Fallback summary point 2",
            "Fallback summary point 3",
            "Fallback summary point 4"
        ]
    }

def summarize_post(
    post: Dict,
    mode: Literal["bullets", "narrative"] = "bullets",
    max_points: int = 4,
    max_chars: int = 240,
    model: str = DEFAULT_MODEL,
) -> Dict:
    """
    Use DeepSeek API to summarize a blog post into:
    - teaser (str)
    - points (list[str])
    Falls back to stub on errors.
    """
    use_real_api = os.getenv("TEST_API", "false").lower() == "true"

    if os.getenv("DRY_RUN", "").lower() == "true" and not use_real_api:
        print("🚫 DRY_RUN enabled - using mock teaser/points")
        return {
            "teaser": "Mock teaser for testing",
            "points": [
                "Mock summary point 1",
                "Mock summary point 2",
                "Mock summary point 3",
                "Mock summary point 4",
            ][:max_points]
        }

    title = post.get("title", "")
    url = post.get("url", "")
    content = (post.get("content") or "")[:6000]

    if not content:
        return {"teaser": "", "points": ["[No content available for this post]"]}

    style = "bullet points" if mode == "bullets" else "short narrative sentences"

    prompt = f"""
You are a social-media editor. Summarize the blog post below for X (Twitter).
Return a JSON object with:
- "teaser": 1 hook sentence (≤200 chars) that entices readers to click.
- "points": an array of {max_points} {style} for the thread.

Constraints:
- Teaser must be engaging but not clickbait. Do not exaggerate.
- Each point must be ≤ {max_chars} characters.
- No markdown (#, *, [], () etc.), no emojis, no hashtags.
- No URLs in teaser or points (the link will be in the first tweet).
- Return ONLY valid JSON.

TITLE: {title}
URL: {url}

BLOG CONTENT:
\"\"\"{content}\"\"\"
"""

    try:
        print("🤖 Calling DeepSeek API...")
        client = _client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes content for social media."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        text = response.choices[0].message.content.strip()
        print(f"📥 API raw response (truncated): {text[:120]}...")

        # Remove code fences if present
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()

        try:
            data = json.loads(text)
        except Exception as e:
            print(f"⚠️ JSON parse failed: {e}")
            return _fallback_stub()

        teaser = data.get("teaser", "").strip()
        points = data.get("points", [])
        if not isinstance(points, list):
            points = []

        return {
            "teaser": teaser,
            "points": points[:max_points] or ["[Summarizer returned no usable content]"]
        }

    except Exception as e:
        print(f"❌ DeepSeek summarizer failed: {e}")
        return _fallback_stub()
