"""Native type is source-exact and offline until treatment identities are ready."""
import copy
from pathlib import Path
import pytest
from scripts.instagram_growth.autonomy import policy,creative,admission
from scripts.instagram_growth.factory import source_typography as st
from tests.test_instagram_auto_policy import city,keys,metadata


def item(arm=1):
    i=city()
    return policy.compile_script(i,creative={'protocol':creative.PROTOCOL,'factor':'typography','arm':arm,'evidence':None})


def alignment(i):
    words=[{'word':w,'start':n*.25,'end':n*.25+.2} for n,w in enumerate(i['text'].split())]
    return {'words':words},len(words)*.25


def test_matched_arms_preserve_source_narration_voice_cta_and_qualifications():
    a,b=item(0),item(1)
    assert a['text']==b['text'] and a['scenes']==b['scenes']
    assert a['source_anchor']==b['source_anchor'] and a['voice']==b['voice']
    assert a['concept_id']!=b['concept_id'] and a['claim_id']==b['claim_id']
    assert a['visual']=='cards' and b['visual']=='source_type'
    data,duration=alignment(b);plan=st.plan(b,data,duration)
    assert ' '.join(p['text'] for p in plan['sentences'])==policy.clean(b['source_anchor'])
    assert 'if you can' in plan['sentences'][-1]['text']
    assert plan==st.plan(b,data,duration)


@pytest.mark.parametrize('change',['negative','omit','reorder','time','word','speed'])
def test_false_source_or_unmeasured_timing_never_renders(change):
    i=item();data,duration=alignment(i)
    if change=='negative':i['source_sentences'][-1]=i['source_sentences'][-1].replace('if you can','you can')
    if change=='omit':i['source_sentences'].pop()
    if change=='reorder':i['source_sentences'].reverse()
    if change=='time':data['words'][2]['start']=float('nan')
    if change=='word':data['words'][2]['word']='invented'
    if change=='speed':
        for w in data['words']:w['start']/=10;w['end']/=10
    with pytest.raises(ValueError):st.plan(i,data,duration)


def test_long_text_has_a_readability_floor_and_failure_is_visible():
    i=item();data,duration=alignment(i);panel=st.plan(i,data,duration)['sentences'][-1]
    fitted=st.layout(panel,lambda text,size:len(text)*size*.55)
    assert fitted['font_size']>=st.MIN_FONT
    assert [w for line in fitted['lines'] for w in line]==panel['words']
    with pytest.raises(ValueError,match='readable layout'):
        st.layout(panel,lambda text,size:10000)


def test_new_factor_cannot_enter_live_selection_admission_or_old_digest_lane(tmp_path,monkeypatch):
    i=item();data,duration=alignment(i);m=metadata(i)
    plan=st.plan(i,data,duration)
    for panel in plan['sentences']:panel['layout']=st.layout(panel,lambda text,size:len(text)*size*.55)
    m.update(source_typography=plan,captions=data)
    m['audio']['duration']=duration
    assert admission.qa_check(i,m,i['text'])['status']=='PASS'
    key=keys(tmp_path,monkeypatch)
    with pytest.raises(policy.Quarantine,match='treatment_identity'):admission.admit(i,m,i['text'],key)
    changed=copy.deepcopy(m);changed['source_typography']['sentences'][-1]['text']='unqualified claim'
    with pytest.raises(policy.Quarantine,match='evidence_changed'):admission.qa_check(i,changed,i['text'])
    changed=copy.deepcopy(m);changed['source_typography']['sentences'][0]['layout']['font_size']=1
    with pytest.raises(policy.Quarantine,match='layout_changed'):admission.qa_check(i,changed,i['text'])
    record=policy.discover()[0][0]
    assert creative.choose(record,{'experiment_bucket':'exploration'},[],{})['factor']!='typography'


def test_protected_main_compact_receipts_remain_valid_but_mixed_digests_do_not(tmp_path,monkeypatch):
    key=keys(tmp_path,monkeypatch);old=city();m=admission.admit(old,metadata(old),old['text'],key)
    m['admission'].update(policy_digest=admission.COMPACT001_POLICY_DIGEST,runtime_digest=admission.COMPACT001_RUNTIME_DIGEST)
    m=admission.seal(m,key);assert admission.verify_manifest(m)==m
    m['admission']['runtime_digest']=admission.CREATIVE001_RUNTIME_DIGEST;m=admission.seal(m,key)
    with pytest.raises(policy.Quarantine):admission.verify_manifest(m)


def test_scorecard_tracks_new_factor_without_inventing_growth_evidence():
    from scripts.instagram_growth.scorecard import creative_results
    i=item();m={'script':i,'concept_id':i['concept_id'],'claim_id':i['claim_id']}
    r=creative_results([], [m], {})[0]
    assert r['factor']=='typography' and r['max_posts_per_arm']==3
    assert all(x['winner'] is None for x in r['comparisons'])
    assert r['counts']['treatment']['published']==0


def test_real_font_render_is_readable_repeatable_and_word_aligned():
    from PIL import Image,ImageDraw,ImageFont
    from types import SimpleNamespace
    i=item();data,duration=alignment(i);treatment=st.plan(i,data,duration)
    def font(size):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size)
    for panel in treatment['sentences']:
        panel['layout']=st.layout(panel,lambda text,size:font(size).getlength(text))
    def frame(t):
        image=Image.new('RGB',(1080,1920),'#0c1b20');canvas=ImageDraw.Draw(image)
        def text(d,s,x,y,n,c):
            box=d.textbbox((x,y),s,font=font(n))
            assert 96<=box[0]<=box[2]<=900 and 275<=box[1]<=box[3]<=1460
            d.text((x,y),s,font=font(n),fill=c)
        renderer=SimpleNamespace(text=text,font=font,GREEN='#d4f28d',WHITE='#f6f3eb',MUTED='#a3b4b2',ease=lambda x:1-(1-min(1,max(0,x)))**3)
        st.draw(renderer,canvas,treatment,t)
        return image.tobytes()
    t=treatment['sentences'][0]['words'][2]['start']+.01
    assert frame(t)==frame(t) and frame(0)!=frame(t)


def test_dependent_qualification_keeps_its_antecedent_in_same_panel():
    i=item();data,duration=alignment(i);panels=st.plan(i,data,duration)['sentences']
    # "The person's priorities..." and "Once cities... (if you can)" must not
    # appear as disconnected pull quotes from the original priorities claim.
    assert len(panels)==1
    assert panels[0]['text']==policy.clean(i['source_anchor'])


def test_ten_claim_corpus_covers_hard_prose_without_manual_layout():
    from scripts.instagram_growth.factory.typography_benchmark import CLAIMS
    from PIL import ImageFont
    records={r['claim_id']:r for r in policy.discover()[0]}
    topics=set();sizes=[];anchors=[]
    for claim in CLAIMS:
        i=policy.compile_script(records[claim],creative={'protocol':creative.PROTOCOL,'factor':'typography','arm':1,'evidence':None})
        policy.verify_script(i);topics.add(i['topic']);anchors.append(i['source_anchor'])
        data,duration=alignment(i);panels=st.plan(i,data,duration)['sentences']
        assert ' '.join(p['text'] for p in panels)==policy.clean(i['source_anchor'])
        for panel in panels:
            fitted=st.layout(panel,lambda text,size:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size).getlength(text))
            sizes.append(fitted['font_size'])
    assert len(CLAIMS)==10 and len(topics)>=6
    assert min(sizes)>=st.MIN_FONT and min(sizes)<max(sizes)
    assert any('not' in x or "n't" in x for x in anchors)
    assert any('if you can' in x for x in anchors)
    assert max(len(x.split()) for x in anchors)>=60


def test_benchmark_missing_audio_fails_before_creating_output(tmp_path):
    from scripts.instagram_growth.factory.typography_benchmark import run
    out=tmp_path/'output'
    with pytest.raises(ValueError,match='missing cached narration'):run(tmp_path,out,tmp_path)
    assert not out.exists()
