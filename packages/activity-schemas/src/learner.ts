import { z } from 'zod';
import { activityContractSchema, lessonManifestSchema } from './lesson.js';
import type { ActivityContract, LessonManifest } from './lesson.js';
import { UUID_PATTERN } from '../../domain/src/identity.js';
const uuid = z.string().regex(UUID_PATTERN);

/** Public presentation contract never exposes accepted answers or reveal feedback. */
export const learnerActivitySchema = z.object({
  schema_version: activityContractSchema.shape.schema_version,
  id: uuid, stable_code: activityContractSchema.shape.stable_code,
  type: activityContractSchema.shape.type, language: activityContractSchema.shape.language,
  variety: activityContractSchema.shape.variety, content_version_id: uuid,
  presentation: activityContractSchema.shape.presentation,
  response_kind: activityContractSchema.shape.response.shape.kind,
  runtime: activityContractSchema.shape.runtime,
}).strict();
export type LearnerActivity = z.infer<typeof learnerActivitySchema>;
export function learnerActivity(activity: ActivityContract): LearnerActivity {
  return learnerActivitySchema.parse({ schema_version: activity.schema_version, id: activity.id, stable_code: activity.stable_code,
    type: activity.type, language: activity.language, variety: activity.variety, content_version_id: activity.content_version_id,
    presentation: activity.presentation, response_kind: activity.response.kind, runtime: activity.runtime });
}
export const learnerManifestSchema = z.object({ ...lessonManifestSchema.shape, activities: z.array(learnerActivitySchema).min(1) }).strict();
export type LearnerManifest = z.infer<typeof learnerManifestSchema>;
export function learnerManifest(manifest: LessonManifest): LearnerManifest {
  return learnerManifestSchema.parse({ ...manifest, activities: manifest.activities.map(learnerActivity) });
}
export const runPositionSchema = z.object({ id: uuid, state: z.enum(['active','remediation','completed']), position: z.number().int().min(0),
  revision: z.number().int().positive(), current_activity_id: uuid.nullable(), unresolved_count: z.number().int().min(0), retry_available: z.boolean() }).strict();
export const learnerRunSchema = runPositionSchema.extend({ language_profile_id: uuid, language_id: uuid, publication_id: uuid, lesson_id: uuid,
  content_version_id: uuid, client_sequence: z.number().int().min(0), manifest: learnerManifestSchema }).strict();
export type LearnerRun = z.infer<typeof learnerRunSchema>;
export const attemptResultSchema = z.object({ attempt_id: uuid, outcome: z.enum(['correct','incorrect','assisted','accepted']),
  feedback: z.string(), evaluator_version: z.string(), answer_policy_version: z.string(), run: runPositionSchema, replayed: z.boolean() }).strict();
export const problemSchema = z.object({ type:z.string(),title:z.string(),status:z.number().int(),code:z.string(),detail_safe:z.string(),
  instance:z.string().optional(),correlation_id:uuid,field_errors:z.array(z.object({path:z.string(),code:z.string()})).optional() });
