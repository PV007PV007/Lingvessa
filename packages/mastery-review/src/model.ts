import { isSkillFacet, skillFacetMatrix } from '../../activity-schemas/src/mastery.js';
import type { Skill } from '../../activity-schemas/src/mastery.js';
import { DAY, policy } from './policy.js';
import type { Policy } from './policy.js';
export type Evidence = {
  id: string; attempt_id: string; knowledge_item_id: string; skill: Skill; facet: string;
  result_class: 'positive'|'negative'|'assisted'; independence: 'independent'|'retry'|'assisted'|'hinted';
  base_weight: number; effective_weight: number; difficulty: number; occurred_at: string;
  hint_count: number; prior_attempts: number; response_time_ms: number|null; transcript_support: boolean;
};
export type Projection = { estimate: number; uncertainty: number; evidence_count: number; lapse_count: number; last_evidence_at: string|null };
export type Schedule = { difficulty: number; stability_days: number; due_at: string|null; lapses: number; reps: number; state: 'scheduled'; updated_at: string };
export type SchedulingOutcome = 'clean'|'retry'|'hint'|'incorrect'|'reveal'|'skip'|'unavailable';
const bounded = (n:number)=>Math.max(0,Math.min(1,n));
const rounded = (n:number)=>Math.round(n*100000)/100000;
export function evidenceWeight(e:Evidence, lastAt:string|null, p:Policy=policy):number {
  if (!isSkillFacet(e.skill,e.facet)) throw new Error('INVALID_SKILL_FACET');
  if (e.result_class==='assisted'||e.independence==='assisted')return 0;
  const productive=['production','spelling','orthography','recall_l1_to_l2','grammar_form','morphology','word_order','context_use','register','interaction_goal','interaction_repair'].includes(e.facet);
  const operation=productive?p.productive_weight:p.recognition_weight;
  const independence=e.hint_count>0?p.hint_weight:e.independence==='retry'?p.retry_weight:1;
  const gap=lastAt===null?p.fresh_after_ms:Math.max(0,Date.parse(e.occurred_at)-Date.parse(lastAt));
  const freshness=Math.max(p.min_freshness,Math.min(1,gap/p.fresh_after_ms));
  const latency=e.response_time_ms!==null&&e.response_time_ms<p.rapid_response_ms?0.5:1;
  // Unknown legacy latency is neutral; never fabricate response time for historical P3 attempts.
  return bounded(e.effective_weight)*operation*independence/(1+e.prior_attempts*0.1)*freshness*latency*
    (0.5+bounded(e.difficulty)*0.5)*(e.transcript_support?p.transcript_weight:1);
}
export function schedulingOutcome(e:Evidence):SchedulingOutcome {
  return e.result_class==='assisted'?'reveal':e.result_class==='negative'?'incorrect':
    e.hint_count>0?'hint':e.independence==='retry'?'retry':'clean';
}
export function schedule(previous:Schedule|null, outcome:SchedulingOutcome, at:string, difficulty:number, p:Policy=policy):Schedule|null {
  if(outcome==='skip'||outcome==='unavailable')return previous;
  const lapses=(previous?.lapses??0)+(outcome==='incorrect'?1:0);
  let days=outcome==='reveal'?p.reveal_days:outcome==='incorrect'?p.incorrect_days:outcome==='hint'?p.hint_days:outcome==='retry'?p.retry_days:
    Math.min(p.max_days,Math.max(p.initial_days,(previous?.stability_days??0)*p.growth));
  if(outcome==='clean'&&lapses>0)days=Math.min(days,Math.max(p.retry_days,(previous?.stability_days??p.retry_days)*1.25));
  days=rounded(days);
  return {difficulty:rounded(bounded(difficulty+(outcome==='incorrect'?0.1:0))),stability_days:days,
    due_at:new Date(Date.parse(at)+days*DAY).toISOString(),lapses,reps:(previous?.reps??0)+(outcome==='clean'?1:0),state:'scheduled',updated_at:at};
}
function uniqueTargets(events:Evidence[]):Evidence[]{
  const seen=new Map<string,Evidence>();
  for(const e of events){const key=`${e.attempt_id}:${e.knowledge_item_id}:${e.facet}`;const prior=seen.get(key);if(!prior||e.effective_weight>prior.effective_weight||(e.effective_weight===prior.effective_weight&&e.id.localeCompare(prior.id)<0))seen.set(key,e);}
  return [...seen.values()].sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
}
export function project(events:Evidence[], p:Policy=policy):Projection {
  let positive=p.prior,negative=p.prior,count=0,lapses=0,last:string|null=null;const lastByTarget=new Map<string,string>();
  for(const e of uniqueTargets(events)){
    const target=`${e.knowledge_item_id}:${e.facet}`;const weight=evidenceWeight(e,lastByTarget.get(target)??null,p);
    if(weight>0){if(e.result_class==='positive')positive+=weight;else negative+=weight;count++;last=e.occurred_at;lastByTarget.set(target,e.occurred_at);}
    if(e.result_class==='negative')lapses++;
  }
  return {estimate:rounded(positive/(positive+negative)),uncertainty:rounded(2*p.prior/(positive+negative)),evidence_count:count,lapse_count:lapses,last_evidence_at:last};
}
export function recompute(events:Evidence[],p:Policy=policy){
  for(const e of events)if(!isSkillFacet(e.skill,e.facet))throw new Error('INVALID_SKILL_FACET');
  const keys=[...new Set(events.map(e=>`${e.knowledge_item_id}:${e.facet}`))].sort();
  return {
    knowledge:keys.map(key=>{const rows=events.filter(e=>`${e.knowledge_item_id}:${e.facet}`===key);return {knowledge_item_id:rows[0]!.knowledge_item_id,facet:rows[0]!.facet,...project(rows,p)};}),
    skills:(Object.keys(skillFacetMatrix) as Skill[]).map(skill=>({skill,...project(events.filter(e=>e.skill===skill),p)})),
    schedules:keys.map(key=>{const rows=uniqueTargets(events.filter(e=>`${e.knowledge_item_id}:${e.facet}`===key));let current:Schedule|null=null;
      for(const e of rows)current=schedule(current,schedulingOutcome(e),e.occurred_at,e.difficulty,p);
      return {knowledge_item_id:rows[0]!.knowledge_item_id,facet:rows[0]!.facet,skill:rows[0]!.skill,...current!};}),
  };
}
