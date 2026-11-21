import os,json,time,pathlib,hashlib,re,gc
R=pathlib.Path(os.environ.get('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve(); O=pathlib.Path(os.environ['ABP_FACTORY_OUTPUT']).resolve(); A=O/'audio'; A.mkdir(exist_ok=True)
os.environ.update(HF_HUB_OFFLINE='1',HF_HUB_DISABLE_IMPLICIT_TOKEN='1',HF_HUB_DISABLE_TELEMETRY='1',NLTK_DATA=str(R/'nltk'))
import torch,numpy as np,soundfile as sf
from kokoro import KModel,KPipeline
items=json.loads((O/'briefs.json').read_text())['items']; torch.set_num_threads(6); torch.manual_seed(20261121)
assert torch.cuda.is_available(); print('GPU',torch.cuda.get_device_name(),torch.__version__,flush=True)
t0=time.monotonic(); torch.cuda.reset_peak_memory_stats()
model=KModel(repo_id='hexgrad/Kokoro-82M',config=str(R/'models/kokoro/config.json'),model=str(R/'models/kokoro/kokoro-v1_0.pth')).to('cuda').eval()
pipe=KPipeline(lang_code='a',repo_id='hexgrad/Kokoro-82M',model=model,device='cuda');voice_name=os.environ.get('ABP_TTS_VOICE','af_heart');voice=torch.load(R/f'models/kokoro/voices/{voice_name}.pt',weights_only=True,map_location='cpu')
for item in items:
 name=item['concept_id']; wav=A/f'{name}-REVIEW_ONLY.wav'; meta=A/f'{name}.json'
 if wav.exists() and meta.exists():continue
 start=time.monotonic()
 with torch.inference_mode():x=np.concatenate([v.audio.cpu().numpy() for v in pipe(item['text'],voice=voice,speed=.95)])
 sr=24000; nz=np.flatnonzero(abs(x)>.001); left=max(0,int(nz[0])-int(.1*sr));right=min(len(x),int(nz[-1])+int(.2*sr))
 x=np.concatenate([x[left:right],np.zeros(int(.18*sr),dtype=np.float32)])
 sf.write(wav,x,sr,subtype='PCM_24')
 m={'text':item['text'],'path':str(wav),'duration':len(x)/sr,'sample_rate':sr,'voice':voice_name,'speed':.95,'seed':20261121,'engine':'kokoro==0.9.4','model':json.loads((R/'models/kokoro-provenance.json').read_text()),'seconds':time.monotonic()-start,'peak_torch_allocated_mib':torch.cuda.max_memory_allocated()/2**20,'peak_torch_reserved_mib':torch.cuda.max_memory_reserved()/2**20,'clipped_samples':int((abs(x)>=.999).sum()),'crop_start_sample':left,'crop_end_sample_before_padding':right,'tail_padding_seconds':.18,'sha256':hashlib.sha256(wav.read_bytes()).hexdigest()}
 meta.write_text(json.dumps(m,indent=2)); print('VOICE',name,round(m['duration'],2),round(m['seconds'],2),flush=True)
del pipe,model; gc.collect(); torch.cuda.empty_cache()
from whisperx.alignment import load_align_model,align
from scipy.signal import resample_poly
import nltk
nltk.data.path.insert(0,str(R/'nltk'))
model,metadata=load_align_model('en','cuda',model_name='facebook/wav2vec2-base-960h',model_dir=str(R/'models/wav2vec'))
for item in items:
 name=item['concept_id']; dest=A/f'{name}-REVIEW_ONLY.alignment.json'
 if dest.exists():continue
 x,sr=sf.read(A/f'{name}-REVIEW_ONLY.wav',dtype='float32'); x=resample_poly(x,2,3); t=time.monotonic()
 with torch.inference_mode():res=align([{'start':0.,'end':len(x)/16000,'text':item['text']}],model,metadata,x,'cuda',return_char_alignments=False)
 words=[w for s in res['segments'] for w in s['words']]
 for w in words:assert 'start' in w and 'end' in w, w
 assert len(words)==len(item['text'].split()),(name,len(words))
 starts=[];offset=0
 for scene in item['scenes']:
  starts.append(words[offset]['start']);offset+=len(scene['narration'].split())
 dest.write_text(json.dumps({'engine':'whisperx 3.8.6','model_revision':json.loads((R/'models/wav2vec-provenance.json').read_text())['revision'],'method':'exact narration CTC-aligned to final waveform; no estimated script timings','seconds':time.monotonic()-t,'scene_starts':starts,'words':words},indent=2))
 print('ALIGN',name,len(words),starts,flush=True)
print('AUDIO_BATCH_SECONDS',time.monotonic()-t0,flush=True)
