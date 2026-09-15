import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ContractError, assertUuid } from '../../packages/domain/src/identity.js';
import { validateContent, validatorVersion } from '../../packages/activity-schemas/src/content.js';
import type { ContentPayload } from '../../packages/activity-schemas/src/content.js';
import type { ContentLookup } from '../../packages/application/src/content.js';
import { transaction } from './database.js';

export class ContentRepository implements ContentLookup {
  constructor(private readonly pool: pg.Pool) {}
  async resolve(languageId: string, stableCode: string, versionCode: string) {
    const result = await this.pool.query<{ entity_id: string; content_version_id: string }>(
      `SELECT e.id AS entity_id, v.id AS content_version_id FROM content_entities e
       JOIN content_versions v ON v.entity_id=e.id AND v.language_id=e.language_id
       WHERE e.language_id=$1 AND e.stable_code=$2 AND v.version_code=$3`, [languageId, stableCode, versionCode]);
    return result.rows[0] ?? null;
  }
  async saveDraft(actorId: string, languageId: string, input: unknown, expectedRevision?: number) {
    assertUuid(actorId); assertUuid(languageId);
    const payload = validateContent(input);
    return transaction(this.pool, async (db) => {
      if (!(await db.query('SELECT p2_has_role($1, $2) AS allowed', [actorId, 'content_editor'])).rows[0]?.allowed)
        throw new ContractError('FORBIDDEN', 'Content editor role required');
      const entity = await db.query(`SELECT e.*,l.stable_code AS language FROM content_entities e
        JOIN languages l ON l.id=e.language_id WHERE e.id=$1 AND e.language_id=$2`, [payload.entity_id, languageId]);
      const row = entity.rows[0];
      if (!row || row.stable_code !== payload.stable_code || row.kind !== payload.kind || row.language !== payload.language)
        throw new ContractError('INVALID_INPUT', 'Content identity and language must match the database');
      const prior = await db.query('SELECT * FROM content_versions WHERE id=$1 FOR UPDATE', [payload.content_version_id]);
      if (prior.rowCount) {
        if (expectedRevision === undefined || prior.rows[0].revision !== expectedRevision)
          throw new ContractError('CONFLICT', 'Draft revision changed');
        await db.query('UPDATE content_versions SET payload=$1 WHERE id=$2', [payload, payload.content_version_id]);
      } else {
        if (expectedRevision !== undefined) throw new ContractError('CONFLICT', 'Draft does not exist');
        await db.query(`INSERT INTO content_versions(id,entity_id,language_id,version_code,schema_version,payload,source_kind,created_by)
          VALUES($1,$2,$3,$4,$5,$6,'human',$7)`, [payload.content_version_id, payload.entity_id, languageId, payload.version_code, payload.schema_version, payload, actorId]);
      }
      await db.query('DELETE FROM content_version_refs WHERE source_version_id=$1', [payload.content_version_id]);
      for (const ref of payload.refs) await db.query(`INSERT INTO content_version_refs(source_version_id,language_id,target_entity_id,target_version_id,relation)
        VALUES($1,$2,$3,$4,$5)`, [payload.content_version_id, languageId, ref.entity_id, ref.content_version_id, ref.relation]);
      await db.query(`INSERT INTO audit_events(actor_id,action,target_id) VALUES($1,'content.draft_saved',$2)`, [actorId, payload.content_version_id]);
      return (await db.query('SELECT id,checksum,revision FROM content_versions WHERE id=$1', [payload.content_version_id])).rows[0] as { id: string; checksum: string; revision: number };
    });
  }
  async validateVersion(versionId: string) {
    assertUuid(versionId);
    return transaction(this.pool, async (db) => {
      const version = (await db.query('SELECT * FROM content_versions WHERE id=$1 FOR UPDATE', [versionId])).rows[0];
      if (!version) throw new ContractError('NOT_FOUND', 'Content version not found');
      const payload = validateContent(version.payload);
      await this.validateReferences(db, payload, version.language_id as string);
      const report = { schema: 'PASS', references: 'PASS', language: 'PASS', skill_facet: 'PASS', scope: 'P2 data validation; human/media/accessibility approvals remain separate' };
      await db.query(`INSERT INTO content_validations(id,content_version_id,target_checksum,target_revision,validator_version,passed,report)
        VALUES($1,$2,$3,$4,$5,true,$6)`, [randomUUID(), versionId, version.checksum, version.revision, validatorVersion, report]);
      return { ...report, checksum: version.checksum as string, revision: version.revision as number };
    });
  }
  private async validateReferences(db: pg.PoolClient, payload: ContentPayload, languageId: string) {
    for (const ref of payload.refs) {
      const target = (await db.query(`SELECT e.stable_code,v.version_code FROM content_entities e JOIN content_versions v ON v.entity_id=e.id
        WHERE e.id=$1 AND v.id=$2 AND e.language_id=$3 AND v.language_id=$3`, [ref.entity_id, ref.content_version_id, languageId])).rows[0];
      if (!target || target.stable_code !== ref.stable_code || target.version_code !== ref.version_code)
        throw new ContractError('INVALID_INPUT', 'Unresolved or cross-language reference');
    }
    for (const activity of payload.activities ?? []) {
      const item = (await db.query('SELECT response_modality,lesson_id FROM activity_items WHERE id=$1 AND language_id=$2', [activity.id, languageId])).rows[0];
      if (!item || item.lesson_id !== payload.entity_id || item.response_modality !== activity.response_modality)
        throw new ContractError('INVALID_INPUT', 'Activity lineage/modality mismatch');
      if (activity.evidence_map.length && !(await db.query('SELECT 1 FROM item_outcome_map WHERE item_id=$1 AND language_id=$2', [activity.id, languageId])).rowCount)
        throw new ContractError('INVALID_INPUT', 'Assessable item outcome required');
      for (const ref of activity.knowledge_refs) {
        const knowledge = (await db.query(`SELECT e.stable_code FROM knowledge_items k JOIN content_entities e ON e.id=k.id
          WHERE k.id=$1 AND k.language_id=$2`, [ref.knowledge_item_id, languageId])).rows[0];
        if (!knowledge || knowledge.stable_code !== ref.stable_code) throw new ContractError('INVALID_INPUT', 'Knowledge identity/language mismatch');
        for (const map of activity.evidence_map) {
          if (!(await db.query(`SELECT 1 FROM item_knowledge_map WHERE item_id=$1 AND knowledge_item_id=$2 AND language_id=$3
            AND role=$4 AND skill=$5 AND facet=$6 AND evidence_weight=$7`, [activity.id, ref.knowledge_item_id, languageId, ref.role, map.skill, map.facet, map.weight])).rowCount)
            throw new ContractError('INVALID_INPUT', 'Evidence map differs from relational mapping');
        }
      }
      // Actual asset resolution belongs to P5. P2 cannot certify media-bearing publications.
      if (activity.media_refs.length) throw new ContractError('INVALID_INPUT', 'Concrete asset validation requires the P5 media foundation');
    }
  }
  async approve(actorId: string, versionId: string, checksum: string, revision: number, gate: string, decision: 'approved' | 'rejected', notes: string) {
    assertUuid(actorId); assertUuid(versionId);
    if (!notes.trim()) throw new ContractError('INVALID_INPUT', 'Explicit review notes required');
    const id = randomUUID();
    await this.pool.query(`INSERT INTO approvals(id,target_content_version_id,target_checksum,target_revision,gate_type,reviewer_id,decision,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, versionId, checksum, revision, gate, actorId, decision, notes]);
    return id;
  }
  /** Transactional data foundation, not the P8 Admin UI or a worker/AI publication endpoint. */
  async publish(input: { id: string; actorId: string; courseId: string; languageId: string; channel: 'test' | 'preview' | 'stable'; versionCode: string; versionIds: string[]; previousId?: string }) {
    for (const value of [input.id, input.actorId, input.courseId, input.languageId, ...input.versionIds]) assertUuid(value);
    return transaction(this.pool, async (db) => {
      // P2 fixtures are test/preview only. Production workflow and media gates are owned by P8/P13.
      if (input.channel === 'stable') throw new ContractError('FORBIDDEN', 'Stable release requires the later release gates');
      await db.query(`INSERT INTO publications(id,course_id,language_id,channel,version_code,schema_version,manifest,previous_publication_id,published_by)
        VALUES($1,$2,$3,$4,$5,'1.7','{}',$6,$7)`, [input.id, input.courseId, input.languageId, input.channel, input.versionCode, input.previousId ?? null, input.actorId]);
      for (const id of input.versionIds) {
        const v = (await db.query('SELECT * FROM content_versions WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!v) throw new ContractError('NOT_FOUND', 'Publication version not found');
        await db.query(`INSERT INTO publication_entries(publication_id,entity_id,content_version_id,language_id,content_checksum)
          VALUES($1,$2,$3,$4,$5)`, [input.id, v.entity_id, id, input.languageId, v.checksum]);
      }
      const entries = (await db.query(`SELECT e.entity_id,e.content_version_id,ce.stable_code,cv.version_code,cv.checksum
        FROM publication_entries e JOIN content_versions cv ON cv.id=e.content_version_id JOIN content_entities ce ON ce.id=e.entity_id
        WHERE e.publication_id=$1 ORDER BY ce.stable_code COLLATE "C"`, [input.id])).rows;
      const translations = (await db.query(`SELECT t.id AS translation_id,t.content_version_id,t.locale,t.version_code,t.checksum
        FROM translations t JOIN publication_entries e ON e.content_version_id=t.content_version_id WHERE e.publication_id=$1 ORDER BY t.id`, [input.id])).rows;
      const manifest = { publication_id: input.id, course_id: input.courseId, language_id: input.languageId, schema_version: '1.7', entries, translations, assets: [] };
      await db.query(`UPDATE publications SET manifest=$1,status='published',published_at=now() WHERE id=$2`, [manifest, input.id]);
      return (await db.query('SELECT id,checksum,manifest FROM publications WHERE id=$1', [input.id])).rows[0] as { id: string; checksum: string; manifest: unknown };
    });
  }
  async activate(actorId: string, publicationId: string, expectedRevision: number | null) {
    assertUuid(actorId); assertUuid(publicationId);
    return transaction(this.pool, async (db) => {
      const p = (await db.query('SELECT * FROM publications WHERE id=$1', [publicationId])).rows[0];
      if (!p) throw new ContractError('NOT_FOUND', 'Publication not found');
      // A stable per-course lock serializes first activation and concurrent rollback.
      await db.query('SELECT 1 FROM courses WHERE id=$1 FOR UPDATE', [p.course_id]);
      const prior = (await db.query('SELECT revision FROM publication_pointers WHERE course_id=$1 AND channel=$2 FOR UPDATE', [p.course_id, p.channel])).rows[0];
      if ((prior?.revision ?? null) !== expectedRevision) throw new ContractError('CONFLICT', 'Publication pointer changed');
      if (prior) await db.query(`UPDATE publication_pointers SET publication_id=$1,updated_by=$2 WHERE course_id=$3 AND channel=$4`, [publicationId, actorId, p.course_id, p.channel]);
      else await db.query(`INSERT INTO publication_pointers(course_id,language_id,channel,publication_id,updated_by) VALUES($1,$2,$3,$4,$5)`, [p.course_id, p.language_id, p.channel, publicationId, actorId]);
      return (await db.query('SELECT revision FROM publication_pointers WHERE course_id=$1 AND channel=$2', [p.course_id, p.channel])).rows[0]?.revision as number;
    });
  }
  async catalog(languageId: string, channel = 'stable') {
    assertUuid(languageId);
    return (await this.pool.query(`SELECT p.id,p.version_code,p.checksum,p.manifest FROM publication_pointers x
      JOIN publications p ON p.id=x.publication_id AND p.language_id=x.language_id
      WHERE x.language_id=$1 AND x.channel=$2 AND p.status='published' ORDER BY p.course_id`, [languageId, channel])).rows;
  }
}
