import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import type pg from 'pg';
import type {AssetStore} from '../../packages/application/src/media.js';
import type {AssetVersion} from '../../packages/activity-schemas/src/media.js';
import type {ContentPayload} from '../../packages/activity-schemas/src/content.js';
import type {ActivityContract} from '../../packages/activity-schemas/src/lesson.js';
import {executableLessonFixtureSchema} from '../../packages/content-tools/src/p3-fixture.js';
import {loadExecutableLessonFixture} from '../../infra/persistence/p3-fixtures.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import {p5MediaFixture,svgAsset} from './p5-fixtures.js';

/** Original sine-tone PCM is a browser/storage fixture, never linguistic QA or reference speech. */
export function toneWav(milliseconds:number):Buffer {
 const samples=milliseconds*8,bytes=Buffer.alloc(44+samples*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)bytes.writeInt16LE(Math.round(900*Math.sin(2*Math.PI*440*i/8000)),44+i*2);
 return bytes;
}
export async function p5AudioFixture(db:pg.Pool,store:AssetStore){
 const f=await p5MediaFixture(db,store),lessons=new LessonRepository(db);
 const runs:Partial<Record<'en'|'cs',Awaited<ReturnType<LessonRepository['start']>>>>={};
 const fixtures:Partial<Record<'en'|'cs',{normal:AssetVersion;slow:AssetVersion;voiceId:string;itemId:string;activities:ActivityContract[]}>>={};
 for(const language of ['en','cs'] as const){
  const source=f.sources[language],fixture=executableLessonFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p3/${language}-lesson.json`,'utf8')));
  // Disposable P5 contracts only; these are not authored M01 learner activities.
  for(const type of ['listening_gist','listening_detail','dictation'] as const){
   const activity=structuredClone(fixture.activities[0]!);activity.id=randomUUID();activity.stable_code=`P5_${language}_${type}`;activity.type=type;
   activity.presentation.prompt='Synthetic transcript-support contract check.';
   activity.presentation.accessibility.transcript=language==='en'?'Tone A. Tone B.':'Tón A. Tón B.';
   activity.learning.evidence_map=[{skill:type==='dictation'?'writing':'listening',facet:type==='dictation'?'spelling':type,weight:1}];
   if(type==='dictation'){
    activity.response.kind='text';activity.response.answer_policy.mode='text';
    activity.response.answer_policy.accepted_text=[language==='en'?'Tone A.':'Tón A.'];
    delete activity.response.answer_policy.accepted_option_ids;delete activity.presentation.options;
    activity.runtime.presentation_order=[];
   }
   fixture.activities.push(activity);fixture.new_items.push({activity_id:activity.id,content_version_id:randomUUID(),version_code:'p5-transcript-fixture-1'});
  }
  await loadExecutableLessonFixture(db,f.author,fixture);
  const payload=(await db.query('SELECT payload FROM content_versions WHERE id=$1',[fixture.content_version_id])).rows[0].payload as ContentPayload;
  const activity=payload.activities![0]!,variety=language==='en'?'en-GB':'cs-CZ',voiceIds=[randomUUID(),randomUUID()],charIds=[randomUUID(),randomUUID()];
  const transcript=language==='en'?'Tone A. Tone B.':'Tón A. Tón B.',scriptHash=createHash('sha256').update(transcript).digest('hex');
  const rights={licence:'Original repository synthetic tone fixture only',provenance:'Programmatic sine wave, no spoken words; not reference speech, no real person or external provider',source_kind:'programmatic' as const,generator_version:'p5-audio-fixture-1',spec_hash:scriptHash,real_person_clone:false as const};
  for(let n=0;n<2;n++){
   await f.media.registerVoice(f.author,{id:voiceIds[n],stable_code:`P5_${language}_VOICE_${n}`,version_code:'fixture-1',scope:{language,variety},profile:'Synthetic tone fixture voice binding',provider_adapter_code:'programmatic_fixture',provider_external_id:`synthetic-tone-${n}`,rights});
   await f.media.registerCharacter(f.author,{id:charIds[n],stable_code:`P5_${language}_CHAR_${n}`,version_code:'fixture-1',scope:{language,variety},style_profile:'Synthetic speaker label only',allowed_contexts:['contract_test'],voice_id:voiceIds[n],voice_version_code:'fixture-1',rights});
   const avatar=svgAsset(language);
   Object.assign(avatar.metadata,{kind:'avatar',stable_code:`P5_${language}_AVATAR_${n}`,character_id:charIds[n],character_version_code:'fixture-1',scope:{language,variety}});
   const requirement=randomUUID(),role=`avatar_${n}`;
   await f.media.declareRequirement(f.author,{id:requirement,target_content_version_id:fixture.content_version_id,item_id:activity.id,role,required:true,kind:'avatar',scope:{language,variety},specification_version:'fixture-1',specification:'Synthetic avatar geometry bound to the exact fictional test character version',accessibility_role:'semantic'});
   const job=await f.media.enqueue(f.author,requirement,randomUUID(),'programmatic_fixture',avatar.metadata.rights.generator_version);
   await f.approve(await f.media.ingest(f.author,job,avatar.metadata,avatar.bytes));
   const ref={asset_id:avatar.metadata.asset_id,asset_version:1,asset_stable_code:avatar.metadata.stable_code,role};
   activity.media_refs.push(ref);activity.contract!.presentation.media_refs.push(ref);
  }
  const normalId=randomUUID(),turnIds=[randomUUID(),randomUUID()],assets:AssetVersion[]=[];
  for(const speed of ['normal','slow'] as const){
   const duration=speed==='normal'?8000:12000,bytes=toneWav(duration),id=speed==='normal'?normalId:randomUUID();
   const metadata:AssetVersion={asset_id:id,stable_code:`P5_${language}_${speed}_AUDIO`,asset_version:1,version_code:'fixture-1',kind:'audio',scope:{language,variety},purpose:'Synthetic PCM/timing fixture; not course audio',mime:'audio/wav',checksum:createHash('sha256').update(bytes).digest('hex'),byte_length:bytes.length,duration_ms:duration,codec:'pcm_s16le',loudness_lufs:-34,decorative:false,alt_text:'',transcript,script_version:'fixture-1',script_hash:scriptHash,speed,voice_id:voiceIds[0]!,voice_version_code:'fixture-1',rights,
    ...(speed==='slow'?{normal_asset_id:normalId,normal_asset_version:1}:{}),
    turns:[{turn_id:turnIds[0]!,speaker:'A',voice_id:voiceIds[0]!,voice_version_code:'fixture-1',character_id:charIds[0],character_version_code:'fixture-1',start_ms:0,end_ms:duration/2,text:language==='en'?'Tone A.':'Tón A.'},
     {turn_id:turnIds[1]!,speaker:'B',voice_id:voiceIds[1]!,voice_version_code:'fixture-1',character_id:charIds[1],character_version_code:'fixture-1',start_ms:duration/2,end_ms:duration,text:language==='en'?'Tone B.':'Tón B.'}]};
   const requirement=randomUUID();await f.media.declareRequirement(f.author,{id:requirement,target_content_version_id:fixture.content_version_id,item_id:activity.id,role:speed,required:true,kind:'audio',scope:{language,variety},specification_version:'fixture-1',specification:'Original tone with two synthetic timing windows; no real speech or linguistic evaluation',accessibility_role:'semantic'});
   const job=await f.media.enqueue(f.author,requirement,randomUUID(),'programmatic_fixture',rights.generator_version);
   if(speed==='slow'){
    const mismatch=structuredClone(metadata);mismatch.turns![0]!.turn_id=randomUUID();
    await assert.rejects(f.media.ingest(f.author,job,mismatch,bytes),{code:'23514'},'Slow audio must retain normal turn identities');
   }
   await f.approve(await f.media.ingest(f.author,job,metadata,bytes));assets.push(metadata);
   const ref={asset_id:id,asset_version:1,asset_stable_code:metadata.stable_code,role:speed};activity.media_refs.push(ref);activity.contract!.presentation.media_refs.push(ref);
  }
  const revision=(await db.query('SELECT revision FROM content_versions WHERE id=$1',[fixture.content_version_id])).rows[0].revision as number;
  // New fixture item references must retain PostgreSQL's canonical C-order contract.
  payload.refs.sort((a,b)=>a.relation===b.relation?(a.stable_code<b.stable_code?-1:a.stable_code>b.stable_code?1:0):(a.relation<b.relation?-1:1));
  await f.content.saveDraft(f.author,source.language_id,payload,revision);
  const replacements=new Map([[fixture.lesson_id,fixture.content_version_id],...fixture.ancestor_versions.map(a=>[a.entity_id,a.content_version_id] as const)]);
  const versionIds=[...source.entities.map(e=>replacements.get(e.id)??e.version_id),...fixture.new_items.map(item=>item.content_version_id)];
  for(const id of versionIds){await f.content.validateVersion(id);const v=(await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[id])).rows[0];
   for(const gate of ['linguistic','pedagogical','technical','accessibility','media','originality'])await f.content.approve(f.reviewer,id,v.checksum,v.revision,gate,'approved','Controlled synthetic P5 contract approval, not production QA');}
  const publication=await f.content.publish({id:randomUUID(),actorId:f.reviewer,courseId:source.entities.find(e=>e.kind==='course')!.id,languageId:source.language_id,channel:'test',versionCode:`p5-audio-${language}-1`,versionIds});
  const profileId=randomUUID();await db.query('INSERT INTO language_profiles(id,user_id,language_id,variant_id) VALUES($1,$2,$3,$4)',[profileId,f.learner,source.language_id,language==='en'?'0198f000-0000-7000-8000-000000000011':'0198f000-0000-7000-8000-000000000013']);
  runs[language]=await lessons.start(f.learner,{language_profile_id:profileId,publication_id:publication.id,lesson_id:fixture.lesson_id});
  fixtures[language]={normal:assets[0]!,slow:assets[1]!,voiceId:voiceIds[0]!,itemId:activity.id,activities:payload.activities!.map(item=>item.contract!)};
 }
 return {...f,lessons,runs:runs as Required<typeof runs>,audio:fixtures as Required<typeof fixtures>};
}
