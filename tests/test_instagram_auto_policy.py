"""Deterministic admission controls; synthetic QA fixtures never publish."""
import copy
import json
from pathlib import Path
import subprocess
import pytest
from scripts.instagram_growth.autonomy import policy as p, admission as a


def city():
    source=Path('src/content/blog/2020_08_19_city/index.md')
    anchor=next(x for x in source.read_text().split('\n\n') if x.startswith('People have their own unique priorities'))
    return p.compile_script(p.source_record(source,anchor))


def keys(tmp_path,monkeypatch):
    private=tmp_path/'key';public=tmp_path/'public.pem'
    subprocess.run(['openssl','genpkey','-algorithm','ED25519','-out',str(private)],check=True,capture_output=True)
    subprocess.run(['openssl','pkey','-in',str(private),'-pubout','-out',str(public)],check=True,capture_output=True)
    monkeypatch.setattr(a,'PUBLIC_KEY',public)
    return private


def metadata(item):
    return {'sha256':'a'*64,'bytes':10000,'render_seconds':1,'verified_text_bounds':[110,290,880,1450],
            'audio':{'text':item['text'],'voice':'af_heart','engine':'kokoro==0.9.4','model':{'revision':'f3ff3571791e39611d31c381e3a41a3af07b4987'},'seconds':1},
            'captions':{'model_revision':'test-fixture'},
            'verification':{**{k:'PASS' for k in ('decode','ffprobe','faststart','source_anchor_and_hash','caption_exact_text_and_measured_word_timings','audio_clipping')},
                            'duration':24,'loudness':{'input_i':-16,'input_tp':-2}}}


def test_valid_source_compiler_preserves_every_qualification():
    item=city();e=p.verify_script(item)
    assert e['source_fidelity']=='EXACT_COMPLETE_PARAGRAPH'
    assert 'if you can' in item['text']
    assert 'city' in item['scenes'][0]['narration'].lower()
    assert e['human_approval_required'] is False


@pytest.mark.parametrize('replacement',['You will definitely succeed.','You can always afford the city.','There is no downside.','Everyone earns fifty percent more.'])
def test_invented_claims_never_match_source_policy(replacement):
    item=city();item['scenes'][2]['narration']=replacement
    with pytest.raises(p.Quarantine):p.verify_script(item)


def test_each_spoken_field_is_bound_and_mutations_are_rejected():
    item=city()
    for scene in range(4):
        for field in ('narration','headline','detail'):
            altered=copy.deepcopy(item);altered['scenes'][scene][field]+=' Unsupported claim'
            with pytest.raises(p.Quarantine):p.verify_script(altered)
    altered=copy.deepcopy(item);altered['graphic_labels'][0]='Guaranteed profits'
    with pytest.raises(p.Quarantine):p.verify_script(altered)


def test_reference_set_is_not_an_open_fact_generation_lane():
    for index in p.REFERENCE_INDICES:
        item=p.compile_reference(index);assert p.verify_script(item)['source_fidelity']=='VERSIONED_SOURCE_SUPPORTED_REFERENCE'
        item['scenes'][1]['narration']+=' Guaranteed results.'
        with pytest.raises(p.Quarantine):p.verify_script(item)
    for index in (0,2,12,14,17,18,19,20):
        with pytest.raises(p.Quarantine):p.compile_reference(index)


def test_auto_receipt_is_distinct_from_human_review(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);item=city();manifest=a.admit(item,metadata(item),item['text'],key)
    assert manifest['review_status']=='AUTO_ADMITTED' and 'approved_by' not in manifest
    assert a.verify_manifest(manifest)==manifest
    manifest['caption']+=' Added after signing'
    with pytest.raises(p.Quarantine,match='signature'):a.verify_manifest(manifest)


def test_signed_wrong_identity_and_fake_human_receipt_are_blocked(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);item=city();manifest=a.admit(item,metadata(item),item['text'],key)
    manifest['account']='leon.lin.s';manifest=a.seal(manifest,key)
    with pytest.raises(p.Quarantine,match='identity'):a.verify_manifest(manifest)
    manifest['account']='avoidboringpeople';manifest['approved_by']='human';manifest=a.seal(manifest,key)
    with pytest.raises(p.Quarantine,match='human'):a.verify_manifest(manifest)


def test_audio_misread_and_missing_negation_quarantine():
    item=city();m=metadata(item)
    with pytest.raises(p.Quarantine,match='asr'):a.qa_check(item,m,'A completely unrelated narration.')
    with pytest.raises(p.Quarantine,match='qualification'):a.qa_check(item,m,item['text'].replace('if you can','you can'))
    m['verification']['decode']='NOT RUN'
    with pytest.raises(p.Quarantine,match='media_qa'):a.qa_check(item,m,item['text'])


def test_technical_quality_is_not_a_source_admission_override(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);item=city();m=metadata(item)
    item['scenes'][2]['narration']='Move now and your income will double.'
    with pytest.raises(p.Quarantine):a.admit(item,m,item['text'],key)


def test_existing_manually_rewritten_bank_is_shadowed_without_faking_human_decisions():
    examples=json.loads(Path('scripts/instagram_growth/specs/standalone-v3.json').read_text())['items']
    assert len(examples)==21
    for example in examples:
        with pytest.raises((p.Quarantine,KeyError)):p.verify_script(example)
    assert all(p.verify_script(p.compile_reference(i))['human_approval_required'] is False for i in p.REFERENCE_INDICES)
