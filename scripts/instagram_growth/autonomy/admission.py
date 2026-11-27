"""Signed AUTO_ADMITTED contracts; never manufacture a human review receipt."""
from __future__ import annotations
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import tempfile
from scripts.instagram_growth.autonomy import policy

PUBLIC_KEY = Path(__file__).with_name('public-key.pem')
HOST = 'kveensoemz2j3t8d.public.blob.vercel-storage.com'
RUNTIME_FILES = ('autonomy/policy.py','autonomy/admission.py','autonomy/creative.py','autonomy/research.py','autonomy/research-fixture-public.pem','factory/render.py','factory/audio.py','factory/run.py','factory/verify.py','factory/presenter.py','specs/standalone-v3.json')
# Only the frozen protected-main revision before creative protocol 001. It still
# undergoes signature/source reconstruction; new treatment fields cannot use it.
LEGACY_POLICY_DIGEST='f8956d04b7646b748acf01d36fb51b4aee23be29ba051c571f26f475566a85dd'
LEGACY_RUNTIME_DIGEST='46d3f4fae1c219e6f42e3a2b5b9318f6518deca7068bd8908bca29e7c0ed21a6'
PORTRAIT_SHA='ed3d505c510944b7f4356f75a25df6e4804cf0b7d557598a74600ca74b492bbb'
FLASH_REV='74d81686a7bd750b276ec1ade295bc4077c5868a'


def runtime_digest():
    root=Path(__file__).resolve().parents[1]
    return policy.sha({name:policy.sha((root/name).read_bytes()) for name in RUNTIME_FILES})


def unsigned(value):
    return {k:v for k,v in value.items() if k!='auto_signature'}


def seal(value, key):
    body=policy.canonical(unsigned(value))
    with tempfile.TemporaryDirectory(prefix='abp-sign-') as tmp:
        src=Path(tmp)/'payload';sig=Path(tmp)/'signature';src.write_bytes(body)
        subprocess.run(['openssl','pkeyutl','-sign','-rawin','-inkey',str(key),'-in',str(src),'-out',str(sig)],check=True,capture_output=True)
        return {**value,'auto_signature':base64.b64encode(sig.read_bytes()).decode()}


def authenticate(value):
    try:signature=base64.b64decode(value['auto_signature'],validate=True)
    except (ValueError,KeyError) as error:raise policy.Quarantine('missing_auto_signature') from error
    if len(signature)!=64:raise policy.Quarantine('invalid_auto_signature')
    with tempfile.TemporaryDirectory(prefix='abp-verify-') as tmp:
        src=Path(tmp)/'payload';sig=Path(tmp)/'signature';src.write_bytes(policy.canonical(unsigned(value)));sig.write_bytes(signature)
        result=subprocess.run(['openssl','pkeyutl','-verify','-pubin','-rawin','-inkey',str(PUBLIC_KEY),'-in',str(src),'-sigfile',str(sig)],capture_output=True)
        if result.returncode:raise policy.Quarantine('untrusted_auto_signature')
    return value


def normalize(text):
    text=text.casefold().replace('’',"'")
    substitutions={"can't":"cannot","don't":"do not","doesn't":"does not","isn't":"is not","wouldn't":"would not","it's":"it is","you're":"you are","they're":"they are","that's":"that is","you've":"you have","i'm":"i am","i've":"i have","we've":"we have","won't":"will not","lin's":"lin","lynn":"lin"}
    for a,b in substitutions.items():text=text.replace(a,b)
    return re.findall(r'[a-z]+',text)


def word_error(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        row=[i]
        for j,y in enumerate(b,1):row.append(min(row[-1]+1,prev[j]+1,prev[j-1]+(x!=y)))
        prev=row
    return prev[-1]/max(1,len(a))


def qa_check(item, meta, independent_asr):
    policy.verify_script(item)
    verification=meta.get('verification',{})
    required=('decode','ffprobe','faststart','source_anchor_and_hash','caption_exact_text_and_measured_word_timings','audio_clipping')
    if any(verification.get(k)!='PASS' for k in required):raise policy.Quarantine('incomplete_media_qa')
    if meta['audio']['text']!=item['text'] or meta['audio']['voice']!=item['voice']:raise policy.Quarantine('narration_or_voice_changed')
    if not 15<=float(verification['duration'])<=policy.POLICY['max_seconds']:raise policy.Quarantine('duration_outside_auto_policy')
    if meta['bytes']>policy.POLICY['max_bytes']:raise policy.Quarantine('auto_asset_too_large')
    loud=verification['loudness']
    if not -17<=float(loud['input_i'])<=-15 or float(loud['input_tp'])>-1.5:raise policy.Quarantine('audio_level_failure')
    a=normalize(item['text']);b=normalize(independent_asr)
    error=word_error(a,b)
    if error>.12:raise policy.Quarantine('independent_asr_mismatch')
    for qualifier in ('not','cannot','unless','if','may','might','could'):
        if b.count(qualifier)<a.count(qualifier):raise policy.Quarantine('independent_asr_qualification_missing')
    models=meta['audio'].get('model',{})
    if models.get('revision')!='f3ff3571791e39611d31c381e3a41a3af07b4987':raise policy.Quarantine('unverified_voice_model')
    if item['presenter']:
        presenter=meta.get('presenter',{})
        if presenter.get('model_variant')!='Pro' or presenter.get('model',{}).get('revision')!=FLASH_REV:raise policy.Quarantine('unverified_presenter_model')
        if policy.sha(Path(presenter['original_reference']).read_bytes())!=PORTRAIT_SHA:raise policy.Quarantine('unverified_fictional_identity')
    return {'status':'PASS','independent_asr_word_error_rate':error,'qualifications_audible':True,
            'duration_seconds':float(verification['duration']),'loudness_lufs':float(loud['input_i']),
            'true_peak_dbtp':float(loud['input_tp']),'text_bounds':meta['verified_text_bounds'],
            'checks':list(required),'qa_digest':policy.sha(verification),'render_seconds':meta['render_seconds'],
            'voice_seconds':meta['audio']['seconds'],'voice_peak_allocated_mib':meta['audio'].get('peak_torch_allocated_mib'),
            'presenter_seconds':meta.get('presenter',{}).get('seconds_including_load_and_encode'),
            'presenter_peak_allocated_mib':meta.get('presenter',{}).get('peak_torch_allocated_mib')}


def admit(item, meta, independent_asr, key):
    evidence=policy.verify_script(item);quality=qa_check(item,meta,independent_asr)
    if item['template_parameters'].get('creative'):
        from scripts.instagram_growth.autonomy.creative import require_live_evidence
        require_live_evidence(item)
    source=item['source_url'];caption=item['scenes'][0]['narration']+'\n\nLeon Lin’s perspective: '+source+'\n\nAI-generated narration'+(' and fictional presenter.' if item['presenter'] else '. Original graphics.')
    if item['template_parameters'].get('creative'):
        from scripts.instagram_growth.autonomy.creative import caption as creative_caption
        caption=creative_caption(item)
    manifest={'account':'avoidboringpeople','concept_id':item['concept_id'],'format':'REELS','ai_generated':True,'trial':False,'graduation_strategy':None,
              'source_url':source,'source_file':item['source_file'],'source_sha256':item['source_sha256'],'source_anchor':item['source_anchor'],
              'video_sha256':meta['sha256'],'video_url':f'https://{HOST}/instagram/reels/auto/{item["concept_id"]}/{meta["sha256"]}.mp4',
              'video_path':f'downloads/{meta["sha256"]}.mp4','caption':caption,
              'review_status':'AUTO_ADMITTED','admitted_by':policy.VERSION,'admitted_at':datetime.now(timezone.utc).isoformat(),
              'release_after':datetime.now(timezone.utc).isoformat(),'artifact_type':'abp_auto_manifest_v1',
              'admission':{**evidence,'runtime_digest':runtime_digest(),'quality':quality},'script':item,
              'model_provenance':{'voice_engine':meta['audio']['engine'],'voice_model_revision':meta['audio']['model']['revision'],
                                  'alignment_model_revision':meta['captions']['model_revision'],
                                  'presenter_model_revision':FLASH_REV if item['presenter'] else None,
                                  'fictional_portrait_sha256':PORTRAIT_SHA if item['presenter'] else None,
                                  'rights':'Kokoro Apache2; Lato OFL1.1; original graphics; fictional portrait; FlashHead Pro DiT/WanVAE Apache2; no external clips/music'},
              'voice':item['voice'],'duration_seconds':quality['duration_seconds'],'creative_format':'presenter_then_graphics' if item['presenter'] else 'narrated_motion_graphics',
              'visual_style':item['visual'],'cta_type':'follow','experiment_hypothesis':item['experiment_hypothesis'],
              'experiment_bucket':item['experiment_bucket'],'pair_id':item['pair_id'],'pair_role':item['pair_role'],'claim_id':item['claim_id']}
    if item['template_parameters'].get('creative'):
        manifest.update({k:item[k] for k in ('audience','hook_structure','caption_strategy','creative_trial','research_origin','research_evidence_id')})
    return seal(manifest,key)


def verify_manifest(item):
    authenticate(item)
    if item.get('artifact_type')!='abp_auto_manifest_v1' or item.get('review_status')!='AUTO_ADMITTED' or item.get('admitted_by')!=policy.VERSION:
        raise policy.Quarantine('wrong_auto_admission_contract')
    if item.get('approved_by') is not None or item.get('trial') is not False:raise policy.Quarantine('forged_human_review_or_trial')
    evidence=policy.verify_script(item['script']);admission=item['admission']
    legacy=(not item['script']['template_parameters'].get('creative') and admission.get('policy_digest')==LEGACY_POLICY_DIGEST
            and admission.get('runtime_digest')==LEGACY_RUNTIME_DIGEST)
    if not legacy and admission['runtime_digest']!=runtime_digest():raise policy.Quarantine('stale_or_changed_auto_policy')
    if any(admission[k]!=v for k,v in evidence.items() if not (legacy and k=='policy_digest')):raise policy.Quarantine('stale_or_changed_auto_policy')
    for field in ('concept_id','claim_id','pair_id','pair_role','source_file','source_sha256','source_anchor','source_url','voice'):
        if item.get(field)!=item['script'][field]:raise policy.Quarantine('manifest_script_disagreement')
    if item['script']['template_parameters'].get('creative'):
        from scripts.instagram_growth.autonomy.creative import caption,require_live_evidence
        require_live_evidence(item['script'],now=datetime.fromisoformat(item['admitted_at']))
        if item.get('caption')!=caption(item['script']):raise policy.Quarantine('creative_caption_disagreement')
        for field in ('audience','hook_structure','caption_strategy','creative_trial','research_origin','research_evidence_id'):
            if item.get(field)!=item['script'][field]:raise policy.Quarantine('manifest_creative_disagreement')
    if admission['quality']['status']!='PASS' or item['account']!='avoidboringpeople':raise policy.Quarantine('qa_or_identity_failure')
    expected=f'https://{HOST}/instagram/reels/auto/{item["concept_id"]}/{item["video_sha256"]}.mp4'
    if item['video_url']!=expected:raise policy.Quarantine('unowned_auto_video_url')
    return item
