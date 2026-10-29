import {z} from 'zod';
import {activityContractSchema} from '../../activity-schemas/src/lesson.js';
import {evaluateActivity, validateEvaluationContract} from '../../lesson-engine/src/evaluator.js';

/** Authoring regression input. It cannot be loaded as a lesson or publication. */
export const referenceProbesSchema = z.object({
  schema_version: z.literal('p6-evaluation-probes-1'),
  publication_ready: z.literal(false),
  scope: z.string().min(1),
  probes: z.array(z.object({
    source_unit: z.string().min(1), source_step: z.number().int().positive(),
    scope: z.literal('DETERMINISTIC_POLICY_PROBE_NOT_COMPLETE_ACTIVITY'),
    contract: activityContractSchema,
    expected_correct: z.array(z.string().min(1)).min(1),
    expected_incorrect: z.array(z.string().min(1)).min(1),
    varieties: z.array(z.enum(['en-GB','en-US','cs-CZ'])).min(1),
  }).strict()).min(1),
}).strict();

/** Uses the existing evaluator; no language-specific evaluation or fallback. */
export function verifyReferenceProbes(raw: unknown) {
  const data=referenceProbesSchema.parse(raw);
  const cases: Array<{probe_id:string;variety:string;expected:'correct'|'incorrect';actual:string}>=[];
  const ids=new Set<string>();
  for(const probe of data.probes){
    if(ids.has(probe.contract.id))throw new Error('Duplicate reference probe identity');
    ids.add(probe.contract.id);
    if(probe.contract.response.kind!=='text')throw new Error('This probe format requires a text response');
    for(const variety of probe.varieties){
      // These locale clones test authored text equivalence, not a user profile,
      // audio variety, publication or pronunciation policy.
      const contract=activityContractSchema.parse({...probe.contract,variety,response:{...probe.contract.response,
        answer_policy:{...probe.contract.response.answer_policy,normalization:{...probe.contract.response.answer_policy.normalization,locale:variety}}}});
      validateEvaluationContract(contract);
      for(const expected of ['correct','incorrect'] as const)for(const text of probe[`expected_${expected}`]){
        const actual=evaluateActivity(contract,{kind:'text',text}).result;
        if(actual!==expected)throw new Error(`Reference policy mismatch: ${contract.stable_code} / ${variety} / expected ${expected}`);
        cases.push({probe_id:contract.id,variety,expected,actual});
      }
    }
  }
  return {status:'PASS' as const,scope:'DETERMINISTIC_POLICY_PROBES_ONLY' as const,probes:data.probes.length,cases,
    lesson_execution:false,postgresql_execution:false,browser_execution:false,publication_ready:false};
}
