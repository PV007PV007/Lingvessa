import { z } from 'zod';
import { STABLE_CODE_PATTERN, UUID_PATTERN } from '../../domain/src/identity.js';
import { isSkillFacet } from './mastery.js';

const uuid = z.string().regex(UUID_PATTERN);
const stableCode = z.string().regex(STABLE_CODE_PATTERN);
const versionCode = z.string().min(1).max(80).refine((value) => !/[\s*]/u.test(value));

export const activityTypeSchema = z.enum([
  'scene_intro', 'vocabulary_intro', 'sentence_intro',
  'multiple_choice', 'image_choice', 'classification',
  'matching', 'pair_match',
  'gap_fill', 'word_builder', 'sentence_order',
  'full_typing', 'translation', 'writing',
  'listening_gist', 'listening_detail', 'reading', 'dictation',
  'dialogue_completion', 'dialogue_chain', 'role_play',
  'listen_repeat', 'read_aloud',
  'interactive_grammar', 'contrast', 'error_correction',
  'integrated_task', 'module_recap', 'optional_level_test',
  'result', 'remediation',
]);

export const normalizationPolicySchema = z.object({
  unicode: z.literal('NFC'),
  locale: z.enum(['en-GB', 'en-US', 'cs-CZ']),
  case_sensitive: z.boolean().default(false),
  collapse_whitespace: z.boolean().default(true),
  punctuation_sensitive: z.boolean().default(false),
  apostrophe_equivalent: z.boolean().default(false),
  diacritics_sensitive: z.boolean().default(true),
}).strict();

export const answerPolicySchema = z.object({
  id: stableCode,
  version: versionCode,
  mode: z.enum(['exposure', 'single', 'set', 'mapping', 'text', 'order']),
  accepted_option_ids: z.array(stableCode).optional(),
  accepted_sets: z.array(z.array(stableCode)).optional(),
  accepted_pairs: z.array(z.object({ left: stableCode, right: stableCode }).strict()).optional(),
  accepted_text: z.array(z.string().min(1).max(500)).optional(),
  accepted_order: z.array(stableCode).optional(),
  normalization: normalizationPolicySchema,
}).strict().superRefine((policy, ctx) => {
  const populated = {
    single: Boolean(policy.accepted_option_ids?.length),
    set: Boolean(policy.accepted_sets?.length),
    mapping: Boolean(policy.accepted_pairs?.length),
    text: Boolean(policy.accepted_text?.length),
    order: Boolean(policy.accepted_order?.length),
    exposure: true,
  } as const;
  if (!populated[policy.mode]) ctx.addIssue({ code: 'custom', message: `Answer policy ${policy.mode} has no accepted answer` });
  if (policy.normalization.locale === 'cs-CZ' && policy.mode === 'text' && !policy.normalization.diacritics_sensitive)
    ctx.addIssue({ code: 'custom', message: 'Czech form evaluation cannot strip diacritics globally' });
});

const optionSchema = z.object({
  id: stableCode,
  label: z.string().min(1).max(500),
  group: stableCode.optional(),
  accessibility_label: z.string().min(1).max(500).optional(),
}).strict();

export const activityContractSchema = z.object({
  schema_version: z.literal('1.7'),
  id: uuid,
  stable_code: stableCode,
  type: activityTypeSchema,
  language: z.enum(['en', 'cs']),
  variety: z.enum(['en-GB', 'en-US', 'cs-CZ']),
  cefr: z.literal('A1'),
  content_version_id: uuid,
  presentation: z.object({
    instruction_key: stableCode,
    prompt: z.string().min(1).max(2000),
    stimulus: z.string().max(4000).optional(),
    media_refs: z.array(z.object({asset_id:uuid,asset_stable_code:stableCode,asset_version:z.number().int().positive(),role:z.string().min(1)}).strict()).default([]),
    options: z.array(optionSchema).max(40).optional(),
    pairs: z.array(z.object({ left: optionSchema, right: optionSchema }).strict()).max(30).optional(),
    tokens: z.array(optionSchema).max(80).optional(),
    segments: z.array(z.object({ speaker: stableCode, text: z.string().min(1).max(2000), language: z.enum(['en', 'cs']) }).strict()).max(30).optional(),
    accessibility: z.object({
      keyboard_action: z.string().min(1),
      feedback_live_region: z.boolean(),
      transcript: z.string().max(8000).optional(),
    }).strict(),
  }).strict(),
  response: z.object({
    kind: z.enum(['none', 'single', 'set', 'mapping', 'text', 'order']),
    answer_policy: answerPolicySchema,
  }).strict(),
  feedback: z.object({
    correct: z.string().min(1).max(500),
    incorrect: z.string().min(1).max(500),
    reveal: z.string().min(1).max(1000),
    remediation: z.string().min(1).max(1000),
  }).strict(),
  learning: z.object({
    knowledge_refs: z.array(z.object({
      knowledge_item_id: uuid,
      stable_code: stableCode,
      role: z.enum(['teach', 'practice', 'assess']),
    }).strict()),
    outcome_refs: z.array(z.object({ outcome_id: uuid, stable_code: stableCode }).strict()),
    evidence_map: z.array(z.object({
      skill: z.string().min(1),
      facet: z.string().min(1),
      weight: z.number().positive().max(1),
    }).strict()),
    difficulty: z.number().min(0).max(1),
  }).strict(),
  runtime: z.object({
    completion_policy: z.enum(['exposure_v1', 'correct_or_reveal_v1', 'optional_speech_v1']),
    evaluator_version: versionCode,
    presentation_seed: z.string().min(1).max(128),
    presentation_order: z.array(stableCode).max(100),
    max_retries: z.number().int().min(0).max(10),
    auto_advance_allowed: z.boolean(),
    optional_ai: z.object({ capability: stableCode, deterministic_fallback: z.string().min(1) }).strict().optional(),
  }).strict(),
}).strict().superRefine((activity, ctx) => {
  if ((activity.language === 'cs') !== (activity.variety === 'cs-CZ'))
    ctx.addIssue({ code: 'custom', path: ['variety'], message: 'Activity language/variety mismatch' });
  if (activity.response.kind !== activity.response.answer_policy.mode && activity.response.answer_policy.mode !== 'exposure')
    ctx.addIssue({ code: 'custom', path: ['response'], message: 'Response kind and answer policy mode differ' });
  if (activity.response.kind === 'none' && activity.response.answer_policy.mode !== 'exposure')
    ctx.addIssue({ code: 'custom', path: ['response'], message: 'No-response activity must use exposure policy' });
  if (activity.runtime.completion_policy === 'correct_or_reveal_v1' && activity.response.answer_policy.mode === 'exposure')
    ctx.addIssue({ code: 'custom', path: ['runtime'], message: 'Scored activity requires an evaluable answer policy' });
  for (const [index, evidence] of activity.learning.evidence_map.entries()) {
    if (!isSkillFacet(evidence.skill, evidence.facet))
      ctx.addIssue({ code: 'custom', path: ['learning', 'evidence_map', index], message: 'Invalid canonical skill/facet pair' });
    if (['speaking', 'pronunciation'].includes(evidence.skill) && (activity.runtime.completion_policy !== 'optional_speech_v1' || !['listen_repeat','read_aloud'].includes(activity.type)))
      ctx.addIssue({ code: 'custom', path: ['learning', 'evidence_map', index], message: 'Speech evidence requires the optional speech contract' });
  }
  if(activity.response.answer_policy.mode === 'exposure' && activity.learning.evidence_map.length)
    ctx.addIssue({code:'custom',message:'Exposure cannot create performance evidence'});
  const identifiers = activity.presentation.options?.map((option) => option.id) ?? [];
  if (new Set(identifiers).size !== identifiers.length)
    ctx.addIssue({ code: 'custom', path: ['presentation', 'options'], message: 'Presentation option IDs must be unique' });
  const accepted = new Set(activity.response.answer_policy.accepted_option_ids ?? []);
  if (identifiers.length && [...accepted].some((id) => !identifiers.includes(id)))
    ctx.addIssue({ code: 'custom', path: ['response', 'answer_policy'], message: 'Accepted option is absent from presentation' });
});

export type ActivityContract = z.infer<typeof activityContractSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type AnswerPolicy = z.infer<typeof answerPolicySchema>;

export const lessonManifestSchema = z.object({
  schema_version: z.literal('1.7'),
  publication_id: uuid,
  publication_checksum: z.string().regex(/^[0-9a-f]{64}$/u),
  lesson_id: uuid,
  content_version_id: uuid,
  language_id: uuid,
  language: z.enum(['en', 'cs']),
  variety: z.enum(['en-GB', 'en-US', 'cs-CZ']),
  activities: z.array(activityContractSchema).min(1),
}).strict().superRefine((manifest, ctx) => {
  if ((manifest.language === 'cs') !== (manifest.variety === 'cs-CZ'))
    ctx.addIssue({ code: 'custom', path: ['variety'], message: 'Manifest language/variety mismatch' });
  for (const [index, activity] of manifest.activities.entries()) {
    if (activity.content_version_id !== manifest.content_version_id || activity.language !== manifest.language)
      ctx.addIssue({ code: 'custom', path: ['activities', index], message: 'Activity is not pinned to manifest language/content version' });
  }
  if (new Set(manifest.activities.map((activity) => activity.id)).size !== manifest.activities.length)
    ctx.addIssue({ code: 'custom', path: ['activities'], message: 'Duplicate activity identity' });
});

export type LessonManifest = z.infer<typeof lessonManifestSchema>;
