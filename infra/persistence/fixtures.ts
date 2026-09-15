import { createHash } from 'node:crypto';
import type pg from 'pg';
import { referenceFixtureSchema } from '../../packages/content-tools/src/fixture.js';
import { validateContent } from '../../packages/activity-schemas/src/content.js';
import type { ContentPayload } from '../../packages/activity-schemas/src/content.js';
import { transaction } from './database.js';
import { ContractError } from '../../packages/domain/src/identity.js';

/** Atomic, repeatable import. A changed fixture refuses overwrite; author a new content version. */
export async function loadReferenceFixture(pool: pg.Pool, authorId: string, input: unknown) {
  const fixture = referenceFixtureSchema.parse(input);
  const fileHash = createHash('sha256').update(JSON.stringify(fixture), 'utf8').digest('hex');
  return transaction(pool, async (db) => {
    // Serialize same-language imports, including first import.
    await db.query('SELECT 1 FROM languages WHERE id=$1 FOR UPDATE', [fixture.language_id]);
    const prior = (await db.query(`SELECT payload->>'fixture_hash' AS hash,payload->'version_checksums' AS checksums FROM audit_events
      WHERE action='content.reference_fixture_loaded' AND payload->>'language'=$1 ORDER BY occurred_at DESC LIMIT 1`, [fixture.language])).rows[0];
    if (prior) {
      if (prior.hash !== fileHash) throw new ContractError('CONFLICT', 'Changed fixture requires a new version; refusing to overwrite');
      for (const entity of fixture.entities) {
        const saved = (await db.query(`SELECT e.stable_code,v.checksum,v.payload FROM content_entities e JOIN content_versions v ON v.entity_id=e.id WHERE e.id=$1 AND v.id=$2`, [entity.id, entity.version_id])).rows[0];
        if (!saved || saved.stable_code !== entity.stable_code || saved.payload.body.fixture_hash !== fileHash || saved.checksum !== prior.checksums[entity.version_id])
          throw new ContractError('CONFLICT', 'Fixture integrity mismatch; refusing silent repair');
      }
      return { status: 'unchanged' as const, entities: fixture.entities.length };
    }
    if (!(await db.query('SELECT p2_has_role($1, $2) AS allowed', [authorId, 'content_editor'])).rows[0]?.allowed)
      throw new ContractError('FORBIDDEN', 'Content editor required');
    for (const e of fixture.entities) {
      await db.query('INSERT INTO content_entities(id,language_id,stable_code,kind,title,variety_scope) VALUES($1,$2,$3,$4,$5,$6)', [e.id, fixture.language_id, e.stable_code, e.kind, e.title, e.variety_scope]);
      const m = e.metadata; const values = [e.id, fixture.language_id];
      switch (e.kind) {
        case 'course': await db.query('INSERT INTO courses(id,language_id) VALUES($1,$2)', values); break;
        case 'level': await db.query('INSERT INTO levels(id,language_id,course_id,cefr,position) VALUES($1,$2,$3,$4,$5)', [...values, e.parent_id, m.cefr, m.position]); break;
        case 'module': await db.query('INSERT INTO modules(id,language_id,level_id,position) VALUES($1,$2,$3,$4)', [...values, e.parent_id, m.position]); break;
        case 'lesson': await db.query('INSERT INTO lessons(id,language_id,module_id,unit_kind,position) VALUES($1,$2,$3,$4,$5)', [...values, e.parent_id, m.unit_kind, m.position]); break;
        case 'activity': await db.query('INSERT INTO activity_items(id,language_id,lesson_id,activity_type,response_modality,position) VALUES($1,$2,$3,$4,$5,$6)', [...values, e.parent_id, m.activity_type, m.response_modality, m.position]); break;
        case 'knowledge': await db.query('INSERT INTO knowledge_items(id,language_id,knowledge_type,canonical_form,sense,cefr,learning_scope) VALUES($1,$2,$3,$4,$5,$6,$7)', [...values, m.knowledge_type, m.canonical_form, m.sense, m.cefr, m.learning_scope]); break;
        case 'outcome': await db.query('INSERT INTO outcomes(id,language_id,cefr,can_do,source_reference) VALUES($1,$2,$3,$4,$5)', [...values, m.cefr, m.can_do, m.source_reference]); break;
        case 'translation': throw new ContractError('INVALID_INPUT', 'Translations bind to a concrete content version');
      }
    }
    for (const map of fixture.evidence_maps) await db.query('INSERT INTO item_knowledge_map VALUES($1,$2,$3,$4,$5,$6,$7)', [map.item_id, map.knowledge_item_id, fixture.language_id, map.role, map.skill, map.facet, map.weight]);
    const outcome = fixture.entities.find((e) => e.kind === 'outcome');
    if (!outcome) throw new ContractError('INVALID_INPUT', 'Fixture outcome required');
    for (const itemId of new Set(fixture.evidence_maps.map((m) => m.item_id)))
      await db.query('INSERT INTO item_outcome_map(item_id,outcome_id,language_id) VALUES($1,$2,$3)', [itemId, outcome.id, fixture.language_id]);
    for (const e of fixture.knowledge_edges) await db.query('INSERT INTO knowledge_edges(id,language_id,from_id,to_id,edge_type,direction,weight,version_code,review_status,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [e.id, fixture.language_id, e.from_id, e.to_id, e.edge_type, e.direction, e.weight, e.version_code, e.review_status, e.provenance]);
    for (const e of fixture.entities) {
      const refs: ContentPayload['refs'] = fixture.entities.filter((child) => child.parent_id === e.id).map((child) => ({ relation: 'contains', entity_id: child.id, content_version_id: child.version_id, stable_code: child.stable_code, version_code: child.version_code }));
      if (e.kind === 'activity') {
        for (const k of fixture.entities.filter((k) => fixture.evidence_maps.some((m) => m.item_id === e.id && m.knowledge_item_id === k.id)))
          refs.push({ relation: 'knowledge', entity_id: k.id, content_version_id: k.version_id, stable_code: k.stable_code, version_code: k.version_code });
        refs.push({ relation: 'outcome', entity_id: outcome.id, content_version_id: outcome.version_id, stable_code: outcome.stable_code, version_code: outcome.version_code });
      }
      refs.sort((a, b) => `${a.relation}:${a.stable_code}` < `${b.relation}:${b.stable_code}` ? -1 : 1);
      const payload: ContentPayload = { schema_version: '1.7', entity_id: e.id, content_version_id: e.version_id, stable_code: e.stable_code, version_code: e.version_code,
        language: fixture.language, kind: e.kind, title: e.title, variety_scope: e.variety_scope, refs,
        body: { ...e.metadata, fixture_hash: fileHash, fixture_scope: fixture.scope } };
      if (e.kind === 'lesson') payload.activities = fixture.entities.filter((a) => a.kind === 'activity' && a.parent_id === e.id).map((a) => {
        const maps = fixture.evidence_maps.filter((m) => m.item_id === a.id);
        return { id: a.id, stable_code: a.stable_code, type: String(a.metadata.activity_type), response_modality: a.metadata.response_modality as 'selection' | 'speech',
          completion_policy: a.metadata.response_modality === 'speech' ? 'speech_binary_nonblocking_v1' : 'correct_or_reveal_v1',
          knowledge_refs: maps.map((m) => ({ knowledge_item_id: m.knowledge_item_id, stable_code: fixture.entities.find((k) => k.id === m.knowledge_item_id)!.stable_code, role: m.role })),
          evidence_map: maps.map((m) => ({ skill: m.skill, facet: m.facet, weight: m.weight })), media_refs: [] };
      });
      validateContent(payload);
      await db.query(`INSERT INTO content_versions(id,entity_id,language_id,version_code,schema_version,payload,source_kind,created_by)
        VALUES($1,$2,$3,$4,'1.7',$5,'imported',$6)`, [e.version_id, e.id, fixture.language_id, e.version_code, payload, authorId]);
    }
    for (const e of fixture.entities) {
      const payload = (await db.query('SELECT payload FROM content_versions WHERE id=$1', [e.version_id])).rows[0]?.payload as ContentPayload;
      for (const ref of payload.refs)
        await db.query('INSERT INTO content_version_refs(source_version_id,language_id,target_entity_id,target_version_id,relation) VALUES($1,$2,$3,$4,$5)', [e.version_id, fixture.language_id, ref.entity_id, ref.content_version_id, ref.relation]);
    }
    const versionChecksums = Object.fromEntries((await db.query('SELECT id,checksum FROM content_versions WHERE id=ANY($1::uuid[])', [fixture.entities.map((e) => e.version_id)])).rows.map((r) => [r.id, r.checksum]));
    await db.query(`INSERT INTO audit_events(actor_id,action,payload) VALUES($1,'content.reference_fixture_loaded',$2)`, [authorId, { language: fixture.language, fixture_hash: fileHash, version_checksums: versionChecksums }]);
    return { status: 'loaded' as const, entities: fixture.entities.length };
  });
}
