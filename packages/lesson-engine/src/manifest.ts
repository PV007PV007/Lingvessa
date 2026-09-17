import { lessonManifestSchema } from '../../activity-schemas/src/lesson.js';
import type { LessonManifest } from '../../activity-schemas/src/lesson.js';
import { resolveActivity } from './registry.js';

export type ManifestLoadResult =
  | { status: 'ready'; manifest: LessonManifest }
  | { status: 'recoverable_error'; code: 'INVALID_PINNED_MANIFEST' | 'UNSUPPORTED_ACTIVITY_CONTRACT'; correlation_id?: string };

export function loadPinnedManifest(input: unknown, correlationId?: string): ManifestLoadResult {
  const parsed = lessonManifestSchema.safeParse(input);
  if (!parsed.success) return { status: 'recoverable_error', code: 'INVALID_PINNED_MANIFEST', ...(correlationId ? { correlation_id: correlationId } : {}) };
  if (parsed.data.activities.some((activity) => resolveActivity(activity).status !== 'supported'))
    return { status: 'recoverable_error', code: 'UNSUPPORTED_ACTIVITY_CONTRACT', ...(correlationId ? { correlation_id: correlationId } : {}) };
  return { status: 'ready', manifest: parsed.data };
}
