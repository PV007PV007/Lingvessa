import { z } from 'zod';
import { UUID_PATTERN, STABLE_CODE_PATTERN } from '../../domain/src/identity.js';
import { activityContractSchema } from './lesson.js';
export { isSkillFacet, skillFacetMatrix, type Skill } from './mastery.js';
import { isSkillFacet } from './mastery.js';

const uuid = z.string().regex(UUID_PATTERN);
const code = z.string().regex(STABLE_CODE_PATTERN);
const version = z.string().min(1).max(80).refine((v) => !/[\s*]/u.test(v));
export const entityKind = z.enum(['course', 'level', 'module', 'lesson', 'activity', 'knowledge', 'outcome', 'translation']);
export const referenceSchema = z.object({
  relation: z.enum(['contains', 'knowledge', 'outcome', 'prerequisite', 'contrast', 'component', 'variant', 'reuse', 'co_occurrence']),
  entity_id: uuid, content_version_id: uuid, stable_code: code, version_code: version,
}).strict();
export const activityMetadataSchema = z.object({
  id: uuid, stable_code: code, type: z.string().min(1),
  response_modality: z.enum(['none', 'selection', 'typed', 'speech']),
  completion_policy: z.string().min(1),
  knowledge_refs: z.array(z.object({ knowledge_item_id: uuid, stable_code: code, role: z.enum(['teach', 'practice', 'assess']) }).strict()),
  evidence_map: z.array(z.object({ skill: z.string(), facet: z.string(), weight: z.number().positive().max(1) }).strict()),
  media_refs: z.array(z.object({ asset_id: uuid, asset_stable_code: code, asset_version: z.number().int().positive(), role: z.string().min(1) }).strict()),
  contract: activityContractSchema.optional(),
}).strict().superRefine((a, ctx) => {
  for (const [index, map] of a.evidence_map.entries()) {
    if (!isSkillFacet(map.skill, map.facet)) ctx.addIssue({ code: 'custom', path: ['evidence_map', index], message: 'Invalid canonical skill/facet pair' });
    if (['speaking', 'pronunciation'].includes(map.skill) && a.response_modality !== 'speech')
      ctx.addIssue({ code: 'custom', path: ['evidence_map', index], message: 'Evaluable learner speech required; selection/typing/exposure is not Speaking evidence' });
  }
  if (a.evidence_map.length && (!a.knowledge_refs.length || a.response_modality === 'none'))
    ctx.addIssue({ code: 'custom', message: 'Evidence requires an assessable knowledge target' });
  if (a.contract && (JSON.stringify(a.contract.learning.evidence_map)!==JSON.stringify(a.evidence_map) || JSON.stringify(a.contract.learning.knowledge_refs)!==JSON.stringify(a.knowledge_refs)))
    ctx.addIssue({ code:'custom',path:['contract','learning'],message:'Executable contract mapping differs from published metadata' });
  if (a.contract && (a.contract.id !== a.id || a.contract.stable_code !== a.stable_code || a.contract.type !== a.type))
    ctx.addIssue({ code: 'custom', path: ['contract'], message: 'Executable contract identity/type differs from activity metadata' });
});
export const contentSchema = z.object({
  schema_version: z.literal('1.7'), entity_id: uuid, content_version_id: uuid,
  stable_code: code, version_code: version, language: z.enum(['en', 'cs']),
  kind: entityKind, title: z.string().min(1), variety_scope: z.enum(['common', 'en-GB', 'en-US', 'cs-CZ']),
  refs: z.array(referenceSchema),
  body: z.record(z.string(), z.unknown()),
  activities: z.array(activityMetadataSchema).optional(),
  // Optional by the locked contract. No provider request objects are accepted here.
  ai_extensions: z.array(z.object({ capability: z.string().min(1), fallback: z.string().min(1) }).strict()).optional(),
}).strict().superRefine((value, ctx) => {
  for (const text of [value.title, value.body.canonical_form, value.body.sense]) {
    if (typeof text === 'string' && /\p{Script=Cyrillic}/u.test(text)) ctx.addIssue({ code: 'custom', message: 'Unexpected Cyrillic in target-language text; UI translations are separate' });
    if (typeof text === 'string' && text !== text.normalize('NFC')) ctx.addIssue({ code: 'custom', message: 'Target-language text must be NFC' });
  }
  if ((value.language === 'cs') !== (value.variety_scope === 'cs-CZ')) ctx.addIssue({ code: 'custom', message: 'Invalid language/variety scope' });
  if (new Set(value.refs.map((r) => `${r.relation}:${r.entity_id}`)).size !== value.refs.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate relationship' });
  if (value.kind === 'lesson' && !value.activities) ctx.addIssue({ code: 'custom', message: 'Lesson activity metadata required' });
  for (const [index, activity] of (value.activities ?? []).entries()) {
    if (activity.contract && (activity.contract.language !== value.language || activity.contract.content_version_id !== value.content_version_id))
      ctx.addIssue({ code: 'custom', path: ['activities', index, 'contract'], message: 'Executable activity is not pinned to lesson language/content version' });
  }
});
export type ContentPayload = z.infer<typeof contentSchema>;
export type ContentReference = z.infer<typeof referenceSchema>;
export const validatorVersion = 'p2-content-1.0.0';

export function validateContent(input: unknown): ContentPayload { return contentSchema.parse(input); }
