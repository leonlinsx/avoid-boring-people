"""Network-free tests of hosted durability, isolation and kill switches."""
import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import pytest
from scripts.instagram_growth import hosted as h, reel_pilot as p, rolling_queue as q
from tests.test_instagram_growth_reel_pilot import item


def test_state_rejects_another_repo(monkeypatch):
    monkeypatch.setenv('GITHUB_TOKEN','test-token')
    monkeypatch.setenv('GITHUB_REPOSITORY','someone/else')
    with pytest.raises(h.StateError,match='exact repository'):h.Store()


def test_state_write_uses_sha_compare_and_swap(monkeypatch):
    monkeypatch.setenv('GITHUB_TOKEN','test-token');monkeypatch.setenv('GITHUB_REPOSITORY',h.REPO)
    store=h.Store();store.sha='old-sha';store.state={'account':'avoidboringpeople','receipts':{}}
    captured=[]
    def request(method,route,**kwargs):
        captured.append((method,route,kwargs));return {'content':{'sha':'next-sha'}}
    monkeypatch.setattr(store,'request',request);store.save()
    assert captured[0][2]['json']['sha']=='old-sha'
    assert captured[0][2]['json']['branch']=='abp-instagram-state'
    assert 'test-token' not in base64.b64decode(captured[0][2]['json']['content']).decode()
    assert store.sha=='next-sha'


def test_unverified_pilot_blocks_scheduled_post(monkeypatch):
    monkeypatch.setenv('ABP_REELS_PUBLISH','enabled')
    with pytest.raises(h.StateError,match='unverified pilot'):
        h.publish_one(SimpleNamespace(state={'pilot_verified':False}))


def test_kill_switch_blocks_even_verified_pilot(monkeypatch):
    monkeypatch.delenv('ABP_REELS_PUBLISH',raising=False)
    with pytest.raises(h.StateError,match='kill switch'):
        h.publish_one(SimpleNamespace(state={'pilot_verified':True}))


def test_remote_reservation_must_ack_before_meta_call(monkeypatch,tmp_path):
    monkeypatch.setattr(p,'local_video_preflight',lambda v:{'sha256':v['video_sha256']})
    monkeypatch.setattr(p,'hosted_video_preflight',lambda v:2048)
    monkeypatch.setattr(p,'confirmed_account',lambda:('123','token'))
    monkeypatch.setattr(p,'create_reel_container',lambda *_:pytest.fail('no remote receipt means no Meta write'))
    def failed(_):raise h.StateError('durable storage unavailable')
    with pytest.raises(h.StateError):p.publish(item(),state_dir=tmp_path,receipt_sink=failed)
    assert json.loads((tmp_path/'ergodicity-v01.json').read_text())['status']=='reconciliation_required'


def test_remote_publish_attempt_must_ack_before_irreversible_post(monkeypatch,tmp_path):
    monkeypatch.setattr(p,'local_video_preflight',lambda v:{'sha256':v['video_sha256']})
    monkeypatch.setattr(p,'hosted_video_preflight',lambda v:2048)
    monkeypatch.setattr(p,'confirmed_account',lambda:('123','token'))
    monkeypatch.setattr(p,'create_reel_container',lambda *_:'container')
    monkeypatch.setattr(p.ig,'wait_for_container',lambda *_:None)
    monkeypatch.setattr(p.ig,'publish_container',lambda *_:pytest.fail('unacknowledged remote intent must not publish'))
    seen=[]
    def persist(record):
        seen.append(record['status'])
        if record['status']=='publish_attempted':raise h.StateError('CAS conflict')
    with pytest.raises(h.StateError):p.publish(item(),state_dir=tmp_path,receipt_sink=persist)
    assert seen[:3]==['reserved','container_created','publish_attempted']


def test_measurement_failure_is_visible_and_does_not_save_success(monkeypatch):
    def fail():raise h.StateError('unauthorized')
    monkeypatch.setattr(p,'account_snapshot',fail)
    store=SimpleNamespace(state={},save=lambda:pytest.fail('must not save success'))
    with pytest.raises(h.StateError):h.measure(store)


def test_live_quota_requires_margin(monkeypatch):
    monkeypatch.setattr(h,'read_api',lambda *_:{'data':[{'quota_usage':99,'config':{'quota_total':100}}]})
    with pytest.raises(h.StateError,match='margin'):h.live_quota()
    monkeypatch.setattr(h,'read_api',lambda *_:{'data':[{'quota_usage':8,'config':{'quota_total':100}}]})
    assert h.live_quota()=={'usage':8,'limit':100}


def test_three_posts_default_and_fourth_throttled(tmp_path):
    from tests.test_instagram_growth_rolling_queue import put,receipt,NOW
    queue,state=tmp_path/'queue',tmp_path/'state';put(queue,'new-one')
    receipt(state,'first',created_at='2026-11-21T01:00:00Z')
    receipt(state,'second',created_at='2026-11-21T05:00:00Z')
    assert q.choose(queue,state,NOW)[1]=='READY'
    receipt(state,'third',created_at='2026-11-21T09:00:00Z')
    assert '24h' in q.choose(queue,state,NOW)[1]


def test_verify_pilot_rechecks_metrics_without_publishing(monkeypatch):
    record={'concept_id':'first-pilot','status':'published','media_id':'123456789','published_at':'2026-11-21T12:00:00+00:00'}
    store=SimpleNamespace(state={'receipts':{'first-pilot':record},'pilot_verified':False},save=lambda:None)
    monkeypatch.setattr(h,'verify_media',lambda _: {'id':'123456789','username':'avoidboringpeople'})
    monkeypatch.setattr(p,'fetch_insights',lambda _: {'metrics':{'reach':0}})
    monkeypatch.setattr(p,'publish',lambda *_:pytest.fail('verification must never publish'))
    h.verify_pilot(store)
    assert store.state['pilot_verified'] is True


def test_verify_pilot_does_not_pass_when_insights_missing(monkeypatch):
    record={'status':'published','media_id':'123456789','published_at':'2026-11-21T12:00:00+00:00'}
    store=SimpleNamespace(state={'receipts':{'first-pilot':record}},save=lambda:None)
    monkeypatch.setattr(h,'verify_media',lambda _: {'id':'123456789'})
    monkeypatch.setattr(p,'fetch_insights',lambda _: {'metrics':{'reach':None}})
    with pytest.raises(h.StateError,match='unavailable'):h.verify_pilot(store)
    assert store.state['pilot_verified'] is False


def test_known_container_rejection_can_be_reconciled_explicitly():
    record={'status':'reconciliation_required','error_type':'GraphApiError','trial':True}
    saved=[];store=SimpleNamespace(state={'receipts':{'trial':record}},save=lambda:saved.append(1))
    h.reconcile_no_publish(store,'trial')
    assert record['status']=='confirmed_unpublished' and saved==[1]


@pytest.mark.parametrize('extra',[{'container_id':'existing-container'},{'media_id':'existing-media'},{'error_type':'ConnectionError'}])
def test_uncertain_publish_cannot_be_declared_unpublished(extra):
    record={'status':'reconciliation_required','error_type':'GraphApiError',**extra}
    store=SimpleNamespace(state={'receipts':{'trial':record}},save=lambda:pytest.fail('must not clear uncertainty'))
    with pytest.raises(h.StateError,match='cannot prove'):h.reconcile_no_publish(store,'trial')
    assert record['status']=='reconciliation_required'
