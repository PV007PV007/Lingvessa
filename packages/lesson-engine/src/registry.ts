import type { ActivityContract, ActivityType } from '../../activity-schemas/src/lesson.js';
import { activityContractSchema } from '../../activity-schemas/src/lesson.js';
import { evaluateActivity, validateEvaluationContract } from './evaluator.js';
import type { ActivityResponse, EvaluationResult } from './evaluator.js';

export type ActivityViewModel = {
  activity_id: string;
  type: ActivityType;
  family: string;
  primary_action: 'continue' | 'select' | 'match' | 'construct' | 'type' | 'listen' | 'dialogue' | 'remediate';
  instruction_key: string;
  prompt: string;
  stimulus?: string;
  options?: ActivityContract['presentation']['options'];
  pairs?: ActivityContract['presentation']['pairs'];
  tokens?: ActivityContract['presentation']['tokens'];
  segments?: ActivityContract['presentation']['segments'];
  accessibility: ActivityContract['presentation']['accessibility'];
};

export type ActivityAdapter = {
  readonly type: ActivityType;
  readonly schema_major: 1;
  readonly family: string;
  readonly fixture_languages: readonly ['en', 'cs'];
  readonly deferred_to_phase?: 'P5';
  render(activity: ActivityContract): ActivityViewModel;
  evaluate(activity: ActivityContract, response: ActivityResponse): EvaluationResult;
};

export type RegistryResolution =
  | { status: 'supported'; adapter: ActivityAdapter; activity: ActivityContract }
  | { status: 'recoverable_error'; code: 'UNSUPPORTED_ACTIVITY_CONTRACT'; detail: string };

const primaryActions: Record<string, ActivityViewModel['primary_action']> = {
  intro: 'continue', selection: 'select', mapping: 'match', construction: 'construct', production: 'type',
  receptive: 'listen', dialogue: 'dialogue', grammar: 'construct', assessment: 'construct', result: 'remediate', speech: 'listen',
};

const families: ReadonlyArray<{ family: string; types: readonly ActivityType[] }> = [
  { family: 'intro', types: ['scene_intro', 'vocabulary_intro', 'sentence_intro'] },
  { family: 'selection', types: ['multiple_choice', 'image_choice', 'classification'] },
  { family: 'mapping', types: ['matching', 'pair_match'] },
  { family: 'construction', types: ['gap_fill', 'word_builder', 'sentence_order'] },
  { family: 'production', types: ['full_typing', 'translation', 'writing'] },
  { family: 'receptive', types: ['listening_gist', 'listening_detail', 'reading', 'dictation'] },
  { family: 'dialogue', types: ['dialogue_completion', 'dialogue_chain', 'role_play'] },
  { family: 'speech', types: ['listen_repeat', 'read_aloud'] },
  { family: 'grammar', types: ['interactive_grammar', 'contrast', 'error_correction'] },
  { family: 'assessment', types: ['integrated_task', 'module_recap', 'optional_level_test'] },
  { family: 'result', types: ['result', 'remediation'] },
];

const registry = new Map<string, ActivityAdapter>();
for (const group of families) {
  for (const type of group.types) {
    const deferred = group.family === 'speech';
    const adapter: ActivityAdapter = {
      type,
      schema_major: 1,
      family: group.family,
      fixture_languages: ['en', 'cs'],
      ...(deferred ? { deferred_to_phase: 'P5' as const } : {}),
      render: (activity) => ({
        activity_id: activity.id,
        type: activity.type,
        family: group.family,
        primary_action: primaryActions[group.family]!,
        instruction_key: activity.presentation.instruction_key,
        prompt: activity.presentation.prompt,
        ...(activity.presentation.stimulus === undefined ? {} : { stimulus: activity.presentation.stimulus }),
        ...(activity.presentation.options === undefined ? {} : { options: activity.presentation.options }),
        ...(activity.presentation.pairs === undefined ? {} : { pairs: activity.presentation.pairs }),
        ...(activity.presentation.tokens === undefined ? {} : { tokens: activity.presentation.tokens }),
        ...(activity.presentation.segments === undefined ? {} : { segments: activity.presentation.segments }),
        accessibility: activity.presentation.accessibility,
      }),
      evaluate: (activity, response) => {
        if (deferred) throw new TypeError('Speech evaluation is unavailable until P5; use the deterministic text fallback declared by role_play');
        return evaluateActivity(activity, response);
      },
    };
    registry.set(`${type}@1`, adapter);
  }
}

export function resolveActivity(input: unknown): RegistryResolution {
  const parsed = activityContractSchema.safeParse(input);
  if (!parsed.success) return { status: 'recoverable_error', code: 'UNSUPPORTED_ACTIVITY_CONTRACT', detail: 'Activity contract failed schema validation' };
  const major = Number.parseInt(parsed.data.schema_version.split('.')[0]!, 10);
  const adapter = registry.get(`${parsed.data.type}@${major}`);
  if (!adapter) return { status: 'recoverable_error', code: 'UNSUPPORTED_ACTIVITY_CONTRACT', detail: `Unsupported ${parsed.data.type}@${major}` };
  try {
    validateEvaluationContract(parsed.data);
    const allowed: Record<string, readonly ActivityContract['response']['kind'][]> = {
      intro: ['none'], selection: ['single','set'], mapping: ['mapping'], construction: ['text','order'],
      production: ['text'], receptive: ['single','set','text'], dialogue: ['single','text'], speech: ['none'],
      grammar: ['single','text'], assessment: ['single','set','mapping','text','order'], result: ['none'],
    };
    if (!allowed[adapter.family]?.includes(parsed.data.response.kind)) throw new TypeError('Activity type uses an incompatible answer policy');
    if (parsed.data.type === 'role_play' && parsed.data.response.kind !== 'text') throw new TypeError('P3 role-play requires a deterministic text fallback');
  }
  catch { return { status: 'recoverable_error', code: 'UNSUPPORTED_ACTIVITY_CONTRACT', detail: 'Activity answer contract is ambiguous' }; }
  return { status: 'supported', adapter, activity: parsed.data };
}

export function registeredActivities(): ReadonlyArray<Pick<ActivityAdapter, 'type' | 'schema_major' | 'family' | 'fixture_languages' | 'deferred_to_phase'>> {
  return [...registry.values()].map(({ type, schema_major, family, fixture_languages, deferred_to_phase }) => ({
    type, schema_major, family, fixture_languages, ...(deferred_to_phase === undefined ? {} : { deferred_to_phase }),
  }));
}
