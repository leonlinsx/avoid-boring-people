"""Deterministic source-constrained low-risk script compiler and verifier.

V1 represents an author's attributed perspective, not independent proof that
every assertion in an essay is universally true. Free model-written facts,
numbers, quotations and advice in sensitive domains are outside admission.
"""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from scripts.instagram_growth.factory.run import validate, standalone

VERSION = 'ABP-AUTO-OWNED-COMMENTARY-1'
REFERENCE_INDICES=(3,4,5,6,7,8,10,11,13,15)
POLICY = {
    'version': VERSION, 'source_words': [15, 72], 'spoken_words': [35, 100],
    'max_seconds': 50, 'max_bytes': 10*1024*1024, 'max_pair_members': 2,
    'qualification': 'Full contiguous source paragraph, unchanged except Markdown emphasis/whitespace.',
    'factual_standard': 'Every substantive spoken claim is a complete owned source paragraph, attributed to Leon Lin; no generated factual prose.',
    'rights': 'Owned published commentary only; no third-party quotations, book-note excerpts, external images, music or cloned identities. First-person prose must be introduced as Leon Lin\'s words.',
    'scope': 'Low-risk perspectives, not financial/medical/legal instructions, numeric claims or current product assertions.',
    'source_owner': 'Leon Lin; reuse authorized by the archive owner in the Phase4 execution request.',
    'reference_templates': list(REFERENCE_INDICES),
}
TOPICS = [
    ('city', r'\bcit(?:y|ies)\b', ['Which city would fit the life you want?', 'How do you decide which city to live in?']),
    ('friendship', r'\bfriend(?:s|ship|ships)?\b', ['What helps a friendship grow?', 'How do you decide what to share in a friendship?']),
    ('feedback', r'\bfeedback\b', ['What makes feedback useful?', 'How do you decide what to do with feedback?']),
    ('community', r'\bcommunit(?:y|ies)|\bgatekeeping\b', ['What makes a community worth joining?', 'How should a community decide who belongs?']),
    ('decision', r'\bdecision|\bchoices?\b|\boptions?\b|\badvice\b', ['How do you make a decision with competing priorities?', 'What could change your decision?']),
    ('process', r'\bprocess(?:es)?\b|\bsteps\b|\bworkflow|\broutine', ['Could the order of steps change a process?', 'What would you change about a recurring process?']),
    ('creative ideas', r'\bcreativ|\bideas\b|\binnovat', ['How do you make room for useful creative ideas?', 'Which creative ideas deserve more attention?']),
    ('learning', r'\blearn|\bteach|\bpractice|\bskill', ['What makes learning a skill difficult?', 'How do you approach learning something unfamiliar?']),
    ('product', r'\bproduct|\bcustomer|\buser|\bcommunication|\bsoftware', ['What job does a useful product need to do?', 'How does a product fit the way people work?']),
]
RISK = re.compile(r'(?i)\b(invest\w*|stocks?|portfolio|gambl\w*|bank\w*|funds?|trading|ipo|tax\w*|medical|health|disease|drug\w*|suicid\w*|law\w*|legal|elections?|politic\w*|sexual\w*|sex|violence|weapons?|billion|million|percent|dollars?|guarantee\w*)\b')
REFERENTIAL = re.compile(r'(?i)\b(above|below|as mentioned|as discussed|earlier|this section|this second|the former|the latter|screenshot|pictured|the image|the chart|for this reason|currently|today|now)\b')
OPEN_REF = re.compile(r"(?i)^(this|that|these|those|it|however|also|so|but|and|they|another|in other words|lastly|firstly|secondly|as |now |usually|there are ways|the tradeoffs here|the downside)\b")


class Quarantine(ValueError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def sha(value):
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value)).hexdigest()


def policy_digest():
    # Compiler changes produce a new digest. Admission recognizes just one
    # frozen V1 digest pair after unchanged legacy source reconstruction.
    return sha(Path(__file__).read_bytes() + canonical(POLICY))


def clean(text):
    return ' '.join(re.sub(r'[*_`]', '', text).split())


def sentences(text):
    return re.split(r'(?<=[.!?])\s+', text)


def source_record(path, anchor, today=None, *, allow_single=False):
    path = Path(path)
    if not path.resolve().is_relative_to(Path('src/content/blog').resolve()) or path.suffix not in ('.md','.mdx'):
        raise Quarantine('unowned_source_path')
    raw = path.read_bytes(); text = raw.decode(); parts = text.split('---', 2)
    if len(parts)!=3 or anchor not in parts[2].split('\n\n'):
        raise Quarantine('not_a_complete_source_paragraph')
    fm, body = parts[1:]
    date = re.search(r'^pubDate:\s*([0-9-]{10})', fm, re.M)
    today = today or datetime.now(timezone.utc).date().isoformat()
    if not date or date[1]>str(today) or re.search(r'^draft:\s*true\s*$',fm,re.M):
        raise Quarantine('unpublished_source')
    title = re.search(r'^title:\s*(.+)',fm,re.M)
    if not title or re.search(r'(?i)book review|outright quotes|quotes from the book|summarised the book',text):
        raise Quarantine('third_party_rights_exception')
    paragraph = clean(anchor)
    if not POLICY['source_words'][0] <= len(paragraph.split()) <= POLICY['source_words'][1]:
        raise Quarantine('paragraph_outside_template_budget')
    if re.search(r'[\d<>\[\]#`“”"]|https?://',anchor) or anchor.startswith(('-','*','>','!','|')):
        raise Quarantine('numbers_quote_or_markup')
    if RISK.search(paragraph) or REFERENTIAL.search(paragraph) or OPEN_REF.search(paragraph):
        raise Quarantine('risk_or_missing_context')
    units = sentences(paragraph)
    if (len(units)<2 and not allow_single) or not paragraph.endswith(('.', '?', '!')):
        raise Quarantine('incomplete_explanation')
    if len(units)==1 and re.search(r'(?i)\b(this|that|these|those|stage|theory|finding)\b',paragraph):
        raise Quarantine('single_claim_needs_surrounding_context')
    if len(units)==1 and not re.search(r'(?i)\b(but|though|because|which|if|may|might|could|likelihood)\b',paragraph):
        raise Quarantine('single_claim_has_no_reason_or_condition')
    # Named current products/people and unexplained acronyms are not a V1 lane.
    for sentence in units:
        capitals=list(re.finditer(r'\b[A-Z][A-Za-z-]*',sentence))
        ordinary_starts={'I','We','Our','My','You','Your','The','A','An','If','When','People','Many','Some','Most','Not','No','In','On','For','As','To','By','From','With','It','That','This','Those','These','They','Their','There','Community','Communities','Data','Cities','Picking','Leaving','Getting','Starting','Learning','Having','Making','Understanding','Knowing','One','Another','Building','Working','Being','Instead','But','And','Or','Without','Rather','Perhaps','Even','Something','Everything','Nothing','Only','Whether','What','Why','How','Once','Think','Given','Similar','Unlike','Every','Each','Any','All','Imagine','Remember','Using','Whenever','Usually','Sometimes','Businesses','Companies','Customer','Customers','Culture','Change','Creativity','Feedback','Trust','Friendships','Relationships','Adults','Children','Students','Teachers'}
        for word in capitals:
            if word.start()!=0 or word.group() not in ordinary_starts:
                raise Quarantine('named_entity_needs_independent_context')
        if re.search(r'\b[A-Z]{2,}\b',sentence):raise Quarantine('unexplained_acronym')
    topic = next((x for x in TOPICS if re.search(x[1], units[0],re.I)),None)
    if not topic:raise Quarantine('no_standalone_topic_template')
    slug = re.search(r'^slug:\s*(.+)',fm,re.M)
    slug = slug[1].strip().strip('"\'') if slug else path.parent.name[11:]
    return {'source_file':str(path),'source_sha256':sha(raw),'source_anchor':anchor,
            'source_url':'https://leonlins.com/writing/'+slug,'source_date':date[1],
            'title':title[1].strip().strip('"\''),'topic':topic[0],
            'claim_id':'claim-'+sha({'source':str(path),'paragraph':paragraph})[:24],
            'source_sentences':units, 'copyright_basis':'owned_nonquoted_commentary'}


def compile_script(record, *, hook=0, voice='af_heart', presenter=False, visual='cards', caption_words=5, bucket='exploration', creative=None):
    compact=bool(creative and creative.get('factor')=='compression' and creative.get('arm')==1)
    source=source_record(record['source_file'],record['source_anchor'],allow_single=compact)
    if any(source[k]!=record[k] for k in ('source_sha256','claim_id','topic')):
        raise Quarantine('source_record_changed')
    if hook not in (0,1) or voice not in ('af_heart','af_nicole') or visual not in ('cards','statement') or caption_words not in (3,5):
        raise Quarantine('unknown_creative_template')
    topic=next(x for x in TOPICS if x[0]==source['topic'])
    question=topic[2][hook]
    first=question+(' In Leon Lin\'s words:' if re.search(r'\b(I|we|our|my|us)\b',clean(source['source_anchor'])) else ' Leon Lin offers this perspective.')
    units=source['source_sentences']; split=max(1,len(units)//2)
    scenes=[{'narration':first,'headline':question.upper(),'detail':source['topic'].upper()},
            {'narration':' '.join(units[:split]),'headline':'THE PERSPECTIVE','detail':'AN IDEA TO EXAMINE'},
            {'narration':' '.join(units[split:]),'headline':'THE CONDITIONS MATTER','detail':'KEEP THE WHOLE ARGUMENT'},
            {'narration':'Follow Avoid Boring People for more ways to think through decisions.','headline':'BETTER QUESTIONS, BETTER DECISIONS','detail':'FOLLOW AVOID BORING PEOPLE'}]
    pair_id='autopair-'+sha({'claim':source['claim_id'],'hook':hook,'voice':voice,'visual':visual,'caption_words':caption_words})[:20]
    item={**source,'concept_id':'abpa-'+sha({'pair':pair_id,'presenter':presenter})[:24],
          'scenes':scenes,'standalone_context':{'subject':topic[0] if topic[0] in first.lower() else question.split()[1].lower(),'situation':question,'payoff':'An attributed perspective with the complete original conditions retained.'},
          'voice':voice,'presenter':presenter,'visual':visual,'caption_words':caption_words,
          'label':question,'graphic_labels':['THE SITUATION','THE PERSPECTIVE','THE CONDITIONS'],
          'pair_id':pair_id,'pair_role':'presenter' if presenter else 'graphics',
          'pair_primary_factor':'fictional_presenter_opening_vs_graphics','experiment_bucket':bucket,
          'experiment_hypothesis':f'{"question" if hook else "concrete situation"} / {source["topic"]}',
          'hook_type':'question' if hook else 'concrete situation','cta_type':'follow',
          'auto_policy':VERSION,'template_parameters':{'hook':hook,'voice':voice,'presenter':presenter,'visual':visual,'caption_words':caption_words,'bucket':bucket}}
    if creative is not None:
        from scripts.instagram_growth.autonomy.creative import apply
        item=apply(item,creative)
    try:return validate(item)
    except ValueError as error:raise Quarantine(str(error)) from error


def verify_script(item):
    rebuilt=compile_reference(**item['template_parameters']) if item.get('reference_index') is not None else compile_script(item,**item['template_parameters'])
    if set(item)!=set(rebuilt):raise Quarantine('unbound_content_fields')
    for key in rebuilt:
        if item.get(key)!=rebuilt.get(key):raise Quarantine('unbound_or_generated_content:'+key)
    treatment=item['template_parameters'].get('creative',{})
    if treatment.get('factor')=='compression' and treatment.get('arm')==1:
        prefix=f"Leon Lin writes on {item['topic']}: "
        factual=item['scenes'][0]['narration'].removeprefix(prefix)
        if len(item['source_sentences'])>1:factual+=' '+item['scenes'][1]['narration']
    else:
        factual=' '.join(x['narration'] for x in item['scenes'][1:3])
    if item.get('reference_index') is None and factual!=clean(item['source_anchor']):raise Quarantine('source_qualification_lost')
    standalone(item)
    return {'policy_version':VERSION,'policy_digest':policy_digest(),'claim_id':item['claim_id'],
            'source_fidelity':'VERSIONED_SOURCE_SUPPORTED_REFERENCE' if item.get('reference_index') is not None else 'EXACT_COMPLETE_PARAGRAPH','context':'EXPLICIT_TOPIC_AND_ATTRIBUTION',
            'rights':'OWNED_NONQUOTED_PROSE_ONLY','arithmetic':'NOT_APPLICABLE_NUMERIC_CLAIMS_EXCLUDED',
            'factual_text_sha256':sha(factual.encode()),'human_approval_required':False}


def compile_reference(reference_index, *, voice='af_heart', presenter=False, visual='cards', caption_words=5, bucket='exploration',creative=None):
    if reference_index not in REFERENCE_INDICES:raise Quarantine('reference_outside_low_risk_policy')
    catalog=Path(__file__).resolve().parents[1]/'specs/standalone-v3.json'
    source=json.loads(catalog.read_text())['items'][reference_index]
    item={k:v for k,v in source.items() if k not in ('revises_concept','editorial_review_status','review_status','creative_method','allocation_evidence','allocation_note','planned_bucket','duration_target','pair_id','pair_role','pair_primary_factor')}
    item=validate(item);standalone(item)
    if RISK.search(item['text']) or re.search(r'\d',item['text']):raise Quarantine('sensitive_reference_claim')
    if voice not in ('af_heart','af_nicole') or visual not in ('cards','statement') or caption_words not in (3,5) or type(presenter) is not bool:raise Quarantine('unknown_reference_treatment')
    claim_id='claim-'+sha({'source':item['source_file'],'paragraph':clean(item['source_anchor'])})[:24]
    pair_id='autopair-'+sha({'claim':claim_id,'script':item['text'],'voice':voice,'visual':visual,'caption_words':caption_words})[:20]
    item.update(reference_index=reference_index,voice=voice,presenter=presenter,visual=visual,caption_words=caption_words,experiment_bucket=bucket,
                claim_id=claim_id,pair_id=pair_id,pair_role='presenter' if presenter else 'graphics',pair_primary_factor='fictional_presenter_opening_vs_graphics',
                concept_id='abpa-'+sha({'pair':pair_id,'presenter':presenter})[:24],auto_policy=VERSION,
                template_parameters={'reference_index':reference_index,'voice':voice,'presenter':presenter,'visual':visual,'caption_words':caption_words,'bucket':bucket})
    if creative is not None:
        from scripts.instagram_growth.autonomy.creative import apply
        item=apply(item,creative)
    return validate(item)


def discover():
    accepted=[]; rejected=[]
    for path in sorted(Path('src/content/blog').glob('*/index.*')):
        if path.suffix not in ('.md','.mdx'):continue
        pieces=path.read_text().split('---',2)
        if len(pieces)!=3:continue
        for paragraph in pieces[2].split('\n\n'):
            if len(paragraph.split())<15:continue
            try:
                record=source_record(path,paragraph,allow_single=True)
                treatment={'protocol':'ABP-CREATIVE-001','factor':'compression','arm':1,'evidence':None} if len(record['source_sentences'])==1 else None
                item=compile_script(record,creative=treatment);verify_script(item);accepted.append(record)
            except (Quarantine,ValueError):rejected.append({'source_file':str(path),'paragraph_sha256':sha(paragraph.encode())})
    return accepted,rejected
