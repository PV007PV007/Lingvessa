import {isDeepStrictEqual} from 'node:util';
import type pg from 'pg';
import {compileAuthoredUnit,verifyAuthoredMedia} from '../../packages/content-tools/src/authored-unit.js';
import {ContractError} from '../../packages/domain/src/identity.js';
import {transaction} from './database.js';

/** Atomic authoring import. Replay checks the entire closure and never repairs or approves it. */
export async function importAuthoredUnit(pool:pg.Pool,actor:string,input:unknown){
  const {unit,lesson,payloads,maps,sourceHash}=compileAuthoredUnit(input);
  return transaction(pool,async db=>{
    if(!(await db.query("SELECT p2_has_role($1,'content_editor') AS allowed",[actor])).rows[0]?.allowed)throw new ContractError('FORBIDDEN','Content editor required');
    await db.query('SELECT 1 FROM languages WHERE id=$1 FOR UPDATE',[unit.language_id]);
    const ids=unit.entities.map(e=>e.version_id);
    const count=Number((await db.query('SELECT count(*) FROM content_versions WHERE id=ANY($1::uuid[])',[ids])).rows[0].count);
    if(count!==0&&count!==ids.length)throw new ContractError('CONFLICT','Partial authored version closure');
    const replay=count!==0;
    const metadata=(await db.query('SELECT metadata FROM asset_versions WHERE asset_id=ANY($1::uuid[])',[unit.media_pins.map(p=>p.asset_id)])).rows.map(r=>r.metadata);
    verifyAuthoredMedia(unit,metadata);
    // Names below are fixed in this module, never user-controlled SQL identifiers.
    const ensure=async(table:string,row:Record<string,unknown>,key:string[])=>{
      const columns=Object.keys(row),values=Object.values(row);
      const where=key.map((k,i)=>`${k}=$${i+1}`).join(' AND '),keys=key.map(k=>row[k]);
      if(!replay)await db.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`,values);
      const actual=(await db.query(`SELECT ${columns.map(c=>c==='evidence_weight'?'evidence_weight::float8 AS evidence_weight':c).join(',')} FROM ${table} WHERE ${where}`,keys)).rows[0];
      if(!actual||!isDeepStrictEqual(actual,row))throw new ContractError('CONFLICT',`Authored ${table} integrity mismatch`);
    };
    for(const e of unit.entities){
      const common={id:e.id,language_id:unit.language_id},m=e.metadata;
      await ensure('content_entities',{...common,stable_code:e.stable_code,kind:e.kind,title:e.title,variety_scope:e.variety_scope},['id']);
      switch(e.kind){
        case 'course':await ensure('courses',common,['id']);break;
        case 'level':await ensure('levels',{...common,course_id:e.parent_id,cefr:m.cefr,position:m.position},['id']);break;
        case 'module':await ensure('modules',{...common,level_id:e.parent_id,position:m.position},['id']);break;
        case 'lesson':await ensure('lessons',{...common,module_id:e.parent_id,unit_kind:m.unit_kind,position:m.position},['id']);break;
        case 'activity':await ensure('activity_items',{...common,lesson_id:e.parent_id,activity_type:m.activity_type,response_modality:m.response_modality,position:m.position},['id']);break;
        case 'knowledge':await ensure('knowledge_items',{...common,knowledge_type:m.knowledge_type,canonical_form:m.canonical_form,sense:m.sense,cefr:m.cefr,learning_scope:m.learning_scope},['id']);break;
        case 'outcome':await ensure('outcomes',{...common,cefr:m.cefr,can_do:m.can_do,source_reference:m.source_reference},['id']);break;
        case 'translation':throw new ContractError('INVALID_INPUT','Translation requires a concrete version binding');
      }
    }
    for(const p of payloads){
      if(!replay)await db.query("INSERT INTO content_versions(id,entity_id,language_id,version_code,schema_version,payload,source_kind,created_by) VALUES($1,$2,$3,$4,'1.7',$5,'imported',$6)",[p.content_version_id,p.entity_id,unit.language_id,p.version_code,p,actor]);
      const actual=(await db.query('SELECT entity_id,language_id,version_code,payload FROM content_versions WHERE id=$1',[p.content_version_id])).rows[0];
      if(!actual||actual.entity_id!==p.entity_id||actual.language_id!==unit.language_id||actual.version_code!==p.version_code||!isDeepStrictEqual(actual.payload,p))throw new ContractError('CONFLICT','Immutable authored content version changed');
    }
    for(const m of maps){
      const row={item_id:m.item_id,knowledge_item_id:m.knowledge_item_id,language_id:unit.language_id,role:m.role,skill:m.skill,facet:m.facet,evidence_weight:m.weight};
      await ensure('item_knowledge_map',row,['item_id','knowledge_item_id','skill','facet']);
    }
    for(const a of unit.activities){
      for(const o of a.learning.outcome_refs)await ensure('item_outcome_map',{item_id:a.id,outcome_id:o.outcome_id,language_id:unit.language_id},['item_id','outcome_id']);
      for(const r of a.presentation.media_refs){
        await ensure('content_media_bindings',{content_version_id:lesson.version_id,item_id:a.id,language_id:unit.language_id,asset_id:r.asset_id,asset_version:r.asset_version,role:r.role},['content_version_id','item_id','asset_id','asset_version','role']);
        const p=unit.media_pins.find(p=>p.asset_id===r.asset_id)!;
        // Requirement IDs are generated once by PostgreSQL; immutable replay uses the unique target/item/role.
        const key=[lesson.version_id,a.id,r.role];
        if(!replay)await db.query(`INSERT INTO media_requirements(id,target_content_version_id,item_id,language_id,role,required,kind,variety,specification_version,specification,accessibility_role,created_by)
          VALUES(gen_random_uuid(),$1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10)`,[lesson.version_id,a.id,unit.language_id,r.role,p.kind,p.scope.variety,lesson.version_code,'Authored objective use; sha256 '+p.checksum,p.decorative?'decorative':'semantic',actor]);
        const req=(await db.query('SELECT language_id,required,kind,variety,specification_version,specification,accessibility_role FROM media_requirements WHERE target_content_version_id=$1 AND item_id=$2 AND role=$3',key)).rows[0];
        if(!isDeepStrictEqual(req,{language_id:unit.language_id,required:true,kind:p.kind,variety:p.scope.variety,specification_version:lesson.version_code,specification:'Authored objective use; sha256 '+p.checksum,accessibility_role:p.decorative?'decorative':'semantic'}))throw new ContractError('CONFLICT','Authored media requirement changed');
      }
    }
    for(const p of payloads){
      for(const r of p.refs)await ensure('content_version_refs',{source_version_id:p.content_version_id,language_id:unit.language_id,target_entity_id:r.entity_id,target_version_id:r.content_version_id,relation:r.relation},['source_version_id','target_entity_id','relation']);
      if(Number((await db.query('SELECT count(*) FROM content_version_refs WHERE source_version_id=$1',[p.content_version_id])).rows[0].count)!==p.refs.length)throw new ContractError('CONFLICT','Extraneous authored reference');
    }
    const itemIds=unit.activities.map(a=>a.id),uses=unit.activities.reduce((n,a)=>n+a.presentation.media_refs.length,0);
    for(const [table,column,value,expected] of [
      ['item_knowledge_map','item_id',itemIds,maps.length],['item_outcome_map','item_id',itemIds,unit.activities.reduce((n,a)=>n+a.learning.outcome_refs.length,0)],
      ['content_media_bindings','content_version_id',[lesson.version_id],uses],['media_requirements','target_content_version_id',[lesson.version_id],uses],
    ] as const)if(Number((await db.query(`SELECT count(*) FROM ${table} WHERE ${column}=ANY($1::uuid[])`,[value])).rows[0].count)!==expected)throw new ContractError('CONFLICT','Extraneous authored binding');
    if(!replay)await db.query("INSERT INTO audit_events(actor_id,action,payload) VALUES($1,'content.authored_unit_imported',$2)",[actor,{source_hash:sourceHash,lesson_version_id:lesson.version_id,version_ids:ids}]);
    return {status:replay?'unchanged' as const:'loaded' as const,version_ids:ids,source_hash:sourceHash};
  });
}
