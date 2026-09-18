from scripts.scout import inventory


def _entry(**overrides):
    entry = {
        "id": "incentives",
        "title": "Incentives beat advice",
        "url": "https://leonlins.com/writing/incentives",
        "date": "2021-01-01",
        "category": "Notes",
        "tags": ["behaviour", "investing"],
        "content": "Incentives explain behaviour better than instruction.",
    }
    entry.update(overrides)
    return entry


def test_entries_missing_an_id_title_or_url_are_skipped_not_guessed():
    items = inventory.build_inventory(
        [
            _entry(),
            _entry(id=""),
            _entry(title="  "),
            _entry(url=""),
            _entry(id=None, title=None, url=None),
        ]
    )

    assert [item.content_id for item in items] == ["incentives"]


def test_body_is_capped_at_what_a_judgment_and_draft_need():
    item = inventory.build_inventory([_entry(content="x" * (inventory.BODY_CHARS + 500))])[0]

    assert len(item.body) == inventory.BODY_CHARS


def test_summary_is_the_body_lede_and_never_exceeds_its_own_cap():
    item = inventory.build_inventory([_entry(content="y" * (inventory.SUMMARY_CHARS + 100))])[0]

    assert item.summary == item.body[: inventory.SUMMARY_CHARS]
    assert len(item.summary) == inventory.SUMMARY_CHARS


def test_tags_are_trimmed_and_empty_or_non_string_ones_dropped():
    item = inventory.build_inventory([_entry(tags=["behaviour", "  ", None, " investing "])])[0]

    assert item.tags == ("behaviour", "investing")


def test_missing_optional_fields_become_empty_strings_rather_than_none():
    item = inventory.build_inventory([_entry(date=None, category=None, tags=None, content=None)])[0]

    assert (item.published_at, item.category, item.tags, item.summary, item.body) == ("", "", (), "", "")


def test_load_inventory_reads_the_published_index_once(monkeypatch):
    calls = []

    def fake_fetch_posts():
        calls.append(1)
        return [_entry()]

    monkeypatch.setattr(inventory, "fetch_posts", fake_fetch_posts)

    items = inventory.load_inventory()

    assert len(calls) == 1
    assert [item.url for item in items] == ["https://leonlins.com/writing/incentives"]
