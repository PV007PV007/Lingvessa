import type pg from 'pg';
import { recompute, policy } from '../../packages/mastery-review/src/index.js';
import type { Evidence } from '../../packages/mastery-review/src/index.js';
import type { Policy } from '../../packages/mastery-review/src/policy.js';
import { sha256 } from '../../packages/application/src/lesson.js';
import { ContractError } from '../../packages/domain/src/identity.js';
import { transaction } from './database.js';
import { lockLearningProfile } from './learning-lock.js';

export async function readActiveEvidence(db:pg.PoolClient,profileId:string){
  const rows=(await db.query(`SELECT e.*,to_char(e.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS timestamp_exact,a.assistance,a.intent,a.error_category,a.id AS source_attempt_id FROM evidence_events e
    JOIN activity_attempts a ON a.id=e.attempt_db_id AND a.language_profile_id=e.language_profile_id
    WHERE e.language_profile_id=$1 AND NOT EXISTS (
      SELECT 1 FROM mastery_reset_targets t JOIN learning_reset_jobs j ON j.id=t.reset_job_id
      WHERE t.language_profile_id=e.language_profile_id AND t.knowledge_item_id=e.knowledge_item_id AND t.facet=e.facet AND e.occurred_at<=j.created_at)
    ORDER BY e.occurred_at,e.id`,[profileId])).rows;
  return rows.map(row=>({...row,base_weight:Number(row.base_weight),effective_weight:Number(row.effective_weight),difficulty:Number(row.difficulty),
    occurred_at:row.timestamp_exact,hint_count:Number(row.assistance.hint_count??0),prior_attempts:Number(row.assistance.prior_attempts??0),
    response_time_ms:typeof row.assistance.response_time_ms==='number'?row.assistance.response_time_ms:null,
    transcript_support:Boolean(row.assistance.transcript_support)})) as Array<Evidence&{source_attempt_id:string;intent:string;error_category:string;item_id:string}>;
}
/** Called inside the authoritative attempt transaction and by explicit, versioned recomputation. */
export async function refreshMastery(db:pg.PoolClient,userId:string,profileId:string,p:Policy=policy){
  const profile=await lockLearningProfile(db,userId,profileId);
  const registered=(await db.query('SELECT parameters FROM learning_policies WHERE model_version=$1 AND scheduler_version=$2',[p.model_version,p.scheduler_version])).rows[0];
  if(!registered||sha256(registered.parameters)!==sha256(p))throw new ContractError('UNSUPPORTED_CONTRACT','Learning policy version is not registered');
  const events=await readActiveEvidence(db,profileId);const result=recompute(events,p);
  const updated=events.at(-1)?.occurred_at??'1970-01-01T00:00:00.000Z';
  // These are disposable derived projections. The evidence and earlier model versions are never modified.
  await db.query('DELETE FROM knowledge_mastery_states WHERE language_profile_id=$1 AND model_version=$2',[profileId,p.model_version]);
  await db.query('DELETE FROM skill_mastery_states WHERE language_profile_id=$1 AND model_version=$2',[profileId,p.model_version]);
  await db.query('DELETE FROM review_schedules WHERE language_profile_id=$1 AND scheduler_version=$2',[profileId,p.scheduler_version]);
  for(const state of result.knowledge)await db.query(`INSERT INTO knowledge_mastery_states(user_id,language_profile_id,language_id,knowledge_item_id,facet,model_version,
    estimate,uncertainty,evidence_count,lapse_count,last_evidence_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [userId,profileId,profile.language_id,state.knowledge_item_id,state.facet,p.model_version,state.estimate,state.uncertainty,state.evidence_count,state.lapse_count,state.last_evidence_at,updated]);
  for(const state of result.skills)await db.query(`INSERT INTO skill_mastery_states(user_id,language_profile_id,language_id,skill,model_version,
    estimate,uncertainty,evidence_count,lapse_count,last_evidence_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [userId,profileId,profile.language_id,state.skill,p.model_version,state.estimate,state.uncertainty,state.evidence_count,state.lapse_count,state.last_evidence_at,updated]);
  for(const state of result.schedules)await db.query(`INSERT INTO review_schedules(user_id,language_profile_id,language_id,knowledge_item_id,facet,skill,scheduler_version,
    state,difficulty,stability_days,due_at,lapses,reps,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [userId,profileId,profile.language_id,state.knowledge_item_id,state.facet,state.skill,p.scheduler_version,state.state,state.difficulty,state.stability_days,state.due_at,state.lapses,state.reps,state.updated_at]);
  for(const event of events){
    if(event.result_class==='negative')await db.query(`INSERT INTO mistake_instances(user_id,language_profile_id,language_id,knowledge_item_id,facet,source_evidence_id,item_id,error_type,first_seen,last_seen,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'unresolved') ON CONFLICT(source_evidence_id) DO NOTHING`,
      [userId,profileId,profile.language_id,event.knowledge_item_id,event.facet,event.id,event.item_id,event.error_category,event.occurred_at]);
    else await db.query(`UPDATE mistake_instances SET status=$1,remediated_attempt_id=$2,last_seen=$3
      WHERE language_profile_id=$4 AND knowledge_item_id=$5 AND facet=$6 AND first_seen<=$3 AND status IN ('unresolved','scheduled')`,
      [event.intent==='reveal'?'scheduled':'remediated',event.source_attempt_id,event.occurred_at,profileId,event.knowledge_item_id,event.facet]);
  }
  return {...result,model_version:p.model_version,scheduler_version:p.scheduler_version,projection_checksum:sha256(result)};
}
export class MasteryRepository {
  constructor(private readonly pool:pg.Pool){}
  async recompute(userId:string,profileId:string,p:Policy=policy){return transaction(this.pool,db=>refreshMastery(db,userId,profileId,p));}
  async summary(userId:string,profileId:string,details=false){
    return transaction(this.pool,async db=>{const result=await refreshMastery(db,userId,profileId);
      return {language_profile_id:profileId,model_version:result.model_version,scheduler_version:result.scheduler_version,
        skills:result.skills.map(s=>({...s,coverage:s.evidence_count===0?'no_evidence':'observed'})),
        ...(details?{facets:result.knowledge}:{}),projection_checksum:result.projection_checksum};});
  }
  async runSummary(userId:string,runId:string){return transaction(this.pool,async db=>{
    const run=(await db.query('SELECT language_profile_id FROM lesson_runs WHERE id=$1 AND user_id=$2',[runId,userId])).rows[0];
    if(!run)throw new ContractError('NOT_FOUND','Lesson run not found');const result=await refreshMastery(db,userId,run.language_profile_id);
    const skills=(await db.query('SELECT DISTINCT e.skill FROM evidence_events e JOIN activity_attempts a ON a.id=e.attempt_db_id WHERE a.lesson_run_id=$1',[runId])).rows.map(r=>r.skill);
    return {run_id:runId,skills:result.skills.filter(s=>skills.includes(s.skill)),model_version:result.model_version};
  });}
  async mistakes(userId:string,profileId:string){return transaction(this.pool,async db=>{
    await refreshMastery(db,userId,profileId);const active=await readActiveEvidence(db,profileId);
    return (await db.query(`SELECT m.*,a.lesson_run_id FROM mistake_instances m JOIN activity_attempts a ON a.id=(SELECT attempt_db_id FROM evidence_events WHERE id=m.source_evidence_id)
      WHERE m.language_profile_id=$1 AND m.source_evidence_id=ANY($2::uuid[]) ORDER BY m.first_seen,m.id`,[profileId,active.map(e=>e.id)])).rows;
  });}
}
