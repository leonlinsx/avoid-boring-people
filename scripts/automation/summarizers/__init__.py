from .summarizer_stub import summarize_post as stub_summarize


def llm_summarize(*args, **kwargs):
    """Load the optional OpenAI dependency only when LLM summarization is enabled."""
    from .llm_summarizer import summarize_post

    return summarize_post(*args, **kwargs)
