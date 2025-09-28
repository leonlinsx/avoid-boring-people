from typing import Dict, Literal
import os
import json
from textwrap import dedent
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
            "Fallback summary point 4",
        ],
    }


def _sanitize_text(value: str) -> str:
    return " ".join(value.strip().split())


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    trimmed = value[: limit - 1].rstrip(" ,;:.-")
    return trimmed


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
            ][:max_points],
        }

    title = post.get("title", "")
    url = post.get("url", "")
    content = (post.get("content") or "")[:6000]

    if not content:
        return {"teaser": "", "points": ["[No content available for this post]"]}

    style = "bullet" if mode == "bullets" else "narrative"

    prompt = dedent(
        f'''
        You are an editorial assistant preparing a {style} recap of a blog post for an email + social digest. Answer with JSON matching
        this schema:
        {{
          "teaser": string,  # ≤200 characters, 1 sentence hook, factual and specific
          "points": [string, ...]  # {max_points} {style} takeaways, each ≤{max_chars} characters
        }}

        Writing rules:
        - Capture the sharpest insight, metric, or quote in the teaser. Avoid clickbait or rhetorical questions.
        - Each point should deliver a standalone takeaway. Lead with the most concrete fact before context.
        - Use plain text only. Prohibit markdown, emojis, hashtags, and URLs.
        - Never repeat the teaser verbatim in the points.
        - If information is missing, acknowledge it instead of inventing details.
        - Respond with JSON only; do not wrap inside code fences.

        ARTICLE TITLE: {title}
        SOURCE URL: {url}

        FULL TEXT (truncated):
        """{content}"""
        '''
    ).strip()


    try:
        print("🤖 Calling DeepSeek API...")
        client = _client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes content for social media.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1000,
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

        teaser = _truncate(_sanitize_text(data.get("teaser", "")), 200)
        raw_points = data.get("points", [])
        points = []
        if isinstance(raw_points, list):
            for point in raw_points:
                clean_point = _truncate(_sanitize_text(str(point)), max_chars)
                if clean_point and clean_point not in points:
                    points.append(clean_point)
        if not isinstance(points, list):
            points = []

        return {
            "teaser": teaser,
            "points": points[:max_points]
            or ["[Summarizer returned no usable content]"],
        }

    except Exception as e:
        print(f"❌ DeepSeek summarizer failed: {e}")
        return _fallback_stub()
