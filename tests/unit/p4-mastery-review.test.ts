import {test} from 'node:test';
import assert from 'node:assert/strict';
import {policy,DAY,recompute,project,schedule,evidenceWeight,buildSession} from '../../packages/mastery-review/src/index.js';
import type {Evidence,Candidate} from '../../packages/mastery-review/src/index.js';
const at='2026-09-01T12:00:00.000Z';
const e:Evidence={id:'1',attempt_id:'a1',knowledge_item_id:'k1',skill:'vocabulary',facet:'meaning',result_class:'positive',independence:'independent',base_weight:1,effective_weight:1,difficulty:0.5,occurred_at:at,hint_count:0,prior_attempts:0,response_time_ms:3000,transcript_support:false};
test('P4 canonical six skills, separate facets and deterministic golden projection',()=>{
  const r=recompute([e]);assert.equal(r.skills.length,6);assert(!r.skills.some(s=>(s.skill as string)==='reading'));
  assert.deepEqual(r.knowledge[0],{knowledge_item_id:'k1',facet:'meaning',estimate:0.59184,uncertainty:0.81633,evidence_count:1,lapse_count:0,last_evidence_at:at});
  assert.equal(r.schedules[0]!.due_at,'2026-09-02T12:00:00.000Z');
  const spelling={...e,id:'2',attempt_id:'a2',facet:'spelling',result_class:'negative' as const};
  assert.deepEqual(recompute([spelling,e]),recompute([e,spelling]));assert.equal(recompute([e,spelling]).knowledge.length,2);
  for(const facet of ['meaning','spelling','listening_recognition','register']){
    const skill=facet==='listening_recognition'?'listening':'vocabulary';assert.equal(recompute([{...e,facet,skill}]).knowledge[0]!.facet,facet);
  }
  assert.throws(()=>recompute([{...e,skill:'pronunciation',facet:'spelling'}]),/INVALID_SKILL_FACET/);
});
test('P4 repeated surfaces share facet state; multi-skill same attempt is not double item credit',()=>{
  const duplicate={...e,id:'2',skill:'listening' as const};assert.equal(recompute([e,duplicate]).knowledge[0]!.evidence_count,1);
  assert.equal(recompute([e,{...e,id:'3',attempt_id:'a3',occurred_at:new Date(Date.parse(at)+DAY).toISOString()}]).knowledge.length,1);
  assert.equal(project([e,{...e,knowledge_item_id:'k2',id:'4',attempt_id:'a4'}]).estimate,0.65517);
});
test('P4 weight considers operation, difficulty, hint, retry, freshness, latency and transcript',()=>{
  const weight=evidenceWeight(e,null);assert(evidenceWeight({...e,facet:'production'},null)>weight);
  for(const changed of [{hint_count:1},{independence:'retry' as const,prior_attempts:1},{response_time_ms:100},{difficulty:0},{transcript_support:true}])assert(evidenceWeight({...e,...changed},null)<weight);
  assert(evidenceWeight(e,at)<weight);assert.equal(evidenceWeight({...e,result_class:'assisted',independence:'assisted',effective_weight:0},null),0);
});
test('P4 schedule golden outcomes are distinct, skip/unavailable preserve due, lapses survive remediation',()=>{
  const outcomes=['clean','retry','hint','incorrect','reveal'] as const;
  const days=outcomes.map(o=>schedule(null,o,at,0.5)!.stability_days);assert.equal(new Set(days).size,5);
  const wrong=schedule(null,'incorrect',at,0.5)!;const fixed=schedule(wrong,'retry',at,0.5)!;
  assert.equal(fixed.lapses,1);assert(fixed.stability_days<schedule(null,'clean',at,0.5)!.stability_days);
  assert.deepEqual(schedule(wrong,'skip',at,0.5),wrong);assert.deepEqual(schedule(wrong,'unavailable',at,0.5),wrong);
  assert.equal(schedule(null,'clean',at,0.5,{...policy,initial_days:2})!.stability_days,2);
});
test('P4 Review priority, cap, knowledge/surface dedup and bounded recycle',()=>{
  const c:Candidate={knowledge_item_id:'k',facet:'meaning',skill:'vocabulary',item_id:'i',lesson_id:'l',publication_id:'p',content_version_id:'v',surface:'Hello',due_at:null,unresolved:false,estimate:0.9,uncertainty:0.1,selected:false,fresh:false};
  const rows=[{...c,item_id:'weak',knowledge_item_id:'kw',surface:'Weak',estimate:0.2},{...c,item_id:'due',knowledge_item_id:'kd',surface:'Due',due_at:at},{...c,item_id:'error',knowledge_item_id:'ke',surface:'Error',unresolved:true},
    {...c,item_id:'duplicate',knowledge_item_id:'kd',surface:'Other',due_at:at},{...c,item_id:'surface',surface:'  DUE ',knowledge_item_id:'ks'},c];
  assert.deepEqual(buildSession(rows,at,3).map(x=>x.reason),['due','unresolved_mistake','weak_or_uncertain']);
  assert.equal(buildSession(Array.from({length:10},(_,i)=>({...c,item_id:`${i}`,knowledge_item_id:`${i}`,surface:`surface${i}`,fresh:true})),at,20).length,2);
  assert.throws(()=>buildSession(rows,at,21),/CAP/);
});
