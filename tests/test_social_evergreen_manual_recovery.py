"""Guard the manual Instagram-only recovery path without exercising publishing."""
from pathlib import Path

from scripts.automation.routing import DEFAULT_PLATFORMS

WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "social-evergreen.yml"


def test_manual_recovery_requires_article_and_defaults_to_preview():
    workflow = WORKFLOW.read_text()
    manual = workflow.split("  workflow_dispatch:\n    inputs:\n", 1)[1].split("\npermissions:", 1)[0]
    assert "      target_post_id:\n" in manual
    assert "        required: true\n        type: string\n" in manual
    publish = manual.split("      publish:\n", 1)[1]
    assert "        type: boolean\n        default: false\n" in publish

    # Publish cannot happen by simply pressing the manual Run workflow button:
    # the operator must select an article AND explicitly opt into publishing.
    assert "DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && !inputs.publish && 'true' || 'false' }}" in workflow
    assert "TARGET_POST_ID: ${{ github.event_name == 'workflow_dispatch' && inputs.target_post_id || '' }}" in workflow


def test_manual_recovery_is_instagram_only_without_changing_scheduled_destinations():
    workflow = WORKFLOW.read_text()
    expected = ",".join(DEFAULT_PLATFORMS)
    assert (
        "PLATFORM: ${{ github.event_name == 'workflow_dispatch' && 'instagram' || '"
        + expected + "' }}"
    ) in workflow
    assert "          DISTRIBUTION_MODE: evergreen\n" in workflow
    assert "          FAIL_ON_PUBLISH_ERROR: 'true'\n" in workflow
