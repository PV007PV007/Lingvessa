import { z } from 'zod';
import { UUID_PATTERN } from '../../domain/src/identity.js';

const uuid = z.string().regex(UUID_PATTERN);
const stableCode = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);

export const startLessonRunSchema = z.object({
  language_profile_id: uuid,
  publication_id: uuid,
  lesson_id: uuid,
}).strict();

const activityResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('single'), option_id: stableCode }).strict(),
  z.object({ kind: z.literal('set'), option_ids: z.array(stableCode).min(1).max(80) }).strict(),
  z.object({ kind: z.literal('mapping'), pairs: z.array(z.object({ left: stableCode, right: stableCode }).strict()).min(1).max(80) }).strict(),
  z.object({ kind: z.literal('text'), text: z.string().max(4000) }).strict(),
  z.object({ kind: z.literal('order'), option_ids: z.array(stableCode).min(1).max(80) }).strict(),
]);

export const attemptCommandSchema = z.object({
  attempt_id: uuid,
  content_version_id: uuid,
  item_id: uuid,
  client_sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  intent: z.enum(['submit', 'reveal', 'continue']),
  response: activityResponseSchema,
  presentation: z.object({ seed: z.string().min(1).max(128), order: z.array(stableCode).max(100) }).strict(),
  assistance: z.object({ hint_count: z.number().int().min(0).max(20), reveal: z.boolean() }).strict(),
}).strict();

export const exitLessonRunSchema = z.object({
  expected_revision: z.number().int().positive(),
  acknowledge_unresolved: z.boolean(),
}).strict();

export type StartLessonRun = z.infer<typeof startLessonRunSchema>;
export type AttemptCommand = z.infer<typeof attemptCommandSchema>;
export type ExitLessonRun = z.infer<typeof exitLessonRunSchema>;

