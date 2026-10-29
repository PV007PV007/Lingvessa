import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {localDatabaseUrl} from '../../infra/local/database-guard.js';
import {createFoundationPool} from '../../infra/persistence/database.js';
import {seedBootstrap} from '../../prisma/seed.js';
import {LocalAssetStore} from '../../packages/provider-adapters/storage/local.js';
import {EncryptedTransientSpeechStore} from '../../packages/provider-adapters/speech/transient.js';
import {speechSignature} from '../../packages/provider-adapters/speech/callback.js';
import {unavailableSpeechEvaluator} from '../../packages/provider-adapters/speech/unavailable.js';
import type {SpeechEvaluator} from '../../packages/application/src/speech.js';
import type {SpeechJobView,SpeechResult} from '../../packages/activity-schemas/src/speech.js';
import {SpeechRepository,startSpeechLoop} from '../../infra/persistence/speech.js';
import {ResetRepository} from '../../infra/persistence/resets.js';
import {createApi} from '../../apps/api/src/app.js';
import {p5SpeechFixture} from '../support/p5-speech-fixtures.js';
import {toneWav} from '../support/p5-audio-fixtures.js';
import {p5BrowserGate} from '../../tools/p5/browser-gate.js';
import {takeP5Quota,p5QuotaKey,P5_QUOTAS} from '../../infra/persistence/p5-quota.js';

test('P5 speech real PostgreSQL: idempotent settlement, exact facets, ownership, callback replay, retries and transient cleanup',{timeout:300000},async()=>{
 const base=localDatabaseUrl(process.env),admin=new pg.Client({connectionString:base}),name=`lingvessa_p5_test_${randomBytes(8).toString('hex')}`,url=new URL(base);url.pathname=`/${name}`;
 const env={...process.env,LINGVESSA_ENV:'local',DATABASE_URL:url.toString()},root=await mkdtemp(join(tmpdir(),'p5-speech-assets-')),transient=await mkdtemp('/dev/shm/p5-speech-');let created=false,pool:pg.Pool|undefined;
 const gates:Array<{gate:string;status:'PASS'}>=[],gate=async(id:string,fn:()=>Promise<void>)=>{await fn();gates.push({gate:id,status:'PASS'});console.log('P5_GATE PASS',id);};
 try{
  await admin.connect();assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num,'180006');await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);created=true;
  const migration=spawnSync('pnpm',['db:migrate'],{env,encoding:'utf8',timeout:60000});assert.equal(migration.status,0,migration.stdout.slice(-2500)+migration.stderr.slice(-1200));await seedBootstrap(env);
  pool=createFoundationPool(url.toString());const db=pool,f=await p5SpeechFixture(db,new LocalAssetStore(root)),audio=new EncryptedTransientSpeechStore(transient,randomBytes(32));
  let output:SpeechResult={usable:true,confidence:0.95,target_match:true,error_tags:[],processing_ms:20},fail=false;
  const evaluator:SpeechEvaluator={code:'controlled_speech_fixture',modelVersion:'fixture-1',available:true,async evaluate(input){assert(input.audio.length>0);if(fail)throw new Error('controlled outage');return structuredClone(output);}};
  const speech=new SpeechRepository(db,audio,evaluator,randomBytes(32));
  const fresh=async(language:'en'|'cs')=>{const r=await f.lessons.get(f.learner,f.runs[language].id);return {attempt_id:randomUUID(),language_profile_id:r.language_profile_id,lesson_run_id:r.id,item_id:r.current_activity_id!,content_version_id:r.content_version_id};};
  const create=async(language:'en'|'cs'='en')=>speech.create(f.learner,randomUUID(),await fresh(language));
  const upload=async(j:SpeechJobView)=>{const u=new URL(j.upload_url!,'http://fixture.invalid');await speech.upload(f.learner,j.job_id,u.searchParams.get('token')!,'audio/wav',toneWav(50));return speech.submit(f.learner,j.job_id);};
  const count=async(table:string)=>Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
  const reject=async(sql:string,args:unknown[]=[])=>assert.rejects(db.query(sql,args),(e:unknown)=>Boolean(e&&typeof e==='object'&&'code'in e&&['23514','23503','42501'].includes(String(e.code))));
  await gate('P5-SPEECH-001 created/cancel replay settles once; Next never appends an attempt',async()=>{
   const input=await fresh('en'),key=randomUUID(),pair=await Promise.all([speech.create(f.learner,key,input),speech.create(f.learner,key,input)]);assert.equal(pair[0]!.job_id,pair[1]!.job_id);
   const j=pair[0]!;await assert.rejects(speech.create(f.learner,key,{...input,attempt_id:randomUUID()}),/retain/);
   const cancelled=await Promise.all([speech.cancel(f.learner,j.job_id),speech.cancel(f.learner,j.job_id)]);assert(cancelled.every(j=>j.state==='cancelled'&&j.outcome==='speech_unavailable'&&j.reason==='user_cancelled'));
   assert.equal(await count('activity_attempts'),1);assert.equal(await count('evidence_events'),0);assert.equal(await count('review_schedules'),0);assert.equal(await count('mistake_instances'),0);
   assert.equal((await db.query('SELECT cleanup_pending FROM speech_jobs WHERE id=$1',[j.job_id])).rows[0].cleanup_pending,false);
   const first=await speech.next(f.learner,f.runs.en.id,j.job_id);assert.equal(first.position,1);assert.deepEqual(await speech.next(f.learner,f.runs.en.id,j.job_id),first);assert.equal(await count('activity_attempts'),1);
  });
  await gate('P5-SPEECH-002 evaluable mismatch targets exact intelligibility facet; Retry is new immutable attempt',async()=>{
   output={...output,target_match:false};const j=await create();await upload(j);await speech.runOnce();const mismatch=await speech.get(f.learner,j.job_id);assert.equal(mismatch.outcome,'speech_incorrect');
   const e=(await db.query('SELECT skill,facet,result_class FROM evidence_events')).rows;assert.equal(e.length,1);assert.deepEqual(e[0],{skill:'pronunciation',facet:'intelligibility',result_class:'negative'});
   assert.equal((await f.lessons.get(f.learner,f.runs.en.id)).position,1);assert.equal(await count('mistake_instances'),1);assert.deepEqual(await readdir(transient),[]);
   output={...output,target_match:true};const retry=await create();assert.notEqual(retry.attempt_id,j.attempt_id);await upload(retry);await speech.runOnce();assert.equal((await speech.get(f.learner,retry.job_id)).outcome,'speech_correct');
   await reject("UPDATE activity_attempts SET outcome='speech_correct' WHERE attempt_id=$1",[j.attempt_id]);await reject("UPDATE speech_jobs SET outcome='speech_correct' WHERE id=$1",[j.job_id]);
   await assert.rejects(speech.next(f.learner,f.runs.en.id,j.job_id),/latest/);
   const n=await count('activity_attempts');await speech.next(f.learner,f.runs.en.id,retry.job_id);assert.equal(await count('activity_attempts'),n);
  });
  await gate('P5-SPEECH-003 Czech shares lifecycle; DB cross-language/owner/policy/receipt negatives reject',async()=>{
   const j=await create('cs');
   await assert.rejects(speech.get(f.author,j.job_id),/not found/);
   await reject('UPDATE speech_jobs SET language_id=$2 WHERE id=$1',[j.job_id,f.runs.en.language_id]);
   await reject('UPDATE speech_jobs SET language_profile_id=$2 WHERE id=$1',[j.job_id,f.runs.en.language_profile_id]);
   await reject('UPDATE speech_jobs SET user_id=$2 WHERE id=$1',[j.job_id,f.author]);
   await reject('INSERT INTO speech_next_receipts(job_id,user_id,result) VALUES($1,$2,$3)',[j.job_id,f.author,{}]);
   await upload(j);await speech.runOnce();assert.equal((await speech.get(f.learner,j.job_id)).outcome,'speech_correct');
   const evidence=(await db.query('SELECT * FROM evidence_events WHERE attempt_id=$1',[j.attempt_id])).rows[0];assert.equal(evidence.facet,'pronunciation_target');assert.equal(evidence.language_id,f.runs.cs.language_id);
   await reject("INSERT INTO evidence_events SELECT (jsonb_populate_record(NULL::evidence_events,to_jsonb(e)||jsonb_build_object('id',$2::uuid,'facet','meaning'))).* FROM evidence_events e WHERE attempt_id=$1",[j.attempt_id,randomUUID()]);
   // A mismatched exact map cannot be introduced by writing around the application.
   await reject("UPDATE speech_policies SET confidence_threshold=0",[]);
   await speech.next(f.learner,f.runs.cs.id,j.job_id);
  });
  await gate('P5-SPEECH-004 denied/absent/low confidence/unavailable leave all learning projections unchanged',async()=>{
   const before=await db.query('SELECT * FROM evidence_events ORDER BY id');
   for(const reason of ['mic_denied','mic_absent','unsupported_audio'] as const){const j=await create('cs');assert.equal((await speech.submit(f.learner,j.job_id,{client_unavailable_reason:reason})).outcome,'speech_unavailable');}
   output={...output,confidence:0.1,target_match:false};const low=await create('cs');await upload(low);await speech.runOnce();assert.equal((await speech.get(f.learner,low.job_id)).reason,'low_confidence');
   const unavailable=new SpeechRepository(db,audio,unavailableSpeechEvaluator,randomBytes(32));const j=await unavailable.create(f.learner,randomUUID(),await fresh('cs'));assert.equal(j.outcome,'speech_unavailable');assert.equal(j.upload_url,null);
   assert.deepEqual((await db.query('SELECT * FROM evidence_events ORDER BY id')).rows,before.rows);assert.deepEqual(await readdir(transient),[]);
  });
  const callbackSecret=randomBytes(32),callbackOrigin='p5-fixture-worker';
  const app=await createApi({ready:async()=>true,close:async()=>undefined},{identity:f.identity,content:f.content,lessons:f.lessons,speech:{repository:speech,callback:{secret:callbackSecret,origin:callbackOrigin}}});await app.listen(0,'127.0.0.1');
  try{
   const origin=await app.getUrl(),session=await f.identity.login('p5-learner@example.invalid','Synthetic P5 learner password!'),headers={cookie:`__Host-lingvessa_session=${session.token}`,'x-csrf-token':session.csrf,'content-type':'application/json'};
   await gate('P5-SPEECH-005 auth/CSRF/single-use upload and signed callbacks reject replay/context tampering',async()=>{
    const input=await fresh('cs'),key=randomUUID(),url=origin+'/api/v1/speech/jobs';
    assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})).status,401);
    assert.equal((await fetch(url,{method:'POST',headers:{cookie:headers.cookie,'content-type':'application/json','idempotency-key':key},body:JSON.stringify(input)})).status,403);
    const response=await fetch(url,{method:'POST',headers:{...headers,'idempotency-key':key},body:JSON.stringify(input)});assert.equal(response.status,201);const job=await response.json() as SpeechJobView;
    const put=()=>fetch(origin+job.upload_url,{method:'PUT',headers:{...headers,'content-type':'audio/wav'},body:new Uint8Array(toneWav(50))});assert.equal((await put()).status,200);assert.equal((await put()).status,409);
    assert.equal((await fetch(url+'/'+job.job_id+'/submit',{method:'POST',headers,body:'{}'})).status,200);assert.equal((await fetch(url+'/'+job.job_id+'/submit',{method:'POST',headers,body:'{}'})).status,200);
    const execution=randomUUID();await db.query("UPDATE speech_jobs SET state='processing',attempts=attempts+1,execution_id=$2,lease_until=clock_timestamp()+interval '15 seconds' WHERE id=$1",[job.job_id,execution]);
    const row=(await db.query('SELECT * FROM speech_jobs WHERE id=$1',[job.job_id])).rows[0];
    const payload={event_id:randomUUID(),job_id:job.job_id,execution_id:execution,user_id:f.learner,language_profile_id:row.language_profile_id,language_id:row.language_id,provider_code:row.provider_code,model_version:row.model_version,policy_code:row.policy_code,policy_version:row.policy_version,result:{...output,confidence:0.9,target_match:false}};
    const send=(body:string,signed=true)=>{const time=String(Date.now());return fetch(origin+'/api/v1/internal/speech/callback',{method:'POST',headers:{'content-type':'application/json','x-speech-origin':callbackOrigin,'x-speech-timestamp':time,'x-speech-signature':signed?speechSignature(callbackSecret,callbackOrigin,time,body):'0'.repeat(64)},body});};
    assert.equal((await send(JSON.stringify(payload),false)).status,403);assert.equal((await send(JSON.stringify({...payload,language_id:f.runs.en.language_id}))).status,403);
    assert.equal((await send(JSON.stringify(payload))).status,200);const after=await count('evidence_events');assert.equal((await (await send(JSON.stringify(payload))).json()).disposition,'duplicate');
    assert.equal((await (await send(JSON.stringify({...payload,event_id:randomUUID()}))).json()).disposition,'late');assert.equal(await count('evidence_events'),after);
    assert.equal((await db.query("SELECT count(*) FROM outbox_events WHERE event_type='speech.callback.duplicate'")).rows[0].count,'1');
    const e=(await db.query('SELECT facet FROM evidence_events WHERE attempt_id=$1',[job.attempt_id])).rows[0];assert.equal(e.facet,'intelligibility');assert.deepEqual(await readdir(transient),[]);
   });
   await gate('P5-SPEECH-012 transport quota is separate; cancellation, cleanup and poll remain available',async()=>{
    const j=await create('cs');await upload(j);
    for(let n=0;n<P5_QUOTAS.speech_transport;n++)await f.identity.allowSpeechTransport(f.learner);
    assert.equal(await f.identity.allowSpeechTransport(f.learner),false);assert.equal(await f.identity.allowLearningAction(f.learner),true);
    const url=origin+'/api/v1/speech/jobs';
    assert.equal((await fetch(url,{method:'POST',headers:{...headers,'idempotency-key':randomUUID()},body:JSON.stringify(await fresh('cs'))})).status,429);
    assert.equal((await fetch(url+'/'+j.job_id,{headers})).status,200);
    const cancel=await fetch(url+'/'+j.job_id+'/cancel',{method:'POST',headers,body:'{}'});assert.equal(cancel.status,200);assert.equal((await cancel.json()).outcome,'speech_unavailable');
    assert.deepEqual(await readdir(transient),[]);
    await db.query("UPDATE auth_rate_windows SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",[p5QuotaKey('speech_transport',f.learner)]);
   });
  }finally{await app.close();}
  await gate('P5-SPEECH-006 bounded failures retry same job, then one neutral settlement',async()=>{
   const before=await count('evidence_events');fail=true;const j=await create('cs');await upload(j);
   for(let n=0;n<3;n++){await speech.runOnce();if(n<2)await new Promise(r=>setTimeout(r,(n+1)*1000+30));}
   const done=await speech.get(f.learner,j.job_id);assert.equal(done.state,'failed');assert.equal(done.outcome,'speech_unavailable');assert.equal((await db.query('SELECT attempts FROM speech_jobs WHERE id=$1',[j.job_id])).rows[0].attempts,3);
   assert.equal((await db.query('SELECT count(*) FROM activity_attempts WHERE attempt_id=$1',[j.attempt_id])).rows[0].count,'1');assert.equal(await count('evidence_events'),before);assert.deepEqual(await readdir(transient),[]);fail=false;
  });
  await gate('P5-SPEECH-009 expired job/orphan, failed cleanup and deferred settlement recover without evidence',async()=>{
   const before=await count('evidence_events'),j=await create('cs');
   await reject("UPDATE speech_jobs SET state='cancelled',outcome='speech_unavailable',reason='user_cancelled',settled_at=clock_timestamp() WHERE id=$1",[j.job_id]);
   assert.equal((await speech.get(f.learner,j.job_id)).state,'created');await speech.cancel(f.learner,j.job_id);
   // The fixture creates a legitimately expired job; it never disables or edits a constraint.
   const expired=randomUUID();await db.query(`INSERT INTO speech_jobs(id,attempt_id,idempotency_key,request_hash,user_id,language_profile_id,language_id,lesson_run_id,item_id,content_version_id,policy_id,policy_code,policy_version,provider_code,model_version,created_at,expires_at)
    SELECT $2,$3,$4,request_hash,user_id,language_profile_id,language_id,lesson_run_id,item_id,content_version_id,policy_id,policy_code,policy_version,provider_code,model_version,clock_timestamp()-interval '15 minutes',clock_timestamp()-interval '2 minutes' FROM speech_jobs WHERE id=$1`,[j.job_id,expired,randomUUID(),randomUUID()]);
   await audio.put(expired,toneWav(50),new Date(Date.now()+5000));await speech.recover();assert.equal((await speech.get(f.learner,expired)).state,'expired');assert.deepEqual(await readdir(transient),[]);
   const cleanup=await create('cs');await upload(cleanup);let unavailable=true;
   const faultyAudio={put:audio.put.bind(audio),read:audio.read.bind(audio),prune:audio.prune.bind(audio),async delete(id:string){if(unavailable)throw new Error('Controlled deletion outage');await audio.delete(id);}};
   const retryCleanup=new SpeechRepository(db,faultyAudio,evaluator,randomBytes(32));assert.equal((await retryCleanup.cancel(f.learner,cleanup.job_id)).outcome,'speech_unavailable');
   assert.equal((await db.query('SELECT cleanup_pending FROM speech_jobs WHERE id=$1',[cleanup.job_id])).rows[0].cleanup_pending,true);assert.equal((await readdir(transient)).length,1);
   unavailable=false;await retryCleanup.recover();assert.equal((await db.query('SELECT cleanup_pending FROM speech_jobs WHERE id=$1',[cleanup.job_id])).rows[0].cleanup_pending,false);
   assert.equal(await count('evidence_events'),before);assert.deepEqual(await readdir(transient),[]);
  });
  await gate('P5-SPEECH-010 worker lease recovery audits old execution; cancellation wins an in-flight result',async()=>{
   const before=await count('evidence_events'),j=await create('cs');await upload(j);const oldExecution=randomUUID();
   await db.query("UPDATE speech_jobs SET state='processing',attempts=attempts+1,execution_id=$2,lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[j.job_id,oldExecution]);
   await speech.recover();assert.equal((await speech.get(f.learner,j.job_id)).state,'queued');
   const row=(await db.query('SELECT * FROM speech_jobs WHERE id=$1',[j.job_id])).rows[0];
   const callback={event_id:randomUUID(),job_id:j.job_id,execution_id:oldExecution,user_id:f.learner,language_profile_id:row.language_profile_id,language_id:row.language_id,provider_code:row.provider_code,model_version:row.model_version,policy_code:row.policy_code,policy_version:row.policy_version,result:{...output,confidence:0.9,target_match:true}};
   assert.equal((await speech.callback(callback)).disposition,'stale_execution');assert.equal((await speech.get(f.learner,j.job_id)).state,'queued');await speech.cancel(f.learner,j.job_id);
   let announce!:()=>void,release!:(result:SpeechResult)=>void;const started=new Promise<void>(r=>{announce=r;}),pending=new Promise<SpeechResult>(r=>{release=r;});
   const held:SpeechEvaluator={code:evaluator.code,modelVersion:evaluator.modelVersion,available:true,async evaluate(){announce();return pending;}};
   const delayed=new SpeechRepository(db,audio,held,randomBytes(32)),active=await create('cs');await upload(active);const worker=delayed.runOnce();await started;
   await speech.cancel(f.learner,active.job_id);release({...output,confidence:0.95,target_match:true});await worker;
   assert.equal((await speech.get(f.learner,active.job_id)).state,'cancelled');assert.equal(await count('evidence_events'),before);assert.deepEqual(await readdir(transient),[]);
   assert.equal((await speech.callback({...callback,event_id:randomUUID()})).disposition,'late');assert.equal(await count('evidence_events'),before);
  });
  await gate('P5-SPEECH-011 processing quota settles neutral, replay is free and normal learning stays available',async()=>{
   const before=await count('evidence_events');
   for(let n=0;n<P5_QUOTAS.speech_processing;n++)await takeP5Quota(db,'speech_processing',f.learner);
   const input=await fresh('cs'),key=randomUUID(),j=await speech.create(f.learner,key,input);
   assert.equal(j.outcome,'speech_unavailable');assert.equal(j.reason,'quota_exhausted');assert.equal(j.upload_url,null);
   const used=async()=>Number((await db.query('SELECT attempts FROM auth_rate_windows WHERE key_hash=$1',[p5QuotaKey('speech_processing',f.learner)])).rows[0].attempts);
   const prior=await used();assert.equal((await speech.create(f.learner,key,input)).job_id,j.job_id);assert.equal(await used(),prior);
   assert.equal(await f.identity.allowLearningAction(f.learner),true);assert.equal(await count('evidence_events'),before);assert.deepEqual(await readdir(transient),[]);
   const priorRun=await f.lessons.get(f.learner,f.runs.cs.id),attemptsBeforeNext=await count('activity_attempts');
   assert.equal(priorRun.position,priorRun.manifest.activities.length-1,'Fixture is at its final activity');
   const completed=await speech.next(f.learner,f.runs.cs.id,j.job_id);
   assert.equal(completed.state,'completed');assert.equal(completed.current_activity_id,null);assert.equal(completed.position,priorRun.position);
   assert.deepEqual(await speech.next(f.learner,f.runs.cs.id,j.job_id),completed);assert.equal(await count('activity_attempts'),attemptsBeforeNext);assert.equal(await count('evidence_events'),before);
   // The following reset gate needs a new active run, not the completed quota fixture.
   f.runs.cs=await f.lessons.start(f.learner,{language_profile_id:priorRun.language_profile_id,publication_id:priorRun.publication_id,lesson_id:priorRun.lesson_id});
   assert.notEqual(f.runs.cs.id,priorRun.id);assert.equal(f.runs.cs.position,0);
   await db.query("UPDATE auth_rate_windows SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",[p5QuotaKey('speech_processing',f.learner)]);
  });
  await gate('P5-SPEECH-007 reset during processing settles neutral and cannot receive late mastery credit',async()=>{
   const before=await count('evidence_events'),j=await create('cs');await upload(j);
   await new ResetRepository(db).reset(f.learner,{request_id:randomUUID(),language_profile_id:f.runs.cs.language_profile_id,scope:'lesson',target_id:f.runs.cs.lesson_id,confirmed:true,reset_mastery:false});
   await speech.recover();const ended=await speech.get(f.learner,j.job_id);assert.equal(ended.outcome,'speech_unavailable');assert.equal(ended.reason,'context_superseded');assert.equal(await count('evidence_events'),before);assert.deepEqual(await readdir(transient),[]);
  });
  if(process.env.P5_BROWSER_TESTS==='true')await gate('P5-SPEECH-008 real Chromium microphone/retry/Continue/reduced-motion, shared EN/CS runtime',async()=>{
   const browserRuns={} as Record<'en'|'cs',string>;
   for(const language of ['en','cs'] as const){const old=f.runs[language];browserRuns[language]=(await f.lessons.start(f.learner,{language_profile_id:old.language_profile_id,publication_id:old.publication_id,lesson_id:old.lesson_id})).id;}
   const calls={en:0,cs:0};
   const browserEvaluator:SpeechEvaluator={code:evaluator.code,modelVersion:evaluator.modelVersion,available:true,async evaluate(input){
    assert(input.audio.length>0);assert(input.mime.startsWith('audio/'));calls[input.language]++;
    if(input.language==='cs'&&calls.cs>1)throw new Error('Controlled browser provider outage');
    return {usable:true,confidence:input.language==='cs'?0.1:0.95,target_match:input.language==='en'&&calls.en!==2,error_tags:[],processing_ms:20};
   }};
   const browserSpeech=new SpeechRepository(db,audio,browserEvaluator,randomBytes(32));
   const browserApp=await createApi({ready:async()=>true,close:async()=>undefined},{identity:f.identity,content:f.content,lessons:f.lessons,speech:{repository:browserSpeech}});
   await browserApp.listen(0,'127.0.0.1');const stop=startSpeechLoop(browserSpeech);
   try{await p5BrowserGate(await browserApp.getUrl(),browserRuns.en,browserRuns.cs,'speech');}
   finally{stop();await browserApp.close();}
   assert.deepEqual(calls,{en:3,cs:4});
   assert.equal((await f.lessons.get(f.learner,browserRuns.en)).state,'completed');assert.equal((await f.lessons.get(f.learner,browserRuns.cs)).state,'completed');
   const rows=(await db.query('SELECT j.outcome,j.reason,count(e.id)::int AS evidence FROM speech_jobs j LEFT JOIN activity_attempts a ON a.speech_job_id=j.id LEFT JOIN evidence_events e ON e.attempt_db_id=a.id WHERE j.lesson_run_id=$1 GROUP BY j.id',[browserRuns.cs])).rows;
   assert.equal(rows.length,5);assert(rows.every(r=>r.outcome==='speech_unavailable'&&r.evidence===0));assert.deepEqual(rows.map(r=>r.reason).sort(),['mic_denied','mic_absent','low_confidence','provider_failure','user_cancelled'].sort());
   assert.equal((await db.query('SELECT count(*) FROM speech_jobs WHERE lesson_run_id=$1',[browserRuns.en])).rows[0].count,'3');
   assert.deepEqual(await readdir(transient),[]);
  });
  mkdirSync('artifacts/p5',{recursive:true});writeFileSync('artifacts/p5/speech-database-validation.json',JSON.stringify({phase:'P5',task:'IMP-P5-003',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_sha:process.env.GITHUB_HEAD_SHA??null,status:'PASS',database:'PostgreSQL 18.6',synthetic_adapter_not_linguistic_calibration:true,gates},null,2)+'\n');
 }finally{await pool?.end();if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();await rm(root,{recursive:true,force:true});await rm(transient,{recursive:true,force:true});}
});
