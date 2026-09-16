import { z } from 'zod';
import { UUID_PATTERN } from '../../domain/src/identity.js';
import { activityContractSchema } from '../../activity-schemas/src/lesson.js';

const uuid = z.string().regex(UUID_PATTERN);

export const executableLessonFixtureSchema = z.object({
  fixture_version: z.literal('p3-executable-lesson-1'),
  source_document: z.string().min(1),
  language: z.enum(['en', 'cs']),
  language_id: uuid,
  lesson_id: uuid,
  base_content_version_id: uuid,
  content_version_id: uuid,
  version_code: z.string().min(1),
  ancestor_versions: z.array(z.object({
    entity_id: uuid,
    base_content_version_id: uuid,
    content_version_id: uuid,
    version_code: z.string().min(1),
  }).strict()).length(3),
  new_items: z.array(z.object({activity_id: uuid, content_version_id: uuid, version_code: z.string().min(1)}).strict()).default([]),
  activities: z.array(activityContractSchema).min(1),
}).strict().superRefine((fixture, ctx) => {
  for (const [index, activity] of fixture.activities.entries()) {
    if (activity.language !== fixture.language || activity.content_version_id !== fixture.content_version_id)
      ctx.addIssue({ code: 'custom', path: ['activities', index], message: 'Fixture activity does not share language/content version pin' });
  }
});

export type ExecutableLessonFixture = z.infer<typeof executableLessonFixtureSchema>;
