#!/usr/bin/env python3
"""Build an import manifest from exact retained owner-approved package records."""
import argparse,copy,hashlib,json,math,uuid,wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def sha(p):return hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
def encode(x):return (json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()
def read(p):return json.loads((ROOT/p).read_text())
def build():
 approval_path='docs/p5/m01-completion-20261014/owner-approval.json';approval=read(approval_path)
 catalog=read('assets/media/m01/source-catalog.json');dataset={k:catalog[k] for k in ['schema_version','scope','audio_source_sha','results_sha256','counts','pairs']}
 assert hashlib.sha256(json.dumps(dataset,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==approval['dataset_sha256']
 assert catalog['results_sha256']==approval['results_sha256'] and approval['status']=='OWNER_APPROVED'
 assets=read('assets/media/m01/source-all-assets.json');slots={s['id']:s for p in catalog['pairs'] for s in p['slots']};assert len(assets)==len(slots)==420
 plan=read('docs/p5/m01-audio-draft-20261011/plan.json');source=read('assets/specs/p5/reference-media.registry.json');original={a['asset_id']:a for a in source['audio']};voices=[];characters=[];version='m01-approved-1'
 for c in plan['cast']:
  scope={'language':c['language'],'variety':'en-GB' if c['language']=='en' else 'cs-CZ'}
  rights={'licence':'Owner-approved audio rights; original Lingvessa scripts; VCTK/Pocket Czech CC BY 4.0 or Piper Jirka CC0 per retained source credits',
   'provenance':'Exact source '+c['candidate_id']+'; Piper VCTK or Jirka / Pocket TTS Czech; synthetic conditioning only. VCTK: Yamagishi, Veaux, MacDonald, CSTR Edinburgh; Czech ParCzech4Speech: UFAL. See docs/p5/m01-completion-attribution.md and pinned model locks. Owner-approved dataset '+approval['dataset_sha256'],
   'source_kind':'ai_generated','generator_version':'m01-completion-20261014','spec_hash':sha(ROOT/'docs/p5/m01-audio-draft-20261011/plan.json'),'real_person_clone':False}
  voices.append({'id':c['voice_id'],'stable_code':c['voice_code'],'version_code':version,'scope':scope,'profile':c['name']+'; owner-approved fictional adult course voice','provider_adapter_code':'pocket_tts_czech' if c['engine']=='pocket' else 'piper','provider_external_id':c['candidate_id'],'rights':rights})
  character=next(x for x in source['characters'] if x['character_id']==c['character_id'])
  characters.append({'id':c['character_id'],'stable_code':character['stable_code'],'version_code':'m01-speaker-1','scope':scope,'style_profile':c['name']+'; fictional adult speaker; visual artwork review pending','allowed_contexts':['M01'],'voice_id':c['voice_id'],'voice_version_code':version,'rights':{'licence':'Original Lingvessa fictional speaker identity; visual artwork rights pending','provenance':'Original catalog; owner-approved audio cast; no real person input','source_kind':'programmatic','generator_version':'p5-speaker-1','spec_hash':sha(ROOT/'assets/specs/p5/reference-media.source.json'),'real_person_clone':False}})
 voices_by_id={v['id']:v for v in voices};audio=[]
 for a in assets:
  slot=slots[a['asset_id']];src=original[a['asset_id']];assert slot['sha256']==a['sha256'] and slot['path']==a['path'] and slot['duration']==a['metrics']['duration_seconds']
  assert all(a[k]==src[k] for k in ['stable_code','language','speed','script_hash','transcript','normal_asset_id']);turns=[]
  for cue,t in zip(a['timing'],src['turns'],strict=True):
   assert cue['turn_id']==t['turn_id'] and cue['voice_id']==t['voice_id'] and cue['text']==t['text']
   row={'turn_id':t['turn_id'],'speaker':t['speaker'],'voice_id':t['voice_id'],'voice_version_code':version,'start_ms':math.floor(cue['start_frame']/24+0.5),'end_ms':math.floor(cue['end_frame']/24+0.5),'text':t['text']}
   if cue['character_id']:row.update(character_id=cue['character_id'],character_version_code='m01-speaker-1')
   turns.append(row)
  metadata={'asset_id':a['asset_id'],'stable_code':a['stable_code'],'asset_version':2,'version_code':version,'kind':'audio','scope':{'language':a['language'],'variety':src['variety']},'purpose':'Owner-approved immutable M01 audio; original PCM preserved','mime':'audio/wav','checksum':a['sha256'],'byte_length':a['bytes'],'duration_ms':math.ceil(a['metrics']['frames']/24),'codec':'pcm_s16le','loudness_lufs':a['integrated_lufs'],'decorative':False,'alt_text':'','transcript':a['transcript'],'script_version':'m01-script-1','script_hash':a['script_hash'],'speed':a['speed'],'voice_id':turns[0]['voice_id'],'voice_version_code':version,'turns':turns,'rights':copy.deepcopy(voices_by_id[turns[0]['voice_id']]['rights'])}
  metadata['rights']['provenance']+='; exact source '+a['path']+'; dialogue voices use the six locked profiles; pre-approval resampling, level adjustment and slow atempo=0.8 retained.'
  if a['speed']=='slow':metadata.update(normal_asset_id=a['normal_asset_id'],normal_asset_version=2)
  audio.append({'file':'assets/media/m01/'+a['path'].removeprefix('audio/'),'metadata':metadata,'source_frames':{'sample_rate':24000,'frames':a['metrics']['frames'],'cues':[{'turn_id':t['turn_id'],'start_frame':t['start_frame'],'end_frame':t['end_frame']} for t in a['timing']]}})
 visuals=[]
 for v in source['visuals']:
  a=copy.deepcopy(v['metadata']);a.update(asset_version=2,version_code='m01-visual-draft-1')
  if a['kind']=='avatar':a['character_version_code']='m01-speaker-1'
  visuals.append({'file':v['file'],'metadata':a,'human_review':'PENDING'})
 files={};batches=[]
 for name,rows,authorization,code in [('audio',audio,approval_path,'M01_APPROVED_AUDIO'),('visual',visuals,'docs/p5/integration-20261014/authorization.json','M01_VISUAL_DRAFT')]:
  records=[]
  for i in range(0,len(rows),30):
   path=f'assets/media/m01/records/{name}-{i//30:02}.json';data=encode(rows[i:i+30]);files[path]=data;records.append({'path':path,'sha256':hashlib.sha256(data).hexdigest(),'count':len(rows[i:i+30])})
  batch={'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'https://lingvessa.local/p5/'+code)),'stable_code':code,'version_code':version if name=='audio' else 'm01-visual-draft-1','manifest_checksum':hashlib.sha256(encode(records)).hexdigest(),'authorization_checksum':sha(ROOT/authorization),'source_revision':approval['approved_source_sha'],'expected_assets':len(rows),'provenance':'Owner-approved audio byte import; no synthesis' if name=='audio' else 'Authorized SVG draft import; visual quality/rights pending'}
  batches.append({'batch':batch,'authorization_path':authorization,'records':records,'approval_status':'OWNER_APPROVED_AUDIO' if name=='audio' else 'PENDING_VISUAL_REVIEW'})
 files['assets/media/m01/registry.json']=encode({'schema_version':1,'version_code':version,'approved_dataset_sha256':approval['dataset_sha256'],'voices':voices,'characters':characters,'batches':batches,'timing_conversion':'Nearest integer millisecond (<=0.5ms); duration rounded up; source frames retained; PCM unchanged','automatic_approval_insertion':False,'production_profile_approved':False,'p6_authorized':False})
 return files,audio
def main():
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.add_argument('--metadata-only',action='store_true');args=p.parse_args();files,audio=build()
 for name,data in files.items():
  path=ROOT/name
  if args.check:assert path.read_bytes()==data,name
  else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 for e in ([] if args.metadata_only else audio):
  a=e['metadata'];path=ROOT/e['file'];assert sha(path)==a['checksum'] and path.stat().st_size==a['byte_length']
  with wave.open(str(path)) as w:assert (w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())==(24000,1,2,e['source_frames']['frames'])
 print(json.dumps({'status':'PASS','audio_bytes_verified':0 if args.metadata_only else 420,'visual_drafts':30,'resynthesis':False,'approval_insertion':False}))
if __name__=='__main__':main()
