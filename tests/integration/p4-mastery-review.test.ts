import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import pg from 'pg';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {createFoundationPool} from '../../infra/persistence/database.js';
import {seedBootstrap} from '../../prisma/seed.js';
import {LessonRepository} from '../../infra/persistence/lessons.js';
import type {RunView} from '../../infra/persistence/lessons.js';
import {MasteryRepository} from '../../infra/persistence/mastery.js';
import {ReviewRepository} from '../../infra/persistence/review.js';
import {CollectionRepository} from '../../infra/persistence/collections.js';
import {ResetRepository} from '../../infra/persistence/resets.js';
import {languageIds} from '../../packages/domain/src/identity.js';
import {policy} from '../../packages/mastery-review/src/index.js';
import {createApi} from '../../apps/api/src/app.js';
import {p4Fixture,command} from '../support/p4-fixtures.js';
import {p4BrowserGate} from '../../tools/p4/browser-gate.js';

test('P4 real PostgreSQL: mastery/recompute, Review, collections, reset and P3 atomicity', {timeout:480000},async()=>{
 const base=localDatabaseUrl(process.env),admin=new pg.Client({connectionString:base,connectionTimeoutMillis:2000});
 const name=`lingvessa_p4_test_${randomBytes(8).toString('hex')}`,url=new URL(base);url.pathname=`/${name}`;
 const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()};let created=false,pool:pg.Pool|undefined;
 const gates:Array<{gate:string;status:'PASS'}>=[];
 const gate=async(name:string,work:()=>Promise<void>)=>{await work();gates.push({gate:name,status:'PASS'});console.log(`P4_GATE PASS ${name}`);};
 const migrate=()=>{const r=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:60000});assert.equal(r.status,0,`P4 migration: ${r.stdout.slice(-1800)} ${r.stderr.slice(-1000)}`);};
 try{
  await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);created=true;migrate();await seedBootstrap(env);await seedBootstrap(env);pool=createFoundationPool(url.toString());const db=pool;
  const reject=async(sql:string,args:unknown[],codes=['23503','23514'])=>assert.rejects(db.query(sql,args),(e:unknown)=>Boolean(e&&typeof e==='object'&&'code'in e&&codes.includes(String(e.code))));
  await gate('P4-DB-001 clean migration/replay/seed and phase boundary',async()=>{
   migrate();assert.equal((await db.query('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].count,'4');
   const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename);
   for(const t of ['knowledge_mastery_states','skill_mastery_states','review_schedules','review_sessions','review_session_items','mistake_instances','collections','collection_entries','learning_reset_jobs'])assert(tables.includes(t));
   for(const t of ['speech_jobs','ai_runs','ai_sessions'])assert(!tables.includes(t));
   assert.equal((await db.query('SELECT parameters FROM learning_policies WHERE model_version=$1',[policy.model_version])).rows[0].parameters.scheduler_version,policy.scheduler_version);
   await reject("UPDATE learning_policies SET parameters='{}'",[]);
  });
  const f=await p4Fixture(db),lessons=new LessonRepository(db),mastery=new MasteryRepository(db),review=new ReviewRepository(db,'test'),collections=new CollectionRepository(db),resets=new ResetRepository(db);
  const start=(language:'en'|'cs',kind:'lesson'|'core'='lesson')=>lessons.start(f.learner,{language_profile_id:f.profiles[language],publication_id:f.publications[language][kind],lesson_id:f.sources[language][kind].lesson_id});
  const finish=async(initial:RunView)=>{let run=initial;let cap=0;while(run.state!=='completed'){assert(cap++<30);const a=f.activities.get(run.current_activity_id!)!;await lessons.submit(f.learner,run.id,command(run,a));run=await lessons.get(f.learner,run.id);}return run;};
  let en:RunView,cs:RunView;
  await gate('P4-FIX-001 isolated bilingual fixtures idempotently load and publish',async()=>{assert(f.fixtureStatuses.every(s=>s==='unchanged'));en=await start('en');cs=await start('cs');await finish(cs);});
  await gate('P4-MAST-001 separate facets, immutable evidence, six skills and exact recompute',async()=>{
   const a=f.activities.get(en.current_activity_id!)!;const incorrect=command(en,a,{kind:'single',option_id:a.presentation.options!.find(o=>!a.response.answer_policy.accepted_option_ids!.includes(o.id))!.id});
   await lessons.submit(f.learner,en.id,incorrect);en=await lessons.get(f.learner,en.id);
   const before=await mastery.summary(f.learner,f.profiles.en,true);assert.equal(before.skills.length,6);assert(before.facets!.some(s=>s.facet==='meaning'&&s.lapse_count===1));
   await lessons.hint(f.learner,en.id);await finish(en);assert((await db.query("SELECT 1 FROM evidence_events e JOIN activity_attempts a ON a.id=e.attempt_db_id WHERE a.lesson_run_id=$1 AND e.independence='hinted'",[en.id])).rowCount); await finish(await start('en','core'));await finish(await start('cs','core'));
   const one=await mastery.recompute(f.learner,f.profiles.en),two=await mastery.recompute(f.learner,f.profiles.en);assert.deepEqual(one,two);
   for(const facet of ['meaning','spelling','listening_gist','register'])assert(one.knowledge.some(s=>s.facet===facet));
   assert(one.knowledge.find(s=>s.facet==='meaning')!.lapse_count>=1);
   const count=Number((await db.query('SELECT count(*) FROM evidence_events')).rows[0].count);await mastery.recompute(f.learner,f.profiles.en);assert.equal(Number((await db.query('SELECT count(*) FROM evidence_events')).rows[0].count),count);
   await reject('UPDATE evidence_events SET effective_weight=0',[]);
   const old=await mastery.recompute(f.learner,f.profiles.en);const shadow={...policy,model_version:'weighted-evidence-shadow-test',scheduler_version:'facet-srs-shadow-test',initial_days:2};
   await db.query('INSERT INTO learning_policies(model_version,scheduler_version,parameters) VALUES($1,$2,$3)',[shadow.model_version,shadow.scheduler_version,shadow]);await mastery.recompute(f.learner,f.profiles.en,shadow);
   assert.deepEqual(await mastery.recompute(f.learner,f.profiles.en),old);assert.equal(Number((await db.query('SELECT count(*) FROM evidence_events')).rows[0].count),count);
   assert((await mastery.mistakes(f.learner,f.profiles.en)).some(m=>m.status==='remediated'));
  });
  await gate('P4-ISO-001 direct DB negative owner/language/facet projection constraints',async()=>{
   await reject('UPDATE knowledge_mastery_states SET user_id=$1 WHERE language_profile_id=$2',[f.other,f.profiles.en]);
   await reject(`INSERT INTO knowledge_mastery_states SELECT $1,$2,language_id,knowledge_item_id,facet,model_version,estimate,uncertainty,evidence_count,lapse_count,last_evidence_at,updated_at FROM knowledge_mastery_states WHERE language_profile_id=$3 LIMIT 1`,[f.learner,f.profiles.other,f.profiles.en]);
   const csKnowledge=f.sources.cs.lesson.activities[0]!.learning.knowledge_refs[0]!.knowledge_item_id;
   await reject(`INSERT INTO knowledge_mastery_states SELECT user_id,language_profile_id,language_id,$1,facet,model_version,estimate,uncertainty,evidence_count,lapse_count,last_evidence_at,updated_at FROM knowledge_mastery_states WHERE language_profile_id=$2 LIMIT 1`,[csKnowledge,f.profiles.en]);
   await reject(`INSERT INTO skill_mastery_states SELECT user_id,language_profile_id,language_id,'reading',model_version,estimate,uncertainty,evidence_count,lapse_count,last_evidence_at,updated_at FROM skill_mastery_states WHERE language_profile_id=$1 LIMIT 1`,[f.profiles.en]);
   await reject(`INSERT INTO review_schedules SELECT user_id,language_profile_id,language_id,$1,facet,skill,scheduler_version,state,difficulty,stability_days,due_at,lapses,reps,updated_at FROM review_schedules WHERE language_profile_id=$2 LIMIT 1`,[csKnowledge,f.profiles.en]);
   await reject("UPDATE review_schedules SET skill='pronunciation' WHERE facet='meaning'",[]);
   await reject("UPDATE knowledge_mastery_states SET facet='invented_facet' WHERE ctid=(SELECT ctid FROM knowledge_mastery_states WHERE language_profile_id=$1 LIMIT 1)",[f.profiles.en]);
   await assert.rejects(mastery.summary(f.other,f.profiles.en),/not found/);
   await assert.rejects(review.start(f.learner,{language_profile_id:f.profiles.en,topic_id:f.sources.cs.base.entities.find(e=>e.kind==='module')!.id}),/not found/);
  });
  await gate('P4-TXN-001 projections/mistakes/evidence roll back together; replay/concurrency exact once',async()=>{
   const run=await start('en'),a=f.activities.get(run.current_activity_id!)!,c=command(run,a);
   const before=await mastery.summary(f.learner,f.profiles.en,true);const count=Number((await db.query('SELECT count(*) FROM activity_attempts')).rows[0].count);
   await assert.rejects(lessons.submit(f.learner,run.id,c,'after_projection'),/P4_FAULT/);
   assert.equal(Number((await db.query('SELECT count(*) FROM activity_attempts')).rows[0].count),count);assert.deepEqual(await mastery.summary(f.learner,f.profiles.en,true),before);
   const results=await Promise.all([lessons.submit(f.learner,run.id,c),lessons.submit(f.learner,run.id,c)]);assert.equal(results.filter(r=>r.replayed).length,1);
   const state=await mastery.summary(f.learner,f.profiles.en,true);await lessons.submit(f.learner,run.id,c);assert.deepEqual(await mastery.summary(f.learner,f.profiles.en,true),state);await finish(await lessons.get(f.learner,run.id));
  });
  await gate('P4-REVIEW-001 candidate isolation, immutable selection, shared attempts, skip and expiry',async()=>{
   assert.equal((await new ReviewRepository(db).start(f.learner,{language_profile_id:f.profiles.en})).item_count,0,'Default stable reader cannot see test publications');
   const input={language_profile_id:f.profiles.en,mode:'all',cap:10};const sessions=await Promise.all([review.start(f.learner,input),review.start(f.learner,input)]);let s=sessions[0];assert.equal(s.id,sessions[1].id);assert(s.item_count>0);assert(s.item_count<=10);
   assert(s.items.every((i:{knowledge_item_id:string})=>!f.sources.cs.base.entities.some(e=>e.id===i.knowledge_item_id)));
   // Session selection is historical: direct SQL cannot retarget it, even within English.
   await reject("UPDATE review_session_items SET facet=CASE WHEN facet='meaning' THEN 'spelling' ELSE 'meaning' END WHERE session_id=$1 AND ordinal=0",[s.id]);
   await reject('UPDATE review_session_items SET knowledge_item_id=$1 WHERE session_id=$2 AND ordinal=0',[f.sources.cs.lesson.activities[0]!.learning.knowledge_refs[0]!.knowledge_item_id,s.id]);

   await assert.rejects(review.get(f.other,s.id),/not found/);const first=s.items[0];assert(first);const oldDue=(await db.query('SELECT * FROM review_schedules WHERE language_profile_id=$1 ORDER BY knowledge_item_id,facet,scheduler_version',[f.profiles.en])).rows;
   s=await review.skip(f.learner,s.id,{expected_position:0});await review.skip(f.learner,s.id,{expected_position:0});assert.deepEqual((await db.query('SELECT * FROM review_schedules WHERE language_profile_id=$1 ORDER BY knowledge_item_id,facet,scheduler_version',[f.profiles.en])).rows,oldDue);
   const skipped=await lessons.get(f.learner,first.lesson_run_id);await assert.rejects(lessons.submit(f.learner,skipped.id,command(skipped,f.activities.get(skipped.current_activity_id!)!)),/expired|position/);
   if(s.state==='active'){const item=s.items[s.position];const run=await lessons.get(f.learner,item.lesson_run_id);const c=command(run,f.activities.get(run.current_activity_id!)!);await lessons.submit(f.learner,run.id,c);const after=await review.get(f.learner,s.id);assert(after.position>s.position);await lessons.submit(f.learner,run.id,c);assert.equal((await review.get(f.learner,s.id)).position,after.position);}
   await review.cancel(f.learner,s.id);s=await review.start(f.learner,input);assert(s.state==='active');
   await db.query("UPDATE review_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[s.id]);
   const run=await lessons.get(f.learner,s.items[0].lesson_run_id);await assert.rejects(lessons.submit(f.learner,run.id,command(run,f.activities.get(run.current_activity_id!)!)),/expired/);assert.equal((await review.get(f.learner,s.id)).state,'expired');
  });
  await gate('P4-SUPPORT-001 reveal retains lapse/short due and cannot fabricate independent mastery',async()=>{
   let run=await start('en');const a=f.activities.get(run.current_activity_id!)!;const before=await mastery.summary(f.learner,f.profiles.en,true);
   await lessons.submit(f.learner,run.id,command(run,a,{kind:'none'},true));const after=await mastery.summary(f.learner,f.profiles.en,true);
   assert.equal(after.facets!.find(x=>x.facet==='meaning')!.evidence_count,before.facets!.find(x=>x.facet==='meaning')!.evidence_count);
   assert(Number((await db.query('SELECT min(stability_days) AS days FROM review_schedules WHERE language_profile_id=$1 AND scheduler_version=$2',[f.profiles.en,policy.scheduler_version])).rows[0].days)<=policy.reveal_days);
   run=await lessons.get(f.learner,run.id);await finish(run);
  });
  await gate('P4-COLL-001 curated/custom CRUD, cross-language rejection, deletion preserves learning',async()=>{
   const c=await collections.create(f.learner,{language_profile_id:f.profiles.en,name:'My English'});const enKnowledge=f.sources.en.lesson.activities[0]!.learning.knowledge_refs[0]!.knowledge_item_id,csKnowledge=f.sources.cs.lesson.activities[0]!.learning.knowledge_refs[0]!.knowledge_item_id;
   await collections.putEntry(f.learner,c.id,{knowledge_item_id:enKnowledge});const custom=await collections.putEntry(f.learner,c.id,{custom_text:'  Hello   again ',translation:'Привіт знову',note:'Personal note'});assert.equal(custom.normalized_text,'Hello again');assert.equal(custom.audio_status,'unavailable');
   await collections.putEntry(f.learner,c.id,{custom_text:'Hello once more'},custom.id);
   await assert.rejects(collections.putEntry(f.learner,c.id,{knowledge_item_id:csKnowledge}),/this language/);await assert.rejects(collections.get(f.other,c.id),/not found/);
   await reject('UPDATE collection_entries SET language_id=$1 WHERE collection_id=$2',[languageIds.cs,c.id]);
   const selected=await review.start(f.learner,{language_profile_id:f.profiles.en,collection_id:c.id,mode:'all',cap:10});assert(selected.items.every((i:{knowledge_item_id:string})=>i.knowledge_item_id===enKnowledge));await review.cancel(f.learner,selected.id);
   const state=await mastery.summary(f.learner,f.profiles.en,true);await collections.remove(f.learner,c.id);assert.equal((await db.query('SELECT count(*) FROM collection_entries WHERE collection_id=$1',[c.id])).rows[0].count,'0');assert.deepEqual(await mastery.summary(f.learner,f.profiles.en,true),state);
  });
  await gate('P4-RESET-001 explicit position/language reset, immutable history and unaffected Czech',async()=>{
   const enBefore=await mastery.summary(f.learner,f.profiles.en,true),csBefore=await mastery.summary(f.learner,f.profiles.cs,true);
   const request={request_id:randomUUID(),language_profile_id:f.profiles.en,scope:'lesson',target_id:f.sources.en.lesson.lesson_id,reset_mastery:false,confirmed:true};
   await resets.reset(f.learner,request);assert.deepEqual(await mastery.summary(f.learner,f.profiles.en,true),enBefore);
   await assert.rejects(resets.reset(f.other,{...request,request_id:randomUUID()}),{code:'NOT_FOUND'});
   await assert.rejects(resets.reset(f.learner,{...request,reset_mastery:true}),{code:'CONFLICT'});
   const moduleId=f.sources.en.base.entities.find(e=>e.kind==='module')!.id;
   await assert.rejects(resets.reset(f.learner,{...request,request_id:randomUUID(),scope:'module',target_id:f.sources.cs.base.entities.find(e=>e.kind==='module')!.id}),{code:'NOT_FOUND'});
   const evidenceBeforeModule=(await db.query('SELECT count(*) FROM evidence_events')).rows[0].count;
   await resets.reset(f.learner,{...request,request_id:randomUUID(),scope:'module',target_id:moduleId,reset_mastery:true});
   assert((await mastery.summary(f.learner,f.profiles.en)).skills.every(x=>x.evidence_count===0));
   assert.equal((await db.query('SELECT count(*) FROM evidence_events')).rows[0].count,evidenceBeforeModule);
   assert.deepEqual(await mastery.summary(f.learner,f.profiles.cs,true),csBefore);
   await finish(await start('en'));
   const active=await start('en');const counts=(await db.query('SELECT (SELECT count(*) FROM evidence_events) AS evidence,(SELECT count(*) FROM activity_attempts) AS attempts')).rows[0];
   await assert.rejects(resets.reset(f.learner,{request_id:randomUUID(),language_profile_id:f.profiles.en,scope:'language',reset_mastery:true,confirmed:true}),/confirmation/);
   const full={request_id:randomUUID(),language_profile_id:f.profiles.en,scope:'language',reset_mastery:true,confirmed:true,confirmation:'RESET_LANGUAGE'};
   const job=await resets.reset(f.learner,full);assert.equal((await resets.reset(f.learner,full)).id,job.id);
   assert((await mastery.summary(f.learner,f.profiles.en,true)).skills.every(x=>x.evidence_count===0));assert.deepEqual(await mastery.summary(f.learner,f.profiles.cs,true),csBefore);
   assert.deepEqual((await db.query('SELECT (SELECT count(*) FROM evidence_events) AS evidence,(SELECT count(*) FROM activity_attempts) AS attempts')).rows[0],counts);
   await assert.rejects(lessons.submit(f.learner,active.id,command(active,f.activities.get(active.current_activity_id!)!)),/superseded/);
   await reject('DELETE FROM learning_reset_jobs WHERE id=$1',[job.id]);await finish(await start('en'));assert((await mastery.summary(f.learner,f.profiles.en)).skills.some(x=>x.evidence_count>0));
  });
  await gate('P4-API-001 auth/CSRF, Review permissions and actual P4 HTTP contracts',async()=>{
   const app=await createApi({ready:async()=>true,close:async()=>undefined},{identity:f.identity,content:f.content,lessons,p4:{mastery,review,collections,resets}});
   try{await app.listen(0,'127.0.0.1');const origin=await app.getUrl();const session=await f.identity.login('p4-learner@example.invalid','Synthetic P4 learner password!');const headers={'content-type':'application/json',cookie:`__Host-lingvessa_session=${session.token}`,'x-csrf-token':session.csrf};
    assert.equal((await fetch(`${origin}/api/v1/mastery/summary?language_profile_id=${f.profiles.en}`)).status,401);
    const summary=await fetch(`${origin}/api/v1/mastery/summary?language_profile_id=${f.profiles.en}&details=true`,{headers});assert.equal(summary.status,200);assert.equal((await summary.json() as {skills:unknown[]}).skills.length,6);
    assert.equal((await fetch(`${origin}/api/v1/review-sessions`,{method:'POST',headers:{'content-type':'application/json',cookie:headers.cookie},body:JSON.stringify({language_profile_id:f.profiles.en})})).status,403);
    const create=await fetch(`${origin}/api/v1/collections`,{method:'POST',headers,body:JSON.stringify({language_profile_id:f.profiles.en,name:'HTTP collection'})});assert.equal(create.status,201);const c=await create.json() as {id:string};
    assert.equal((await fetch(`${origin}/api/v1/collections/${c.id}`,{method:'DELETE',headers})).status,200);
    assert.equal((await fetch(`${origin}/api/v1/review-sessions`,{method:'POST',headers,body:JSON.stringify({language_profile_id:f.profiles.en,correct:true,due_at:'2099-01-01'})})).status,400);
    if(process.env.P4_BROWSER_TESTS==='true')await gate('P4-UI-001 Chromium EN/CS Review and collection journeys',()=>p4BrowserGate(origin,f.profiles.en,f.profiles.cs));
   }finally{await app.close();}
  });
  await gate('P4-DB-002 introspection and clean database recreation',async()=>{
   const pulled=spawnSync('pnpm',['exec','prisma','db','pull','--print'],{env,encoding:'utf8',timeout:60000});assert.equal(pulled.status,0);mkdirSync('artifacts/p4',{recursive:true});writeFileSync('artifacts/p4/introspected.prisma',pulled.stdout);
   const schema=readFileSync('prisma/schema.prisma','utf8');
   const actual=[...pulled.stdout.matchAll(/^model (\w+)/gm)].map(m=>m[1]).sort(),expected=[...schema.matchAll(/^model (\w+)/gm)].map(m=>m[1]).sort();assert.deepEqual(actual,expected);
   // SQL owns constraints; Prisma's scalar view must still match every P4-owned column/type/nullability.
   const models=[...schema.slice(schema.indexOf('model learning_policies')).matchAll(/model (\w+) \{([^}]+)\}/g)];
   for(const [,table,body] of models){
    const fields=[...body!.matchAll(/^\s+(\w+)\s+(String|Int|Boolean|DateTime|Decimal|Json)(\?)?([^\n]*)/gm)];
    const columns=(await db.query('SELECT column_name,data_type,is_nullable,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1 ORDER BY column_name',[table])).rows;
    assert.deepEqual(columns.map(c=>c.column_name),fields.map(f=>f[1]).sort(),`${table} columns`);
    for(const [,name,type,optional,attributes] of fields){const column=columns.find(c=>c.column_name===name)!;
     const sqlType=attributes!.includes('@db.Uuid')?'uuid':({String:'text',Int:'integer',Boolean:'boolean',DateTime:'timestamp with time zone',Decimal:'numeric',Json:'jsonb'} as Record<string,string>)[type!];
     assert.equal(column.data_type,sqlType,`${table}.${name} type`);assert.equal(column.is_nullable,optional?'YES':'NO',`${table}.${name} nullable`);
     const decimal=/@db.Decimal\((\d+),\s*(\d+)\)/.exec(attributes!);if(decimal){assert.equal(column.numeric_precision,Number(decimal[1]));assert.equal(column.numeric_scale,Number(decimal[2]));}
    }
   }
   const recreate=`lingvessa_p4_test_${randomBytes(8).toString('hex')}`,freshUrl=new URL(url);freshUrl.pathname=`/${recreate}`;await admin.query(`CREATE DATABASE "${recreate}" TEMPLATE template0 ENCODING 'UTF8'`);
   try{const freshEnv={...env,DATABASE_URL:freshUrl.toString()};assert.equal(spawnSync('pnpm',['db:migrate'],{env:freshEnv,encoding:'utf8',timeout:60000}).status,0);await seedBootstrap(freshEnv);await seedBootstrap(freshEnv);
    const fresh=new pg.Client({connectionString:freshUrl.toString()});await fresh.connect();try{assert.equal((await fresh.query('SELECT count(*) FROM knowledge_mastery_states')).rows[0].count,'0');assert.equal((await fresh.query('SELECT count(*) FROM learning_policies')).rows[0].count,'1');}finally{await fresh.end();}
   }finally{await admin.query(`DROP DATABASE "${recreate}" WITH (FORCE)`);}
  });
  assert.equal(gates.length,process.env.P4_BROWSER_TESTS==='true'?12:11);
 }finally{
  if(pool)await pool.end();if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();mkdirSync('artifacts/p4',{recursive:true});
  writeFileSync('artifacts/p4/database-validation.json',JSON.stringify({phase:'P4',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_sha:process.env.GITHUB_HEAD_SHA??null,database:'PostgreSQL 18.6',gates,status:gates.length===(process.env.P4_BROWSER_TESTS==='true'?12:11)?'PASS':'FAIL'},null,2)+'\n');
 }
});
