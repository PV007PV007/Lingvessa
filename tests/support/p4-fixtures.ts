import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {IdentityRepository} from '../../infra/persistence/identity.js';
import {ContentRepository} from '../../infra/persistence/content.js';
import {loadReferenceFixture} from '../../infra/persistence/fixtures.js';
import {loadExecutableLessonFixture} from '../../infra/persistence/p3-fixtures.js';
import {referenceFixtureSchema} from '../../packages/content-tools/src/fixture.js';
import {executableLessonFixtureSchema} from '../../packages/content-tools/src/p3-fixture.js';
import {languageIds} from '../../packages/domain/src/identity.js';
import type {ActivityContract} from '../../packages/activity-schemas/src/lesson.js';
import type {ActivityResponse} from '../../packages/lesson-engine/src/evaluator.js';
import type {RunView} from '../../infra/persistence/lessons.js';
export async function p4Fixture(db:pg.Pool){
 const identity=new IdentityRepository(db),content=new ContentRepository(db);const author=await identity.provision('p4-author@example.invalid','Synthetic P4 author password!');
 const reviewer=await identity.provision('p4-reviewer@example.invalid','Synthetic P4 reviewer password!');
 const learner=await identity.provision('p4-learner@example.invalid','Synthetic P4 learner password!'),other=await identity.provision('p4-other@example.invalid','Synthetic P4 other password!');
 await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='content_editor'",[author]);
 await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code IN ('linguistic_reviewer','pedagogical_reviewer','administrator')",[reviewer]);
 const profiles={en:randomUUID(),cs:randomUUID(),other:randomUUID()};
 await db.query(`INSERT INTO language_profiles(id,user_id,language_id,variant_id) VALUES($1,$2,$3,'0198f000-0000-7000-8000-000000000011'),($4,$2,$5,'0198f000-0000-7000-8000-000000000013'),($6,$7,$3,'0198f000-0000-7000-8000-000000000011')`,[profiles.en,learner,languageIds.en,profiles.cs,languageIds.cs,profiles.other,other]);
 const sources=Object.fromEntries(['en','cs'].map(language=>[language,{base:referenceFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p4/${language}-base.json`,'utf8'))),
  lesson:executableLessonFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p4/${language}-lesson.json`,'utf8'))),core:executableLessonFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p4/${language}-core.json`,'utf8')))}])) as Record<'en'|'cs',{
   base:ReturnType<typeof referenceFixtureSchema.parse>;lesson:ReturnType<typeof executableLessonFixtureSchema.parse>;core:ReturnType<typeof executableLessonFixtureSchema.parse>}>;
 const publications={en:{lesson:'',core:''},cs:{lesson:'',core:''}};const fixtureStatuses:string[]=[];
 for(const language of ['en','cs'] as const){const source=sources[language];await loadReferenceFixture(db,author,source.base);fixtureStatuses.push((await loadReferenceFixture(db,author,source.base)).status);
  for(const kind of ['lesson','core'] as const){const fixture=source[kind];await loadExecutableLessonFixture(db,author,fixture);fixtureStatuses.push((await loadExecutableLessonFixture(db,author,fixture)).status);
   const replacements=new Map([[fixture.lesson_id,fixture.content_version_id],...fixture.ancestor_versions.map(e=>[e.entity_id,e.content_version_id] as const)]);
   const versionIds=[...source.base.entities.map(e=>replacements.get(e.id)??e.version_id),...fixture.new_items.map(e=>e.content_version_id)];
   for(const id of versionIds){await content.validateVersion(id);const v=(await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[id])).rows[0];
    for(const gate of ['linguistic','pedagogical','technical','accessibility','media','originality'])if(!(await db.query('SELECT 1 FROM approvals WHERE target_content_version_id=$1 AND reviewer_id=$2 AND gate_type=$3',[id,reviewer,gate])).rowCount)
     await content.approve(reviewer,id,v.checksum,v.revision,gate,'approved',`Synthetic P4 ${gate} approval`);
   }
   const id=randomUUID();await content.publish({id,actorId:reviewer,courseId:source.base.entities.find(e=>e.kind==='course')!.id,languageId:source.base.language_id,channel:'test',versionCode:`p4-${kind}-${language}-1`,versionIds});publications[language][kind]=id;
   await content.activate(reviewer,id,kind==='lesson'?null:1);
  }
 }
 const activities=new Map([...sources.en.lesson.activities,...sources.en.core.activities,...sources.cs.lesson.activities,...sources.cs.core.activities].map(a=>[a.id,a]));
 return {identity,content,learner,other,profiles,sources,publications,activities,fixtureStatuses};
}
export function correctResponse(a:ActivityContract):ActivityResponse{const p=a.response.answer_policy;
 switch(p.mode){case 'speech':throw new TypeError('Speech uses asynchronous jobs');case 'exposure':return {kind:'none'};case 'single':return {kind:'single',option_id:p.accepted_option_ids![0]!};case 'set':return {kind:'set',option_ids:p.accepted_sets![0]!};case 'mapping':return {kind:'mapping',pairs:p.accepted_pairs!};case 'text':return {kind:'text',text:p.accepted_text![0]!};case 'order':return {kind:'order',option_ids:p.accepted_order!};}}
export function command(run:RunView,a:ActivityContract,response:ActivityResponse=correctResponse(a),reveal=false){return {attempt_id:randomUUID(),content_version_id:run.content_version_id,item_id:a.id,client_sequence:run.client_sequence+1,
 intent:reveal?'reveal' as const:response.kind==='none'?'continue' as const:'submit' as const,response,presentation:{seed:a.runtime.presentation_seed,order:a.runtime.presentation_order},assistance:{hint_count:0,reveal}};}
