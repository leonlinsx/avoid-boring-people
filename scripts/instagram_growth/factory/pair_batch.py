"""Add matched graphics versions of completed presenter Reels for batch review."""
import argparse
import copy
import json
from pathlib import Path
import shutil
import subprocess
from scripts.instagram_growth.factory.review import assets, package, digest


def compare(root, state, count=6):
    root=Path(root).resolve()
    if not 1<=count<=6:raise ValueError('one to six presentation pairs required')
    candidates=[]
    for batch in assets(root):
        for item in json.loads((batch/'briefs.json').read_text())['items']:
            if item.get('presenter') and item.get('standalone_context'):
                candidates.append((batch,item))
    if len(candidates)<count:raise ValueError('not enough complete contextual presenter originals')
    groups={};records=[]
    for batch,original in candidates[:count]:
        name=original['concept_id'];source=batch/'final'/f'{name}-REVIEW_ONLY.mp4'
        meta=json.loads(source.with_suffix('.manifest.json').read_text())
        if meta.get('verification',{}).get('decode')!='PASS':raise ValueError('original media QA incomplete')
        pair_id='abppair-'+digest({'source':original['source_file'],'text':meta['audio']['text'],'voice':meta['audio']['voice']})[:16]
        alternate=copy.deepcopy(original);alternate.update(concept_id=name+'-graphics',presenter=False,pair_id=pair_id,pair_role='graphics',pair_primary_factor='fictional_presenter_opening_vs_graphics')
        voice=meta['audio']['voice'];target=root/f'paired-{voice}';audio=target/'audio';audio.mkdir(parents=True,exist_ok=True)
        for suffix in ('-REVIEW_ONLY.wav','.json','-REVIEW_ONLY.alignment.json','-independent-asr.json'):
            src=batch/'audio'/f'{name}{suffix}';dst=audio/f"{alternate['concept_id']}{suffix}"
            if not dst.exists():
                shutil.copy2(src,dst)
                if suffix=='.json':
                    data=json.loads(dst.read_text());data.update(path=str(audio/f"{alternate['concept_id']}-REVIEW_ONLY.wav"),reused_from_audio_sha256=data['sha256'],original_generation_seconds=data.get('seconds'),seconds=0)
                    dst.write_text(json.dumps(data,indent=2)+'\n')
        groups.setdefault(voice,[]).append(alternate)
        records.append({'original_batch':batch,'original':original,'alternate':alternate,'pair_id':pair_id,'meta':meta,'target':target})
    python=Path('.venv-ig-reels/bin/python').absolute()
    for voice,items in groups.items():
        spec=root/f'paired-{voice}-spec.json';spec.write_text(json.dumps({'items':items},indent=2)+'\n')
        subprocess.run([str(python),'-m','scripts.instagram_growth.factory.run','--spec',str(spec),'--output',str(root/f'paired-{voice}'),'--voice',voice,'--limit',str(len(items))],check=True)
    registry={};summary=[]
    for record in records:
        a=record['meta'];alternate=record['alternate'];b=json.loads((record['target']/'final'/f"{alternate['concept_id']}-REVIEW_ONLY.manifest.json").read_text())
        assert a['audio']['text']==b['audio']['text'] and a['audio']['sha256']==b['audio']['sha256']
        assert a['audio']['voice']==b['audio']['voice'] and a['captions']['words']==b['captions']['words']
        assert abs(float(a['ffprobe']['format']['duration'])-float(b['ffprobe']['format']['duration']))<.04
        for name,meta,role in [(record['original']['concept_id'],a,'presenter'),(alternate['concept_id'],b,'graphics')]:
            registry[name]={'pair_id':record['pair_id'],'pair_role':role,'pair_primary_factor':'fictional_presenter_opening_vs_graphics','video_sha256':meta['sha256']}
        summary.append({'pair_id':record['pair_id'],'source_url':record['original']['source_url'],'members':[record['original']['concept_id'],alternate['concept_id']],
                        'matched_audio_sha256':a['audio']['sha256'],'caption_words_sha256':digest(a['captions']['words']),'voice':a['audio']['voice'],
                        'duration_seconds':a['audio']['duration'],'tested_difference':'Fictional presenter opening versus graphics throughout; unique footer IDs/disclosures identify each creative.',
                        'inference':'Nonrandomized observational comparison; do not attribute account follower gains per variant.'})
    path=root/'presentation-pairs.json';encoded=json.dumps(registry,indent=2)+'\n'
    if path.exists() and path.read_text()!=encoded:raise ValueError('pair registry already frozen differently')
    path.write_text(encoded)
    (root/'PRESENTATION_COMPARISON.json').write_text(json.dumps({'pairs':summary,'new_graphics_versions':count,'approved':0},indent=2)+'\n')
    return package(root,state)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--state',type=Path,required=True);p.add_argument('--pairs',type=int,default=6);a=p.parse_args()
    print(compare(a.root,json.loads(a.state.read_text()),a.pairs))


if __name__=='__main__':main()
