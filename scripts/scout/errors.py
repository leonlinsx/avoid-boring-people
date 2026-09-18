"""The failure Scout reports to the author instead of guessing around."""
import re

# Long enough to name a status code or a provider complaint, short enough that a
# log line built from an external service's message stays one line.
MAX_NOTE_CHARS = 200

_ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


class ScoutError(RuntimeError):
    """A Scout run cannot produce a trustworthy result, so it must fail loudly."""


def note(error: Exception) -> str:
    """One clipped line naming an error, for a greppable log line.

    The exception class alone cannot separate a rate limit from a code bug, which
    is the difference between waiting a day and rotating a key. The message is
    flattened to one line first, because this text also lands in the report and
    an embedded newline or escape sequence would forge a line of it.
    """
    message = " ".join(_ANSI_ESCAPE_PATTERN.sub("", str(error)).split())
    return f"{type(error).__name__}: {message}"[:MAX_NOTE_CHARS]
