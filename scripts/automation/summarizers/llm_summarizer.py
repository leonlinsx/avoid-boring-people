from typing import Dict, Literal
import os
import json
from datetime import datetime
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
    budget = limit - 1
    clipped = value[:budget]
    if clipped and not clipped[-1].isspace():
        clipped = clipped.rsplit(" ", 1)[0] or clipped
    return f"{clipped.rstrip(' ,;:.-')}…"


def _format_publication_date(post: Dict) -> str:
    """Normalize the article's publication date for the LLM prompt.

    Evergreen redistribution can summarize articles years after publication, so
    the prompt must receive the original date instead of letting the model
    assume "now". The search index exposes an ISO 8601 timestamp; reduce it to a
    calendar date and fall back to the raw value (or an explicit marker) when it
    is missing or unparseable.
    """
    raw = str(post.get("date") or post.get("pubDate") or "").strip()
    if not raw:
        return "unknown"
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return raw


def build_summary_prompt(
    post: Dict,
    mode: Literal["bullets", "narrative"] = "bullets",
    max_points: int = 4,
    max_chars: int = 240,
) -> str:
    """Build the deterministic DeepSeek prompt for a post's social summary."""
    title = post.get("title", "")
    url = post.get("url", "")
    published = _format_publication_date(post)
    content = (post.get("content") or "")[:6000]
    style = "bullet" if mode == "bullets" else "narrative"

    return dedent(
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

        Publication-date awareness:
        - This article was published on {published}. Treat its facts, metrics, valuations, prices, product capabilities, market conditions, regulations, personnel references, and forecasts as belonging to that publication period, not to today.
        - Do not present historical or time-sensitive facts as current facts, and do not rewrite them using outside knowledge.
        - Do not blindly repeat the source's relative time words ("today", "currently", "recently", "now", "this year"); when one referred to the original publication period, drop it or anchor it in time instead.
        - When a time-sensitive fact is important, anchor it naturally, for example "In this 2020 analysis...", "At the time...", or "The 2020 article argued...".
        - Durable conceptual claims (frameworks, book reviews, decision-making ideas) do not need to be date-stamped and should stay concise.
        - Do not invent current conditions, and do not fact-check or update the article against newer events.
        - The summary must still read naturally as a social post.

        ARTICLE TITLE: {title}
        SOURCE URL: {url}
        PUBLICATION DATE: {published}

        FULL TEXT (truncated):
        """{content}"""
        '''
    ).strip()


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

    content = (post.get("content") or "")[:6000]

    if not content:
        return {"teaser": "", "points": ["[No content available for this post]"]}

    prompt = build_summary_prompt(post, mode=mode, max_points=max_points, max_chars=max_chars)

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


def localize_zh_cn(title: str, teaser: str, point: str, url: str, max_chars: int = 1800,
                   model: str = DEFAULT_MODEL) -> str:
    """Adapt an English article into Simplified-Chinese microblog copy for Weibo.

    Raises instead of falling back: silently posting the English text (or a
    stub) to a Chinese-language audience would be worse than failing the run.
    """
    hook = _sanitize_text(teaser or title)
    detail = _sanitize_text(point or "")
    prompt = dedent(
        f'''
        你是一位面向中文读者的科技专栏作者。请把下面这篇英文科技/投资文章改写成一条简体中文微博。

        要求：
        - 简洁有力，保留原文最核心的一个观点和一个具体事实/数据
        - 技术术语保留英文原词并加中文解释，例如 “资本开支 (capex)”
        - 美国特有的机构或概念用一句话向中文读者解释清楚
        - 人名、公司名等专有名词尽量不翻译，必要时加中文备注
        - 只用纯文本，不用表情符号，不用话题标签，不编造原文没有的信息
        - 正文不超过{max_chars}字，只返回正文，不要加任何解释或代码块标记

        英文标题：{title}
        英文钩子：{hook}
        英文要点：{detail}
        '''
    ).strip()
    try:
        print("🤖 Localizing article into Simplified Chinese...")
        client = _client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是一位面向中文读者的科技专栏作者，只返回微博正文。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1500,
        )
        body = _sanitize_text(response.choices[0].message.content or "")
        if not body:
            raise ValueError("Localization returned no usable content")
        text = f"{body}\n\n{url}".strip()
        if len(text) > max_chars + len(url) + 2:
            text = f"{_truncate(body, max_chars)}\n\n{url}".strip()
        return text  # post_to_weibo enforces the Weibo character limit
    except Exception as error:
        raise RuntimeError(f"❌ Weibo localization failed, refusing to post unlocalized text: {error}")
