import json,hashlib,subprocess,math,struct,re,concurrent.futures,time,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import cv2,numpy as np
R=Path(os.environ.get('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve();O=Path(os.environ['ABP_FACTORY_OUTPUT']).resolve();F=O/'final';FF=next((R/'tools').glob('ffmpeg-*/ffmpeg'));FP=FF.with_name('ffprobe')
items=json.loads((O/'briefs.json').read_text())['items']; results=[]
def gate(probe):
 v=[s for s in probe['streams'] if s['codec_type']=='video'];a=[s for s in probe['streams'] if s['codec_type']=='audio']
 assert len(v)==len(a)==1
 v,a=v[0],a[0]
 assert (v['width'],v['height'],v['codec_name'],v['pix_fmt'],v['avg_frame_rate'])==(1080,1920,'h264','yuv420p','30/1')
 assert a['codec_name']=='aac' and a['sample_rate']=='48000'
 assert abs(float(v['duration'])-float(a['duration']))<.08
 assert 3<=float(probe['format']['duration'])<=90
 assert int(probe['format']['size'])<200*2**20
 return v,a
def inspect(item):
 name=item['concept_id'];p=F/f'{name}-REVIEW_ONLY.mp4';m=json.loads(p.with_suffix('.manifest.json').read_text());probe=json.loads(p.with_suffix('.ffprobe.json').read_text());v,a=gate(probe)
 assert m['audio']['text']==item['text']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sha256']
 assert hashlib.sha256(Path(item['source_file']).read_bytes()).hexdigest()==item['source_sha256']
 assert item['source_anchor'] in Path(item['source_file']).read_text()
 words=m['captions']['words'];assert ' '.join(w['word'] for w in words)==item['text'];assert all(0<=w['start']<w['end']<=m['audio']['duration'] for w in words)
 assert all(words[i]['start']<=words[i+1]['start'] for i in range(len(words)-1))
 assert all(96<=m['verified_text_bounds'][i]<=900 for i in [0,2]);assert 275<=m['verified_text_bounds'][1]<=m['verified_text_bounds'][3]<=1460
 decode=subprocess.run([str(FF),'-v','error','-i',str(p),'-f','null','-'],capture_output=True,text=True);assert decode.returncode==0 and not decode.stderr
 loud=subprocess.run([str(FF),'-hide_banner','-i',str(p),'-vn','-af','loudnorm=I=-16:TP=-2:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
 l=json.JSONDecoder().raw_decode(loud.stderr[loud.stderr.rfind('{'):])[0]
 assert -17<=float(l['input_i'])<=-15 and float(l['input_tp'])<=-1
 atoms=[]
 with p.open('rb') as h:
  while z:=h.read(8):
   n,t=struct.unpack('>I4s',z);assert n>=8;atoms.append(t.decode());h.seek(n-8,1)
 assert atoms.index('moov')<atoms.index('mdat')
 assert m['audio']['clipped_samples']==0
 asr=json.loads((O/'audio'/f'{name}-independent-asr.json').read_text())
 result={'concept_id':name,'duration':float(probe['format']['duration']),'bytes':p.stat().st_size,'sha256':m['sha256'],'decode':'PASS','ffprobe':'PASS','faststart':'PASS','source_anchor_and_hash':'PASS','caption_exact_text_and_measured_word_timings':'PASS','text_bounds_every_rendered_frame':m['verified_text_bounds'],'audio_clipping':'PASS','loudness':l,'independent_asr':asr['text'],'rights':'Original graphics/owned prose paraphrase/licensed models; no borrowed footage, photos or music','phone_playback':'NOT RUN','native_Instagram_overlay':'NOT RUN','Instagram_status':'NOT PUBLISHED'}
 m['verification']=result;p.with_suffix('.manifest.json').write_text(json.dumps(m,indent=2));print('PASS',name,result['duration'],l['input_i'],l['input_tp'],flush=True)
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(inspect,items))
assert len(results)==len(items) and len({r['sha256'] for r in results})==len(items)
assert math.isclose(1.5*.6,.9) and math.isclose(.5*1.5+.5*.6,1.05) and math.isclose(.5-.5/10,.45)
assert 4/100==.04 and 4/50==.08 and math.isclose((90+4-100)/100,-.06)
# Controlled negative: an invalid export must be rejected, not silently pass.
bad=json.loads((F/f"{items[0]['concept_id']}-REVIEW_ONLY.ffprobe.json").read_text());next(s for s in bad['streams'] if s['codec_type']=='video')['width']=1920
try:gate(bad)
except AssertionError:negative='PASS: landscape-dimension control rejected'
else:raise AssertionError('invalid video accepted')
# Real final MP4 contact sheets, four scene checkpoints per video, without old previews.
font=ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-Bold.ttf',19)
for part in range(math.ceil(len(items)/6)):
 sheet=Image.new('RGB',(1080,6*520),'#e5e6df');d=ImageDraw.Draw(sheet)
 for row,item in enumerate(items[part*6:(part+1)*6]):
  p=F/f'{item["concept_id"]}-REVIEW_ONLY.mp4';m=json.loads(p.with_suffix('.manifest.json').read_text());cap=cv2.VideoCapture(str(p))
  ts=[1.5]+[x+.8 for x in m['scene_starts'][1:]]
  for col,t in enumerate(ts):
   cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,x=cap.read();assert ok
   im=Image.fromarray(cv2.cvtColor(x,cv2.COLOR_BGR2RGB)).resize((270,480));sheet.paste(im,(col*270,row*520))
  cap.release();d.text((8,row*520+485),item['concept_id']+' · '+item['label'],font=font,fill='#15242b')
 sheet.save(F/f'FINAL_CONTACT_SHEET_{part+1}.jpg',quality=94)
(O/'verification.json').write_text(json.dumps({'head':json.loads((O/'briefs.json').read_text())['head'],'assets':results,'arithmetic':'PASS','negative_control':negative,'unique_hashes':len(items),'total_bytes':sum(r['bytes'] for r in results),'publication_status':'review-only; the factory has no publishing operation'},indent=2))
print('BATCH_QA_PASS',len(results),sum(r['bytes'] for r in results),flush=True)
