"""Source-grounded 12-Reel local batch; no upload or publishing code."""
import json,pathlib,math,time,hashlib,subprocess,sys,os
from PIL import Image,ImageDraw,ImageFont,ImageOps
import numpy as np,cv2
from run import presenter_window
R=pathlib.Path(os.environ.get('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve();O=pathlib.Path(os.environ['ABP_FACTORY_OUTPUT']).resolve();F=O/'final';F.mkdir(exist_ok=True)
FF=next((R/'tools').glob('ffmpeg-*/ffmpeg'));FP=FF.with_name('ffprobe');FPS=30
W,H=1080,1920;WHITE='#f6f3eb';MUTED='#a3b4b2';GREEN='#d4f28d';RED='#ffac96';PANEL='#203337';fonts={};bounds=[1080,1920,0,0]
def font(n,b=True):
 k=(int(n),b)
 if k not in fonts:fonts[k]=ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-'+('Bold' if b else 'Regular')+'.ttf',int(n))
 return fonts[k]
def text(d,s,x,y,n=42,c=WHITE,b=True,center=False):
 f=font(n,b)
 if center:x-=d.textlength(s,font=f)/2
 bb=d.textbbox((x,y),s,font=f)
 assert 96<=bb[0] and bb[2]<=900 and 275<=bb[1] and bb[3]<=1460,(s,bb)
 bounds[0]=min(bounds[0],bb[0]);bounds[1]=min(bounds[1],bb[1]);bounds[2]=max(bounds[2],bb[2]);bounds[3]=max(bounds[3],bb[3]); d.text((x,y),s,font=f,fill=c)
def wrap(d,s,x,y,n=65,w=790,c=WHITE,center=False):
 while True:
  lines=[];line=''
  for a in s.split():
   q=(line+' '+a).strip()
   if line and d.textlength(q,font=font(n))>w:lines.append(line);line=a
   else:line=q
  if line:lines.append(line)
  if len(lines)<=2 and all(d.textlength(l,font=font(n))<=w for l in lines):break
  n-=2;assert n>=28,s
 for j,l in enumerate(lines):text(d,l,500 if center else x,y+j*n*1.17,n,c,center=center)
 return len(lines)
def ease(v):return 1-(1-min(1,max(0,v)))**3
def card(d,box,fill=PANEL,outline=None):d.rounded_rectangle(box,radius=22,fill=fill,outline=outline,width=2)
def small(d,s,y=1040):wrap(d,s,110,y,29,c=MUTED)
def number(d,s,y=730,n=125,c=GREEN):text(d,s,500,y,n,c,center=True)
def diagram(d,item,stage,p,t):
 typ=item['visual'];z=ease(p)
 if typ=='ledger':
  values=[1,1.5,.9,.9]; val=values[stage];number(d,f'${val:.2f}',720,148,RED if stage>=2 else GREEN)
  card(d,(110,940,890,990));d.rounded_rectangle((110,940,110+max(3,int(780*val/1.5*z)),990),radius=15,fill=RED if stage>=2 else GREEN)
  small(d,['A sequence, not an addition problem','WIN: +50¢ ON THE ORIGINAL DOLLAR','LOSS: 40% OF $1.50 = 60¢','90¢ IS 10% BELOW $1.00'][stage])
 elif typ=='paths':
  # Theoretical mean wealth versus one alternating realization, not a simulated population.
  d.line((125,960,875,960),fill=MUTED,width=2)
  mean=[1.05**i for i in range(9)];path=[(1.5 if i%2 else 1)*(.9**(i//2)) for i in range(9)]
  for vals,col in [(mean,GREEN),(path,RED)]:
   points=[(140+i*90,1010-v*205) for i,v in enumerate(vals)]
   upto=max(2,min(9,int(2+z*7)))
   d.line(points[:upto],fill=col,width=7)
   for x,y in points[:upto]:d.ellipse((x-5,y-5,x+5,y+5),fill=col)
  text(d,'MEAN ACROSS POSSIBILITIES',110,640,29,GREEN);text(d,'ONE ALTERNATING PATH',110,1090,29,RED)
  small(d,'ILLUSTRATION · SAME GAME, DIFFERENT QUESTIONS',1160)
 elif typ=='coin':
  for x,s,col in [(310,'WIN',GREEN),(690,'LOSE',RED)]:
   d.ellipse((x-135,690,x+135,960),fill=PANEL,outline=col,width=4);text(d,s,x,780,52,col,center=True)
  number(d,'0% EDGE' if stage<2 else '0% STAKE',1050,65)
 elif typ=='kelly':
  # Proportional stake / reserve diagram, under the explicitly narrated model.
  box=(330,650,670,990);d.arc(box,0,360,fill=PANEL,width=58);d.arc(box,-90,-90+360*.45*z,fill=GREEN,width=58)
  text(d,'45%',500,755,92,GREEN,center=True)
  text(d,'STAKE',500,860,28,MUTED,center=True)
  small(d,'45% MODEL STAKE / 55% UNSTAKED',1040);small(d,'ASSUMES 50% WIN CHANCE; 10:1 NET PROFIT',1100)
 elif typ=='reframe':
  card(d,(110,650,890,800));wrap(d,'WHAT MIGHT GO WRONG?',150,690,49,c=MUTED)
  d.line((145,746,840,700),fill=RED,width=4)
  d.polygon([(485,845),(515,845),(515,890),(540,890),(500,930),(460,890),(485,890)],fill=GREEN)
  card(d,(110,960,890,1130),outline=GREEN);wrap(d,'IT FAILED. WHY?',150,1000,65,c=GREEN)
 elif typ=='roundrobin':
  for i in range(5):
   x=190+i*155;active=int(t*1.2)%5==i
   d.ellipse((x-58,720,x+58,836),fill=GREEN if active else PANEL)
   text(d,chr(65+i),x,745,40,'#17262a' if active else WHITE,center=True)
   d.line((x,875,x,1000+(-30 if active else 0)),fill=GREEN if active else MUTED,width=5)
  small(d,'ONE CONCERN EACH. THEN ANOTHER ROUND.',1080)
 elif typ=='filter':
  for i in range(10):
   x=115+(i%5)*155;y=690+(i//5)*155; selected=i in (0,2,4,6,8)
   card(d,(x,y,x+130,y+120),GREEN if selected else PANEL)
   text(d,str(i+1),x+65,y+33,36,'#17262a' if selected else MUTED,center=True)
  small(d,'AN EXERCISE, NOT A PROVEN FIVE-FACT RULE',1080)
 elif typ=='equity':
  card(d,(110,670,465,950));card(d,(535,670,890,950),outline=GREEN)
  text(d,'TODAY',287,710,32,MUTED,center=True);text(d,'FUTURE',712,710,32,GREEN,center=True)
  text(d,'CASH',287,800,54,center=True);text(d,'EQUITY',712,800,54,GREEN,center=True)
  small(d,'CERTAIN COSTS / UNCERTAIN OUTCOMES',1050)
 elif typ=='yield':
  for y,label,value,col in [(700,'PRICE',100 if stage<2 else 50,WHITE),(870,'CASH / YEAR',4,GREEN)]:
   text(d,label,110,y,30,MUTED); width=430*value/100
   d.rounded_rectangle((355,y,355+max(5,width*z),y+65),radius=12,fill=col)
   text(d,f'${value}',790,y+6,36,col)
  number(d,'4% YIELD' if stage<2 else '8% YIELD',1030,64)
 elif typ=='totalreturn':
  vals=[('START',100,WHITE),('SALE',90,RED),('CASH',4,GREEN)]
  for i,(label,val,col) in enumerate(vals):
   y=670+i*137;text(d,label,110,y+15,30,MUTED)
   d.rounded_rectangle((300,y,300+max(5,450*val/100*z),y+75),radius=14,fill=col)
   text(d,f'${val}',790,y+15,35,col)
  small(d,'$90 + $4 − $100 = −$6 (−6%)',1120)
 elif typ=='process':
  for i,label in enumerate(['INPUT','ACTION','FEEDBACK']):
   y=650+i*165;card(d,(220,y,780,y+115),outline=GREEN if i==1 else None);text(d,label,500,y+30,43,GREEN if i==1 else WHITE,center=True)
   if i<2:d.line((500,y+120,500,y+158),fill=MUTED,width=5)
  small(d,'MAP → FIND A WEAK STEP → ADJUST',1190)
 elif typ=='log':
  for i,(a,b) in enumerate([('01','PREDICT'),('02','CHANGE'),('03','OBSERVE')]):
   y=670+i*150;card(d,(110,y,890,y+112));text(d,a,150,y+25,42,GREEN);text(d,b,290,y+25,42)
  small(d,'DATE YOUR RECORD BEFORE SEEING RESULTS',1180)
 elif typ=='cards':
  for j,label in enumerate(item.get('graphic_labels',['EVIDENCE','ASSUMPTION','DECISION'])):
   y=660+j*160;card(d,(110,y,890,y+120),outline=GREEN if j==stage%3 else None);wrap(d,label,150,y+35,42,c=GREEN if j==stage%3 else WHITE)
 elif typ=='statement':
  card(d,(110,690,890,1080),outline=GREEN)
  text(d,'ONE IDEA TO EXAMINE',150,735,34,GREEN)
  wrap(d,item['scenes'][stage]['headline'],150,830,58,w=700)
  small(d,'CONTEXT AND QUALIFICATIONS MATTER',1140)
 else:raise ValueError(typ)
def caption_groups(words,maximum=5):
 groups=[];buf=[]
 for w in words:
  if buf and (len(buf)>=maximum or len(' '.join(x['word'] for x in buf))+len(w['word'])>30):groups.append(buf);buf=[]
  buf.append(w)
  if w['word'].endswith(('.', '?', '!')):groups.append(buf);buf=[]
 if buf:groups.append(buf)
 return groups
def render(item,preview=False):
 bounds[:]=[1080,1920,0,0]; name=item['concept_id'];audio=json.loads((O/'audio'/f'{name}.json').read_text());align=json.loads((O/'audio'/f'{name}-REVIEW_ONLY.alignment.json').read_text());dur=audio['duration'];starts=[0]+align['scene_starts'][1:];groups=caption_groups(align['words'],item.get('caption_words',5));frames=[]
 if item['presenter']:
  source=O/'presenters'/name/'flashhead-pro-native-REVIEW_ONLY.mp4'
  if not source.exists() and not preview:raise FileNotFoundError(source)
  if source.exists():
   cap=cv2.VideoCapture(str(source))
   while True:
    ok,frame=cap.read()
    if not ok:break
    frames.append(Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)))
   cap.release()
  if not preview:presenter_window(len(frames),starts[1])
 presenter_end=presenter_window(len(frames),starts[1]) if frames else 0
 def draw(t):
  stage=max(i for i,s in enumerate(starts) if t>=s);elapsed=t-starts[stage]; im=Image.new('RGB',(W,H),'#0c1b20')
  # Quiet background rails keep motion without distracting stock footage.
  d=ImageDraw.Draw(im)
  for k in range(7):
   y=int(540+k*150+(t*9)%150);d.line((96,y,900,y),fill='#12252a',width=1)
  show_presenter=stage==0 and t<presenter_end
  if show_presenter:
   idx=min(int(t*25),len(frames)-1); im=ImageOps.fit(frames[idx],(W,H),method=Image.Resampling.LANCZOS)
   overlay=Image.new('RGBA',(W,H),(0,0,0,0)); od=ImageDraw.Draw(overlay)
   for y in range(H):
    alpha=int(210*max(0,(740-y)/740)+200*max(0,min(1,(y-1030)/380)))
    od.line((0,y,W,y),fill=(4,12,16,min(235,alpha)))
   im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB');d=ImageDraw.Draw(im)
  text(d,'AVOID BORING PEOPLE',110,285,28,GREEN)
  text(d,'AI VOICE'+(' · FICTIONAL PRESENTER' if item['presenter'] else ''),110,330,30,MUTED)
  if item.get('source_date'):text(d,'SOURCE ESSAY · '+item['source_date'],110,375,22,MUTED)
  wrap(d,item['scenes'][stage]['headline'],110,410,64)
  if show_presenter:
   wrap(d,item['scenes'][stage]['detail'],110,1080,54,c=GREEN)
  else:
   wrap(d,item['scenes'][stage]['detail'],110,570,32,c=GREEN)
   diagram(d,item,stage,elapsed,t)
  cg=next((g for g in groups if g[0]['start']<=t<g[-1]['end']+.06),None)
  if cg:
   # Waveform-aligned phrase captions, with actual active word highlighted.
   x,y=110,1290
   for word in cg:
    width=d.textlength(word['word'],font=font(49))
    if x+width>900:x,y=110,y+58
    active=word['start']<=t<=word['end']
    text(d,word['word'],x,y,49,GREEN if active else WHITE)
    x+=width+d.textlength(' ',font=font(49))
  text(d,'LEONLINS.COM / '+name.upper(),110,1430,20,MUTED)
  d.rounded_rectangle((110,1510,900,1516),radius=3,fill=PANEL)
  d.rounded_rectangle((110,1510,110+max(3,int(790*t/dur)),1516),radius=3,fill=GREEN)
  return im
 if preview:
  for j,t in enumerate([1.5,starts[1]+.7,starts[2]+1,starts[3]+1]):draw(t).save(F/f'{name}-scene-{j}.jpg',quality=94)
  return
 p=F/f'{name}-REVIEW_ONLY.mp4'
 if p.exists() and p.with_suffix('.manifest.json').exists():return
 start=time.monotonic()
 probe=subprocess.run([str(FF),'-hide_banner','-i',audio['path'],'-af','loudnorm=I=-16:TP=-2:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
 l=json.JSONDecoder().raw_decode(probe.stderr[probe.stderr.rfind('{'):])[0]
 norm=f"loudnorm=I=-16:TP=-2:LRA=9:measured_I={l['input_i']}:measured_TP={l['input_tp']}:measured_LRA={l['input_lra']}:measured_thresh={l['input_thresh']}:offset={l['target_offset']}:linear=true"
 proc=subprocess.Popen([str(FF),'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','pipe:0','-i',audio['path'],'-af',norm,'-c:v','libx264','-threads','3','-preset','fast','-crf','18','-pix_fmt','yuv420p','-profile:v','high','-level:v','4.1','-c:a','aac','-b:a','192k','-ar','48000','-t',str(dur),'-movflags','+faststart',str(p)],stdin=subprocess.PIPE)
 for i in range(math.ceil(dur*30)):
  im=draw(i/30)
  if i in [45,int((starts[1]+.7)*30),int((starts[2]+1)*30),int((starts[3]+1)*30)]:im.save(F/f'{name}-frame-{i}.jpg',quality=94)
  proc.stdin.write(im.tobytes())
 proc.stdin.close();assert proc.wait()==0
 scan=json.loads(subprocess.check_output([str(FP),'-v','quiet','-show_format','-show_streams','-of','json',str(p)]));p.with_suffix('.ffprobe.json').write_text(json.dumps(scan,indent=2))
 out={'concept':item,'audio':audio,'captions':align,'caption_groups':groups,'scene_starts':starts,'verified_text_bounds':bounds.copy(),'safe_area_note':'Conservative central region; actual native Instagram overlay unverified until pilot','render_seconds':time.monotonic()-start,'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'rights':'Original owned article paraphrase and code-drawn graphics. No article photos, copyrighted clips or music. Lato OFL-1.1; Kokoro Apache-2.0; fictional Z-Image portrait and FlashHead Pro DiT/Wan VAE Apache-2.0. No real person likeness or voice cloning.','quality_review':'technical/source/frame review pending; no human full playback claimed','head':json.loads((O/'briefs.json').read_text())['head'],'ffprobe':scan}
 if item['presenter']:
  out['presenter']=json.loads((O/'presenters'/name/'flashhead-pro.manifest.json').read_text())
  out['presenter_display_until_seconds']=presenter_end
  out['presenter_transition']='Cut to motion graphics at native clip end or next scene; narration and word alignment continue unchanged.'
 p.with_suffix('.manifest.json').write_text(json.dumps(out,indent=2));print('RENDERED',name,round(dur,2),round(out['render_seconds'],2),out['bytes'],flush=True)
if __name__=='__main__':
 items=json.loads((O/'briefs.json').read_text())['items']
 for item in items:
  if len(sys.argv)>1 and sys.argv[1] not in ('preview',item['concept_id']):continue
  render(item,preview='preview' in sys.argv)
