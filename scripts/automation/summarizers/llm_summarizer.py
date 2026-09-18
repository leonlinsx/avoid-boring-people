"""Author-voice social distillation for one article, via DeepSeek or local Ollama.

A single model call rewrites the author's own long-form writing into the
author's own voice: one teaser (the sharpest standalone hook) plus standalone
supporting points. Every platform renderer then adapts that one shared result
rather than generating its own copy.

The module fails closed. A production generation that fails, returns unusable
JSON, or produces copy that fails the deterministic quality gate raises instead
of handing fallback text to a publisher, because these posts go out under the
author's own name.

`SOCIAL_LLM_PROVIDER` selects the inference backend and defaults to DeepSeek, so
production is unchanged. `ollama` is an explicit local-development option for
inspecting real generated copy without spending API credit; it is never an
automatic fallback, and both backends feed the same prompt, contract, parser,
and quality gate. The local backend is called through Ollama's native endpoint
because only that endpoint can be told how much context the article needs.
"""
from typing import Dict, Literal, Sequence
import os
import re
import json
import urllib.error
import urllib.request
from datetime import datetime
from textwrap import dedent
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# `deepseek-flash` is the DeepSeek API alias for DeepSeek-V4.1-Flash and the
# current replacement for the retired `deepseek-chat` identifier. This is the
# hosted API model name, not the Hugging Face repository id (`deepseek-ai/...`).
DEFAULT_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-flash")

# Provider selection. `deepseek` is the production default and the only possible
# value unless someone sets `SOCIAL_LLM_PROVIDER` deliberately.
PROVIDER_DEEPSEEK = "deepseek"
PROVIDER_OLLAMA = "ollama"
SUPPORTED_PROVIDERS = (PROVIDER_DEEPSEEK, PROVIDER_OLLAMA)
PROVIDER_LABELS = {PROVIDER_DEEPSEEK: "DeepSeek", PROVIDER_OLLAMA: "Ollama"}

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
# Ollama's server-side context default is only 4k tokens on a 16 GB GPU, and it
# then drops the *oldest* tokens of an over-long prompt -- which is exactly where
# the instructions live. The full article (up to MAX_ARTICLE_CHARS) needs far
# more than that, so the local request states its own window.
DEFAULT_OLLAMA_NUM_CTX = 32768
OLLAMA_TIMEOUT_SECONDS = 600

# The hosted backend answers in seconds; these are ceilings, not expectations.
# They exist so one stalled request cannot consume a whole scheduled run.
HOSTED_TIMEOUT_SECONDS = 60
HOSTED_MAX_RETRIES = 2

# The search index is a single JSON document fetched over the network, so a
# pathological entry must not be able to build an unbounded request. The longest
# article currently on leonlins.com is ~43,000 characters, so this bound never
# truncates real writing; it exists only as a safety net.
MAX_ARTICLE_CHARS = 60_000

TEASER_MAX = 200
POINT_MAX = 240
TEASER_ALTERNATES_MAX = 2

# Specificity is the structural opposite of clickbait ("this one trick..."):
# a teaser naming a number, a proper noun, or a concrete claim earns the
# feed slot over a vaguer one. Purely deterministic, never a second model
# call, and ties keep the model's own first choice.
_DIGIT_RE = re.compile(r"\d")
_PROPER_NOUN_RE = re.compile(r"[a-zà-öø-ÿ]\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+")
SPECIFICITY_SWEET_MIN = 40
SPECIFICITY_SWEET_MAX = 140

# Non-thinking mode supports sampling. 0.5 keeps editorial rewrites natural
# without drifting away from the source.
TEMPERATURE = 0.5
MAX_TOKENS = 1000


class SocialCopyError(RuntimeError):
    """Generated social copy is unpublishable, so the run must fail closed."""


# Framing that describes the article from the outside instead of stating the
# author's own ideas. Phrases ending in a word get a trailing boundary so
# "the author" does not also reject a legitimate "the authors of the study".
META_SUMMARY_PHRASES = (
    "the author",
    "the writer",
    "the reader",
    "this article",
    "this essay",
    "this piece",
    "this post",
    "the article argues",
    "the essay explains",
    "the author writes",
    "i wrote about",
    "new post:",
    "check out",
    "here are my thoughts on",
)
META_SUMMARY_PATTERN = re.compile(
    "|".join(
        rf"\b{re.escape(phrase)}\b" if phrase[-1].isalnum() else rf"\b{re.escape(phrase)}"
        for phrase in META_SUMMARY_PHRASES
    ),
    re.IGNORECASE,
)
URL_PATTERN = re.compile(r"(?:https?://|www\.)\S", re.IGNORECASE)
MARKDOWN_PATTERN = re.compile(r"!?\[[^\]\n]*\]\(|^#{1,6}\s|\*\*|__|`")


def llm_provider() -> str:
    """Selected inference backend, defaulting to DeepSeek.

    The provider is chosen only by configuration. It is never inferred from
    which credentials happen to be present, so an absent `DEEPSEEK_API_KEY`
    keeps failing closed instead of quietly switching to a local model.
    """
    provider = os.getenv("SOCIAL_LLM_PROVIDER", "").strip().lower() or PROVIDER_DEEPSEEK
    if provider not in SUPPORTED_PROVIDERS:
        raise SocialCopyError(
            f"❌ Unknown SOCIAL_LLM_PROVIDER {provider!r}; expected one of "
            + " or ".join(SUPPORTED_PROVIDERS)
        )
    return provider


def llm_model(provider: str | None = None) -> str:
    """Model name for the selected provider."""
    provider = provider or llm_provider()
    if provider == PROVIDER_OLLAMA:
        model = os.getenv("OLLAMA_MODEL", "").strip()
        if not model:
            raise SocialCopyError(
                "❌ OLLAMA_MODEL is not set; name an installed local model "
                "(see `ollama list`) when using SOCIAL_LLM_PROVIDER=ollama"
            )
        return model
    return os.getenv("DEEPSEEK_MODEL", "").strip() or DEFAULT_MODEL


def llm_identity(provider: str | None = None) -> str:
    """`provider/model` for logs. Contains no credential material."""
    provider = provider or llm_provider()
    return f"{provider}/{llm_model(provider)}"


def llm_configured(provider: str | None = None) -> bool:
    """Whether the selected provider has the configuration a call needs.

    This is configuration presence, not reachability: whether an API key is
    valid or a local server is up is proven by making the call.
    """
    provider = provider or llm_provider()
    if provider == PROVIDER_OLLAMA:
        return bool(os.getenv("OLLAMA_MODEL", "").strip())
    return bool(os.getenv("DEEPSEEK_API_KEY", "").strip())


def _request_options(provider: str, json_mode: bool = True) -> dict:
    """Extra chat-completion options for the DeepSeek request.

    Both backends are asked for JSON. DeepSeek additionally needs its `thinking`
    field disabled: this task is a rewrite, not a reasoning problem, and thinking
    tokens only add latency and cost here.
    """
    options: dict = {}
    if json_mode:
        options["response_format"] = {"type": "json_object"}
    options["extra_body"] = {"thinking": {"type": "disabled"}}
    return options


def ollama_base_url() -> str:
    """Ollama server root, without a trailing slash."""
    return (os.getenv("OLLAMA_BASE_URL", "").strip() or DEFAULT_OLLAMA_BASE_URL).rstrip("/")


def ollama_num_ctx() -> int:
    """Context window requested from the local server."""
    raw = os.getenv("OLLAMA_NUM_CTX", "").strip()
    if not raw:
        return DEFAULT_OLLAMA_NUM_CTX
    try:
        value = int(raw)
    except ValueError as error:
        raise SocialCopyError(
            f"❌ OLLAMA_NUM_CTX must be an integer number of tokens, got {raw!r}"
        ) from error
    if value < 2048:
        raise SocialCopyError(f"❌ OLLAMA_NUM_CTX must be at least 2048, got {value}")
    return value


def _client() -> OpenAI:
    """OpenAI-compatible client for the DeepSeek production backend.

    The bounds are explicit because the SDK's defaults are ten minutes and two
    retries per request: a stalled backend would otherwise outlive the job that
    pays for it, and a killed job reports nothing.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("❌ DEEPSEEK_API_KEY is missing")
    return OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com/v1",
        timeout=HOSTED_TIMEOUT_SECONDS,
        max_retries=HOSTED_MAX_RETRIES,
    )


def _ollama_chat(
    prompt: str,
    model: str,
    *,
    system: str,
    temperature: float,
    max_tokens: int,
    json_mode: bool = True,
) -> str:
    """One completion from the local Ollama server, using its native endpoint.

    The OpenAI-compatible `/v1` endpoint of Ollama 0.33.2 does not accept a
    context window per request, and the server default silently drops the oldest
    tokens -- including the instructions -- once the article is long enough. The
    native endpoint takes `num_ctx` per request, so the local preview really does
    see the whole article, exactly like the hosted model does.
    """
    payload = {
        "model": model,
        "stream": False,
        # Local thinking models otherwise spend the whole reply budget on
        # reasoning and return an empty answer.
        "think": False,
        "options": {
            "num_ctx": ollama_num_ctx(),
            "temperature": temperature,
            "num_predict": max_tokens,
        },
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    }
    if json_mode:
        payload["format"] = "json"

    request = urllib.request.Request(
        f"{ollama_base_url()}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        raise RuntimeError(
            f"❌ Ollama is not reachable at {ollama_base_url()} ({error}); "
            "start it with `ollama serve`"
        ) from error
    except ValueError as error:
        raise RuntimeError(f"❌ Ollama returned a non-JSON response: {error}") from error

    if data.get("error"):
        raise RuntimeError(f"❌ Ollama rejected the request: {data['error']}")
    return (data.get("message") or {}).get("content") or ""


def _complete(
    prompt: str,
    model: str,
    *,
    system: str,
    temperature: float,
    max_tokens: int,
    json_mode: bool = True,
) -> str:
    """Raw assistant text from the selected provider. Shared by every caller."""
    provider = llm_provider()
    if provider == PROVIDER_OLLAMA:
        return _ollama_chat(
            prompt,
            model,
            system=system,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )

    response = _client().chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        **_request_options(provider, json_mode),
    )
    return response.choices[0].message.content or ""


def _quality_violations(text: str) -> list[str]:
    violations = []
    meta = META_SUMMARY_PATTERN.search(text)
    if meta:
        violations.append(f"outside-summary framing ({meta.group(0)!r})")
    if URL_PATTERN.search(text):
        violations.append("a URL")
    if MARKDOWN_PATTERN.search(text):
        violations.append("markdown")
    return violations


def validate_social_copy(teaser: str, points: Sequence[str], max_chars: int = POINT_MAX) -> None:
    """Refuse generated copy that must never reach the author's social accounts.

    Deterministic and cheap: no second model call, no scoring, no repair. The
    gate covers the framing the prompt forbids, URLs, leaked markdown, empty
    output, and the configured character limits.
    """
    usable_points = [point for point in points if point.strip()]
    problems: list[str] = []
    if not teaser.strip():
        problems.append("the teaser is empty")
    if not usable_points:
        problems.append("no usable points were generated")
    labelled = [("teaser", teaser)] + [
        (f"point {index}", point) for index, point in enumerate(usable_points, start=1)
    ]
    for label, value in labelled:
        problems.extend(f"{label} contains {violation}" for violation in _quality_violations(value))
    if len(teaser) > TEASER_MAX:
        problems.append(f"the teaser exceeds {TEASER_MAX} characters ({len(teaser)})")
    for index, point in enumerate(usable_points, start=1):
        if len(point) > max_chars:
            problems.append(f"point {index} exceeds {max_chars} characters ({len(point)})")
    if problems:
        raise SocialCopyError(
            "❌ Generated social copy failed the quality gate: " + "; ".join(problems)
        )


def _sanitize_text(value: str) -> str:
    return " ".join(value.strip().split())


def _specificity_score(text: str) -> int:
    """Deterministic concreteness score for choosing between teasers."""
    score = 0
    if _DIGIT_RE.search(text):
        score += 2
    if _PROPER_NOUN_RE.search(text):
        score += 1
    if SPECIFICITY_SWEET_MIN <= len(text) <= SPECIFICITY_SWEET_MAX:
        score += 1
    return score


def _teaser_usable(text: str) -> bool:
    """Whether one teaser candidate may reach a feed: non-empty, in length,
    and free of the framing the quality gate forbids."""
    if not text.strip() or len(text) > TEASER_MAX:
        return False
    return not _quality_violations(text)


def select_teaser(teaser: str, alternates: Sequence[str]) -> str:
    """Pick the most specific usable teaser; ties keep the model's first choice.

    Every candidate already passed through sanitize/truncate upstream. An
    unusable candidate is skipped, never repaired; when none is usable the
    primary is returned so the strict validation downstream still fails
    closed with its usual error.
    """
    candidates = [teaser] + [alt for alt in alternates if alt and alt != teaser]
    usable = [text for text in candidates if _teaser_usable(text)]
    if not usable:
        return teaser
    best = max(
        range(len(usable)),
        key=lambda i: (_specificity_score(usable[i]), -i),
    )
    return usable[best]


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
    """Build the deterministic DeepSeek prompt that rewrites an article as social copy."""
    title = post.get("title", "")
    url = post.get("url", "")
    published = _format_publication_date(post)
    content = (post.get("content") or "")[:MAX_ARTICLE_CHARS]
    style = "bullet" if mode == "bullets" else "narrative"
    year = published[:4] if re.fullmatch(r"\d{4}-\d{2}-\d{2}", published) else ""
    anchor = f'"In {year}..." or "At the time..."' if year else '"At the time..."'

    return dedent(
        f'''
        You are the author of the article below, adapting your own long-form writing into social copy for your own accounts. Write as though you personally extracted the strongest ideas from your draft, in your own first-person voice, never as an outside summarizer of someone else's work. Answer with JSON matching
        this schema:
        {{
          "teaser": string,  # ≤{TEASER_MAX} characters, one sentence: the sharpest claim, tension, or number in the piece
          "teaser_alternates": [string, ...],  # up to {TEASER_ALTERNATES_MAX} different angles (a number, a name, the sharpest sub-claim); same voice and length rules as the teaser
          "points": [string, ...]  # up to {max_points} {style} ideas, each ≤{max_chars} characters and each standalone
        }}

        Voice and framing rules:
        - State your ideas directly, the way you would explain them to a smart friend. Never describe the article from the outside: no "the author argues", "this essay explains", "this piece covers", "the reader", "I wrote about", "new post", "check out".
        - The teaser must stand alone in a feed with no context, and it must not merely announce the topic.
        - Each point must be a complete standalone idea that makes sense without the teaser, the article title, or earlier points, and to someone who never opens the article. Never split or continue a sentence across points.
        - Order the points strongest first: the first one is the point most likely to make someone stop scrolling.
        - Prefer your own phrasing and the concrete specifics already in the article: numbers, names, and examples.
        - Keep your actual argument, uncertainty, and nuance; do not flatten caveats into confident claims, and do not invent controversy.
        - Do not invent facts, metrics, quotes, or conclusions the article does not support.
        - Avoid academic-summary language, marketing language, clickbait, fake enthusiasm, and generic filler; do not ask rhetorical questions or issue calls to action.
        - Plain text only. Prohibit markdown, URLs, emojis, hashtags, and bullet characters.
        - Never repeat the teaser verbatim in the points, and do not open with the article title.
        - Each alternate must take a genuinely different angle from the teaser and from each other, not a rephrasing of the same sentence.
        - Respond with JSON only; do not wrap inside code fences.

        Publication-date awareness:
        - This article was published on {published}. Treat its facts, metrics, valuations, prices, product capabilities, market conditions, regulations, personnel references, and forecasts as belonging to that publication period, not to today.
        - Do not present historical or time-sensitive facts as current facts, and do not rewrite them using outside knowledge.
        - Do not blindly repeat the source's relative time words ("today", "currently", "recently", "now", "this year"); when one referred to the original publication period, drop it or anchor it in time instead.
        - When a time-sensitive fact is important, anchor it naturally in time instead of implying it is happening now, for example {anchor}.
        - Durable conceptual claims (frameworks, book reviews, decision-making ideas) do not need to be date-stamped and should stay concise.
        - Do not invent current conditions, and do not fact-check or update the article against newer events.
        - The copy must still read naturally as a social post.

        ARTICLE TITLE: {title}
        SOURCE URL: {url}
        PUBLICATION DATE: {published}

        FULL TEXT:
        """{content}"""
        '''
    ).strip()


def _extract_json(text: str, label: str = "DeepSeek") -> Dict:
    """Parse the model's JSON reply, tolerating a code fence but nothing else."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    try:
        data = json.loads(cleaned)
    except ValueError as error:
        raise SocialCopyError(
            f"❌ {label} returned unusable JSON ({error}); refusing to publish fallback copy"
        ) from error
    if not isinstance(data, dict):
        raise SocialCopyError(
            f"❌ {label} returned JSON of type {type(data).__name__}, expected an object"
        )
    return data


def complete_json(
    prompt: str,
    *,
    system: str,
    temperature: float = TEMPERATURE,
    max_tokens: int = MAX_TOKENS,
) -> Dict:
    """One JSON-object completion from the selected provider.

    The seam for callers that need the shared provider selection, request
    shaping, and JSON parsing but not social copy: `summarize_post` owns its own
    prompt and quality gate, and this deliberately bypasses its `DRY_RUN` mock so
    a caller can never mistake fabricated output for a real judgment.
    """
    provider = llm_provider()
    label = PROVIDER_LABELS[provider]
    text = _complete(
        prompt,
        llm_model(provider),
        system=system,
        temperature=temperature,
        max_tokens=max_tokens,
        json_mode=True,
    ).strip()
    if not text:
        raise SocialCopyError(f"❌ {label} returned an empty response")
    return _extract_json(text, label)


def summarize_post(
    post: Dict,
    mode: Literal["bullets", "narrative"] = "bullets",
    max_points: int = 4,
    max_chars: int = 240,
    model: str | None = None,
) -> Dict:
    """Distill one article into the author's own social copy.

    Returns {"teaser": str, "points": [str, ...]}. Raises SocialCopyError when
    the model call fails, the response is unusable, or the generated copy fails
    the quality gate: publishing fabricated or third-person fallback text under
    the author's own name is worse than not publishing.

    `model` overrides the selected provider's configured model.
    """
    use_real_api = os.getenv("TEST_API", "false").lower() == "true"

    if os.getenv("DRY_RUN", "").lower() == "true" and not use_real_api:
        print("🚫 DRY_RUN enabled - using mock teaser/points (set TEST_API=true to review real LLM copy)")
        return {
            "teaser": "Mock teaser for testing",
            "points": [
                "Mock summary point 1",
                "Mock summary point 2",
                "Mock summary point 3",
                "Mock summary point 4",
            ][:max_points],
            "teaser_candidates": ["Mock teaser for testing"],
        }

    content = (post.get("content") or "")[:MAX_ARTICLE_CHARS]

    if not content.strip():
        raise SocialCopyError(
            "❌ The article has no content to distill; refusing to publish fallback copy"
        )

    provider = llm_provider()
    model = model or llm_model(provider)
    label = PROVIDER_LABELS[provider]
    prompt = build_summary_prompt(post, mode=mode, max_points=max_points, max_chars=max_chars)

    print(f"🤖 LLM provider: {provider}")
    print(f"🤖 LLM model: {model}")
    try:
        text = _complete(
            prompt,
            model,
            system=(
                "You are the author of the article, writing your own social posts. "
                "You never summarize your own work in the third person."
            ),
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS,
        ).strip()
    except Exception as error:
        raise SocialCopyError(f"❌ {label} summarizer failed: {error}") from error

    if not text:
        raise SocialCopyError(
            f"❌ {label} returned an empty response; refusing to publish fallback copy"
        )
    print(f"📥 API raw response (truncated): {text[:120]}...")

    data = _extract_json(text, label)
    raw_points = data.get("points")
    if not isinstance(raw_points, list):
        raise SocialCopyError(
            f"❌ {label} returned malformed points ({type(raw_points).__name__}), expected a list"
        )

    teaser = _truncate(_sanitize_text(str(data.get("teaser", ""))), TEASER_MAX)
    raw_alternates = data.get("teaser_alternates")
    alternates: list[str] = []
    if isinstance(raw_alternates, list):
        for alternate in raw_alternates:
            clean_alternate = _truncate(_sanitize_text(str(alternate)), TEASER_MAX)
            if (
                clean_alternate
                and clean_alternate != teaser
                and clean_alternate not in alternates
            ):
                alternates.append(clean_alternate)
    alternates = alternates[:TEASER_ALTERNATES_MAX]
    selected = select_teaser(teaser, alternates)
    points: list[str] = []
    for point in raw_points:
        clean_point = _truncate(_sanitize_text(str(point)), max_chars)
        if clean_point and clean_point not in points:
            points.append(clean_point)
    points = points[:max_points]

    validate_social_copy(selected, points, max_chars=max_chars)
    return {
        "teaser": selected,
        "points": points,
        "teaser_candidates": [teaser] + alternates,
    }


def localize_zh_cn(title: str, teaser: str, point: str, url: str, max_chars: int = 1800,
                   model: str | None = None) -> str:
    """Adapt an English article into Simplified-Chinese microblog copy for Weibo.

    Raises instead of falling back: silently posting the English text (or a
    stub) to a Chinese-language audience would be worse than failing the run.
    """
    provider = llm_provider()
    model = model or llm_model(provider)
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
        print(f"🤖 Localizing article into Simplified Chinese ({llm_identity(provider)})...")
        body = _sanitize_text(
            _complete(
                prompt,
                model,
                system="你是一位面向中文读者的科技专栏作者，只返回微博正文。",
                temperature=0.3,
                max_tokens=1500,
                json_mode=False,
            )
        )
        if not body:
            raise ValueError("Localization returned no usable content")
        text = f"{body}\n\n{url}".strip()
        if len(text) > max_chars + len(url) + 2:
            text = f"{_truncate(body, max_chars)}\n\n{url}".strip()
        return text  # post_to_weibo enforces the Weibo character limit
    except Exception as error:
        raise RuntimeError(f"❌ Weibo localization failed, refusing to post unlocalized text: {error}")
