"""Dormant publisher adapters must not break unrelated runs at import time.

`check_tokens` imports this package for the Meta probes and `auto_post`
resolves it on the Twitter path, so an eager adapter import used to let a
bit-rotted dormant adapter (e.g. X/Twitter, LinkedIn, Weibo) fail runs that
never touch it. Each test runs a fresh interpreter because module state does
not reset within one pytest process.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_check(script: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )


def test_package_import_loads_no_adapter():
    result = run_check(
        "import sys; "
        "import scripts.automation.publishers; "
        "loaded = sorted(m for m in sys.modules "
        "if m.startswith('scripts.automation.publishers.')); "
        "assert loaded == [], loaded"
    )
    assert result.returncode == 0, result.stderr


def test_broken_dormant_adapter_breaks_neither_import_nor_sibling():
    # Poisoning sys.modules with None makes any import of that module raise
    # ImportError, simulating a rotted dormant adapter without touching disk.
    result = run_check(
        "import sys; "
        "sys.modules['scripts.automation.publishers.twitter'] = None; "
        "import scripts.automation.publishers as publishers; "
        "assert publishers.threads is not None"
    )
    assert result.returncode == 0, result.stderr
