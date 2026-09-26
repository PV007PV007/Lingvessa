import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {resetSchema} from '../../packages/activity-schemas/src/review.js';
import {sha256} from '../../packages/application/src/lesson.js';
import {ContractError} from '../../packages/domain/src/identity.js';
import {transaction} from './database.js';
import {lockLearningProfile} from './learning-lock.js';
import {refreshMastery} from './mastery.js';
export class ResetRepository {
  constructor(private readonly pool:pg.Pool){}
  async reset(userId:string,raw:unknown){const input=resetSchema.parse(raw);const hash=sha256(input);return transaction(this.pool,async db=>{
    const profile=await lockLearningProfile(db,userId,input.language_profile_id);
    const prior=(await db.query('SELECT * FROM learning_reset_jobs WHERE user_id=$1 AND request_id=$2',[userId,input.request_id])).rows[0];
    if(prior){if(prior.request_hash!==hash)throw new ContractError('CONFLICT','Reset request ID payload differs');return prior;}
    if(input.target_id){const target=(await db.query('SELECT kind FROM content_entities WHERE id=$1 AND language_id=$2',[input.target_id,profile.language_id])).rows[0];
      if(target?.kind!==input.scope)throw new ContractError('NOT_FOUND','Reset target not found in this language');}
    const lessons=(await db.query(`SELECT id FROM lessons WHERE language_id=$1 AND ($2='language' OR ($2='lesson' AND id=$3) OR ($2='module' AND module_id=$3))`,[profile.language_id,input.scope,input.target_id??null])).rows.map(x=>x.id);
    const id=randomUUID();
    const job=(await db.query(`INSERT INTO learning_reset_jobs(id,user_id,language_profile_id,language_id,request_id,request_hash,scope,target_id,reset_mastery,confirmed,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'completed') RETURNING *`,[id,userId,profile.id,profile.language_id,input.request_id,hash,input.scope,input.target_id??null,input.reset_mastery])).rows[0];
    if(input.reset_mastery){
      await db.query(`INSERT INTO mastery_reset_targets(reset_job_id,user_id,language_profile_id,language_id,knowledge_item_id,facet)
        SELECT DISTINCT $1::uuid,$2::uuid,$3::uuid,$4::uuid,e.knowledge_item_id,e.facet FROM evidence_events e JOIN activity_attempts a ON a.id=e.attempt_db_id
        WHERE e.language_profile_id=$3 AND ($5='language' OR a.lesson_id=ANY($6::uuid[]))`,[id,userId,profile.id,profile.language_id,input.scope,lessons]);
    }
    // Explicit position reset supersedes active scoped runs. Completed historical runs are left immutable.
    await db.query(`UPDATE lesson_runs SET superseded_at=clock_timestamp(),revision=revision+1 WHERE language_profile_id=$1 AND lesson_id=ANY($2::uuid[]) AND state<>'completed' AND superseded_at IS NULL`,[profile.id,lessons]);
    await db.query("UPDATE review_sessions SET state='cancelled',completed_at=clock_timestamp() WHERE language_profile_id=$1 AND state='active'",[profile.id]);
    if(input.scope==='language')await db.query('UPDATE user_courses SET selected_lesson_id=NULL WHERE language_profile_id=$1',[profile.id]);
    else {
      const first=(await db.query('SELECT l.id,v.course_id FROM lessons l JOIN modules m ON m.id=l.module_id JOIN levels v ON v.id=m.level_id WHERE l.id=ANY($1::uuid[]) ORDER BY l.position,l.id LIMIT 1',[lessons])).rows[0];
      if(first)await db.query('UPDATE user_courses SET selected_lesson_id=$1 WHERE language_profile_id=$2 AND course_id=$3',[first.id,profile.id,first.course_id]);
    }
    await refreshMastery(db,userId,profile.id);
    await db.query('INSERT INTO audit_events(actor_id,action,target_id,payload) VALUES($1,$2,$3,$4)',[userId,'learning.reset.completed',id,{scope:input.scope,reset_mastery:input.reset_mastery,language_profile_id:profile.id}]);
    return job;
  });}
}
