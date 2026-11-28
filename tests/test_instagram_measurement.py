"""Age-window and failure controls for the existing hosted measurement loop."""
import copy
import base64
import json
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pytest

from scripts.instagram_growth import hosted as h, scorecard


NOW = datetime(2026, 11, 26, 12, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch):
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW
    monkeypatch.setattr(h, 'datetime', Clock)
    monkeypatch.setattr(scorecard, 'datetime', Clock)


def store_with_ages(*ages):
    state = {'account': 'avoidboringpeople', 'receipts': {
        f'reel-{i:02}': {'status': 'published', 'media_id': str(10000+i),
                        'published_at': (NOW-timedelta(hours=age)).isoformat()}
        for i, age in enumerate(ages)
    }}
    saved = []
    return SimpleNamespace(state=state, save=lambda: saved.append(copy.deepcopy(state))), saved


def reads(monkeypatch, *, unavailable=()):
    calls = []
    monkeypatch.setattr(h.pilot, 'account_snapshot', lambda: {
        'account': 'avoidboringpeople', 'captured_at': NOW.isoformat(), 'followers_count': 0})

    def fetch(media_id):
        calls.append(media_id)
        return {'captured_at': NOW.isoformat(), 'media_id': media_id,
                'metrics': {'reach': None if media_id in unavailable else 0}}

    monkeypatch.setattr(h.pilot, 'fetch_insights', fetch)
    monkeypatch.setattr(h.pilot, 'publish', lambda *a, **kw: pytest.fail('measurement must not publish'))
    return calls


def test_global_fetch_budget_and_deadline_priority(monkeypatch):
    store, saved = store_with_ages(*([24]*12), 29)
    calls = reads(monkeypatch)
    h.measure(store)
    assert len(calls) == 12
    assert calls[0] == '10012'  # Closest deadline first, regardless of ledger order.
    assert len(saved[-1]['observations']) == 12
    assert saved[-1]['measurement_health']['remaining_due'] == 1


def test_late_read_cannot_masquerade_as_three_historical_windows(monkeypatch):
    store, saved = store_with_ages(169)
    calls = reads(monkeypatch)
    h.measure(store)
    assert calls == ['10000']
    assert set(saved[-1]['observations']) == {'reel-00-7d'}
    assert set(saved[-1]['measurement_gaps']) == {'reel-00-24h', 'reel-00-48h'}
    report = scorecard.build(store.state, [], NOW)
    assert all(x['status'] == 'missed' for x in report['pending_windows'])
    assert report['rows'][0]['actual_age_hours'] == 169
    h.measure(store)
    assert calls == ['10000']  # Neither successful nor expired windows are refetched.


def test_missing_metrics_preserve_other_readings_and_fail_visibly(monkeypatch):
    store, saved = store_with_ages(25, 25)
    calls = reads(monkeypatch, unavailable=('10000',))
    with pytest.raises(h.StateError, match='measurement incomplete'):
        h.measure(store)
    assert len(calls) == 2
    assert set(saved[-1]['observations']) == {'reel-01-24h'}
    assert 'last_measurement_at' not in saved[-1]
    assert saved[-1]['measurement_health']['status'] == 'failed'
    assert len(saved[-1]['account_snapshots']) == 1
    calls = reads(monkeypatch)
    h.measure(store)
    assert calls == ['10000']
    assert saved[-1]['last_measurement_at'] == NOW.isoformat()


@pytest.mark.parametrize('age, expected_reads', [(24, 1), (30, 1), (30.01, 0),
                                              (48, 1), (54, 1), (54.01, 0),
                                              (168, 1), (192, 1), (192.01, 0)])
def test_existing_comparison_deadlines_are_not_widened(monkeypatch, age, expected_reads):
    store, _ = store_with_ages(age)
    calls = reads(monkeypatch)
    h.measure(store)
    assert len(calls) == expected_reads


def test_unavailable_reads_consume_the_global_budget(monkeypatch):
    store, saved = store_with_ages(*([25]*13))
    calls = reads(monkeypatch, unavailable=tuple(str(10000+i) for i in range(13)))
    with pytest.raises(h.StateError):
        h.measure(store)
    assert len(calls) == 12
    assert saved[-1]['measurement_health']['attempted'] == 12
    assert saved[-1]['measurement_health']['remaining_due'] == 13
    assert saved[-1]['observations'] == {}


def test_transport_failure_is_bounded_and_other_readings_survive(monkeypatch):
    store, saved = store_with_ages(25, 25)
    reads(monkeypatch)
    original = h.pilot.fetch_insights

    def fetch(media_id):
        if media_id == '10000':
            raise h.requests.ConnectionError('secret-like provider message must not be persisted')
        return original(media_id)

    monkeypatch.setattr(h.pilot, 'fetch_insights', fetch)
    with pytest.raises(h.StateError):
        h.measure(store)
    assert set(saved[-1]['observations']) == {'reel-01-24h'}
    assert 'secret-like' not in str(saved[-1])
    assert saved[-1]['measurement_health']['failures'][0]['error_type'] == 'ConnectionError'


def test_measurement_state_failure_never_reports_success(monkeypatch):
    store, _ = store_with_ages(25)
    reads(monkeypatch)

    def fail():
        raise h.StateError('CAS unavailable')

    store.save = fail
    with pytest.raises(h.StateError, match='CAS unavailable'):
        h.measure(store)


def test_weekly_refreshes_measurement_before_building_report(monkeypatch, tmp_path):
    store, _ = store_with_ages(25)
    reads(monkeypatch)
    events = []
    original = h.measure
    monkeypatch.setattr(h, 'measure', lambda st: (events.append('measure'), original(st)))
    monkeypatch.setattr(h.scorecard, 'load_manifests', lambda _: [])
    build = h.scorecard.build

    def report(st, manifests):
        events.append('build')
        assert st['last_measurement_at'] == NOW.isoformat()
        return build(st, manifests, NOW)

    monkeypatch.setattr(h.scorecard, 'build', report)
    monkeypatch.setattr(h.scorecard, 'write', lambda *a: None)
    monkeypatch.delenv('GITHUB_STEP_SUMMARY', raising=False)
    h.weekly(store)
    assert events == ['measure', 'build']
    assert store.state['weekly_review']['followers']['end_snapshot_fresh'] is True


def test_weekly_cannot_consume_failed_measurement_as_current_evidence(monkeypatch):
    store, saved = store_with_ages(25)
    reads(monkeypatch, unavailable=('10000',))
    store.state['weekly_review'] = {'created_at': 'old frozen review'}
    with pytest.raises(h.StateError):
        h.weekly(store)
    assert saved[-1]['weekly_review'] == {'created_at': 'old frozen review'}


def test_weekly_cli_through_identity_insights_cas_report_and_next_plan(monkeypatch, tmp_path):
    """Run real clients and CLI; only external HTTP transport is substituted."""
    from scripts.instagram_growth.factory import allocation
    st, _ = store_with_ages(25)
    ledger = {'state': st.state, 'sha': 'first-sha'}
    archives = {}
    calls = []
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(h.pilot, 'datetime', h.datetime)
    monkeypatch.setenv('GITHUB_TOKEN', 'disposable-test-github-token')
    monkeypatch.setenv('GITHUB_REPOSITORY', h.REPO)
    monkeypatch.setenv('INSTAGRAM_USER_ID', '12345')
    monkeypatch.setenv('INSTAGRAM_ACCESS_TOKEN', 'disposable-test-meta-token')
    monkeypatch.delenv('GITHUB_STEP_SUMMARY', raising=False)
    monkeypatch.setattr(sys, 'argv', ['hosted', 'weekly'])

    def send(session, request, **kwargs):
        url = urlsplit(request.url)
        query = parse_qs(url.query)
        calls.append((request.method, url.hostname, url.path))
        if url.hostname == 'api.github.com':
            if '/contents/instagram-archives/' in url.path:
                if request.method == 'PUT':
                    body=json.loads(request.body)
                    assert 'sha' not in body and body['branch']==h.BRANCH
                    archives[url.path]=body['content'];payload={'content':{'sha':'immutable-archive'}}
                elif url.path in archives:payload={'content':archives[url.path]}
                else:
                    response=h.requests.Response();response.status_code=404;response._content=b'{}';return response
                response=h.requests.Response();response.status_code=200;response._content=json.dumps(payload).encode();return response
            assert url.path == f'/repos/{h.REPO}/contents/{h.STATE_PATH}'
            if request.method == 'PUT':
                body = json.loads(request.body)
                assert body['sha'] == ledger['sha'] and body['branch'] == h.BRANCH
                ledger['state'] = json.loads(base64.b64decode(body['content']))
                ledger['sha'] += '-saved'
                payload = {'content': {'sha': ledger['sha']}}
            else:
                assert request.method == 'GET' and query['ref'] == [h.BRANCH]
                payload = {'sha': ledger['sha'], 'content': base64.b64encode(json.dumps(ledger['state']).encode()).decode()}
        else:
            assert request.method == 'GET' and url.hostname == 'graph.instagram.com'
            if url.path.endswith('/me'):
                payload = {'user_id': '12345', 'username': 'avoidboringpeople', 'followers_count': 0}
            else:
                assert url.path.endswith('/10000/insights')
                metric = query['metric'][0]
                assert metric in h.pilot.METRICS
                payload = {'data': [{'values': [{'value': 0}]}]}
        response = h.requests.Response()
        response.status_code = 200
        response._content = json.dumps(payload).encode()
        return response

    monkeypatch.setattr(h.requests.Session, 'send', send)
    h.main()
    report = json.loads((tmp_path/'reports/instagram-growth/weekly-scorecard.json').read_text())
    assert report['followers']['observed_change'] == 0
    assert report['followers']['net_new_followers_week'] is None
    assert report['rows'][0]['metrics']['reach'] == 0
    assert report['rows'][0]['metrics']['follows'] is None
    assert len(ledger['state']['observations']) == 1
    restored,_=h.retention.restore(ledger['state'],lambda ref:base64.b64decode(archives[f'/repos/{h.REPO}/contents/'+ref['path']]))
    assert restored['weekly_review']['created_at'] == NOW.isoformat()
    assert 'weekly_review' not in ledger['state'] and archives
    plan = allocation.plan(40, restored)
    assert plan['planned_counts'] == {'exploration': 24, 'exploitation': 10, 'control': 6}
    assert all(x['experiment_bucket'] != 'exploitation' for x in plan['slots'])
    assert sum(method == 'PUT' and path.endswith('/'+h.STATE_PATH) for method, _, path in calls) == 2
    assert sum(method == 'PUT' and '/instagram-archives/' in path for method, _, path in calls) == 1
