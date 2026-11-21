import copy
from datetime import datetime, timedelta, timezone
from scripts.instagram_growth import scorecard as s
from tests.test_instagram_growth_rolling_queue import manifest

NOW = datetime(2026, 11, 30, 12, tzinfo=timezone.utc)


def asset(name='example-one', digit='a'):
    m = manifest(name, release_after='2026-11-20T12:00:00Z')
    return {**m, 'trial': False, 'graduation_strategy': None, 'video_sha256': digit * 64}


def state():
    return {'account': 'avoidboringpeople', 'receipts': {}, 'observations': {}, 'account_snapshots': {}}


def test_inventory_thresholds_and_used_hash_aliases():
    st = state()
    assert s.inventory([], st, NOW)['level'] == 'EXHAUSTED'
    assert s.inventory([asset()], st, NOW)['level'] == 'LOW'
    st['receipts']['renamed-published'] = {'sha256': 'a' * 64, 'status': 'published'}
    assert s.inventory([asset()], st, NOW)['approved_unpublished'] == 0
    assert s.inventory([{**asset(), 'review_status': 'rejected'}], state(), NOW)['invalid_or_duplicate']
    items = [{**asset('example-' + str(i)), 'video_sha256': f'{i:064x}'} for i in range(21)]
    assert s.inventory(items, state(), NOW)['level'] == 'OK'
    assert s.inventory(items[:10], state(), NOW)['level'] == 'BUFFER_SHORT'
    assert s.inventory(items[:6], state(), NOW)['level'] == 'LOW'


def test_ordinary_only_and_duplicate_inventory():
    assert s.inventory([{**asset(), 'trial': True}], state(), NOW)['approved_unpublished'] == 0
    assert s.inventory([asset(), {**asset(), 'concept_id': 'other-alias'}], state(), NOW)['approved_unpublished'] == 1


def test_partial_week_is_not_weekly_zero_growth():
    st = state(); st['account_snapshots'] = {'start': {'captured_at': (NOW - timedelta(days=2)).isoformat(), 'followers_count': 0},
                                           'end': {'captured_at': NOW.isoformat(), 'followers_count': 0}}
    f = s.build(st, [], NOW)['followers']
    assert f['net_new_followers_week'] is None and f['observed_change'] == 0
    st['account_snapshots']['start']['captured_at'] = (NOW - timedelta(days=7)).isoformat()
    st['account_snapshots']['end']['followers_count'] = 8
    assert s.build(st, [], NOW)['followers']['net_new_followers_week'] == 8


def test_late_and_small_exposure_do_not_rank_or_fabricate_missing():
    st = state(); m = asset(); st['receipts'][m['concept_id']] = {'status': 'published', 'published_at': (NOW - timedelta(days=8)).isoformat()}
    st['observations']['example-one-7d'] = {'actual_age_hours': 168, 'metrics': {'reach': 4, 'views': 31}}
    report = s.build(st, [m], NOW); row = report['rows'][0]
    assert not row['eligible_for_comparison'] and row['metrics']['follows'] is None
    assert 'shares' in row['missing'] and not report['top_hypotheses']
    assert all(x['status'] == 'overdue' for x in report['pending_windows'])
    st['observations']['example-one-7d']['actual_age_hours'] = 200
    st['observations']['example-one-7d']['metrics']['reach'] = 10000
    assert not s.build(st, [m], NOW)['rows'][0]['eligible_for_comparison']


def test_outlier_on_one_article_cannot_drive_exploitation():
    row = {'window': '7d', 'eligible_for_comparison': True, 'hypothesis': 'contrast',
           'source_url': 'https://leonlins.com/writing/one', 'concept_id': 'example-one',
           'metrics': {'reach': 10000, 'shares': 100}}
    assert s.replicated_patterns([row, copy.deepcopy(row)]) == []
    another = {**row, 'source_url': 'https://leonlins.com/writing/two', 'concept_id': 'example-two'}
    result = s.replicated_patterns([row, another])
    assert result[0]['n_reels'] == 2 and result[0]['shares_per_1000_reached'] == 10


def test_pending_is_not_due_before_actual_age():
    st = state(); st['receipts']['example-one'] = {'status': 'published', 'published_at': NOW.isoformat()}
    report = s.build(st, [asset()], NOW)
    assert len(report['pending_windows']) == 3
    assert all(x['status'] == 'not_due' for x in report['pending_windows'])
