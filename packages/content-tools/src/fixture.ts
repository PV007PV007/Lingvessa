import { z } from 'zod';
import { entityKind, isSkillFacet } from '../../activity-schemas/src/content.js';
import { UUID_PATTERN, STABLE_CODE_PATTERN, languageIds } from '../../domain/src/identity.js';
const uuid = z.string().regex(UUID_PATTERN);
export const referenceFixtureSchema = z.object({
  fixture_version: z.literal('p2-reference-metadata-1'), source_document: z.string(), scope: z.string(),
  language: z.enum(['en', 'cs']), language_id: uuid,
  entities: z.array(z.object({ id: uuid, version_id: uuid, stable_code: z.string().regex(STABLE_CODE_PATTERN), version_code: z.string().min(1),
    kind: entityKind, title: z.string(), variety_scope: z.enum(['common', 'en-GB', 'en-US', 'cs-CZ']), parent_id: uuid.optional(), metadata: z.record(z.string(), z.unknown()) }).strict()),
  evidence_maps: z.array(z.object({ item_id: uuid, knowledge_item_id: uuid, role: z.enum(['teach', 'practice', 'assess']),
    skill: z.string(), facet: z.string(), weight: z.number().positive().max(1) }).strict()),
  knowledge_edges: z.array(z.object({ id: uuid, from_id: uuid, to_id: uuid, edge_type: z.enum(['prerequisite', 'contrast', 'component', 'variant', 'reuse', 'co_occurrence']),
    direction: z.enum(['directed', 'bidirectional']), weight: z.number().min(0).max(1), version_code: z.string(), review_status: z.enum(['draft', 'approved']), provenance: z.record(z.string(), z.unknown()) }).strict()),
}).strict().superRefine((fixture, ctx) => {
  if (fixture.language_id !== languageIds[fixture.language]) ctx.addIssue({ code: 'custom', message: 'Language ID mismatch' });
  for (const field of ['id', 'version_id', 'stable_code'] as const)
    if (new Set(fixture.entities.map((e) => e[field])).size !== fixture.entities.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${field}` });
  const entities = new Map(fixture.entities.map((e) => [e.id, e]));
  const parents: Record<string, string> = { level: 'course', module: 'level', lesson: 'module', activity: 'lesson' };
  for (const entity of fixture.entities) {
    if ((fixture.language === 'cs') !== (entity.variety_scope === 'cs-CZ')) ctx.addIssue({ code: 'custom', message: 'Cross-language variety' });
    if (parents[entity.kind] && entities.get(entity.parent_id ?? '')?.kind !== parents[entity.kind]) ctx.addIssue({ code: 'custom', message: 'Invalid hierarchy lineage' });
  }
  for (const map of fixture.evidence_maps) {
    const item = entities.get(map.item_id);
    if (item?.kind !== 'activity' || entities.get(map.knowledge_item_id)?.kind !== 'knowledge' || !isSkillFacet(map.skill, map.facet)) ctx.addIssue({ code: 'custom', message: 'Invalid knowledge/evidence map' });
    if (['speaking', 'pronunciation'].includes(map.skill) && item?.metadata.response_modality !== 'speech') ctx.addIssue({ code: 'custom', message: 'Speech mapping requires learner speech' });
  }
  for (const edge of fixture.knowledge_edges) if (entities.get(edge.from_id)?.kind !== 'knowledge' || entities.get(edge.to_id)?.kind !== 'knowledge' || edge.from_id === edge.to_id)
    ctx.addIssue({ code: 'custom', message: 'Invalid knowledge edge' });
});
export type ReferenceFixture = z.infer<typeof referenceFixtureSchema>;
