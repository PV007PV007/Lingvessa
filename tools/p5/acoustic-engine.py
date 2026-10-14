#!/usr/bin/env python3
"""Offline test-only acoustic IPA. Runtime emits scalar results, never recognized text."""
import argparse,hashlib,importlib.metadata,json,os,subprocess,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CODE='local_acoustic_ipa';MODEL_VERSION='xlsr53-espeak-2c733782da56-1'
FEATURES={('en','en-GB','en_th_unvoiced'):['θ'],('cs','cs-CZ','cs_r_raised'):['r̝','r̝̊'],('cs','cs-CZ','cs_long_a'):['aː']}
def neutral(tag,elapsed=0):return {'usable':False,'confidence':0.0,'target_match':False,'error_tags':[tag],'processing_ms':min(900000,round(elapsed*1000))}
class AcousticEngine:
 def __init__(self,model_root):
  os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',DO_NOT_TRACK='1',OMP_NUM_THREADS='2',TOKENIZERS_PARALLELISM='false')
  from authoring_offline import install
  self.guard=install();root=Path(model_root).resolve()
  for e in json.loads((ROOT/'docs/p5/acoustic-provider/model.lock.json').read_text())['files']:
   p=root/e['path'];assert p.stat().st_size==e['bytes']
   with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==e['sha256']
  for p in json.loads((ROOT/'docs/p5/acoustic-provider/tooling.lock.json').read_text())['packages']:assert importlib.metadata.version(p['name'])==p['version']
  import numpy as np,torch
  from transformers import Wav2Vec2FeatureExtractor,Wav2Vec2ForCTC
  torch.set_num_threads(2);torch.set_num_interop_threads(1);self.np=np;self.torch=torch
  self.model=Wav2Vec2ForCTC.from_pretrained(str(root),local_files_only=True,trust_remote_code=False,use_safetensors=False,weights_only=True).eval()
  self.extractor=Wav2Vec2FeatureExtractor.from_pretrained(str(root),local_files_only=True);self.vocab=json.loads((root/'vocab.json').read_text());self.blank=self.model.config.pad_token_id
 def infer(self,body,mime):
  start=time.monotonic()
  if not body or len(body)>5*1024*1024 or mime not in ['audio/wav','audio/webm','audio/ogg','audio/mp4']:return None,'UNSUPPORTED_AUDIO',start
  try:r=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-i','pipe:0','-vn','-sn','-dn','-ac','1','-ar','16000','-t','12.1','-f','s16le','pipe:1'],input=body,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=4,check=False)
  except (OSError,subprocess.TimeoutExpired):return None,'UNSUPPORTED_AUDIO',start
  if r.returncode or len(r.stdout)%2 or not 1600<=len(r.stdout)<=384000:return None,'UNSUPPORTED_AUDIO',start
  np=self.np;y=np.frombuffer(r.stdout,dtype='<i2').astype(np.float32)/32768
  if float(np.sqrt(np.mean(y*y)))<0.003 or float(np.max(np.abs(y)))<0.008 or float(np.mean(np.abs(y)>=0.999))>0.01:return None,'UNUSABLE_SIGNAL',start
  spectrum=np.abs(np.fft.rfft(y*np.hanning(len(y))))**2+1e-18
  if float(np.exp(np.mean(np.log(spectrum)))/np.mean(spectrum))>0.35 or float(np.max(spectrum)/np.sum(spectrum))>0.15:return None,'UNUSABLE_SIGNAL',start
  values=self.extractor(y,sampling_rate=16000,return_tensors='pt').input_values
  with self.torch.inference_mode():p=self.model(values).logits.softmax(-1)[0]
  ids=p.argmax(-1);mask=ids!=self.blank
  if int(mask.sum())<2:return None,'UNUSABLE_SIGNAL',start
  return {'probabilities':p,'ids':ids,'confidence':float(p.max(-1).values[mask].mean()),'elapsed':time.monotonic()-start},None,start
 def result(self,value,language,variety,feature):
  tokens=FEATURES.get((language,variety,feature))
  if not tokens:return neutral('UNSUPPORTED_FEATURE')
  if not value:return neutral('UNUSABLE_SIGNAL')
  present=any(bool((value['ids']==self.vocab[t]).any()) for t in tokens)
  return {'usable':value['confidence']>=0.9,'confidence':value['confidence'],'target_match':present,'error_tags':[] if present else ['TARGET_PHONE_ABSENT'],'processing_ms':round(value['elapsed']*1000)}
def exact(stream,size):
 result=[];remaining=size
 while remaining:
  block=stream.read(remaining)
  if not block:raise RuntimeError('INCOMPLETE_INPUT')
  result.append(block);remaining-=len(block)
 return b''.join(result)
def serve(engine):
 print(json.dumps({'ready':True,'provider':CODE,'model_version':MODEL_VERSION,'test_only':True,'network_denied':True}),flush=True);stream=sys.stdin.buffer
 while line:=stream.readline(4097):
  if len(line)>4096 or not line.endswith(b'\n'):raise RuntimeError('INVALID_HEADER')
  h=json.loads(line)
  if set(h)!={'request_id','bytes','mime','language','variety','target_feature'} or str(uuid.UUID(h['request_id']))!=h['request_id'] or type(h['bytes']) is not int or not 1<=h['bytes']<=5*1024*1024:raise RuntimeError('INVALID_HEADER')
  body=exact(stream,h['bytes'])
  if (h['language'],h['variety'],h['target_feature']) not in FEATURES:result=neutral('UNSUPPORTED_FEATURE')
  else:
   value,error,start=engine.infer(body,h['mime']);result=neutral(error,time.monotonic()-start) if error else engine.result(value,h['language'],h['variety'],h['target_feature'])
  del body
  print(json.dumps({'request_id':h['request_id'],'result':result}),flush=True)
def main():
 p=argparse.ArgumentParser();p.add_argument('--model-root',required=True,type=Path);args=p.parse_args()
 try:serve(AcousticEngine(args.model_root))
 except Exception:print('ACOUSTIC_PROVIDER_FAILED',file=sys.stderr);raise SystemExit(1)
if __name__=='__main__':main()
