"""The shared atomic JSON document used by every committed state file.

`posted.json` and `scout-state.json` are written by scheduled jobs that can be
killed at any moment, so the failure mode that matters is a half-written state
file. These tests pin the atomic replace, the deterministic formatting, and the
refusal to treat a non-object document as empty state.
"""
import json

import pytest

from scripts.automation import json_store


def test_a_missing_file_reads_as_no_state_yet(tmp_path):
    assert json_store.load_json_object(tmp_path / "posted.json") is None


def test_a_saved_document_round_trips(tmp_path):
    path = tmp_path / "posted.json"
    payload = {"version": 1, "posts": {"a": {"posted_at": "2026-01-01"}}}

    json_store.save_json_object(path, payload)

    assert json_store.load_json_object(path) == payload


def test_saved_documents_are_deterministic_and_diff_friendly(tmp_path):
    path = tmp_path / "posted.json"

    json_store.save_json_object(path, {"b": 1, "a": {"z": True}})
    first = path.read_bytes()
    json_store.save_json_object(path, {"a": {"z": True}, "b": 1})

    assert path.read_bytes() == first
    assert first.decode("utf-8") == '{\n  "a": {\n    "z": true\n  },\n  "b": 1\n}\n'


def test_saving_creates_missing_parent_directories(tmp_path):
    path = tmp_path / "nested" / "state" / "posted.json"

    json_store.save_json_object(path, {"posts": {}})

    assert json_store.load_json_object(path) == {"posts": {}}


def test_a_replaced_document_leaves_no_temporary_files_behind(tmp_path):
    path = tmp_path / "posted.json"

    json_store.save_json_object(path, {"posts": {}})
    json_store.save_json_object(path, {"posts": {"x": {}}})

    assert [entry.name for entry in tmp_path.iterdir()] == ["posted.json"]


def test_an_unserializable_payload_leaves_the_previous_document_intact(tmp_path):
    path = tmp_path / "posted.json"
    json_store.save_json_object(path, {"posts": {}})

    with pytest.raises(TypeError):
        json_store.save_json_object(path, {"posts": {1, 2}})

    assert json_store.load_json_object(path) == {"posts": {}}
    assert [entry.name for entry in tmp_path.iterdir()] == ["posted.json"]


@pytest.mark.parametrize("document", ["[]", '"text"', "3", "null"])
def test_a_non_object_document_is_an_error_not_empty_state(tmp_path, document):
    path = tmp_path / "posted.json"
    path.write_text(document, encoding="utf-8")

    with pytest.raises(ValueError) as error:
        json_store.load_json_object(path)

    assert "must contain a JSON object" in str(error.value)


def test_malformed_json_still_raises_the_parse_error(tmp_path):
    path = tmp_path / "posted.json"
    path.write_text("{ not json", encoding="utf-8")

    with pytest.raises(json.JSONDecodeError):
        json_store.load_json_object(path)
