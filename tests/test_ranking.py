import os
from datetime import datetime, timedelta, timezone
import unittest

from scripts.automation.ranking import (
    SCOUT_RELEVANCE_MAX_BOOST,
    RankingConfig,
    apply_scout_relevance_boost,
    filter_posts,
    score_posts,
)


class FilterPostsTests(unittest.TestCase):
    def setUp(self):
        # Ensure environment-driven configuration does not leak between tests.
        for name in [
            "DIGEST_ALLOWED_CATEGORIES",
            "DIGEST_EXCLUDED_TAGS",
            "DIGEST_PREFERRED_TAGS",
            "DIGEST_MIN_WORDS",
            "DIGEST_FRESHNESS_HALF_LIFE",
        ]:
            os.environ.pop(name, None)

    def test_applies_min_words_categories_and_excluded_tags(self):
        os.environ["DIGEST_ALLOWED_CATEGORIES"] = "tech"
        os.environ["DIGEST_EXCLUDED_TAGS"] = "spam"
        self.addCleanup(lambda: os.environ.pop("DIGEST_ALLOWED_CATEGORIES", None))
        self.addCleanup(lambda: os.environ.pop("DIGEST_EXCLUDED_TAGS", None))

        config = RankingConfig(min_word_count=5)

        posts = [
            {
                "id": "passes",
                "content": "word " * 6,
                "category": "Tech",
                "tags": ["product"],
            },
            {
                "id": "too_short",
                "content": "word " * 4,
                "category": "Tech",
                "tags": ["product"],
            },
            {
                "id": "wrong_category",
                "content": "word " * 6,
                "category": "News",
                "tags": ["product"],
            },
            {
                "id": "excluded_tag",
                "content": "word " * 6,
                "category": "Tech",
                "tags": ["Spam"],
            },
        ]

        filtered = filter_posts(posts, config)

        self.assertEqual(["passes"], [post["id"] for post in filtered])


class ScorePostsTests(unittest.TestCase):
    def setUp(self):
        for name in [
            "DIGEST_ALLOWED_CATEGORIES",
            "DIGEST_EXCLUDED_TAGS",
            "DIGEST_PREFERRED_TAGS",
            "DIGEST_MIN_WORDS",
            "DIGEST_FRESHNESS_HALF_LIFE",
        ]:
            os.environ.pop(name, None)

    def test_scores_include_freshness_length_tags_and_manual_overrides(self):
        os.environ["DIGEST_PREFERRED_TAGS"] = "preferred"
        self.addCleanup(lambda: os.environ.pop("DIGEST_PREFERRED_TAGS", None))

        now = datetime.now(timezone.utc)
        config = RankingConfig()

        posts = [
            {
                "id": "old",
                "content": "word " * 800,
                "date": (now - timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%S%z"),
                "tags": ["general"],
            },
            {
                "id": "fresh_tagged",
                "content": "word " * 800,
                "date": (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S%z"),
                "tags": ["Preferred"],
            },
            {
                "id": "manual_boost",
                "content": "word " * 400,
                "date": (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S%z"),
                "tags": ["general"],
                "priority_score": 2,
            },
            {
                "id": "invalid_override",
                "content": "word " * 400,
                "date": (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S%z"),
                "tags": ["general"],
                "priority_score": "n/a",
            },
        ]

        scored = score_posts(posts, config)

        # Results should be sorted in descending priority order.
        ordered_ids = [post["id"] for post in scored]
        self.assertEqual(
            ["fresh_tagged", "manual_boost", "invalid_override", "old"],
            ordered_ids,
        )

        # Check that the manual override and preferred tags impact the score as expected.
        scores = {post["id"]: post["priority_score"] for post in scored}

        self.assertGreater(scores["manual_boost"], scores["invalid_override"])
        self.assertGreater(scores["fresh_tagged"], scores["manual_boost"])
        self.assertGreater(scores["invalid_override"], scores["old"])

        # Ensure the invalid override was ignored rather than causing an error.
        self.assertNotEqual(scores["invalid_override"], scores["manual_boost"])


class ScoutRelevanceBoostTests(unittest.TestCase):
    NOW = datetime(2026, 9, 27, tzinfo=timezone.utc)

    def _state(self, *entries):
        return {"version": 1, "opportunities": {str(index): entry for index, entry in enumerate(entries)}}

    def _entry(self, **overrides):
        entry = {
            "content_id": "article/index.md",
            "content_url": "https://leonlins.com/writing/article/",
            "status": "surfaced",
            "surfaced_at": (self.NOW - timedelta(days=1)).isoformat(),
        }
        entry.update(overrides)
        return entry

    def test_fresh_surfaced_signal_boosts_exact_article_id(self):
        posts = [{"id": "article/index.md", "url": "https://elsewhere.invalid", "priority_score": 1.0}]

        boosted = apply_scout_relevance_boost(posts, self._state(self._entry()), now=self.NOW)

        self.assertEqual(1.0 + SCOUT_RELEVANCE_MAX_BOOST, boosted[0]["priority_score"])

    def test_signal_expires_after_fixed_ttl(self):
        stale = self._entry(surfaced_at=(self.NOW - timedelta(days=8)).isoformat())
        posts = [{"id": "article/index.md", "priority_score": 1.0}]

        self.assertEqual(posts, apply_scout_relevance_boost(posts, self._state(stale), now=self.NOW))

    def test_missing_or_invalid_state_leaves_scores_unchanged(self):
        posts = [{"id": "article/index.md", "priority_score": 1.0}]

        self.assertEqual(posts, apply_scout_relevance_boost(posts, {}, now=self.NOW))
        self.assertEqual(posts, apply_scout_relevance_boost(posts, {"opportunities": []}, now=self.NOW))

    def test_multiple_fresh_signals_are_capped_at_one_fixed_bonus(self):
        posts = [{"id": "article/index.md", "priority_score": 1.0}]
        state = self._state(self._entry(), self._entry(content_url="https://leonlins.com/writing/other/"))

        boosted = apply_scout_relevance_boost(posts, state, now=self.NOW)

        self.assertEqual(1.0 + SCOUT_RELEVANCE_MAX_BOOST, boosted[0]["priority_score"])

    def test_only_exact_id_or_canonical_url_matches(self):
        posts = [{"id": "article", "url": "https://leonlins.com/writing/article", "priority_score": 1.0}]

        self.assertEqual(posts, apply_scout_relevance_boost(posts, self._state(self._entry()), now=self.NOW))


if __name__ == "__main__":
    unittest.main()
