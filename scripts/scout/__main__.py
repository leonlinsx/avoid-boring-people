"""Entry point for `python -m scripts.scout`."""
from __future__ import annotations

import sys

from scripts.scout.cli import main

if __name__ == "__main__":
    sys.exit(main())
