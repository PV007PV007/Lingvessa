#!/usr/bin/env python3
"""Blind supplemental ASR on all ten full Czech dialogues; no synthesis or approval."""
import argparse
import importlib.util
import json
from pathlib import Path
import time
spec=importlib.util.spec_from_file_location('m01',Path(__file__).with_name('m01-audio-draft.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
BATCH=m.ROOT/'docs/p5/m01-completion-20261014'

def run(args):
    guard=m.offline()
    plan=m.read(BATCH/'dialogue-crosscheck-plan.json')
    lock=m.read(BATCH/'medium-model.lock.json')
    m.need(m.sha(BATCH/'medium-model.lock.json')==plan['model_lock_sha256'],'Model lock changed')
    for row in lock['files']:m.need(m.sha(args.models/row['path'])==row['sha256'],'Model bytes changed')
    output=BATCH/'dialogue-crosscheck.json'
    m.need(not output.exists(),'Crosscheck already attempted')
    assets={a['asset_id']:a for a in m.read(args.audio/'assembly.json')['assets']}
    versions=m.environment('docs/p5/voice-audition/pocket-20261009/tooling-lock.json')
    import numpy as np
    from scipy.signal import resample_poly
    import onnxruntime as ort
    ort.disable_telemetry_events()
    from faster_whisper import WhisperModel
    model=WhisperModel(str(args.models),device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,local_files_only=True)
    report={'status':'RUNNING','scope':plan['scope'],'plan_sha256':m.sha(BATCH/'dialogue-crosscheck-plan.json'),
        'script_sha256':m.sha(Path(__file__)),'versions':versions,'network_guard':guard,'onnx_telemetry_disabled':True,
        'human_review':'PENDING','pronunciation_quality_asserted':False,'same_model_family_as_primary':True,'outputs':[]}
    m.write(output,report)
    for chosen in plan['selection']:
        asset=assets[chosen['asset_id']];path=args.audio/chosen['path']
        m.need(m.sha(path)==asset['sha256']==chosen['sha256'],'Audio binding changed')
        started=time.monotonic()
        samples=resample_poly(np.frombuffer(m.pcm(path),dtype='<i2').astype(np.float32)/32768,2,3)
        segments,_=model.transcribe(samples,language='cs',beam_size=5,temperature=0,vad_filter=False,
                                    condition_on_previous_text=False,initial_prompt=None)
        segments=[{'start':s.start,'end':s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob} for s in segments]
        transcript=''.join(s['text'] for s in segments).strip()
        expected=asset['transcript']
        edits=m.distance(m.words(expected),m.words(transcript))
        row={'asset_id':asset['asset_id'],'audio_sha256':asset['sha256'],'stable_code':asset['stable_code'],
            'expected':expected,'transcript':transcript,'word_edits':edits,'reference_words':len(m.words(expected)),
            'segments':segments,'elapsed_seconds':round(time.monotonic()-started,3)}
        report['outputs'].append(row);m.write(output,report)
        print(json.dumps({'done':len(report['outputs']),'code':asset['stable_code'],'word_edits':edits}),flush=True)
    report['status']='COMPLETE';m.write(output,report)

def verify(args):
    spec=importlib.util.spec_from_file_location('complete',Path(__file__).with_name('complete-m01-audio.py'))
    complete=importlib.util.module_from_spec(spec);spec.loader.exec_module(complete)
    _,assets,primary,_=complete.load()
    chosen=[a for a in assets if a['language']=='cs' and '_DIALOGUES_' in a['stable_code'] and '_TURN_' not in a['stable_code']]
    plan=m.read(BATCH/'dialogue-crosscheck-plan.json');report=m.read(BATCH/'dialogue-crosscheck.json')
    m.need(len(chosen)==len(report['outputs'])==len(plan['selection'])==10,'Incomplete dialogue coverage')
    m.need(report['status']=='COMPLETE' and report['plan_sha256']==m.sha(BATCH/'dialogue-crosscheck-plan.json') and
           report['script_sha256']==m.sha(Path(__file__)) and plan['model_lock_sha256']==m.sha(BATCH/'medium-model.lock.json'),'Crosscheck provenance changed')
    m.need(plan['parameters']=={'device':'cpu','compute_type':'int8','cpu_threads':2,'beam_size':5,'temperature':0,'language':'cs','vad_filter':False,'condition_on_previous_text':False,'initial_prompt':None},'Parameters changed')
    m.need(report['versions']=={p['name']:p['version'] for p in m.read(m.ROOT/'docs/p5/voice-audition/pocket-20261009/tooling-lock.json')['packages']},'Environment changed')
    m.need(report['human_review']=='PENDING' and report['pronunciation_quality_asserted'] is False and report['same_model_family_as_primary'] is True,
           'Invalid quality claims')
    m.need(report['network_guard']['native_socket_probe']=='EPERM' and report['onnx_telemetry_disabled'] is True,'Offline evidence missing')
    rows=[]
    for a,s,p in zip(chosen,report['outputs'],plan['selection'],strict=True):
        m.need(p=={'asset_id':a['asset_id'],'sha256':a['sha256'],'path':a['path']} and
               s['asset_id']==a['asset_id'] and s['audio_sha256']==a['sha256'] and s['expected']==a['transcript'],'Crosscheck selection/binding changed')
        text=''.join(seg['text'] for seg in s['segments']).strip()
        edits=m.distance(m.words(a['transcript']),m.words(text))
        m.need(s['transcript']==text and s['word_edits']==edits and s['reference_words']==len(m.words(a['transcript'])),'Crosscheck text/count changed')
        rows.append({'asset_id':a['asset_id'],'code':a['stable_code'],'small_word_edits':primary[a['asset_id']]['word_edits'],'medium_word_edits':edits,'reference_words':s['reference_words']})
    result={'status':'PASS','scope':'DIALOGUE_CROSSCHECK_METADATA_ONLY',**complete.b.source_state(),
        'files':10,'small_word_edits':sum(r['small_word_edits'] for r in rows),'medium_word_edits':sum(r['medium_word_edits'] for r in rows),
        'reference_words':sum(r['reference_words'] for r in rows),'rows':rows,'result_sha256':m.sha(BATCH/'dialogue-crosscheck.json'),
        'script_sha256':m.sha(Path(__file__)),'external_audio_bytes_verified':False,'human_review':'PENDING','pronunciation_quality_asserted':False}
    if args.report:m.write(args.report,result)
    print(json.dumps(result))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['run','verify'])
    for k in ['audio','models','report']:parser.add_argument('--'+k,type=Path)
    args=parser.parse_args();globals()[args.command](args)
