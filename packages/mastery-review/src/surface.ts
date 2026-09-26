import type { ActivityContract } from '../../activity-schemas/src/lesson.js';

/** IDs, policy versions and presentation shuffle are not new learning surfaces. */
export function reviewSurface(activity: ActivityContract): string {
  const p = activity.presentation;
  const answer = activity.response.answer_policy;
  const labels = new Map([
    ...(p.options ?? []), ...(p.tokens ?? []),
    ...(p.pairs ?? []).flatMap(pair => [pair.left, pair.right]),
  ].map(option => [option.id, option.label]));
  const label = (id: string) => labels.get(id) ?? id;
  const normalize = (text: string) => text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
  const sorted = (values: string[]) => values.map(normalize).sort();
  return JSON.stringify({
    prompt: normalize(p.prompt), stimulus: normalize(p.stimulus ?? ''),
    transcript: normalize(p.accessibility.transcript ?? ''),
    steps: (p.steps ?? []).map(normalize), segments: (p.segments ?? []).map(s => normalize(s.text)),
    media: p.media_refs.map(m => `${m.asset_id}:${m.asset_version}`).sort(),
    mode: answer.mode,
    options: sorted((answer.accepted_option_ids ?? []).map(label)),
    sets: (answer.accepted_sets ?? []).map(set => sorted(set.map(label))).sort(),
    pairs: (answer.accepted_pairs ?? []).map(pair => [normalize(label(pair.left)), normalize(label(pair.right))]).sort(),
    text: sorted(answer.accepted_text ?? []),
    order: (answer.accepted_order ?? []).map(id => normalize(label(id))),
  });
}
