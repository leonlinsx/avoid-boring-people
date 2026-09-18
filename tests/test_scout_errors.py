from scripts.scout.errors import MAX_NOTE_CHARS, ScoutError, note


def test_a_note_names_the_error_class_and_its_message():
    assert note(ScoutError("❌ https://hn.test unreachable")) == (
        "ScoutError: ❌ https://hn.test unreachable"
    )


def test_a_note_is_always_one_line():
    """This text is also written into the report, where a newline forges a line."""
    assert note(ScoutError("boom\r\nsecond line\ntail")) == "ScoutError: boom second line tail"
    assert note(ScoutError("boom\x1b[31mred\x1b[0m")) == "ScoutError: boomred"


def test_a_note_is_clipped_to_a_length_a_log_line_can_carry():
    message = note(ScoutError("x" * (MAX_NOTE_CHARS * 2)))

    assert len(message) == MAX_NOTE_CHARS
