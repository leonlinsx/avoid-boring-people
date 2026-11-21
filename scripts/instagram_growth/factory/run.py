"""Repeatable local GPU batch, always ending in a review queue, never posting."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import hashlib
import re


def standalone(item):
    """A mechanical context screen, never a substitute for editorial review."""
    context=item.get('standalone_context') or {}
    subject=str(context.get('subject','')).strip()
    opening=item['scenes'][0]['narration'].strip()
    if not subject or subject.casefold() not in opening.casefold():
        raise ValueError('standalone opening must explicitly name its subject')
    if not context.get('situation') or not context.get('payoff'):
        raise ValueError('standalone situation and payoff required')
    if re.match(r"(?i)^(this|that|these|those|it|however|from the above|as mentioned|whether this)\b",opening):
        raise ValueError('opening depends on unseen context')
    if re.search(r'(?i)\b(bottom right|as mentioned|this second finding|from the above|as shown (above|below))\b',item.get('text','')):
        raise ValueError('script refers to missing article context')
    return context


def presenter_window(frame_count, scene_end, fps=25):
    """Cut to graphics before native video runs out; never freeze a face."""
    if frame_count <= 0 or fps <= 0 or scene_end <= 0:
        raise ValueError('presenter requires decoded frames and a positive scene')
    return min(scene_end, frame_count / fps)


def validate(item):
    source=Path(item['source_file']).resolve()
    if not source.is_relative_to(Path('src/content/blog').resolve()) or not source.is_file():raise ValueError('invalid source')
    data=source.read_bytes()
    if hashlib.sha256(data).hexdigest()!=item['source_sha256'] or item['source_anchor'] not in data.decode():raise ValueError('source mismatch')
    if any(anchor not in data.decode() for anchor in item.get('context_anchors',[])):raise ValueError('source context mismatch')
    if not __import__('re').fullmatch(r'[a-z0-9][a-z0-9_-]{2,63}',item['concept_id']):raise ValueError('unsafe concept')
    scenes=item['scenes']
    if len(scenes)!=4:raise ValueError('four explanatory beats required')
    if any(not s['narration'].strip() or len(s['headline'])>80 or len(s['detail'])>85 for s in scenes):raise ValueError('invalid scene copy')
    text=' '.join(s['narration'] for s in scenes)
    if not 35<=len(text.split())<=100:raise ValueError('35–100 words required')
    item['text']=text
    if item.get('standalone_context'):standalone(item)
    return item


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--spec',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--voice',choices=['af_heart','af_nicole'],default='af_heart');p.add_argument('--limit',type=int,default=12);a=p.parse_args()
    if not 1<=a.limit<=24:p.error('bounded batches require 1–24 items')
    root=Path(os.getenv('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
    raw=json.loads(a.spec.read_text());items=[validate(dict(x)) for x in raw['items'][:a.limit]]
    if len({i['concept_id'] for i in items})!=len(items):raise ValueError('duplicate concepts')
    plan={'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'account':'avoidboringpeople','status':'review_required','items':items}
    encoded=json.dumps(plan,indent=2)
    lock=out/'briefs.json'
    if lock.exists() and json.loads(lock.read_text())['items']!=items:raise ValueError('output directory belongs to another frozen batch; choose a new path')
    lock.write_text(encoded+'\n')
    env={**os.environ,'ABP_GPU_ROOT':str(root),'ABP_FACTORY_OUTPUT':str(out),'ABP_TTS_VOICE':a.voice}
    here=Path(__file__).resolve().parent
    def run(script,python=None):
        with (out/f'{script}.log').open('a') as log:subprocess.run([str(python or root/'env/bin/python'),str(here/script)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    run('audio.py');run('transcribe.py')
    for item in items:
        if not item.get('presenter'):continue
        name=item['concept_id'];target=out/'presenters'/name
        if (target/'flashhead-pro.manifest.json').exists():continue
        align=json.loads((out/'audio'/f'{name}-REVIEW_ONLY.alignment.json').read_text())
        duration=min(8,max(4.2,align['scene_starts'][1]+.2))
        presenter_env={**env,'ABP_FLASH_OUTPUT':str(target),'ABP_FLASH_HEIGHT':'768','ABP_FLASH_WIDTH':'512','ABP_FLASH_AUDIO':str(out/'audio'/f'{name}-REVIEW_ONLY.wav'),'ABP_FLASH_DURATION':str(duration),'ABP_FLASH_TEXT':item['scenes'][0]['narration']}
        with (out/f'{name}-presenter.log').open('a') as log:subprocess.run([str(root/'env-flash/bin/python'),str(here/'presenter.py')],env=presenter_env,stdout=log,stderr=subprocess.STDOUT,check=True)
    run('render.py');run('verify.py')
    queue=out/'review-queue';queue.mkdir(exist_ok=True)
    for item in items:
        name=item['concept_id'];video=out/'final'/f'{name}-REVIEW_ONLY.mp4';meta=json.loads(video.with_suffix('.manifest.json').read_text())
        record={'account':'avoidboringpeople','concept_id':name,'source_file':item['source_file'],'source_sha256':item['source_sha256'],'source_anchor':item['source_anchor'],'source_url':item['source_url'],'video_path':str(video),'video_sha256':meta['sha256'],'review_status':'needs_human_review','approved_by':None,'video_url':None,'quality_evidence':str(video.with_suffix('.manifest.json')),'voice':a.voice,'narration':item['text']}
        (queue/f'{name}.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({'status':'RENDERED_REVIEW_REQUIRED','videos':len(items),'review_queue':str(queue),'published':0}))

if __name__=='__main__':main()
