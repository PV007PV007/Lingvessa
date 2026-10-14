#!/usr/bin/env python3
"""Predeclared reference-audio pilot; never approve a real-learner speech policy."""
import argparse,hashlib,importlib.util,io,json,re,time,wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DOCS=ROOT/'docs/p5/acoustic-provider'
def sha(p):return hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def plan():
 registry=json.loads((ROOT/'assets/media/m01/registry.json').read_text());entries=[]
 for group in registry['batches']:
  if group['approval_status']=='OWNER_APPROVED_AUDIO':
   for record in group['records']:entries.extend(json.loads((ROOT/record['path']).read_text()))
 entries=[e for e in entries if len(e['metadata']['turns'])==1]
 explored={'AUD_ENG_M01_WORDS_HELLO','AUD_ENG_M01_WORDS_THANK_YOU','AUD_CZE_M01_WORDS_NUM_03','AUD_CZE_M01_WORDS_NUM_04','AUD_CZE_M01_WORDS_NUM_13','AUD_ENG_M01_DIALOGUES_L01_CONTEXT_TURN_01','AUD_ENG_M01_DIALOGUES_L01_REPAIR_TURN_04','AUD_CZE_M01_DIALOGUES_L01_REPAIR_TURN_03'}
 families={e['metadata']['turns'][0]['turn_id'] for e in entries if e['metadata']['stable_code'] in explored};rows=[]
 for e in entries:
  a=e['metadata'];t=a['turns'][0];text=a['transcript'].casefold();family=t['turn_id']
  labels={'en_th_unvoiced':bool(re.search(r'\b(?:three|thirteen|thirty|thank)\b',text))} if a['scope']['language']=='en' else {'cs_r_raised':'ř' in text,'cs_long_a':'á' in text}
  split='exploratory' if family in families else 'heldout' if int(hashlib.sha256(family.encode()).hexdigest(),16)%5==0 else 'training'
  rows.append({'asset_id':a['asset_id'],'file':e['file'],'sha256':a['checksum'],'language':a['scope']['language'],'variety':a['scope']['variety'],'voice_id':t['voice_id'],'turn_family':family,'speed':a['speed'],'split':split,'labels':labels})
 return {'scope':'SYNTHETIC_REFERENCE_ACOUSTIC_PILOT','model_lock_sha256':sha(DOCS/'model.lock.json'),'tooling_lock_sha256':sha(DOCS/'tooling.lock.json'),'engine_sha256':sha(ROOT/'tools/p5/acoustic-engine.py'),'guard_sha256':sha(ROOT/'tools/p5/authoring_offline.py'),'tool_sha256':sha(Path(__file__)),'approved_dataset_sha256':registry['approved_dataset_sha256'],'parameters':{'ctc_confidence_min':0.9,'max_clip_seconds':12,'noise_seed':14012026,'noise_std':0.05,'controls_seconds':2,'tone_hz':440,'tone_amplitude':0.05},'split_method':'SHA256(turn UUID) mod 5; pace/repeated families stay together; explored families excluded from heldout','production_criteria':{'min_heldout_positive_families':30,'min_positive_voices':3,'recall_min':0.95,'false_positive_rate_max':0.05,'real_learner_labelled_errors_required':True},'learner_recordings_used':0,'policy_approval':False,'rows':rows}
def summarise(rows,controls):
 targets=[]
 for feature in ['en_th_unvoiced','cs_r_raised','cs_long_a']:
  relevant=[r for r in rows if feature in r['labels']];positive=[r for r in relevant if r['labels'][feature]];metrics={}
  for split in ['exploratory','training','heldout']:
   values=[r for r in relevant if r['split']==split];tp=fn=fp=tn=unavailable=0
   for r in values:
    result=r['results'][feature];detected=result['usable'] and result['target_match'];expected=r['labels'][feature]
    unavailable+=not result['usable'];tp+=bool(expected and detected);fn+=bool(expected and not detected);fp+=bool(not expected and detected);tn+=bool(not expected and not detected)
   metrics[split]={'files':len(values),'true_positive':tp,'false_negative':fn,'false_positive':fp,'true_negative':tn,'unavailable':unavailable,'recall':tp/(tp+fn) if tp+fn else None,'false_positive_rate':fp/(fp+tn) if fp+tn else None}
  targets.append({'target_feature':feature,'positive_reference_families':len({r['turn_family'] for r in positive}),'positive_voices':len({r['voice_id'] for r in positive}),'heldout_positive_families':len({r['turn_family'] for r in positive if r['split']=='heldout'}),'metrics':metrics,'production_status':'REJECTED_INSUFFICIENT_CALIBRATION'})
 return {'status':'COMPLETE','scope':'SYNTHETIC_REFERENCE_ACOUSTIC_PILOT','recordings':len(rows),'actual_acoustic_inference':True,'targets':targets,'controls':controls,'normal_slow_family_leakage':False,'learner_recordings_used':0,'production_approved':False,'speech_policies_inserted':0,'reason':'Insufficient positive voice/family coverage and no labelled real-learner errors. Keep candidate test-only; production scoring remains neutral.'}
def run(args):
 declared=json.loads((DOCS/'pilot-plan.json').read_text());assert declared==plan();out=args.output.resolve();out.mkdir(parents=True,exist_ok=False);write(out/'STARTED.json',{'plan_sha256':sha(DOCS/'pilot-plan.json'),'automatic_retries':0,'infrastructure_reconstruction':True})
 spec=importlib.util.spec_from_file_location('engine',ROOT/'tools/p5/acoustic-engine.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);engine=module.AcousticEngine(args.model_root);rows=[]
 for entry in declared['rows']:
  path=ROOT/entry['file'];assert sha(path)==entry['sha256'];value,error,start=engine.infer(path.read_bytes(),'audio/wav');results={}
  for feature in entry['labels']:results[feature]=module.neutral(error,time.monotonic()-start) if error else engine.result(value,entry['language'],entry['variety'],feature)
  rows.append({**entry,'results':results,'target_phone_maxima':{f:float(value['probabilities'][:,[engine.vocab[t] for t in module.FEATURES[(entry['language'],entry['variety'],f)]]].max()) if value else None for f in results}})
  if len(rows)%30==0:print(json.dumps({'inferred':len(rows),'total':len(declared['rows'])}),flush=True)
 np=engine.np;rng=np.random.default_rng(14012026);n=32000;signals={'silence':np.zeros(n),'white_noise':rng.normal(0,0.05,n),'pure_tone':0.05*np.sin(2*np.pi*440*np.arange(n)/16000)};controls=[]
 for name,signal in signals.items():
  buffer=io.BytesIO()
  with wave.open(buffer,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())
  body=buffer.getvalue();value,error,start=engine.infer(body,'audio/wav');result=module.neutral(error,time.monotonic()-start) if error else engine.result(value,'en','en-GB','en_th_unvoiced');controls.append({'name':name,'sha256':hashlib.sha256(body).hexdigest(),'result':result})
 records=[]
 for i in range(0,len(rows),30):
  p=out/f'results-{i//30:02}.json';write(p,rows[i:i+30]);records.append({'path':p.name,'sha256':sha(p),'count':len(rows[i:i+30])})
 summary=summarise(rows,controls);summary.update(plan_sha256=sha(DOCS/'pilot-plan.json'),records=records,network_guard=engine.guard,engine_sha256=declared['engine_sha256']);write(out/'summary.json',summary);print(json.dumps({'status':'COMPLETE','recordings':len(rows),'production_approved':False}),flush=True)
def verify(args):
 declared=json.loads((DOCS/'pilot-plan.json').read_text());assert declared==plan();root=args.output;summary=json.loads((root/'summary.json').read_text());assert summary['plan_sha256']==sha(DOCS/'pilot-plan.json');rows=[]
 for record in summary['records']:
  p=root/record['path'];assert p.parent==root and sha(p)==record['sha256'];values=json.loads(p.read_text());assert len(values)==record['count'];rows.extend(values)
 assert len(rows)==len(declared['rows'])==402
 for row,expected in zip(rows,declared['rows'],strict=True):assert all(row[k]==v for k,v in expected.items())
 assert all(summary[k]==v for k,v in summarise(rows,summary['controls']).items());assert summary['network_guard']['native_socket_probe']=='EPERM' and all(not c['result']['usable'] for c in summary['controls'])
 report={'status':'PASS','scope':'ACOUSTIC_PILOT_INTEGRITY_ONLY','recordings':402,'actual_acoustic_results_verified':True,'production_calibration_passed':False,'plan_sha256':sha(DOCS/'pilot-plan.json'),'summary_sha256':sha(root/'summary.json')}
 if args.report:write(args.report,report)
 print(json.dumps(report))
def main():
 p=argparse.ArgumentParser();p.add_argument('command',choices=['plan','run','verify']);p.add_argument('--model-root',type=Path);p.add_argument('--output',type=Path,default=DOCS/'pilot-results');p.add_argument('--report',type=Path);args=p.parse_args()
 if args.command=='plan':assert not (DOCS/'pilot-plan.json').exists();write(DOCS/'pilot-plan.json',plan());print(json.dumps({'recordings':402,'plan_sha256':sha(DOCS/'pilot-plan.json')}))
 elif args.command=='run':assert args.model_root;run(args)
 else:verify(args)
if __name__=='__main__':main()
