"""Bounded local full-frame FlashHead Pro comparison; no publishing/network."""
import os,sys,pathlib,json,time,hashlib,subprocess
R=pathlib.Path(os.environ.get('ABP_GPU_ROOT','.tmp/instagram-growth')).resolve();O=pathlib.Path(os.environ.get('ABP_FLASH_OUTPUT',str(R/'run-20261120'/'presenter-v2')));O.mkdir(parents=True,exist_ok=True)
seed=int(os.environ.get('ABP_FLASH_SEED','20261120'))
height=int(os.environ.get('ABP_FLASH_HEIGHT','512'));width=int(os.environ.get('ABP_FLASH_WIDTH','512'))
SRC=R/'FlashHead'
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['TORCH_HOME']=str(R/'torch-cache');os.environ['TORCHINDUCTOR_CACHE_DIR']=str(R/'torch-compile-cache')
os.environ['IMAGEIO_FFMPEG_EXE']=str(next((R/'tools').glob('ffmpeg-*/ffmpeg')))
import torch,numpy as np
from PIL import Image,ImageOps
FF=pathlib.Path(os.environ['IMAGEIO_FFMPEG_EXE']);FP=FF.with_name('ffprobe')
torch.set_num_threads(6);torch.manual_seed(seed)
assert torch.cuda.is_available();assert (torch.ones(32,device='cuda')*2).sum().item()==64
print('CUDA tensor PASS',torch.__version__,torch.cuda.get_device_name(),torch.cuda.mem_get_info(),flush=True)
portrait=R/'run-20261120/fictional-presenter-20261122-REVIEW_ONLY.png'
reference=O/'reference-REVIEW_ONLY.png'
source=Image.open(portrait)
if height==width:source=source.crop((0,0,768,768))
ImageOps.fit(source,(width,height),method=Image.Resampling.LANCZOS).save(reference)
audio=O/'heart-hook-REVIEW_ONLY.wav'
audio_source=os.environ.get('ABP_FLASH_AUDIO',str(R/'run-20261120/female-voice-lab/ergodicity-kokoro-af_heart-REVIEW_ONLY.wav'))
audio_duration=float(os.environ.get('ABP_FLASH_DURATION','6.5'))
assert 0<audio_duration<=8
subprocess.run([str(FF),'-v','error','-y','-i',audio_source,'-t',str(audio_duration),'-ar','16000',str(audio)],check=True)
sys.path.insert(0,str(SRC));os.chdir(SRC)
import flash_head.src.pipeline.flash_head_pipeline as module
module.COMPILE_MODEL=False;module.COMPILE_VAE=False
from flash_head.inference import get_pipeline,get_base_data,get_infer_params,get_audio_embedding,run_pipeline
import flash_head.inference as inference_module
inference_module.infer_params['height']=height;inference_module.infer_params['width']=width
import librosa
from collections import deque
torch.cuda.reset_peak_memory_stats();start=time.monotonic()
wav2vec=next((R/'models/wav2vec/models--facebook--wav2vec2-base-960h/snapshots').iterdir())
pipeline=get_pipeline(1,str(R/'models/flashhead'),'pro',str(wav2vec))
get_base_data(pipeline,str(reference),seed,False)
params=get_infer_params();sr=params['sample_rate'];fps=params['tgt_fps'];count=params['frame_num']-params['motion_frames_num'];cache_samples=sr*params['cached_audio_duration']
x,_=librosa.load(str(audio),sr=sr,mono=True);original=len(x);step=count*sr//fps
x=np.pad(x,(0,(-len(x))%step));q=deque([0.0]*cache_samples,maxlen=cache_samples)
frames=[];timings=[]
for j,chunk in enumerate(x.reshape(-1,step)):
    torch.cuda.synchronize();t=time.monotonic();q.extend(chunk.tolist())
    last=params['cached_audio_duration']*fps
    embedding=get_audio_embedding(pipeline,np.asarray(q),last-params['frame_num'],last)
    with torch.inference_mode():video=run_pipeline(pipeline,embedding)[params['motion_frames_num']:]
    torch.cuda.synchronize();elapsed=time.monotonic()-t
    frames.append(video.cpu().numpy().astype(np.uint8));timings.append(elapsed);print('CHUNK',j,'frames',len(video),'seconds',elapsed,'peak allocated MiB',torch.cuda.max_memory_allocated()/2**20,flush=True)
frames=np.concatenate(frames)[:int(round(original/sr*fps))]
output=O/'flashhead-pro-native-REVIEW_ONLY.mp4'
cmd=[str(FF),'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r',str(fps),'-i','pipe:0','-i',str(audio),'-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-movflags','+faststart','-shortest',str(output)]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for frame in frames:p.stdin.write(frame.tobytes())
p.stdin.close();assert p.wait()==0
probe=json.loads(subprocess.check_output([str(FP),'-v','quiet','-show_format','-show_streams','-of','json',str(output)]))
meta={'git_sha':subprocess.check_output(['git','-C',str(R.parents[1]),'rev-parse','HEAD'],text=True).strip(),'code_sha':subprocess.check_output(['git','-C',str(SRC),'rev-parse','HEAD'],text=True).strip(),'code_local_adaptations':['Distributed-only xfuser imports deferred when no multi-GPU process group exists','Optional MediaPipe face-crop import deferred; manually prepared fictional portrait crop','torch.compile disabled to bound first-run memory/time; official SDPA fallback used, no custom CUDA kernels'],'model':json.loads((R/'models/flashhead-provenance.json').read_text()),'model_variant':'Pro','model_license':'DiT and Wan VAE Apache-2.0 per model card; no LTX VAE used','voice':'Kokoro v1.0 af_heart selected by user','audio_path':str(audio),'narration':'A bet can have a positive expected return and still lose you money over time. Imagine a coin toss.','reference':str(reference),'original_reference':str(portrait),'seed':20261120,'parameters':params,'seconds_including_load_and_encode':time.monotonic()-start,'chunk_inference_seconds':timings,'peak_torch_allocated_mib':torch.cuda.max_memory_allocated()/2**20,'peak_torch_reserved_mib':torch.cuda.max_memory_reserved()/2**20,'output':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'ffprobe':probe,'quality_status':'REVIEW_ONLY: full-head movement and artifacts must be inspected; successful inference is not a realism claim','rights':'Original fictional adult, no real-person reference/voice cloning, local only'}
meta['seed']=seed
meta['narration']=os.environ.get('ABP_FLASH_TEXT',meta['narration'])
(O/'flashhead-pro.manifest.json').write_text(json.dumps(meta,indent=2));print('DONE',json.dumps(meta),flush=True)
