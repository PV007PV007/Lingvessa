import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type pg from 'pg';
import {p5MediaFixture} from './p5-fixtures.js';
import type {AssetStore} from '../../packages/application/src/media.js';
import {executableLessonFixtureSchema} from '../../packages/content-tools/src/p3-fixture.js';
import {loadExecutableLessonFixture} from '../../infra/persistence/p3-fixtures.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import type {RunView} from '../../infra/persistence/lessons.js';

/** Synthetic protocol fixtures; these policies are never valid for production publications or quality claims. */
export async function p5SpeechFixture(db:pg.Pool,store:AssetStore){
 const f=await p5MediaFixture(db,store),lessons=new LessonRepository(db),runs={} as Record<'en'|'cs',RunView>;
 for(const language of ['en','cs'] as const){
  const source=f.sources[language],input=executableLessonFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p3/${language}-lesson.json`,'utf8'))),base=structuredClone(input.activities[0]!);
  input.content_version_id=randomUUID();input.version_code='p5-speech-1';input.source_document='Synthetic P5 speech protocol extension of shared executable fixture schema';
  input.ancestor_versions=input.ancestor_versions.map(v=>({...v,content_version_id:randomUUID(),version_code:'p5-speech-1'}));
  input.activities=['pronunciation_target','intelligibility'].map((facet,i)=>({...structuredClone(base),id:randomUUID(),stable_code:`P5_${language}_SPEECH_${i}`,type:i===0?'listen_repeat' as const:'read_aloud' as const,content_version_id:input.content_version_id,
   presentation:{instruction_key:'say_target',prompt:language==='en'?'Hello.':'Ahoj.',stimulus:language==='en'?'Hello.':'Ahoj.',media_refs:[],accessibility:{keyboard_action:'Activate microphone, stop, then continue or retry',feedback_live_region:true}},
   response:{kind:'speech' as const,answer_policy:{id:`P5_${language}_TARGET`,version:'fixture-1',mode:'speech' as const,normalization:base.response.answer_policy.normalization}},speech:{target_feature:'synthetic_target'},
   learning:{...base.learning,evidence_map:[{skill:'pronunciation',facet,weight:0.25}]},
   runtime:{...base.runtime,completion_policy:'speech_binary_nonblocking_v1' as const,evaluator_version:'speech-target-1.0.0',presentation_order:[],max_retries:3,auto_advance_allowed:true},
  }));
  input.new_items=input.activities.map(a=>({activity_id:a.id,content_version_id:randomUUID(),version_code:'p5-speech-1'}));
  await loadExecutableLessonFixture(db,f.author,input);
  const replacements=new Map([[input.lesson_id,input.content_version_id],...input.ancestor_versions.map(a=>[a.entity_id,a.content_version_id] as const)]);
  const versionIds=[...source.entities.map(e=>replacements.get(e.id)??e.version_id),...input.new_items.map(a=>a.content_version_id)];
  for(const id of versionIds){await f.content.validateVersion(id);const v=(await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[id])).rows[0];for(const gate of ['linguistic','pedagogical','technical','accessibility','media','originality'])await f.content.approve(f.reviewer,id,v.checksum,v.revision,gate,'approved','Synthetic speech transport/DB fixture only; no linguistic calibration approval');}
  const publication=await f.content.publish({id:randomUUID(),actorId:f.reviewer,courseId:source.entities.find(e=>e.kind==='course')!.id,languageId:source.language_id,channel:'test',versionCode:`p5-speech-${language}-1`,versionIds});
  const profile=randomUUID();await db.query('INSERT INTO language_profiles(id,user_id,language_id,variant_id) VALUES($1,$2,$3,$4)',[profile,f.learner,source.language_id,language==='en'?'0198f000-0000-7000-8000-000000000011':'0198f000-0000-7000-8000-000000000013']);
  await db.query(`INSERT INTO speech_policies(id,stable_code,version_code,language_id,variety,target_feature,provider_code,model_version,confidence_threshold,test_only,calibration_reference,approved_by)
   VALUES($1,$2,'fixture-1',$3,$4,'synthetic_target','controlled_speech_fixture','fixture-1',0.8,true,'Synthetic adapter result cases, not a production calibration',$5)`,[randomUUID(),`P5_${language}_TARGET`,source.language_id,language==='en'?'en-GB':'cs-CZ',f.reviewer]);
  runs[language]=await lessons.start(f.learner,{language_profile_id:profile,publication_id:publication.id,lesson_id:input.lesson_id});
 }
 return {...f,lessons,runs};
}
