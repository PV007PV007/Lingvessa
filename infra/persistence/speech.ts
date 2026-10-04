import {randomUUID,createHash} from 'node:crypto';
import type pg from 'pg';
import {createSpeechJobSchema,submitSpeechJobSchema,speechResultSchema,speechCallbackSchema,speechJobViewSchema} from '../../packages/activity-schemas/src/speech.js';
import type {SpeechCallback,SpeechJobView,SpeechOutcome,SpeechReason,SpeechResult,SpeechState} from '../../packages/activity-schemas/src/speech.js';
import type {ActivityContract} from '../../packages/activity-schemas/src/lesson.js';
import {SPEECH_LIMITS} from '../../packages/application/src/speech.js';
import type {SpeechEvaluator,TransientSpeechStore} from '../../packages/application/src/speech.js';
import {sha256,P3_VERSIONS} from '../../packages/application/src/lesson.js';
import {ContractError,assertUuid} from '../../packages/domain/src/identity.js';
import {classifySpeech,terminalSpeech} from '../../packages/lesson-engine/src/speech.js';
import {policy} from '../../packages/mastery-review/src/policy.js';
import {uploadToken,validUploadToken} from '../../packages/provider-adapters/speech/transient.js';
import {transaction} from './database.js';
import {lockLearningProfile} from './learning-lock.js';
import {LessonRepository} from './lessons.js';
import type {RunRow,RunView} from './lessons.js';
import {refreshMastery} from './mastery.js';
import {takeP5Quota} from './p5-quota.js';

type Job={id:string;attempt_id:string;idempotency_key:string;request_hash:string;user_id:string;language_profile_id:string;language_id:string;lesson_run_id:string;item_id:string;content_version_id:string;policy_id:string|null;policy_code:string;policy_version:string;provider_code:string;model_version:string;state:SpeechState;attempts:number;execution_id:string|null;lease_until:Date|null;expires_at:Date;mime:string|null;audio_checksum:string|null;audio_bytes:number|null;settled_at:Date|null;outcome:SpeechOutcome|null;reason:SpeechReason|null;feedback:string;cleanup_pending:boolean;audio_deleted_at:Date|null};
type Context={db:pg.PoolClient;job:Job;run:RunRow};
const mimeAllowed=new Set(['audio/webm','audio/ogg','audio/mp4','audio/wav']);
const hashBytes=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** Profile -> run -> job is the common lock order with P4 reset and deterministic attempts. */
export class SpeechRepository {
 private readonly lessons:LessonRepository;
 constructor(private readonly pool:pg.Pool,private readonly audio:TransientSpeechStore,private readonly evaluator:SpeechEvaluator,private readonly tokenSecret:Uint8Array){
  if(tokenSecret.length<32)throw new TypeError('Speech upload signing key must contain at least 32 bytes');this.lessons=new LessonRepository(pool);
 }
 async create(userId:string,key:string,raw:unknown):Promise<SpeechJobView>{
  assertUuid(userId);assertUuid(key);const input=createSpeechJobSchema.parse(raw),requestHash=sha256(input);
  const id=await transaction(this.pool,async db=>{
   await lockLearningProfile(db,userId,input.language_profile_id);
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`speech-create:${userId}`]);
   const previous=(await db.query('SELECT * FROM speech_jobs WHERE user_id=$1 AND (idempotency_key=$2 OR attempt_id=$3)',[userId,key,input.attempt_id])).rows as Job[];
   if(previous.length){const j=previous[0]!;if(previous.length!==1||j.idempotency_key!==key||j.attempt_id!==input.attempt_id||j.request_hash!==requestHash)throw new ContractError('CONFLICT','Speech retry must retain the original attempt, key and context');return j.id;}
   const run=(await db.query('SELECT * FROM lesson_runs WHERE id=$1 AND user_id=$2 AND language_profile_id=$3 FOR UPDATE',[input.lesson_run_id,userId,input.language_profile_id])).rows[0] as RunRow|undefined;
   if(!run)throw new ContractError('NOT_FOUND','Speech run not found');
   if(!await this.activeContext(db,run)||run.content_version_id!==input.content_version_id)throw new ContractError('CONFLICT','Speech context changed');
   const a=run.manifest.activities[run.position];
   if(!a||a.id!==input.item_id||a.response.kind!=='speech'||a.runtime.completion_policy!=='speech_binary_nonblocking_v1')throw new ContractError('INVALID_INPUT','Current activity does not use the speech contract');
   if((await db.query('SELECT 1 FROM speech_jobs WHERE lesson_run_id=$1 AND settled_at IS NULL',[run.id])).rowCount)throw new ContractError('CONFLICT','Resume or cancel the existing speech job');
   const approved=(await db.query(`SELECT p.* FROM speech_policies p JOIN publications pub ON pub.id=$7
    WHERE p.stable_code=$1 AND p.version_code=$2 AND p.language_id=$3 AND p.variety=$4 AND p.target_feature=$5
    AND (NOT p.test_only OR pub.channel='test') AND p.provider_code=$6 AND p.model_version=$8`,
    [a.response.answer_policy.id,a.response.answer_policy.version,run.language_id,a.variety,a.speech!.target_feature,this.evaluator.code,run.publication_id,this.evaluator.modelVersion])).rows[0];
   const id=randomUUID();
   const job=(await db.query(`INSERT INTO speech_jobs(id,attempt_id,idempotency_key,request_hash,user_id,language_profile_id,language_id,lesson_run_id,item_id,content_version_id,policy_id,policy_code,policy_version,provider_code,model_version,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,statement_timestamp(),statement_timestamp()+interval '14 minutes') RETURNING *`,
    [id,input.attempt_id,key,requestHash,userId,run.language_profile_id,run.language_id,run.id,input.item_id,run.content_version_id,approved?.id??null,a.response.answer_policy.id,a.response.answer_policy.version,this.evaluator.code,this.evaluator.modelVersion])).rows[0] as Job;
   if(!approved||!this.evaluator.available)await this.settle({db,job,run},'unavailable','speech_unavailable',!approved?'policy_unavailable':'provider_unavailable');
   else if(!await takeP5Quota(db,'speech_processing',userId))await this.settle({db,job,run},'unavailable','speech_unavailable','quota_exhausted');
   return id;
  });
  return this.get(userId,id);
 }
 async get(userId:string,id:string):Promise<SpeechJobView>{
  const result=await this.withJob(userId,id,async ctx=>{await this.expireContext(ctx);return this.view(ctx.db,ctx.job);});
  if(terminalSpeech(result.state))await this.cleanupOne(id);return result;
 }
 async latest(userId:string,runId:string,itemId:string):Promise<SpeechJobView|null>{
  assertUuid(userId);assertUuid(runId);assertUuid(itemId);
  const row=(await this.pool.query('SELECT id FROM speech_jobs WHERE user_id=$1 AND lesson_run_id=$2 AND item_id=$3 ORDER BY created_at DESC,id DESC LIMIT 1',[userId,runId,itemId])).rows[0];
  return row?this.get(userId,row.id):null;
 }
 async upload(userId:string,id:string,token:string,mime:string,bytes:Uint8Array):Promise<SpeechJobView>{
  mime=mime.split(';')[0]!.trim().toLowerCase();
  if(!mimeAllowed.has(mime)||!bytes.length||bytes.length>SPEECH_LIMITS.maxBytes)throw new ContractError('INVALID_INPUT','Unsupported or oversized speech audio');
  await this.withJob(userId,id,async ctx=>{
   await this.expireContext(ctx);const j=ctx.job;
   if(j.state!=='created'||!validUploadToken(this.tokenSecret,j.id,userId,j.expires_at,token))throw new ContractError('CONFLICT','Upload URL is expired or already used');
   // A crash between tmpfs write and DB commit leaves only an expiring orphan; the same token can retry.
   await this.audio.delete(id);await this.audio.put(id,bytes,j.expires_at);
   await ctx.db.query("UPDATE speech_jobs SET state='uploaded',mime=$2,audio_checksum=$3,audio_bytes=$4,cleanup_pending=true WHERE id=$1",[id,mime,hashBytes(bytes),bytes.length]);
  });
  return this.get(userId,id);
 }
 async submit(userId:string,id:string,raw:unknown={}):Promise<SpeechJobView>{
  const input=submitSpeechJobSchema.parse(raw);
  await this.withJob(userId,id,async ctx=>{
   await this.expireContext(ctx);const j=ctx.job;if(terminalSpeech(j.state))return;
   if(input.client_unavailable_reason){if(j.state!=='created')throw new ContractError('CONFLICT','Microphone exception requires an unuploaded job');await this.settle(ctx,'unavailable','speech_unavailable',input.client_unavailable_reason);return;}
   if(['queued','processing'].includes(j.state))return;
   if(j.state!=='uploaded')throw new ContractError('CONFLICT','Upload audio before submitting');
   await ctx.db.query("UPDATE speech_jobs SET state='queued',next_attempt_at=clock_timestamp() WHERE id=$1",[id]);
  });return this.get(userId,id);
 }
 async cancel(userId:string,id:string):Promise<SpeechJobView>{
  await this.withJob(userId,id,async ctx=>{if(!terminalSpeech(ctx.job.state))await this.settle(ctx,'cancelled','speech_unavailable','user_cancelled');});
  return this.get(userId,id);
 }
 async next(userId:string,runId:string,id:string):Promise<RunView>{
  assertUuid(runId);
  return this.withJob(userId,id,async ctx=>{
   if(ctx.job.lesson_run_id!==runId)throw new ContractError('NOT_FOUND','Speech job not found in this run');
   const prior=(await ctx.db.query('SELECT result FROM speech_next_receipts WHERE job_id=$1 AND user_id=$2',[id,userId])).rows[0];if(prior)return prior.result as RunView;
   await this.expireContext(ctx);
   if(!terminalSpeech(ctx.job.state)||!await this.activeContext(ctx.db,ctx.run)||(await ctx.db.query('SELECT 1 FROM speech_jobs WHERE lesson_run_id=$1 AND settled_at IS NULL',[runId])).rowCount)throw new ContractError('CONFLICT','Wait for the current speech result');
   const view=await this.lessons.continueSpeech(ctx.db,ctx.run,ctx.job);
   await ctx.db.query('INSERT INTO speech_next_receipts(job_id,user_id,result) VALUES($1,$2,$3)',[id,userId,view]);return view;
  });
 }
 /** Called only after transport signature/origin/time validation. The DB independently binds all context. */
 async callback(raw:SpeechCallback):Promise<{disposition:string}>{
  const input=speechCallbackSchema.parse(raw),digest=sha256(input);
  const disposition=await this.withJob(input.user_id,input.job_id,async ctx=>{
   const j=ctx.job;
   if(j.language_profile_id!==input.language_profile_id||j.language_id!==input.language_id||j.provider_code!==input.provider_code||j.model_version!==input.model_version||j.policy_code!==input.policy_code||j.policy_version!==input.policy_version)throw new ContractError('FORBIDDEN','Speech callback context mismatch');
   await ctx.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`speech-event:${input.event_id}`]);
   const prior=(await ctx.db.query('SELECT * FROM speech_callback_events WHERE event_id=$1',[input.event_id])).rows[0];
   if(prior){if(prior.job_id!==j.id||prior.payload_hash!==digest)throw new ContractError('CONFLICT','Callback ID reused with another payload');
    await this.lessons.writeOutbox(ctx.db,{eventType:'speech.callback.duplicate',aggregateId:input.event_id,correlationId:j.id,causationId:input.event_id,profileId:j.language_profile_id,languageId:j.language_id,payload:{job_id:j.id,event_id:input.event_id}});return 'duplicate';}
   await this.expireContext(ctx);
   let result='late';
   if(!terminalSpeech(j.state)){
    if(j.state!=='processing'||j.execution_id!==input.execution_id||!j.lease_until||j.lease_until.getTime()<=Date.now())result='stale_execution';
    else {await this.result(ctx,input.result);result='settled';}
   }
   await ctx.db.query('INSERT INTO speech_callback_events(event_id,job_id,payload_hash,disposition) VALUES($1,$2,$3,$4)',[input.event_id,j.id,digest,result]);return result;
  });await this.cleanupOne(input.job_id);return {disposition};
 }
 async runOnce():Promise<boolean>{
  await this.recover();
  const claimed=await transaction(this.pool,async db=>{
   const j=(await db.query("SELECT * FROM speech_jobs WHERE state='queued' AND next_attempt_at<=clock_timestamp() AND expires_at>clock_timestamp() ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0] as Job|undefined;
   if(!j)return null;
   return (await db.query("UPDATE speech_jobs SET state='processing',attempts=attempts+1,execution_id=$2,lease_until=clock_timestamp()+interval '15 seconds' WHERE id=$1 RETURNING *",[j.id,randomUUID()])).rows[0] as Job;
  });
  if(!claimed)return false;
  let bytes:Uint8Array|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const abort=new AbortController();
  try{
   if(!this.evaluator.available||claimed.provider_code!==this.evaluator.code||claimed.model_version!==this.evaluator.modelVersion){await this.withJob(claimed.user_id,claimed.id,ctx=>this.settle(ctx,'unavailable','speech_unavailable','provider_unavailable'));return true;}
   bytes=await this.audio.read(claimed.id);
   if(hashBytes(bytes)!==claimed.audio_checksum||bytes.length!==claimed.audio_bytes)throw new TypeError('Transient audio integrity failure');
   const source=(await this.pool.query('SELECT manifest FROM lesson_runs WHERE id=$1',[claimed.lesson_run_id])).rows[0];
   const activity=(source.manifest.activities as ActivityContract[]).find(a=>a.id===claimed.item_id)!;
   const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new Error('SPEECH_TIMEOUT'));},SPEECH_LIMITS.processingMs);});
   const output=await Promise.race([this.evaluator.evaluate({audio:bytes,mime:claimed.mime!,language:activity.language,variety:activity.variety,target_feature:activity.speech!.target_feature,signal:abort.signal}),timeout]);
   await this.withJob(claimed.user_id,claimed.id,async ctx=>{
    await this.expireContext(ctx);if(ctx.job.state!=='processing'||ctx.job.execution_id!==claimed.execution_id)return;
    const parsed=speechResultSchema.safeParse(output);
    if(!parsed.success)await this.settle(ctx,'unavailable','speech_unavailable','invalid_result');else await this.result(ctx,parsed.data);
   });
  }catch{
   await this.withJob(claimed.user_id,claimed.id,async ctx=>{
    await this.expireContext(ctx);if(ctx.job.state!=='processing'||ctx.job.execution_id!==claimed.execution_id)return;
    if(ctx.job.attempts>=SPEECH_LIMITS.maxAttempts)await this.settle(ctx,'failed','speech_unavailable',abort.signal.aborted?'provider_timeout':'provider_failure');
    else await ctx.db.query("UPDATE speech_jobs SET state='queued',lease_until=NULL,next_attempt_at=clock_timestamp()+($2*interval '1 second') WHERE id=$1",[claimed.id,ctx.job.attempts]);
   });
  }finally{if(timer)clearTimeout(timer);abort.abort();bytes?.fill(0);await this.cleanupOne(claimed.id);}
  return true;
 }
 async recover():Promise<void>{
  await this.audio.prune();
  const rows=(await this.pool.query(`SELECT id,user_id FROM speech_jobs WHERE settled_at IS NULL AND
   (expires_at<=clock_timestamp() OR state='processing' AND lease_until<=clock_timestamp() OR
    EXISTS(SELECT 1 FROM lesson_runs r WHERE r.id=lesson_run_id AND r.superseded_at IS NOT NULL)) ORDER BY created_at LIMIT 100`)).rows;
  for(const row of rows)await this.withJob(row.user_id,row.id,async ctx=>{
   await this.expireContext(ctx);if(terminalSpeech(ctx.job.state))return;
   if(ctx.job.state==='processing'&&ctx.job.lease_until!.getTime()<=Date.now()){
    if(ctx.job.attempts>=SPEECH_LIMITS.maxAttempts)await this.settle(ctx,'failed','speech_unavailable','provider_timeout');
    else await ctx.db.query("UPDATE speech_jobs SET state='queued',lease_until=NULL,next_attempt_at=clock_timestamp() WHERE id=$1",[row.id]);
   }
  });
  const cleanup=(await this.pool.query('SELECT id FROM speech_jobs WHERE settled_at IS NOT NULL AND audio_deleted_at IS NULL LIMIT 100')).rows;
  for(const row of cleanup)await this.cleanupOne(row.id);
 }
 private async withJob<T>(userId:string,id:string,fn:(ctx:Context)=>Promise<T>):Promise<T>{
  assertUuid(userId);assertUuid(id);
  return transaction(this.pool,async db=>{
   const scope=(await db.query('SELECT language_profile_id,lesson_run_id FROM speech_jobs WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];if(!scope)throw new ContractError('NOT_FOUND','Speech job not found');
   await lockLearningProfile(db,userId,scope.language_profile_id);
   const run=(await db.query('SELECT * FROM lesson_runs WHERE id=$1 FOR UPDATE',[scope.lesson_run_id])).rows[0] as RunRow;
   const job=(await db.query('SELECT * FROM speech_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0] as Job;
   return fn({db,job,run});
  });
 }
 private async activeContext(db:pg.PoolClient,run:RunRow):Promise<boolean>{
  if(run.superseded_at||run.state==='completed')return false;
  if(run.run_kind!=='review')return true;
  return Boolean((await db.query(`SELECT 1 FROM review_sessions s JOIN review_session_items i ON i.session_id=s.id WHERE i.lesson_run_id=$1 AND s.state='active' AND s.expires_at>clock_timestamp() AND i.state='pending' AND i.ordinal=s.position`,[run.id])).rowCount);
 }
 private async expireContext(ctx:Context):Promise<void>{
  if(terminalSpeech(ctx.job.state))return;
  if(!await this.activeContext(ctx.db,ctx.run))await this.settle(ctx,'unavailable','speech_unavailable','context_superseded');
  else if(ctx.job.expires_at.getTime()<=Date.now())await this.settle(ctx,'expired','speech_unavailable','expired');
 }
 private async result(ctx:Context,result:SpeechResult):Promise<void>{
  const row=(await ctx.db.query('SELECT confidence_threshold FROM speech_policies WHERE id=$1',[ctx.job.policy_id])).rows[0];
  if(!row){await this.settle(ctx,'unavailable','speech_unavailable','policy_unavailable');return;}
  const decision=classifySpeech(result,Number(row.confidence_threshold));await this.settle(ctx,decision.state,decision.outcome,decision.reason,result);
 }
 private async settle(ctx:Context,state:SpeechState,outcome:SpeechOutcome,reason:SpeechReason,result:SpeechResult|null=null):Promise<void>{
  const {db,job:j,run}=ctx;if(terminalSpeech(j.state))return;
  const a=run.manifest.activities.find(a=>a.id===j.item_id)!;
  const item=(await db.query('SELECT * FROM lesson_run_items WHERE lesson_run_id=$1 AND item_id=$2 FOR UPDATE',[run.id,j.item_id])).rows[0];
  const feedback=outcome==='speech_correct'?a.feedback.correct:outcome==='speech_incorrect'?a.feedback.incorrect:'Оцінювання вимови недоступне. Ви можете продовжити без зміни майстерності.';
  await db.query('UPDATE speech_jobs SET state=$2,settled_at=clock_timestamp(),outcome=$3,reason=$4,result=$5,feedback=$6,lease_until=NULL WHERE id=$1',[j.id,state,outcome,reason,result,feedback]);
  const response={kind:'speech',job_id:j.id},assistance={hint_count:Number(item.hint_count),reveal:false,prior_reveal:false,prior_attempts:Number(item.attempt_count),response_time_ms:0,transcript_support:false};
  await db.query(`INSERT INTO activity_attempts(user_id,attempt_id,lesson_run_id,language_profile_id,language_id,publication_id,lesson_id,item_id,content_version_id,client_sequence,request_hash,response,response_hash,presentation,assistance,intent,outcome,error_category,feedback,content_schema_version,evaluator_version,answer_policy_id,answer_policy_version,mastery_model_version,scheduler_version,speech_job_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'submit',$16,$17,$18,$19,'speech-target-1.0.0',$20,$21,$22,$23,$24)`,
   [j.user_id,j.attempt_id,run.id,j.language_profile_id,j.language_id,run.publication_id,run.lesson_id,j.item_id,j.content_version_id,Number(run.client_sequence)+1,j.request_hash,response,sha256(response),{seed:a.runtime.presentation_seed,order:a.runtime.presentation_order},assistance,outcome,outcome==='speech_incorrect'?'pronunciation':'none',feedback,P3_VERSIONS.content_schema,j.policy_code,j.policy_version,policy.model_version,policy.scheduler_version,j.id]);
  if(outcome!=='speech_unavailable'){
   for(const k of a.learning.knowledge_refs)for(const m of a.learning.evidence_map){
    if(m.skill!=='pronunciation'||!['pronunciation_target','intelligibility'].includes(m.facet))throw new ContractError('INVALID_INPUT','Target speech evaluator cannot grant unmeasured skills');
    await db.query(`INSERT INTO evidence_events(attempt_db_id,independence,difficulty,model_version,user_id,attempt_id,language_profile_id,language_id,item_id,knowledge_item_id,skill,facet,result_class,assisted,base_weight,effective_weight,content_version_id,content_schema_version,evaluator_version,mastery_model_version,scheduler_version)
     VALUES((SELECT id FROM activity_attempts WHERE user_id=$1 AND attempt_id=$2),$16,$17,$14,$1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$10,$11,$12,$13,$14,$15)`,
     [j.user_id,j.attempt_id,j.language_profile_id,j.language_id,j.item_id,k.knowledge_item_id,m.skill,m.facet,outcome==='speech_correct'?'positive':'negative',m.weight,j.content_version_id,P3_VERSIONS.content_schema,'speech-target-1.0.0',policy.model_version,policy.scheduler_version,assistance.hint_count?'hinted':assistance.prior_attempts?'retry':'independent',a.learning.difficulty]);
   }
   await refreshMastery(db,j.user_id,j.language_profile_id);
  }
  // Keep the current position for Retry/Continue; only Next advances, without a second attempt.
  await db.query('UPDATE lesson_run_items SET state=$3,attempt_count=attempt_count+1,last_attempt_id=$4,needs_remediation=false,updated_at=now() WHERE lesson_run_id=$1 AND item_id=$2',[run.id,j.item_id,outcome,j.attempt_id]);
  await db.query('UPDATE lesson_runs SET client_sequence=client_sequence+1,revision=revision+1 WHERE id=$1',[run.id]);
  Object.assign(run,(await db.query('SELECT * FROM lesson_runs WHERE id=$1',[run.id])).rows[0]);
  await this.lessons.writeOutbox(db,{eventType:'learning.attempt.accepted',aggregateId:j.attempt_id,correlationId:j.id,causationId:j.attempt_id,profileId:j.language_profile_id,languageId:j.language_id,payload:{attempt_id:j.attempt_id,run_id:run.id,item_id:j.item_id,outcome,content_version_id:j.content_version_id,evaluator_version:'speech-target-1.0.0',mastery_model_version:policy.model_version,scheduler_version:policy.scheduler_version}});
  Object.assign(j,(await db.query('SELECT * FROM speech_jobs WHERE id=$1',[j.id])).rows[0]);
 }
 private async view(db:pg.PoolClient,j:Job):Promise<SpeechJobView>{
  return speechJobViewSchema.parse({job_id:j.id,attempt_id:j.attempt_id,lesson_run_id:j.lesson_run_id,item_id:j.item_id,state:j.state,outcome:j.outcome,reason:j.reason,feedback:j.feedback,expires_at:j.expires_at.toISOString(),advanced:Boolean((await db.query('SELECT 1 FROM speech_next_receipts WHERE job_id=$1',[j.id])).rowCount),upload_url:j.state==='created'?`/api/v1/speech/jobs/${j.id}/audio?token=${uploadToken(this.tokenSecret,j.id,j.user_id,j.expires_at)}`:null});
 }
 private async cleanupOne(id:string):Promise<void>{
  const j=(await this.pool.query('SELECT settled_at,audio_deleted_at FROM speech_jobs WHERE id=$1',[id])).rows[0];if(!j?.settled_at||j.audio_deleted_at)return;
  try{await this.audio.delete(id);await this.pool.query('UPDATE speech_jobs SET cleanup_pending=false,audio_deleted_at=clock_timestamp() WHERE id=$1 AND audio_deleted_at IS NULL',[id]);}catch{/* Durable cleanup flag + bounded tmpfs TTL; worker retries, raw bytes never logged. */}
 }
}
export function startSpeechLoop(repository:SpeechRepository):()=>void{
 let stopped=false,running=false;
 const timer=setInterval(()=>{if(stopped||running)return;running=true;void repository.runOnce().catch(()=>{console.error('Speech worker cycle failed; no payload logged.');}).finally(()=>{running=false;});},SPEECH_LIMITS.cleanupIntervalMs);
 return ()=>{stopped=true;clearInterval(timer);};
}
