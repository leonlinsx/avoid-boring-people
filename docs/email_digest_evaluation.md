# Email Summary Digest Assessment & Recommendations

## 1. Prompting & Narrative

- **Current state**: DeepSeek summarization in `scripts/automation/summarizers/llm_summarizer.py` (`summarize_post`, L43) returns a teaser plus up to four points as JSON, with whitespace normalization and character limits enforced in post-processing (`_sanitize_text`/`_truncate`, L32-40). Dry runs substitute mock content by design. A second entry point, `localize_zh_cn` (L157), adapts an article into Simplified-Chinese microblog copy for Weibo and raises rather than falling back to English.
- **Working as intended**: JSON schema enforcement, factuality guardrails, de-duplication, per-point character caps.
- **Next opportunities**:
  - Extend the prompt with audience-specific tone controls (e.g., "operator", "founder") driven by metadata.
  - Capture confidence metadata from the LLM (e.g., flagged hallucination risk) and surface it to editors.

## 2. Ranking & Filtering

- **Current state**: `scripts/automation/ranking.py` filters by minimum word count, categories, and excluded tags (`filter_posts`, L58) and scores by freshness and tag preference (`score_posts`, L80). The scheduler applies filters before selection and honors `priority_score`.
- **Working as intended**: `tests/test_ranking.py` locks in `filter_posts`/`score_posts` behavior (the earlier roadmap item for these tests is done).
- **Next opportunities**:
  - Feed engagement signals (open rates, click-throughs) into `priority_score` to personalize ranking.
  - Cache and reuse scores across runs to avoid recomputation.

## 3. Coverage & Signal

- **Current state**: Filtering defaults drop short posts and boost longer, fresher, or tag-aligned pieces, providing baseline coverage.
- **Next opportunities**:
  - Track coverage across thematic pillars (e.g., finance vs. product) to avoid repetitive sends.
  - Incorporate a lightweight redundancy detector that suppresses posts already summarized in the last N digests.

## 4. Delivery

- **Current state**: No longer manual-only. The same summary objects feed social threads, and a constrained Markdown-to-email renderer (`src/lib/newsletter/render.ts`) plus guarded campaign CLI (`scripts/newsletter/`) deliver full-article email through SES. Per-recipient rendering is logged; GitHub step summaries record per-platform outcomes.
- **Next opportunities**:
  - Add observability hooks (structured logs or GitHub summary) summarizing which posts were filtered out of the queue and why.

## 5. Additional Technical Improvements & Code Quality

- **Shipped**:
  - Normalized summary text sanitation, deduplication, and truncation to avoid runtime surprises when pushing to character-limited channels.
  - A dedicated ranking module with dataclass-backed configuration to keep heuristics isolated and testable.
  - Shared OpenAI-compatible client construction (`_client`, L13) reused by both the social summarizer and the Weibo localizer.
- **Roadmap**:
  - Move sensitive API configuration into typed settings objects shared across scripts.
