import { createHash } from 'node:crypto';
import type pg from 'pg';
import { executableLessonFixtureSchema } from '../../packages/content-tools/src/p3-fixture.js';
import { validateContent } from '../../packages/activity-schemas/src/content.js';
import type { ContentPayload } from '../../packages/activity-schemas/src/content.js';
import { ContractError } from '../../packages/domain/src/identity.js';
import { transaction } from './database.js';

/** Installs a versioned synthetic executable lesson without rewriting the P2 reference snapshot. */
export async function loadExecutableLessonFixture(pool: pg.Pool, authorId: string, raw: unknown) {
  const fixture = executableLessonFixtureSchema.parse(raw);
  const fixtureHash = createHash('sha256').update(JSON.stringify(fixture), 'utf8').digest('hex');
  return transaction(pool, async (db) => {
    await db.query('SELECT 1 FROM languages WHERE id=$1 FOR UPDATE', [fixture.language_id]);
    const prior = (await db.query('SELECT payload,checksum FROM content_versions WHERE id=$1', [fixture.content_version_id])).rows[0];
    if (prior) {
      if (prior.payload.body.p3_fixture_hash !== fixtureHash) throw new ContractError('CONFLICT', 'Executable fixture changed under an existing content version');
      if (!(await db.query('SELECT count(*) FROM content_versions WHERE id=ANY($1::uuid[])', [fixture.ancestor_versions.map((entry) => entry.content_version_id)])).rows[0]?.count ||
          Number((await db.query('SELECT count(*) FROM content_versions WHERE id=ANY($1::uuid[])', [fixture.ancestor_versions.map((entry) => entry.content_version_id)])).rows[0].count) !== fixture.ancestor_versions.length)
        throw new ContractError('CONFLICT', 'Executable fixture ancestor closure is incomplete');
      return { status: 'unchanged' as const, checksum: prior.checksum as string,
        version_ids: [fixture.content_version_id, ...fixture.ancestor_versions.map((entry) => entry.content_version_id)] };
    }
    if (!(await db.query(`SELECT p2_has_role($1,'content_editor') AS allowed`, [authorId])).rows[0]?.allowed)
      throw new ContractError('FORBIDDEN', 'Content editor required');
    const base = (await db.query(`SELECT cv.payload,e.stable_code,e.title,e.variety_scope FROM content_versions cv
      JOIN content_entities e ON e.id=cv.entity_id AND e.language_id=cv.language_id
      WHERE cv.id=$1 AND cv.entity_id=$2 AND cv.language_id=$3`, [fixture.base_content_version_id,fixture.lesson_id,fixture.language_id])).rows[0];
    if (!base) throw new ContractError('NOT_FOUND', 'Base lesson version not found');
    const activities = [] as NonNullable<ContentPayload['activities']>;
    for (const contract of fixture.activities) {
      const item = (await db.query(`SELECT e.stable_code,a.activity_type,a.response_modality FROM activity_items a
        JOIN content_entities e ON e.id=a.id AND e.language_id=a.language_id
        WHERE a.id=$1 AND a.lesson_id=$2 AND a.language_id=$3`, [contract.id,fixture.lesson_id,fixture.language_id])).rows[0];
      if (!item || item.stable_code !== contract.stable_code || item.activity_type !== contract.type)
        throw new ContractError('INVALID_INPUT', 'Executable fixture activity lineage/type mismatch');
      const maps = (await db.query(`SELECT m.knowledge_item_id,e.stable_code,m.role,m.skill,m.facet,m.evidence_weight
        FROM item_knowledge_map m JOIN content_entities e ON e.id=m.knowledge_item_id AND e.language_id=m.language_id
        WHERE m.item_id=$1 AND m.language_id=$2 ORDER BY m.knowledge_item_id,m.skill,m.facet`, [contract.id,fixture.language_id])).rows;
      activities.push({
        id: contract.id,
        stable_code: contract.stable_code,
        type: contract.type,
        response_modality: item.response_modality,
        completion_policy: contract.runtime.completion_policy,
        knowledge_refs: maps.map((map) => ({ knowledge_item_id: map.knowledge_item_id, stable_code: map.stable_code, role: map.role })),
        evidence_map: maps.map((map) => ({ skill: map.skill, facet: map.facet, weight: Number(map.evidence_weight) })),
        media_refs: [],
        contract,
      });
    }
    const payload: ContentPayload = {
      ...(base.payload as ContentPayload),
      content_version_id: fixture.content_version_id,
      version_code: fixture.version_code,
      title: base.title,
      variety_scope: base.variety_scope,
      body: { ...(base.payload.body as Record<string, unknown>), p3_fixture_hash: fixtureHash, p3_fixture_version: fixture.fixture_version },
      activities,
    };
    validateContent(payload);
    await db.query(`INSERT INTO content_versions(id,entity_id,language_id,version_code,schema_version,payload,source_kind,created_by)
      VALUES($1,$2,$3,$4,'1.7',$5,'imported',$6)`, [fixture.content_version_id,fixture.lesson_id,fixture.language_id,fixture.version_code,payload,authorId]);
    await db.query(`INSERT INTO content_version_refs(source_version_id,language_id,target_entity_id,target_version_id,relation)
      SELECT $1,language_id,target_entity_id,target_version_id,relation FROM content_version_refs WHERE source_version_id=$2`,
      [fixture.content_version_id,fixture.base_content_version_id]);
    let childEntityId = fixture.lesson_id; let childVersionId = fixture.content_version_id; let childVersionCode = fixture.version_code;
    for (const ancestor of fixture.ancestor_versions) {
      const source = (await db.query(`SELECT payload FROM content_versions WHERE id=$1 AND entity_id=$2 AND language_id=$3`,
        [ancestor.base_content_version_id,ancestor.entity_id,fixture.language_id])).rows[0];
      if (!source) throw new ContractError('NOT_FOUND', 'Executable fixture ancestor base version not found');
      const sourcePayload = source.payload as ContentPayload;
      let replaced = false;
      const refs = sourcePayload.refs.map((ref) => {
        if (ref.entity_id !== childEntityId) return ref;
        replaced = true;
        return { ...ref, content_version_id: childVersionId, version_code: childVersionCode };
      });
      if (!replaced) throw new ContractError('INVALID_INPUT', 'Executable fixture ancestor chain is not contiguous');
      const ancestorPayload: ContentPayload = { ...sourcePayload, content_version_id: ancestor.content_version_id,
        version_code: ancestor.version_code, refs,
        body: { ...(sourcePayload.body as Record<string, unknown>), p3_fixture_hash: fixtureHash, p3_fixture_version: fixture.fixture_version } };
      validateContent(ancestorPayload);
      await db.query(`INSERT INTO content_versions(id,entity_id,language_id,version_code,schema_version,payload,source_kind,created_by)
        VALUES($1,$2,$3,$4,'1.7',$5,'imported',$6)`, [ancestor.content_version_id,ancestor.entity_id,fixture.language_id,ancestor.version_code,ancestorPayload,authorId]);
      await db.query(`INSERT INTO content_version_refs(source_version_id,language_id,target_entity_id,target_version_id,relation)
        SELECT $1,language_id,target_entity_id,CASE WHEN target_entity_id=$2 THEN $3 ELSE target_version_id END,relation
        FROM content_version_refs WHERE source_version_id=$4`,
      [ancestor.content_version_id,childEntityId,childVersionId,ancestor.base_content_version_id]);
      childEntityId = ancestor.entity_id; childVersionId = ancestor.content_version_id; childVersionCode = ancestor.version_code;
    }
    const stored = (await db.query('SELECT checksum FROM content_versions WHERE id=$1', [fixture.content_version_id])).rows[0];
    return { status: 'loaded' as const, checksum: stored.checksum as string,
      version_ids: [fixture.content_version_id, ...fixture.ancestor_versions.map((entry) => entry.content_version_id)] };
  });
}
