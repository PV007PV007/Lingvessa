import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {reviewStartSchema,reviewSkipSchema} from '../../packages/activity-schemas/src/review.js';
import {activityContractSchema} from '../../packages/activity-schemas/src/lesson.js';
import {buildSession,policy,reviewSurface} from '../../packages/mastery-review/src/index.js';
import type {Candidate} from '../../packages/mastery-review/src/index.js';
import {sha256} from '../../packages/application/src/lesson.js';
import {ContractError,assertUuid} from '../../packages/domain/src/identity.js';
import {resolveActivity} from '../../packages/lesson-engine/src/index.js';
import {transaction} from './database.js';
import {lockLearningProfile} from './learning-lock.js';
import {refreshMastery} from './mastery.js';
import {LessonRepository} from './lessons.js';

export class ReviewRepository {
  private readonly lessons:LessonRepository;
  // Production wiring always uses stable. Synthetic integration fixtures explicitly inject test.
  // This is a server-owned dependency; learner requests cannot choose a publication channel.
  constructor(private readonly pool:pg.Pool,private readonly contentChannel:'stable'|'test'|'preview'='stable'){this.lessons=new LessonRepository(pool);}
  async start(userId:string,raw:unknown){
    assertUuid(userId);const input=reviewStartSchema.parse(raw);const requestHash=sha256(input);
    return transaction(this.pool,async db=>{
      const profile=await lockLearningProfile(db,userId,input.language_profile_id);
      await this.expire(db,profile.id);
      const existing=(await db.query("SELECT * FROM review_sessions WHERE language_profile_id=$1 AND state='active'",[profile.id])).rows[0];
      if(existing){if(existing.request_hash!==requestHash)throw new ContractError('CONFLICT','Finish or cancel the active Review session before changing filters');return this.view(db,existing.id,userId);}
      await refreshMastery(db,userId,profile.id);
      if(input.collection_id&&!((await db.query("SELECT 1 FROM collections WHERE id=$1 AND user_id=$2 AND language_profile_id=$3 AND status='active'",[input.collection_id,userId,profile.id])).rowCount))throw new ContractError('NOT_FOUND','Collection not found in active language');
      if(input.topic_id&&!((await db.query("SELECT 1 FROM modules WHERE id=$1 AND language_id=$2",[input.topic_id,profile.language_id])).rowCount))throw new ContractError('NOT_FOUND','Topic not found in active language');
      // Active publication pointers only; every candidate is rooted in the selected profile and pinned content.
      const source=(await db.query(`SELECT DISTINCT p.id AS publication_id,pe.entity_id AS lesson_id,cv.id AS content_version_id,cv.payload,
        v.code AS variety FROM language_profiles lp JOIN variants v ON v.id=lp.variant_id AND v.language_id=lp.language_id
        JOIN publication_pointers pp ON pp.language_id=lp.language_id AND pp.channel=$4 JOIN publications p ON p.id=pp.publication_id AND p.language_id=lp.language_id
        JOIN publication_entries pe ON pe.publication_id=p.id AND pe.language_id=lp.language_id
        JOIN lessons l ON l.id=pe.entity_id AND l.language_id=lp.language_id
        JOIN content_versions cv ON cv.id=pe.content_version_id AND cv.language_id=lp.language_id
        WHERE lp.id=$1 AND lp.user_id=$2 AND p.status='published' AND ($3::uuid IS NULL OR l.module_id=$3)`,[profile.id,userId,input.topic_id??null,this.contentChannel])).rows;
      const states=(await db.query('SELECT * FROM knowledge_mastery_states WHERE language_profile_id=$1 AND model_version=$2',[profile.id,policy.model_version])).rows;
      const schedules=(await db.query('SELECT * FROM review_schedules WHERE language_profile_id=$1 AND scheduler_version=$2',[profile.id,policy.scheduler_version])).rows;
      const evidence=(await db.query(`SELECT e.* FROM evidence_events e WHERE e.language_profile_id=$1 AND NOT EXISTS(
        SELECT 1 FROM mastery_reset_targets t JOIN learning_reset_jobs j ON j.id=t.reset_job_id WHERE t.language_profile_id=e.language_profile_id AND t.knowledge_item_id=e.knowledge_item_id AND t.facet=e.facet AND e.occurred_at<=j.created_at)
        ORDER BY e.occurred_at DESC,e.id DESC`,[profile.id])).rows;
      const mistakes=(await db.query("SELECT * FROM mistake_instances WHERE language_profile_id=$1 AND status IN ('unresolved','scheduled') AND source_evidence_id=ANY($2::uuid[])",[profile.id,evidence.map(e=>e.id)])).rows;
      const entries=input.collection_id?(await db.query('SELECT knowledge_item_id,content_entity_id FROM collection_entries WHERE collection_id=$1 AND language_profile_id=$2',[input.collection_id,profile.id])).rows:[];
      const types=(await db.query('SELECT id,knowledge_type FROM knowledge_items WHERE language_id=$1',[profile.language_id])).rows;
      const candidates:Candidate[]=[];
      for(const lesson of source)for(const value of (lesson.payload.activities??[]) as Array<{contract?:unknown}>){
        const parsed=activityContractSchema.safeParse(value.contract);if(!parsed.success)continue;const activity=parsed.data;const resolved=resolveActivity(activity);
        if(activity.variety!==lesson.variety||activity.response.kind==='none'||resolved.status!=='supported'||resolved.adapter.deferred_to_phase)continue;
        for(const target of activity.learning.knowledge_refs)for(const mapping of activity.learning.evidence_map){
          if(input.skill&&mapping.skill!==input.skill)continue;
          if(input.collection_id&&!entries.some(e=>e.knowledge_item_id===target.knowledge_item_id||e.content_entity_id===target.knowledge_item_id||e.content_entity_id===activity.id||e.content_entity_id===lesson.lesson_id))continue;
          const kind=types.find(t=>t.id===target.knowledge_item_id)?.knowledge_type;
          if(input.mode==='words'&&kind!=='lexeme')continue;
          if(input.mode==='phrases'&&!['chunk','sentence','interaction_move'].includes(kind))continue;
          const state=states.find(s=>s.knowledge_item_id===target.knowledge_item_id&&s.facet===mapping.facet);
          const due=schedules.find(s=>s.knowledge_item_id===target.knowledge_item_id&&s.facet===mapping.facet);
          const unresolved=mistakes.some(m=>m.knowledge_item_id===target.knowledge_item_id&&m.facet===mapping.facet);
          if(input.mode==='mistakes'&&!unresolved)continue;
          const observed=evidence.find(e=>e.knowledge_item_id===target.knowledge_item_id&&e.facet===mapping.facet);
          candidates.push({knowledge_item_id:target.knowledge_item_id,facet:mapping.facet,skill:mapping.skill,item_id:activity.id,lesson_id:lesson.lesson_id,publication_id:lesson.publication_id,content_version_id:lesson.content_version_id,
            surface:reviewSurface(activity),
            due_at:due?.due_at?.toISOString()??null,unresolved,estimate:state?Number(state.estimate):0.5,uncertainty:state?Number(state.uncertainty):1,
            selected:Boolean(input.topic_id||input.collection_id||input.mode==='all'||input.mode==='words'||input.mode==='phrases'),fresh:!state,source_evidence_id:observed?.id??null});
        }
      }
      const now=new Date();const selection=buildSession(candidates,now.toISOString(),input.cap);const id=randomUUID();
      await db.query(`INSERT INTO review_sessions(id,user_id,language_profile_id,language_id,scheduler_version,model_version,filters,request_hash,state,item_count,eta_seconds,expires_at,completed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[id,userId,profile.id,profile.language_id,policy.scheduler_version,policy.model_version,input,requestHash,selection.length?'active':'completed',selection.length,selection.length*policy.seconds_per_item,
        new Date(now.getTime()+policy.session_minutes*60000),selection.length?null:now]);
      for(const [ordinal,c]of selection.entries()){
        const run=await this.lessons.startInTransaction(db,userId,{language_profile_id:profile.id,publication_id:c.publication_id,lesson_id:c.lesson_id},{sessionId:id,itemId:c.item_id});
        await db.query(`INSERT INTO review_session_items(session_id,ordinal,user_id,language_profile_id,language_id,lesson_run_id,item_id,knowledge_item_id,facet,skill,reason,source_evidence_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,ordinal,userId,profile.id,profile.language_id,run.id,c.item_id,c.knowledge_item_id,c.facet,c.skill,c.reason,c.source_evidence_id??null]);
      }
      return this.view(db,id,userId);
    });
  }
  async get(userId:string,id:string){assertUuid(id);return transaction(this.pool,async db=>{const s=await this.owned(db,id,userId);await this.expire(db,s.language_profile_id);return this.view(db,id,userId);});}
  async skip(userId:string,id:string,raw:unknown){assertUuid(id);const input=reviewSkipSchema.parse(raw);return transaction(this.pool,async db=>{
    const s=await this.owned(db,id,userId);await this.expire(db,s.language_profile_id);const current=(await db.query('SELECT * FROM review_sessions WHERE id=$1 FOR UPDATE',[id])).rows[0];
    const item=(await db.query('SELECT * FROM review_session_items WHERE session_id=$1 AND ordinal=$2',[id,input.expected_position])).rows[0];
    if(item?.state==='skipped')return this.view(db,id,userId);
    if(current.state!=='active'||current.position!==input.expected_position||!item)throw new ContractError('CONFLICT','Review position changed or expired');
    await db.query("UPDATE review_session_items SET state='skipped',completed_at=clock_timestamp() WHERE session_id=$1 AND ordinal=$2",[id,current.position]);
    const next=current.position+1,done=next>=current.item_count;
    await db.query('UPDATE review_sessions SET position=$1,state=$2,completed_at=$3 WHERE id=$4',[next,done?'completed':'active',done?new Date():null,id]);
    // Skip changes session navigation only; it writes no successful attempt/evidence and does not postpone due.
    return this.view(db,id,userId);
  });}
  async cancel(userId:string,id:string){assertUuid(id);return transaction(this.pool,async db=>{await this.owned(db,id,userId);await db.query("UPDATE review_sessions SET state='cancelled',completed_at=clock_timestamp() WHERE id=$1 AND state='active'",[id]);return this.view(db,id,userId);});}
  private async owned(db:pg.PoolClient,id:string,userId:string){assertUuid(userId);const s=(await db.query('SELECT * FROM review_sessions WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];if(!s)throw new ContractError('NOT_FOUND','Review session not found');await lockLearningProfile(db,userId,s.language_profile_id);return s;}
  private async expire(db:pg.PoolClient,profileId:string){await db.query("UPDATE review_sessions SET state='expired',completed_at=clock_timestamp() WHERE language_profile_id=$1 AND state='active' AND expires_at<=clock_timestamp()",[profileId]);}
  private async view(db:pg.PoolClient,id:string,userId:string){const s=(await db.query('SELECT * FROM review_sessions WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];if(!s)throw new ContractError('NOT_FOUND','Review session not found');
    return {...s,items:(await db.query('SELECT ordinal,lesson_run_id,item_id,knowledge_item_id,facet,skill,reason,state,source_evidence_id FROM review_session_items WHERE session_id=$1 ORDER BY ordinal',[id])).rows};}
}
