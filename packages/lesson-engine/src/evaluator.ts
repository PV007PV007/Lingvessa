import type { ActivityContract, AnswerPolicy } from '../../activity-schemas/src/lesson.js';

export type ActivityResponse =
  | { kind: 'none' }
  | { kind: 'single'; option_id: string }
  | { kind: 'set'; option_ids: string[] }
  | { kind: 'mapping'; pairs: Array<{ left: string; right: string }> }
  | { kind: 'text'; text: string }
  | { kind: 'order'; option_ids: string[] };

export type EvaluationResult = {
  result: 'correct' | 'incorrect' | 'accepted';
  error_category: 'none' | 'selection' | 'mapping' | 'form' | 'order';
  normalized_response: unknown;
  feedback: string;
  evaluator_version: string;
  answer_policy_id: string;
  answer_policy_version: string;
};

export function normalizeAnswer(value: string, policy: AnswerPolicy['normalization']): string {
  let normalized = value.normalize('NFC');
  if (policy.apostrophe_equivalent) normalized = normalized.replace(/[‘’‛ʼ]/gu, "'");
  if (policy.collapse_whitespace) normalized = normalized.trim().replace(/\s+/gu, ' ');
  if (!policy.punctuation_sensitive) normalized = normalized.replace(/[.,!?;:…]+$/gu, '').trim();
  if (!policy.case_sensitive) normalized = normalized.toLocaleLowerCase(policy.locale);
  if (!policy.diacritics_sensitive) normalized = normalized.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
  return normalized;
}

const sorted = (values: readonly string[]) => [...values].sort((left, right) => left.localeCompare(right, 'en'));
const pairsKey = (pairs: ReadonlyArray<{ left: string; right: string }>) =>
  [...pairs].map((pair) => `${pair.left}\u0000${pair.right}`).sort().join('\u0001');

export function evaluateActivity(activity: ActivityContract, response: ActivityResponse): EvaluationResult {
  const policy = activity.response.answer_policy;
  if (policy.mode === 'exposure') {
    if (response.kind !== 'none') throw new TypeError('Exposure activity accepts only a continue response');
    return result(activity, 'accepted', 'none', null);
  }
  if (response.kind !== policy.mode) throw new TypeError('Response kind does not match the server-selected answer policy');
  let correct: boolean;
  let normalized: unknown;
  let category: EvaluationResult['error_category'];
  switch (policy.mode) {
    case 'single': {
      const value = (response as Extract<ActivityResponse, { kind: 'single' }>).option_id;
      normalized = value; category = 'selection'; correct = (policy.accepted_option_ids ?? []).includes(value); break;
    }
    case 'set': {
      const values = sorted((response as Extract<ActivityResponse, { kind: 'set' }>).option_ids);
      normalized = values; category = 'selection';
      correct = (policy.accepted_sets ?? []).some((candidate) => JSON.stringify(sorted(candidate)) === JSON.stringify(values)); break;
    }
    case 'mapping': {
      const values = (response as Extract<ActivityResponse, { kind: 'mapping' }>).pairs;
      normalized = [...values].sort((a, b) => `${a.left}:${a.right}`.localeCompare(`${b.left}:${b.right}`, 'en'));
      category = 'mapping'; correct = pairsKey(values) === pairsKey(policy.accepted_pairs ?? []); break;
    }
    case 'text': {
      const text = (response as Extract<ActivityResponse, { kind: 'text' }>).text;
      normalized = normalizeAnswer(text, policy.normalization); category = 'form';
      correct = (policy.accepted_text ?? []).some((candidate) => normalizeAnswer(candidate, policy.normalization) === normalized); break;
    }
    case 'order': {
      const values = (response as Extract<ActivityResponse, { kind: 'order' }>).option_ids;
      normalized = values; category = 'order'; correct = JSON.stringify(values) === JSON.stringify(policy.accepted_order ?? []); break;
    }
    default: throw new TypeError('Unsupported deterministic answer policy');
  }
  return result(activity, correct ? 'correct' : 'incorrect', correct ? 'none' : category, normalized);
}

function result(activity: ActivityContract, outcome: EvaluationResult['result'], category: EvaluationResult['error_category'], normalized: unknown): EvaluationResult {
  return {
    result: outcome,
    error_category: category,
    normalized_response: normalized,
    feedback: outcome === 'correct' ? activity.feedback.correct : outcome === 'incorrect' ? activity.feedback.incorrect : '',
    evaluator_version: activity.runtime.evaluator_version,
    answer_policy_id: activity.response.answer_policy.id,
    answer_policy_version: activity.response.answer_policy.version,
  };
}

/** Reject ambiguous authored options before a lesson can be loaded. */
export function validateEvaluationContract(activity: ActivityContract): void {
  const kind = activity.response.kind;
  const presented = kind === 'mapping' ? (activity.presentation.pairs ?? []).map(pair=>pair.left.id)
    : kind === 'order' ? (activity.presentation.tokens ?? []).map(token=>token.id)
    : ['single','set'].includes(kind) ? (activity.presentation.options ?? []).map(option=>option.id) : [];
  const recorded=activity.runtime.presentation_order;
  if (new Set(recorded).size !== recorded.length || JSON.stringify([...presented].sort())!==JSON.stringify([...recorded].sort()))
    throw new TypeError('Presentation order must be a complete permutation of response controls');
  const options = activity.presentation.options ?? [];
  const normalized = new Map<string, string>();
  for (const option of options) {
    const key = normalizeAnswer(option.label, activity.response.answer_policy.normalization);
    const prior = normalized.get(key);
    if (prior && prior !== option.id) throw new TypeError(`Ambiguous distractors ${prior}/${option.id}`);
    normalized.set(key, option.id);
  }
  if (activity.response.answer_policy.mode === 'mapping') {
    const pairs = activity.response.answer_policy.accepted_pairs ?? [];
    if (new Set(pairs.map((pair) => pair.left)).size !== pairs.length)
      throw new TypeError('Mapping has more than one accepted target for the same source');
  }
}
