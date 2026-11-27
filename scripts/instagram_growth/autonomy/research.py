"""Bounded, optional public-performance research. No publisher or paid provider.

Captions are untrusted data, never transcripts or instructions. Only a closed
structural label and aggregate metrics leave the collector; no media is fetched.
"""
from datetime import datetime,timedelta,timezone
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import tempfile
import time

import requests
from scripts.instagram_growth.autonomy import admission,policy

VERSION='ABP-OUTLIER-RESEARCH-1'
FIXTURE_PUBLIC_KEY=Path(__file__).with_name('research-fixture-public.pem')
CREATOR=re.compile(r'[a-zA-Z0-9_][a-zA-Z0-9_.]{0,29}')
PERMALINK=re.compile(r'https://www\.instagram\.com/reel/[a-zA-Z0-9_-]+/')
MAX_CREATORS=4
MAX_RECEIPTS=20


def instant(value):
    d=datetime.fromisoformat(value.replace('Z','+00:00'))
    if d.utcoffset() is None:raise ValueError('research timestamp requires timezone')
    return d


def count(value):
    if type(value) is not int or not 0<=value<=10**12:raise ValueError('unverified count')
    return value


def fixture_authenticate(value):
    with tempfile.TemporaryDirectory(prefix='abp-research-fixture-') as tmp:
        src=Path(tmp)/'data';sig=Path(tmp)/'signature'
        import base64
        src.write_bytes(policy.canonical(admission.unsigned(value)))
        sig.write_bytes(base64.b64decode(value.get('auto_signature',''),validate=True))
        result=subprocess.run(['openssl','pkeyutl','-verify','-pubin','-rawin','-inkey',str(FIXTURE_PUBLIC_KEY),'-in',str(src),'-sigfile',str(sig)],capture_output=True,timeout=10)
        if result.returncode:raise ValueError('untrusted research fixture')


def validate_receipt(value, *, now=None):
    """Recompute evidence, never trust supplied outlier/winner booleans."""
    now=now or datetime.now(timezone.utc)
    if value.get('mode')=='fixture':fixture_authenticate(value)
    else:admission.authenticate(value)
    required={'artifact_type','version','mode','provider','creator','permalink','retrieved_at','posted_at','views',
              'followers','baseline','topic','pattern','caption_sha256','promotion_status','uncertainties','auto_signature'}
    if set(value)!=required or value['artifact_type']!='abp_research_receipt_v1' or value['version']!=VERSION:raise ValueError('research schema')
    if value['mode'] not in ('fixture','live') or value['provider']!='meta_business_discovery':raise ValueError('research provider')
    if not CREATOR.fullmatch(value['creator']) or not PERMALINK.fullmatch(value['permalink']):raise ValueError('research identity')
    retrieved=instant(value['retrieved_at']);posted=instant(value['posted_at'])
    if not now-timedelta(days=8)<=retrieved<=now+timedelta(minutes=5):raise ValueError('stale research')
    if not timedelta(days=7)<=retrieved-posted<=timedelta(days=45):raise ValueError('research age')
    views=count(value['views']);followers=count(value['followers']) if value['followers'] is not None else None
    baseline=value['baseline']
    if not isinstance(baseline,list) or not 5<=len(baseline)<=24:raise ValueError('research baseline size')
    links=set();numbers=[]
    for row in baseline:
        if set(row)!={'permalink','posted_at','views'} or not PERMALINK.fullmatch(row['permalink']):raise ValueError('research baseline identity')
        if row['permalink']==value['permalink'] or row['permalink'] in links:raise ValueError('duplicate research baseline')
        if not timedelta(days=7)<=retrieved-instant(row['posted_at'])<=timedelta(days=45):raise ValueError('research baseline age')
        links.add(row['permalink']);numbers.append(count(row['views']))
    median=statistics.median(numbers);ratio=views/median if median else None
    if value['topic'] not in {x[0] for x in policy.TOPICS}:raise ValueError('research topic')
    if value['pattern'] not in ('statement_context_question','question_context','unclassified'):raise ValueError('research structure')
    if not re.fullmatch('[a-f0-9]{64}',value['caption_sha256']):raise ValueError('research text hash')
    if value['promotion_status'] not in ('unknown','disclosed_promotion'):raise ValueError('unsupported organic claim')
    if value['uncertainties']!=['Public views may include paid and Facebook views; organic performance is unverified.',
                                 'Caption structure only; first-three-second hook, pacing and audiovisual content are unobserved.']:
        raise ValueError('research limitations missing')
    outlier=bool(median and ratio>=3 and views>=10000)
    usable=bool(outlier and followers is not None and followers<100000 and value['promotion_status']=='unknown'
                and value['pattern']=='statement_context_question')
    return {'evidence_id':'abpr-'+policy.sha(admission.unsigned(value))[:24],
            'creator_recent_median_views':median,'relative_outlier_ratio':ratio,'verified_relative_outlier':outlier,
            'live_eligible':usable and value['mode']=='live','shadow_eligible':usable,
            'organic_status':'unverified','scope':'caption_structure_only'}


def receipts_from_profile(profile,creator,*,retrieved_at,key,mode='live'):
    """Only authenticated adapter responses may become live signed receipts."""
    followers=profile.get('followers_count')
    if followers is not None:count(followers)
    rows=[];seen=set();rejected=0
    for media in profile.get('media',{}).get('data',[])[:25]:
        try:
            if media.get('media_product_type')!='REELS' or media.get('username')!=creator:raise ValueError('not target creator Reel')
            link=media['permalink'];date=media['timestamp'];views=count(media['view_count'])
            if not PERMALINK.fullmatch(link) or link in seen:raise ValueError('missing/duplicate permalink')
            if not timedelta(days=7)<=instant(retrieved_at)-instant(date)<=timedelta(days=45):raise ValueError('incomparable age')
            caption=media.get('caption','')
            if not isinstance(caption,str) or len(caption)>2200:raise ValueError('caption budget')
            if re.search(r'(?i)ignore (?:all |previous |prior )?instructions|system prompt|reveal .*secret|api[_ -]?key',caption):raise ValueError('instruction poisoning')
            seen.add(link);rows.append({'permalink':link,'posted_at':date,'views':views,'caption':caption})
        except (ValueError,KeyError,TypeError):rejected+=1
    result=[]
    for row in rows:
        baseline=[{k:x[k] for k in ('permalink','posted_at','views')} for x in rows if x['permalink']!=row['permalink']]
        if len(baseline)<5:continue
        text=row['caption'];first=text.strip().split('\n')[0]
        # Classification never executes, quotes or forwards retrieved prose.
        topic=next((t[0] for t in policy.TOPICS if re.search(t[1],text,re.I)),None)
        if not topic:continue
        pattern='question_context' if first.endswith('?') else 'statement_context_question' if '?' in text and len(first.split())>=4 else 'unclassified'
        receipt={'artifact_type':'abp_research_receipt_v1','version':VERSION,'mode':mode,'provider':'meta_business_discovery',
                 'creator':creator,'permalink':row['permalink'],'retrieved_at':retrieved_at,'posted_at':row['posted_at'],
                 'views':row['views'],'followers':followers,'baseline':baseline,'topic':topic,'pattern':pattern,
                 'caption_sha256':policy.sha(text.encode()),'promotion_status':'disclosed_promotion' if re.search(r'(?i)#(?:ad|sponsored)\b|paid partnership',text) else 'unknown',
                 'uncertainties':['Public views may include paid and Facebook views; organic performance is unverified.',
                                  'Caption structure only; first-three-second hook, pacing and audiovisual content are unobserved.']}
        result.append(admission.seal(receipt,key))
    return result,rejected


def collect(root,creators,key,*,now=None,token=None,user_id=None):
    """One optional read-only cycle/week, including failures; zero paid calls."""
    environment_token=os.environ.pop('ABP_RESEARCH_META_TOKEN',None);environment_user=os.environ.pop('ABP_RESEARCH_META_USER_ID','')
    token=token if token is not None else environment_token
    user=user_id if user_id is not None else environment_user
    now=now or datetime.now(timezone.utc);root=Path(root);root.mkdir(parents=True,exist_ok=True)
    path=root/f'research-{now.strftime("%G-W%V")}.json'
    if path.exists():return json.loads(path.read_text())
    if not isinstance(creators,list) or any(not isinstance(c,str) or not CREATOR.fullmatch(c) for c in creators):raise ValueError('research creator budget')
    creators=list(dict.fromkeys(creators))
    if len(creators)>MAX_CREATORS:raise ValueError('research creator budget')
    result={'version':VERSION,'account':'avoidboringpeople','created_at':now.isoformat(),'provider':'meta_business_discovery',
            'cost_usd':0,'charged_calls':0,'calls':0,'receipts':[],'rejected':0,'audited_receipts':0,
            'verified_relative_outliers':0,'organic_verified_outliers':0,'status':'running','reason':None}
    def save():
        tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(result,indent=2)+'\n');tmp.chmod(0o600);tmp.replace(path)
    # A crash/outage also consumes this weekly attempt; no blind paid fallback.
    save()
    if not creators or not token or not re.fullmatch('[0-9]{5,32}',user):
        result.update(status='unavailable',reason='No configured permissioned Facebook-Login discovery credential/creator scope. Existing Instagram publishing credentials are not reused.');save();return result
    deadline=time.monotonic()+60
    for creator in creators:
        if time.monotonic()>=deadline:result['reason']='research wall-clock budget';break
        fields=f'username,business_discovery.username({creator}){{followers_count,media.limit(25){{username,permalink,timestamp,media_product_type,view_count,caption}}}}'
        result['calls']+=1;save()
        try:
            with requests.get(f'https://graph.facebook.com/v27.0/{user}',params={'fields':fields},headers={'Authorization':'Bearer '+token},
                              stream=True,allow_redirects=False,timeout=(5,10)) as response:
                response.raise_for_status();data=bytearray()
                for chunk in response.iter_content(16384):
                    data.extend(chunk)
                    if len(data)>256000 or time.monotonic()>deadline:raise ValueError('research response/time budget')
            payload=json.loads(data)
            if payload.get('username')!='avoidboringpeople':raise ValueError('wrong discovery account')
            profile=payload['business_discovery']
            receipts,rejected=receipts_from_profile(profile,creator,retrieved_at=now.isoformat(),key=key)
            result['receipts']+=receipts;result['rejected']+=rejected
        except (requests.RequestException,ValueError,KeyError,TypeError):
            result['reason']='Permissioned provider unavailable or unverifiable response; no paid fallback.'
    dedup={};ambiguous=set()
    for receipt in result['receipts']:
        link=receipt['permalink']
        if link in dedup and dedup[link]['creator']!=receipt['creator']:ambiguous.add(link)
        dedup[link]=receipt
    ranked=[]
    for link,receipt in dedup.items():
        if link in ambiguous:result['rejected']+=1;continue
        facts=validate_receipt(receipt,now=now)
        ranked.append((facts,receipt))
    ranked.sort(key=lambda row:(row[0]['live_eligible'],row[0]['verified_relative_outlier'],row[0]['relative_outlier_ratio'] or 0),reverse=True)
    result['receipts']=[receipt for _,receipt in ranked[:MAX_RECEIPTS]]
    result['audited_receipts']=len(result['receipts'])
    result['verified_relative_outliers']=sum(facts['verified_relative_outlier'] for facts,_ in ranked[:MAX_RECEIPTS])
    result['status']='available' if result['receipts'] else 'unavailable'
    if len(result['receipts'])<20:result['reason']=result['reason'] or 'Fewer than twenty eligible dated, source-bound Reel receipts with a five-Reel creator baseline were retrievable.'
    save();return result


def eligible(result,*,now=None,shadow=False):
    accepted=[]
    for receipt in result.get('receipts',[])[:MAX_RECEIPTS]:
        try:
            facts=validate_receipt(receipt,now=now)
            if facts['shadow_eligible' if shadow else 'live_eligible']:accepted.append(receipt)
        except (ValueError,KeyError,TypeError,policy.Quarantine):continue
    return accepted


def fixture():
    path=Path(__file__).resolve().parents[1]/'specs/outlier-fixture-v1.json'
    result=json.loads(path.read_text())
    if result.get('version')!=VERSION or result.get('mode')!='fixture':raise ValueError('fixture version')
    for receipt in result['receipts']:
        if receipt.get('mode')!='fixture':raise ValueError('fixture cannot contain live evidence')
        validate_receipt(receipt,now=instant(result['created_at']))
    return result


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-root',type=Path,required=True);parser.add_argument('--fixture',action='store_true')
    args=parser.parse_args()
    if args.fixture:
        result=fixture();args.output_root.mkdir(parents=True,exist_ok=True)
        (args.output_root/'research-fixture.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps({'mode':'fixture','synthetic_receipts':len(result['receipts']),'actual_verified_public_receipts':0,'live_eligible':0,'cost_usd':0}))
    else:
        config=json.loads(Path(os.environ['ABP_AUTO_CONFIG']).read_text())
        result=collect(args.output_root,config.get('research_creators',[]),Path(config['signing_key']))
        print(json.dumps({k:result[k] for k in ('status','reason','calls','charged_calls','cost_usd','audited_receipts','verified_relative_outliers','organic_verified_outliers')}))
