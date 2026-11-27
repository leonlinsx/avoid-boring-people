import os,json,time
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
from faster_whisper import WhisperModel
import soundfile as sf
from scipy.signal import resample_poly
R=Path(os.environ.get('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve();O=Path(os.environ['ABP_FACTORY_OUTPUT']).resolve()
device=os.environ.get('ABP_ASR_DEVICE','cpu')
if device not in ('cpu','cuda'):raise ValueError('unsupported transcription device')
model=WhisperModel('small.en',device=device,compute_type='float16' if device=='cuda' else 'int8',cpu_threads=4,download_root=str(R/'models/faster-whisper'))
for item in json.loads((O/'briefs.json').read_text())['items']:
 name=item['concept_id'];dest=O/'audio'/f'{name}-independent-asr.json'
 if dest.exists():continue
 t=time.monotonic(); audio,sr=sf.read(O/'audio'/f'{name}-REVIEW_ONLY.wav',dtype='float32'); audio=resample_poly(audio,2,3)
 seg,info=model.transcribe(audio,language='en',beam_size=5,word_timestamps=True,vad_filter=False)
 segments=[{'text':s.text,'start':s.start,'end':s.end,'words':[{'word':w.word,'start':w.start,'end':w.end,'probability':w.probability} for w in s.words]} for s in seg]
 out={'engine':'faster-whisper small.en '+('float16 CUDA' if device=='cuda' else 'int8 CPU'),'initial_prompt':None,'seconds':time.monotonic()-t,'text':' '.join(s['text'].strip() for s in segments),'segments':segments}
 dest.write_text(json.dumps(out,indent=2));print(name,out['text'],flush=True)
