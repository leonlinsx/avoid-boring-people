"""Offline ten-claim typography comparison using already generated audio/ASR.

No model invocation, credentials, admission, upload, or production state access.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from scripts.instagram_growth.autonomy import policy,creative,admission

CLAIMS = (
    'claim-26753acb874975ae6320e732','claim-0f93e2a121126f86c27634d9',
    'claim-44abcae2d7bb949f84122095','claim-666449939255f9ab7ad912c5',
    'claim-65ff665e7dcc781ecd3b1831','claim-6efa8087af2f73e1cf40b6c6',
    'claim-1ce2902d82101dfdd309b996','claim-e54e87db222ee4fe66d84d2b',
    'claim-0016edb6f7cede444a620f86','claim-f59b48a546311ced177229d3',
)


def run(cached_audio,output,gpu_root):
    if output.exists():raise ValueError('choose a new frozen output directory')
    records={r['claim_id']:r for r in policy.discover()[0]}
    compiled={arm:[policy.compile_script(records[key],creative={'protocol':creative.PROTOCOL,'factor':'typography','arm':arm,'evidence':None}) for key in CLAIMS] for arm in (0,1)}
    cache={}
    for p in sorted((cached_audio/'audio').glob('*.json')):
        if p.name.endswith(('alignment.json','asr.json')):continue
        value=json.loads(p.read_text())
        if value.get('voice')=='af_heart' and value.get('text'):cache[value['text']]=p
    # Missing inputs fail before rendering. A treatment can never synthesize a
    # different voice, omit an ASR failure, or fall back under a false identity.
    for item in compiled[1]:
        policy.verify_script(item)
        if item['text'] not in cache:raise ValueError('missing cached narration')
        p=cache[item['text']]
        for suffix in ('-REVIEW_ONLY.wav','-REVIEW_ONLY.alignment.json','-independent-asr.json'):
            if not p.with_name(p.stem+suffix).exists():raise ValueError('incomplete cached evidence')
    head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
    output.mkdir(parents=True)
    rows=[];here=Path(__file__).resolve().parent
    for arm,label in ((0,'control'),(1,'treatment')):
        batch=output/label;batch.mkdir();(batch/'audio').mkdir()
        items=compiled[arm]
        (batch/'briefs.json').write_text(json.dumps({'head':head,'items':items},indent=2)+'\n')
        for item in items:
            p=cache[item['text']];meta=json.loads(p.read_text());name=item['concept_id']
            wav=batch/'audio'/f'{name}-REVIEW_ONLY.wav'
            original=p.with_name(p.stem+'-REVIEW_ONLY.wav')
            if hashlib.sha256(original.read_bytes()).hexdigest()!=meta['sha256']:raise ValueError('cached waveform changed')
            shutil.copy2(original,wav);meta['path']=str(wav)
            (batch/'audio'/f'{name}.json').write_text(json.dumps(meta,indent=2)+'\n')
            for suffix in ('-REVIEW_ONLY.alignment.json','-independent-asr.json'):
                shutil.copy2(p.with_name(p.stem+suffix),batch/'audio'/f'{name}{suffix}')
        env={**os.environ,'ABP_FACTORY_OUTPUT':str(batch.resolve()),'ABP_GPU_ROOT':str(gpu_root.resolve())}
        for script in ('render.py','verify.py'):
            with (batch/(script+'.log')).open('w') as log:
                subprocess.run([sys.executable,str(here/script)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=900)
        for item in items:
            name=item['concept_id'];meta=json.loads((batch/'final'/f'{name}-REVIEW_ONLY.manifest.json').read_text())
            asr=json.loads((batch/'audio'/f'{name}-independent-asr.json').read_text())
            quality=admission.qa_check(item,meta,asr['text'])
            rows.append({'arm':label,'claim_id':item['claim_id'],'concept_id':name,'source_file':item['source_file'],
                         'sha256':meta['sha256'],'audio_sha256':meta['audio']['sha256'],
                         'duration':quality['duration_seconds'],'seconds':meta['render_seconds'],'bytes':meta['bytes'],
                         'quality':quality,'minimum_font_px':min((p['layout']['font_size'] for p in meta.get('source_typography',{}).get('sentences',[])),default=None)})
    (output/'benchmark.json').write_text(json.dumps({'head':head,'mode':'offline_no_signing_or_publication','rows':rows},indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cached-batch',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--gpu-root',type=Path,default=Path('.tmp/instagram-growth'))
    args=parser.parse_args();run(args.cached_batch,args.output,args.gpu_root)
