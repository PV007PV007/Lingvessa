import { z } from 'zod';
import { UUID_PATTERN, STABLE_CODE_PATTERN } from '../../domain/src/identity.js';

// Content metadata only. No evaluator, renderer, score or mastery projection exists in P2.
export const skillFacetMatrix = {
  vocabulary: ['recognition', 'meaning', 'recall_l2_to_l1', 'recall_l1_to_l2', 'production', 'spelling', 'context_use', 'collocation', 'variant_awareness', 'register'],
  grammar: ['grammar_form', 'morphology', 'word_order', 'register', 'context_use'],
  listening: ['listening_recognition', 'listening_gist', 'listening_detail', 'meaning'],
  speaking: ['production', 'context_use', 'register', 'interaction_repair', 'interaction_goal', 'intelligibility'],
  writing: ['production', 'spelling', 'orthography', 'grammar_form', 'context_use', 'register'],
  pronunciation: ['pronunciation_target', 'intelligibility'],
} as const;
export type Skill = keyof typeof skillFacetMatrix;
export function isSkillFacet(skill: string, facet: string): boolean {
  return Object.entries(skillFacetMatrix).some(([key, facets]) => key === skill && (facets as readonly string[]).includes(facet));
}
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
}).strict().superRefine((a, ctx) => {
  for (const [index, map] of a.evidence_map.entries()) {
    if (!isSkillFacet(map.skill, map.facet)) ctx.addIssue({ code: 'custom', path: ['evidence_map', index], message: 'Invalid canonical skill/facet pair' });
    if (['speaking', 'pronunciation'].includes(map.skill) && a.response_modality !== 'speech')
      ctx.addIssue({ code: 'custom', path: ['evidence_map', index], message: 'Evaluable learner speech required; selection/typing/exposure is not Speaking evidence' });
  }
  if (a.evidence_map.length && (!a.knowledge_refs.length || a.response_modality === 'none'))
    ctx.addIssue({ code: 'custom', message: 'Evidence requires an assessable knowledge target' });
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
});
export type ContentPayload = z.infer<typeof contentSchema>;
export type ContentReference = z.infer<typeof referenceSchema>;
export const validatorVersion = 'p2-content-1.0.0';

export function validateContent(input: unknown): ContentPayload { return contentSchema.parse(input); }
