import { createHash } from 'node:crypto';
import type { AttemptCommand } from '../../activity-schemas/src/attempt.js';
export { attemptCommandSchema, startLessonRunSchema, exitLessonRunSchema } from '../../activity-schemas/src/attempt.js';
export type { AttemptCommand, StartLessonRun, ExitLessonRun } from '../../activity-schemas/src/attempt.js';

export const P3_VERSIONS = Object.freeze({
  content_schema: '1.7',
  mastery_model: 'unprojected-p3-v1',
  scheduler: 'unscheduled-p3-v1',
  outbox_event: 1,
});

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
}

export function semanticAttemptHash(runId: string, command: AttemptCommand): string {
  const response = command.response.kind === 'set'
    ? { ...command.response, option_ids: [...command.response.option_ids].sort() }
    : command.response.kind === 'mapping'
      ? { ...command.response, pairs: [...command.response.pairs].sort((a, b) => `${a.left}:${a.right}`.localeCompare(`${b.left}:${b.right}`, 'en')) }
      : command.response;
  return sha256({ run_id: runId, ...command, response });
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
