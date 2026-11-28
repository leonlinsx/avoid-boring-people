"""Compact scripts retain complete claims; weekly diagnostics never select winners."""
from datetime import datetime, timedelta, timezone

import pytest

from scripts.instagram_growth import scorecard
from scripts.instagram_growth.autonomy import admission as a, creative, policy
from tests.test_instagram_creative_protocol import item, treatment
from tests.test_instagram_auto_policy import keys, metadata


def test_compact_payoff_does_not_repeat_or_drop_any_source_sentence():
    control=item('compression',0);compact=item('compression',1)
    assert len(compact['text'].split()) < len(control['text'].split())
    assert compact['text'].count(compact['source_sentences'][0])==1
    assert compact['scenes'][0]['narration'].startswith('Leon Lin writes on city:')
    assert ' '.join(compact['source_sentences'])==policy.clean(compact['source_anchor'])
    assert 'if you can' in compact['text']
    assert policy.verify_script(compact)['source_fidelity']=='EXACT_COMPLETE_PARAGRAPH'


@pytest.mark.parametrize('mutation',['qualification','question','visual','omission'])
def test_compact_reconstruction_rejects_altered_claims_and_unbound_prompts(mutation):
    i=item('compression',1)
    if mutation=='qualification':
        for scene in i['scenes']:scene['narration']=scene['narration'].replace('if you can','you can')
    if mutation=='question':i['scenes'][2]['narration']='This method always works.'
    if mutation=='visual':i['graphic_labels'][0]='GUARANTEED RETURNS'
    if mutation=='omission':i['scenes'][1]['narration']='Only the good parts.'
    with pytest.raises(policy.Quarantine):policy.verify_script(i)


def single_source(tmp_path,monkeypatch,paragraph):
    monkeypatch.chdir(tmp_path)
    path=tmp_path/'src/content/blog/2020_01_01_learning/index.md';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text('---\ntitle: Learning\npubDate: 2020-01-01\nslug: learning\n---\n\n'+paragraph+'\n\n')
    return str(path.relative_to(tmp_path)),paragraph


def test_single_claim_requires_whole_owned_paragraph_and_compact_lane(tmp_path,monkeypatch):
    path,paragraph=single_source(tmp_path,monkeypatch,'Learning a skill may require practice, but the conditions of that practice could change how you approach it.')
    # Deictic references are deliberately conservative in the narrower lane.
    with pytest.raises(policy.Quarantine):policy.source_record(path,paragraph,allow_single=True)
    path,paragraph=single_source(tmp_path,monkeypatch,'A beginner, starry eyed and bushy tailed, will come looking for advice on how to get started in a subject.')
    with pytest.raises(policy.Quarantine,match='no_reason_or_condition'):
        policy.source_record(path,paragraph,allow_single=True)
    paragraph='Learning a skill may require practice, but careful reflection could change how you approach learning.'
    path,paragraph=single_source(tmp_path,monkeypatch,paragraph)
    record=policy.source_record(path,paragraph,allow_single=True)
    with pytest.raises(policy.Quarantine):policy.compile_script(record)
    compact=policy.compile_script(record,creative=treatment('compression',1))
    policy.verify_script(compact)
    assert compact['text'].count(paragraph)==1
    with pytest.raises(policy.Quarantine,match='complete_source_paragraph'):
        policy.source_record(path,paragraph.split(',')[0]+'.',allow_single=True)


def test_compact_real_archive_inventory_keeps_existing_risk_and_context_exclusions():
    records,_=policy.discover()
    singles=[r for r in records if len(r['source_sentences'])==1]
    assert singles
    for record in singles:
        compact=policy.compile_script(record,creative=treatment('compression',1))
        policy.verify_script(compact)
        assert not policy.RISK.search(compact['source_anchor'])
        assert not policy.REFERENTIAL.search(compact['source_anchor'])


@pytest.mark.parametrize('new_structure',[False,True])
def test_exact_prior_release_compatibility_never_authorizes_new_structure(tmp_path,monkeypatch,new_structure):
    key=keys(tmp_path,monkeypatch);i=item('compression' if new_structure else 'hook',1)
    m=a.admit(i,metadata(i),i['text'],key)
    m['admission'].update(policy_digest=a.CREATIVE001_POLICY_DIGEST,runtime_digest=a.CREATIVE001_RUNTIME_DIGEST)
    m=a.seal(m,key)
    if new_structure:
        with pytest.raises(policy.Quarantine,match='policy'):a.verify_manifest(m)
    else:assert a.verify_manifest(m)==m


def rows(*,reach=30,skip=75,window='24h',articles=3):
    return [{'concept_id':str(n),'window':window,'timely':True,'source_url':'article'+str(n%articles),
             'published_at':(datetime.now(timezone.utc)-timedelta(days=2)).isoformat(),
             'eligible_for_comparison':reach>=100,'metrics':{'reach':reach,'reels_skip_rate':skip}} for n in range(6)]


def test_recursive_diagnoses_require_same_age_multi_article_evidence():
    low=scorecard.creative_learning(rows())
    assert low['factor_priority'][0]=='audience'
    assert low['observed_posts']==6
    skipped=scorecard.creative_learning(rows(reach=150))
    assert skipped['factor_priority'][0]=='compression'
    for sample in (rows()[:1],rows(articles=1),rows(window='48h'),[{**r,'timely':False} for r in rows()],
                   [{**r,'published_at':(datetime.now(timezone.utc)-timedelta(days=15)).isoformat()} for r in rows()]):
        assert scorecard.creative_learning(sample)['factor_priority']==['audience','hook','caption','compression','typography','reflection']
    assert 'no growth winner' in low['effect']


def test_fresh_weekly_diagnostics_change_exploration_but_not_control_or_caps():
    review={'created_at':datetime.now(timezone.utc).isoformat(),'creative_learning':scorecard.creative_learning(rows(reach=150))}
    record={'topic':'city','source_url':'new'};slot={'experiment_bucket':'exploration'}
    assert creative.choose(record,slot,[],{},review=review)['factor']=='compression'
    assert creative.choose(record,{'experiment_bucket':'control'},[],{},review=review)['factor']=='baseline'
    previous=[{'claim_id':str(n),'source_url':'old','template_parameters':{'creative':treatment('compression',arm)}} for arm in (0,1) for n in range(3)]
    assert creative.choose(record,slot,previous,{},review=review)['factor']!='compression'
    review['created_at']=(datetime.now(timezone.utc)-timedelta(days=9)).isoformat()
    assert creative.choose(record,slot,[],{},review=review)['factor']=='audience'
