"""Explicit operator approval after playback/source review; never used by timers."""
import argparse
import hashlib
import json
from pathlib import Path
from scripts.instagram_growth.factory.run import validate
from scripts.instagram_growth import reel_pilot as pilot


def approve(batch: Path, concept: str, reviewer: str, confirmed: bool, trial: bool=False):
    if not confirmed or not reviewer.strip():raise ValueError('explicit reviewed-playback/source confirmation and named reviewer required')
    review=batch/'review-queue'/f'{concept}.json'
    row=json.loads(review.read_text())
    if row['review_status']=='rejected':raise ValueError('rejected creative requires a corrected new batch, not approval override')
    items=json.loads((batch/'briefs.json').read_text())['items'];item=validate(next(x for x in items if x['concept_id']==concept))
    video=batch/'final'/f'{concept}-REVIEW_ONLY.mp4';meta=json.loads(video.with_suffix('.manifest.json').read_text())
    if hashlib.sha256(video.read_bytes()).hexdigest()!=meta['sha256']:raise ValueError('video changed after QA')
    if meta.get('verification',{}).get('decode')!='PASS':raise ValueError('full media verification missing')
    caption=item['scenes'][0]['narration']+'\n\nOriginal essay: '+item['source_url']+'\n\nAI-generated voice'+(' and fictional presenter.' if item.get('presenter') else '.')
    pilot.ig.validate_caption(caption)
    manifest={'account':'avoidboringpeople','concept_id':concept,'source_url':item['source_url'],'source_file':item['source_file'],'source_sha256':item['source_sha256'],'source_anchor':item['source_anchor'],'format':'REELS','video_path':str(video.resolve()),'video_sha256':meta['sha256'],'video_url':None,'caption':caption,'trial':trial,'graduation_strategy':'MANUAL' if trial else None,'ai_generated':True,'review_status':'approved','approved_by':reviewer,'approval_scope':'Operator explicitly confirmed full audio/video playback, source fidelity and rights.','release_after':None,'creative_format':'presenter_then_graphics' if item.get('presenter') else 'narrated_motion_graphics','voice':meta['audio']['voice'],'duration_seconds':meta['audio']['duration'],'cta_type':item.get('cta_type','follow'),'experiment_hypothesis':'source-passage control' if item.get('source_passage') else item.get('experiment_hypothesis','source-grounded insight')}
    out=batch/'approved';out.mkdir(exist_ok=True);target=out/f'{concept}.json'
    if target.exists() and json.loads(target.read_text())!=manifest:raise ValueError('prior approval differs; preserve it and use a corrected batch')
    target.write_text(json.dumps(manifest,indent=2)+'\n')
    return target


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--batch',type=Path,required=True);p.add_argument('--concept',required=True);p.add_argument('--reviewer',required=True);p.add_argument('--confirm-reviewed',action='store_true');p.add_argument('--delivery',choices=['standard','trial'],default='standard');a=p.parse_args()
    if not __import__('re').fullmatch(r'[a-z0-9][a-z0-9_-]{2,63}',a.concept):p.error('unsafe concept')
    print(approve(a.batch,a.concept,a.reviewer,a.confirm_reviewed,trial=a.delivery=='trial'))

if __name__=='__main__':main()
