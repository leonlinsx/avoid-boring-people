# scripts/automation/publishers/publish0x.py

import json
import logging
import subprocess
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Cookie file path (overridable via .env)
COOKIES_FILE = os.getenv("PUBLISH0X_COOKIES_FILE", "./cookies/publish0x.json")

def post_to_publish0x(post: dict) -> None:
    """
    Autopost to Publish0x only if the post has crypto-related tags.

    Args:
        post (dict): Must contain 'title', 'content', 'tags'.
    """
    tags = [t.lower() for t in post.get("tags", [])]
    if not any(t in tags for t in ["crypto", "cryptocurrency", "defi", "blockchain"]):
        logger.info(f"⏭ Skipping Publish0x: Not crypto-related (tags={tags})")
        return

    # Path to Puppeteer runner script
    script_path = Path(__file__).parent.parent / "publish0x_runner.js"

    # Save post payload to a temporary JSON file
    payload_path = Path("post_payload.json")
    with open(payload_path, "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=2)

    try:
        logger.info(f"✅ Posting '{post['title']}' to Publish0x... (cookies={COOKIES_FILE})")
        result = subprocess.run(
            ["node", str(script_path), str(payload_path)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.error(f"❌ Publish0x autopost failed:\n{result.stderr}")
        else:
            logger.info("🎉 Publish0x post successful.")
            if result.stdout.strip():
                logger.debug(f"Publish0x output:\n{result.stdout}")
    except Exception as e:
        logger.error(f"❌ Publish0x autopost exception: {e}")
    finally:
        if payload_path.exists():
            payload_path.unlink()
