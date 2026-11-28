"""Finite, preregistered single-factor tests of owned-source presentation."""
from datetime import datetime,timezone
from urllib.parse import urlencode
from scripts.instagram_growth.autonomy import policy,research

PROTOCOL='ABP-CREATIVE-001'
MAX_POSTS_PER_ARM=3  # Three distinct claims; graphics only in this protocol.
# Available for frozen offline trials; live selection awaits #160 identities.
HYPOTHESES={
    'typography':'Whole source sentences with word-aligned emphasis improve comprehension and qualified discovery over generic graphics.',
    'audience':'People reassessing an earlier choice respond differently from people making that choice for the first time.',
    'hook':'An attributed source statement before its conditions earns more qualified discovery than a diagnostic question before the same type of perspective.',
    'caption':'Inviting the reader to examine the full owned source produces more qualified owned-site outcomes than a reflection prompt.',
    'research':'A verified relative public outlier\'s caption structure informs a useful original source-first treatment more often than the article-first question control.',
    'compression':'A source payoff, its complete explanation, and a practical question retain attention better than repeating the payoff before reading the paragraph.',
}
JOBS={'city':'where to live','friendship':'what to share with a friend','feedback':'how to act on feedback',
      'community':'which community to join','decision':'a choice with competing priorities','process':'the order of a recurring process',
      'creative ideas':'which creative ideas to pursue','learning':'how to learn an unfamiliar skill','product':"how a product fits users' work"}


def config(value):
    if isinstance(value,dict) and value.get('protocol')=='ABP-CREATIVE-002':
        from scripts.instagram_growth.autonomy import renewal
        return renewal.config(value)
    if not isinstance(value,dict) or set(value)!={'protocol','factor','arm','evidence'}:raise policy.Quarantine('creative_protocol_fields')
    if value['protocol']!=PROTOCOL or value['factor'] not in ('baseline',*HYPOTHESES) or type(value['arm']) is not int or value['arm'] not in (0,1):raise policy.Quarantine('creative_protocol_treatment')
    if value['factor']=='baseline' and value['arm']!=0:raise policy.Quarantine('baseline_arm')
    evidence=value['evidence']
    if value['factor']=='research' and value['arm']==1:
        if not evidence:raise policy.Quarantine('research_evidence_required')
        try:facts=research.validate_receipt(evidence,now=research.instant(evidence['retrieved_at']))
        except (ValueError,KeyError,TypeError) as error:raise policy.Quarantine('unverified_research') from error
        if not facts['shadow_eligible']:raise policy.Quarantine('irrelevant_research_structure')
    elif evidence is not None:raise policy.Quarantine('unexpected_research_evidence')
    return value


def apply(item,value):
    value=config(value)
    if value.get('protocol')=='ABP-CREATIVE-002':
        from scripts.instagram_growth.autonomy import renewal
        return renewal.apply(item,value)
    factor=value['factor'];arm=value['arm']
    reference=item.get('reference_index') is not None
    if reference and factor!='baseline':raise policy.Quarantine('reference_has_no_new_creative_lane')
    if factor=='typography' and item['presenter']:raise policy.Quarantine('source_type_graphics_only')
    topic=item.get('topic') or item['standalone_context']['subject']
    job=JOBS.get(topic,'how to think about '+topic)
    position='reassessing_an_earlier_choice' if factor=='audience' and arm else 'making_a_choice'
    viewer=('Someone reassessing ' if position.startswith('reassessing') else 'Someone deciding ')+job
    audience={'position':position,'intended_viewer':viewer,
              'specific_problem':('An earlier choice may need revisiting: ' if arm and factor=='audience' else 'Competing priorities make it hard to decide: ')+job,
              'promised_payoff':'An attributed perspective on '+job+', retaining the original conditions.'}
    source_first=bool((arm and factor in ('hook','research')) or (factor=='compression' and not arm))
    if source_first:
        if value['evidence'] and value['evidence']['topic']!=topic:raise policy.Quarantine('research_topic_mismatch')
        first=f"Leon Lin on {topic}: "+item['source_sentences'][0]
        item['scenes'][0]={'narration':first,'headline':('LEON LIN ON '+topic).upper(),'detail':'AN ATTRIBUTED SOURCE STATEMENT'}
        item['standalone_context'].update(subject=topic,situation='Examine an attributed perspective on '+job)
    elif factor=='audience' and arm:
        first=f"Reconsidering {topic}? "+item['scenes'][0]['narration']
        item['scenes'][0].update(narration=first,headline=('RECONSIDERING '+topic+'?').upper())
        item['standalone_context'].update(subject=topic,situation='Reassess an earlier choice about '+job)
    if (factor=='compression' and arm) or (factor=='typography' and len(item['source_sentences'])==1):
        # Relocate, never paraphrase or omit, source assertions. The verifier
        # independently rebuilds every beat, including this fixed question.
        item['scenes']=[
            {'narration':f"Leon Lin writes on {topic}: "+item['source_sentences'][0],
             'headline':('A QUESTION ABOUT '+topic).upper(),'detail':'LEON LIN’S PERSPECTIVE'},
            {'narration':' '.join(item['source_sentences'][1:]) or 'Which condition matters most to you?',
             'headline':'THE EXPLANATION' if len(item['source_sentences'])>1 else 'EXAMINE THE CONDITIONS',
             'detail':'KEEP THE ORIGINAL CONDITIONS'},
            {'narration':'What would change your choice?',
             'headline':'WHAT WOULD CHANGE YOUR CHOICE?','detail':job.upper()},
            {'narration':'Follow Avoid Boring People for useful decision questions.',
             'headline':'ONE USEFUL QUESTION AT A TIME','detail':'FOLLOW AVOID BORING PEOPLE'}]
        item['graphic_labels']=['YOUR CHOICE',topic.upper(),'WHAT WOULD CHANGE IT?']
        item['standalone_context'].update(subject=topic,situation='Examine an attributed perspective on '+job)
    if factor=='typography':
        item['visual']='source_type' if arm else 'cards'
    strategy='source_question' if factor=='baseline' else 'read_full_context' if factor=='caption' and arm else 'reflection_prompt'
    campaign=None if factor=='baseline' else 'abp_creative001_'+factor+'_'+('treatment' if arm else 'control')
    pair='autopair-'+policy.sha({'base_pair':item['pair_id'],'creative':value})[:20]
    item.update(pair_id=pair,concept_id='abpa-'+policy.sha({'pair':pair,'presenter':item['presenter']})[:24],
                audience=audience,hook_structure='source_payoff_explanation_question' if ((factor=='compression' and arm) or (factor=='typography' and len(item['source_sentences'])==1)) else 'versioned_reference' if reference else 'attributed_source_first' if source_first else 'diagnostic_question',caption_strategy=strategy,
                research_origin='viral_outlier_informed' if factor=='research' and arm else 'article_first_control',
                research_evidence_id=research.validate_receipt(value['evidence'],now=research.instant(value['evidence']['retrieved_at']))['evidence_id'] if value['evidence'] else None,
                creative_trial={'protocol':PROTOCOL,'factor':factor,'arm':'treatment' if arm else 'control',
                                'hypothesis':HYPOTHESES.get(factor),'max_posts_per_arm':MAX_POSTS_PER_ARM,
                                'block':{'topic':topic,'source_article':item['source_url'],
                                         'publication_slot_rule':'UTC six-hour bin derived from the actual publication receipt; no new calendar'},
                                'unit':'distinct_owned_claim_graphics_only',
                                'primary_outcomes':['account_net_followers','qualified_owned_site_outcomes'],
                                'owned_site_campaign':campaign,
                                'limitations':'Different claims and publishing slots are observational blocks; matched format members are not independent idea replications.'})
    item['template_parameters']['creative']=value
    if factor!='baseline':item['experiment_hypothesis']=PROTOCOL+' / '+factor+' / '+('treatment' if arm else 'control')+' / '+topic
    return item


def caption(item):
    source=item['source_url'];disclosure='AI-generated narration'+(' and fictional presenter.' if item['presenter'] else '. Original graphics.')
    campaign=item['creative_trial']['owned_site_campaign']
    if campaign:source+='?'+urlencode({'utm_source':'instagram','utm_medium':'social','utm_campaign':campaign,'utm_content':item['concept_id']})
    if item['caption_strategy']=='source_question':lead=item['scenes'][0]['narration']
    elif item['caption_strategy']=='read_full_context':
        lead='Read the full perspective and its conditions in Leon Lin’s original article. Find it in the writing archive at leonlins.com.'
    else:
        lead='Which part of this perspective would you question before deciding?'
    # URLs in Instagram captions are not represented as clickable tracking.
    return lead+'\n\nLeon Lin’s perspective: '+source+'\n\n'+disclosure


def choose(record,slot,previous,cycle,*,shadow=False,review=None):
    baseline={'protocol':PROTOCOL,'factor':'baseline','arm':0,'evidence':None}
    if slot['experiment_bucket']!='exploration':return baseline
    if len(record.get('source_sentences',[]))==1:
        compact={'protocol':PROTOCOL,'factor':'compression','arm':1,'evidence':None}
        if not has_capacity(compact,previous):raise policy.Quarantine('compact_claim_arm_full')
        return compact
    candidates=research.eligible(cycle,shadow=shadow,now=research.instant(cycle['created_at']) if shadow and cycle.get('mode')=='fixture' else None)
    candidates=[r for r in candidates if r['topic']==record['topic']]
    factors=['audience','hook','caption','compression']+(['research'] if candidates else [])
    # Weekly diagnostics may order exploratory ties; they never increase arm
    # caps, manufacture a winner, or bypass allocation/admission.
    review=review or {}
    try:
        age=(datetime.now(timezone.utc)-research.instant(review['created_at'])).total_seconds()
        priorities=review['creative_learning']['factor_priority'] if -300<=age<=8*86400 else []
    except (KeyError,TypeError,ValueError):priorities=[]
    priorities=[f for f in priorities if f in factors]
    factors=list(dict.fromkeys(priorities+factors))
    counts={(factor,arm):set() for factor in factors for arm in (0,1)}
    blocks={key:set() for key in counts}
    topics={key:set() for key in counts}
    for old in previous:
        script=old.get('script',old);trial=script.get('template_parameters',{}).get('creative',{});factor=trial.get('factor')
        arm=trial.get('arm')
        if (factor,arm) in counts:
            counts[factor,arm].add(script['claim_id'])
            if script.get('source_url')==record['source_url']:blocks[factor,arm].add(script['claim_id'])
            if script.get('topic')==record['topic']:topics[factor,arm].add(script['claim_id'])
    available=[key for key in counts if len(counts[key])<MAX_POSTS_PER_ARM]
    if not available:return baseline
    # Balance single-factor trials and within-article blocks, not copy hashes.
    factor,arm=min(available,key=lambda key:(len(blocks[key]),len(topics[key]),len(counts[key]),factors.index(key[0]),key[1]))
    return {'protocol':PROTOCOL,'factor':factor,'arm':arm,'evidence':candidates[0] if factor=='research' and arm else None}


def require_live_evidence(item,*,now=None):
    # V1 has no execution identity/repetition contract. Only reconstructed V2
    # can enter the source-aware visual reuse lane.
    if item.get('creative_trial',{}).get('factor')=='typography' and item.get('creative_trial',{}).get('protocol')==PROTOCOL:
        raise policy.Quarantine('source_type_waiting_for_treatment_identity')
    value=item.get('template_parameters',{}).get('creative')
    if value and value['evidence']:
        facts=research.validate_receipt(value['evidence'],now=now or datetime.now(timezone.utc))
        if not facts['live_eligible']:raise policy.Quarantine('fixture_or_ineligible_research_cannot_be_admitted')


def has_capacity(value,previous):
    if value['factor']=='baseline':return True
    used={old.get('script',old)['claim_id'] for old in previous
          if old.get('script',old).get('template_parameters',{}).get('creative',{}).get('factor')==value['factor']
          and old.get('script',old).get('template_parameters',{}).get('creative',{}).get('arm')==value['arm']}
    return len(used)<MAX_POSTS_PER_ARM


if __name__=='__main__':
    import argparse,json
    from pathlib import Path
    from scripts.instagram_growth.autonomy.worker import candidates
    parser=argparse.ArgumentParser(description='Offline protocol shadow; no media, admission, uploads or publication')
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--state',type=Path);parser.add_argument('--fixture',action='store_true')
    args=parser.parse_args();state=json.loads(args.state.read_text()) if args.state else {'account':'avoidboringpeople'}
    if state.get('account')!='avoidboringpeople':raise ValueError('wrong shadow account')
    cycle=research.fixture() if args.fixture else {}
    items,quarantined,allocation=candidates(state,[],experiments=True,research_cycle=cycle,shadow=True)
    proof={'protocol':PROTOCOL,'account':'avoidboringpeople','mode':'offline_shadow','allocation':allocation,
           'candidate_count':len(items),'source_verified':sum(bool(policy.verify_script(i)) for i in items),
           'quarantined':quarantined,'items':items,'actual_verified_public_outliers':0 if args.fixture else len(research.eligible(cycle)),
           'research_mode':'synthetic_fixture' if args.fixture else 'unavailable','admission':'NOT_RUN_no_media_QA',
           'published':0,'uploaded':0,'cost_usd':0}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps({k:v for k,v in proof.items() if k not in ('items','quarantined','allocation')}))
