"""Public/private boundary checks for Scout and repository-local secrets."""

from pathlib import Path


ROOT = Path(__file__).parents[1]


def test_secret_env_variants_are_ignored_but_example_is_allowed():
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()

    assert ".env*" in ignore
    assert "!.env.example" in ignore


def test_live_scout_and_operational_records_are_ignored():
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")

    for path in (
        "/scout-state.json",
        "/scout-report.txt",
        "/scout-shadow.jsonl",
        "/SECURITY-REVIEW*.md",
        "/docs/newsletter-status.md",
        "/docs/newsletter-sns-diagnostics.md",
    ):
        assert path in ignore


def test_public_scout_workflow_uses_only_encrypted_private_state():
    workflow = (ROOT / ".github" / "workflows" / "scout.yml").read_text(encoding="utf-8")

    assert "contents: read" in workflow
    assert "actions: read" in workflow
    assert "SCOUT_STATE_PASSPHRASE: ${{ secrets.SCOUT_STATE_PASSPHRASE }}" in workflow
    assert "GITHUB_STEP_SUMMARY= python -m scripts.scout" in workflow
    assert "> scout-report.txt 2>&1" in workflow
    assert "--symmetric --cipher-algo AES256" in workflow
    assert "name: scout-private-state" in workflow
    assert "retention-days: 90" in workflow
    assert "git add scout-state.json" not in workflow
    assert "contents: write" not in workflow
