import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { attemptCommandSchema, exitLessonRunSchema, P3_VERSIONS, semanticAttemptHash, sha256, startLessonRunSchema } from '../../packages/application/src/lesson.js';
import type { AttemptCommand, ExitLessonRun, StartLessonRun } from '../../packages/application/src/lesson.js';
import { lessonManifestSchema } from '../../packages/activity-schemas/src/lesson.js';
import type { ActivityContract, LessonManifest } from '../../packages/activity-schemas/src/lesson.js';
import { ContractError, assertUuid } from '../../packages/domain/src/identity.js';
import { evaluateActivity } from '../../packages/lesson-engine/src/evaluator.js';
import type { ActivityResponse, EvaluationResult } from '../../packages/lesson-engine/src/evaluator.js';
import { loadPinnedManifest, resolveActivity } from '../../packages/lesson-engine/src/index.js';
import { transaction } from './database.js';

type RunRow = {
  id: string; user_id: string; language_profile_id: string; language_id: string; variant_id: string;
  publication_id: string; lesson_id: string; content_version_id: string; manifest: LessonManifest;
  state: 'active' | 'remediation' | 'completed'; position: number; client_sequence: string | number; revision: number;
};

export type RunView = {
  id: string;
  language_profile_id: string;
  language_id: string;
  publication_id: string;
  lesson_id: string;
  content_version_id: string;
  state: RunRow['state'];
  position: number;
  client_sequence: number;
  revision: number;
  current_activity_id: string | null;
  unresolved_count: number;
  manifest: LessonManifest;
};

export type AttemptView = {
  attempt_id: string;
  outcome: 'correct' | 'incorrect' | 'assisted' | 'unscored';
  feedback: string;
  evaluator_version: string;
  answer_policy_version: string;
  run: Omit<RunView, 'manifest' | 'language_profile_id' | 'language_id' | 'publication_id' | 'lesson_id' | 'content_version_id' | 'client_sequence'>;
  replayed: boolean;
};

export class LessonRepository {
  constructor(private readonly pool: pg.Pool) {}

  async start(userId: string, raw: unknown): Promise<RunView> {
    assertUuid(userId); const input = startLessonRunSchema.parse(raw) as StartLessonRun;
    return transaction(this.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`start:${userId}:${input.language_profile_id}:${input.publication_id}:${input.lesson_id}`]);
      const existing = (await db.query(`SELECT * FROM lesson_runs WHERE user_id=$1 AND language_profile_id=$2 AND publication_id=$3 AND lesson_id=$4 AND state<>'completed'`,
        [userId, input.language_profile_id, input.publication_id, input.lesson_id])).rows[0] as RunRow | undefined;
      if (existing) return this.runView(db, existing);

      const source = (await db.query(`SELECT p.id AS publication_id,p.checksum AS publication_checksum,p.language_id,p.status,
          e.content_version_id,e.content_checksum,cv.payload,cv.checksum AS live_content_checksum,
          lp.variant_id,l.stable_code AS language,v.code AS variety
        FROM publications p
        JOIN publication_entries e ON e.publication_id=p.id AND e.language_id=p.language_id
        JOIN content_versions cv ON cv.id=e.content_version_id AND cv.entity_id=e.entity_id AND cv.language_id=e.language_id
        JOIN language_profiles lp ON lp.id=$1 AND lp.user_id=$2 AND lp.language_id=p.language_id
        JOIN languages l ON l.id=p.language_id
        JOIN variants v ON v.id=lp.variant_id AND v.language_id=lp.language_id
        WHERE p.id=$3 AND e.entity_id=$4`, [input.language_profile_id, userId, input.publication_id, input.lesson_id])).rows[0];
      if (!source) throw new ContractError('NOT_FOUND', 'Published lesson is unavailable for this language profile');
      if (source.status !== 'published' || source.content_checksum !== source.live_content_checksum)
        throw new ContractError('CONFLICT', 'Publication pin failed integrity validation');
      const payload = source.payload as { schema_version?: string; activities?: Array<{ contract?: unknown }> };
      const activities = (payload.activities ?? []).map((activity) => activity.contract).filter((activity) => activity !== undefined);
      if (!activities.length || activities.length !== payload.activities?.length)
        throw new ContractError('UNSUPPORTED_CONTRACT', 'Published lesson has no complete executable activity contracts');
      const manifest = lessonManifestSchema.parse({
        schema_version: payload.schema_version,
        publication_id: source.publication_id,
        publication_checksum: source.publication_checksum,
        lesson_id: input.lesson_id,
        content_version_id: source.content_version_id,
        language_id: source.language_id,
        language: source.language,
        variety: source.variety,
        activities,
      });
      const loaded = loadPinnedManifest(manifest);
      if (loaded.status !== 'ready' || loaded.manifest.activities.some((activity) => {
        const resolved = resolveActivity(activity);
        return resolved.status !== 'supported' || Boolean(resolved.adapter.deferred_to_phase);
      }))
        throw new ContractError('UNSUPPORTED_CONTRACT', 'Published activity contract is not executable in P3');
      const id = randomUUID();
      await db.query(`INSERT INTO lesson_runs(id,user_id,language_profile_id,language_id,variant_id,publication_id,publication_checksum,
        lesson_id,content_version_id,content_checksum,manifest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id,userId,input.language_profile_id,source.language_id,source.variant_id,input.publication_id,source.publication_checksum,input.lesson_id,source.content_version_id,source.content_checksum,manifest]);
      for (const [ordinal, activity] of manifest.activities.entries()) {
        await db.query(`INSERT INTO lesson_run_items(lesson_run_id,user_id,language_profile_id,language_id,lesson_id,item_id,ordinal,state)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id,userId,input.language_profile_id,source.language_id,input.lesson_id,activity.id,ordinal,ordinal === 0 ? 'active' : 'pending']);
      }
      await this.writeOutbox(db, {
        eventType: 'lesson.run.started', aggregateId: id, correlationId: id, causationId: id,
        profileId: input.language_profile_id, languageId: source.language_id,
        payload: { run_id: id, publication_id: input.publication_id, content_version_id: source.content_version_id, schema_version: '1.7' },
      });
      return this.runView(db, (await db.query('SELECT * FROM lesson_runs WHERE id=$1', [id])).rows[0] as RunRow);
    });
  }

  async list(userId: string, profileId: string): Promise<RunView[]> {
    assertUuid(userId); assertUuid(profileId);
    return transaction(this.pool, async (db) => {
      const rows = (await db.query(`SELECT * FROM lesson_runs WHERE user_id=$1 AND language_profile_id=$2 ORDER BY updated_at DESC,id`, [userId, profileId])).rows as RunRow[];
      return Promise.all(rows.map((row) => this.runView(db, row)));
    });
  }

  async get(userId: string, runId: string): Promise<RunView> {
    assertUuid(userId); assertUuid(runId);
    return transaction(this.pool, async (db) => {
      const row = (await db.query('SELECT * FROM lesson_runs WHERE id=$1 AND user_id=$2', [runId, userId])).rows[0] as RunRow | undefined;
      if (!row) throw new ContractError('NOT_FOUND', 'Lesson run not found');
      return this.runView(db, row);
    });
  }

  async submit(userId: string, runId: string, raw: unknown, fault?: 'after_attempt'): Promise<AttemptView> {
    assertUuid(userId); assertUuid(runId); const command = attemptCommandSchema.parse(raw) as AttemptCommand;
    const requestHash = semanticAttemptHash(runId, command);
    return transaction(this.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`attempt:${userId}:${command.attempt_id}`]);
      const prior = (await db.query('SELECT * FROM activity_attempts WHERE user_id=$1 AND attempt_id=$2', [userId, command.attempt_id])).rows[0];
      if (prior) {
        if (prior.request_hash !== requestHash) throw new ContractError('CONFLICT', 'Attempt ID already has a different semantic payload');
        const receipt = (await db.query('SELECT result FROM attempt_receipts WHERE user_id=$1 AND attempt_id=$2', [userId, command.attempt_id])).rows[0];
        if (!receipt) throw new ContractError('SERVICE_UNAVAILABLE', 'Accepted attempt receipt is unavailable');
        return { ...(receipt.result as AttemptView), replayed: true };
      }
      const run = (await db.query('SELECT * FROM lesson_runs WHERE id=$1 AND user_id=$2 FOR UPDATE', [runId, userId])).rows[0] as RunRow | undefined;
      if (!run) throw new ContractError('NOT_FOUND', 'Lesson run not found');
      if (run.state === 'completed') throw new ContractError('CONFLICT', 'Lesson run is already completed');
      if (command.client_sequence !== Number(run.client_sequence) + 1) throw new ContractError('VERSION_CONFLICT', 'Client sequence differs from authoritative run');
      if (command.content_version_id !== run.content_version_id) throw new ContractError('VERSION_CONFLICT', 'Attempt content version differs from pinned run');
      const item = (await db.query(`SELECT * FROM lesson_run_items WHERE lesson_run_id=$1 AND item_id=$2 FOR UPDATE`, [runId, command.item_id])).rows[0];
      if (!item || item.ordinal !== run.position) throw new ContractError('VERSION_CONFLICT', 'Attempt item differs from authoritative lesson position');
      const activity = run.manifest.activities[run.position];
      if (!activity || activity.id !== command.item_id) throw new ContractError('VERSION_CONFLICT', 'Pinned manifest position is inconsistent');
      this.validateCommand(activity, command);
      const evaluation = this.evaluate(activity, command);
      const outcome = command.intent === 'reveal' || (item.revealed && evaluation.result === 'correct') ? 'assisted' : evaluation.result;
      const feedback = command.intent === 'reveal' ? activity.feedback.reveal : evaluation.feedback;
      const assistance = { hint_count: 0, reveal: command.intent === 'reveal', prior_reveal: Boolean(item.revealed), prior_attempts: Number(item.attempt_count) };
      await db.query(`INSERT INTO activity_attempts(user_id,attempt_id,lesson_run_id,language_profile_id,language_id,publication_id,lesson_id,item_id,
        content_version_id,client_sequence,request_hash,response,response_hash,presentation,assistance,intent,outcome,error_category,feedback,
        content_schema_version,evaluator_version,answer_policy_id,answer_policy_version,mastery_model_version,scheduler_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [userId,command.attempt_id,runId,run.language_profile_id,run.language_id,run.publication_id,run.lesson_id,command.item_id,run.content_version_id,
        command.client_sequence,requestHash,command.response,sha256(command.response),command.presentation,assistance,command.intent,outcome,evaluation.error_category,
        feedback,P3_VERSIONS.content_schema,evaluation.evaluator_version,evaluation.answer_policy_id,evaluation.answer_policy_version,P3_VERSIONS.mastery_model,P3_VERSIONS.scheduler]);
      if (fault === 'after_attempt') throw new Error('P3_FAULT_AFTER_ATTEMPT');
      if (outcome !== 'unscored') {
        const mappings = activity.learning.knowledge_refs.flatMap((knowledge) => activity.learning.evidence_map.map((entry) => ({
          knowledge_item_id: knowledge.knowledge_item_id, skill: entry.skill, facet: entry.facet, evidence_weight: entry.weight,
        })));
        for (const mapping of mappings) {
          const resultClass = outcome === 'correct' ? 'positive' : outcome === 'incorrect' ? 'negative' : 'assisted';
          await db.query(`INSERT INTO evidence_events(user_id,attempt_id,language_profile_id,language_id,item_id,knowledge_item_id,skill,facet,
            result_class,assisted,base_weight,effective_weight,content_version_id,content_schema_version,evaluator_version,mastery_model_version,scheduler_version)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [userId,command.attempt_id,run.language_profile_id,run.language_id,command.item_id,mapping.knowledge_item_id,mapping.skill,mapping.facet,
            resultClass,outcome === 'assisted',mapping.evidence_weight,outcome === 'assisted' ? 0 : mapping.evidence_weight,run.content_version_id,
            P3_VERSIONS.content_schema,evaluation.evaluator_version,P3_VERSIONS.mastery_model,P3_VERSIONS.scheduler]);
        }
      }
      const next = await this.advance(db, run, item, command.attempt_id, outcome, evaluation.result === 'correct' && command.intent !== 'reveal');
      const accepted = (await db.query('SELECT * FROM activity_attempts WHERE user_id=$1 AND attempt_id=$2', [userId, command.attempt_id])).rows[0];
      const receipt = await this.attemptView(db, accepted, next, false);
      await db.query('INSERT INTO attempt_receipts(user_id,attempt_id,result) VALUES($1,$2,$3)', [userId,command.attempt_id,receipt]);
      await this.writeOutbox(db, {
        eventType: 'learning.attempt.accepted', aggregateId: command.attempt_id, correlationId: command.attempt_id, causationId: command.attempt_id,
        profileId: run.language_profile_id, languageId: run.language_id,
        payload: { attempt_id: command.attempt_id, run_id: runId, item_id: command.item_id, outcome,
          content_version_id: run.content_version_id, content_schema_version: P3_VERSIONS.content_schema,
          evaluator_version: evaluation.evaluator_version, mastery_model_version: P3_VERSIONS.mastery_model, scheduler_version: P3_VERSIONS.scheduler },
      });
      return receipt;
    });
  }

  async exit(userId: string, runId: string, raw: unknown): Promise<RunView> {
    assertUuid(userId); assertUuid(runId); const input = exitLessonRunSchema.parse(raw) as ExitLessonRun;
    return transaction(this.pool, async (db) => {
      const run = (await db.query('SELECT * FROM lesson_runs WHERE id=$1 AND user_id=$2 FOR UPDATE', [runId, userId])).rows[0] as RunRow | undefined;
      if (!run) throw new ContractError('NOT_FOUND', 'Lesson run not found');
      if (run.revision !== input.expected_revision) throw new ContractError('VERSION_CONFLICT', 'Lesson run revision changed');
      if (run.state === 'active') throw new ContractError('CONFLICT', 'Complete the scored lesson path before exiting remediation');
      const unresolved = Number((await db.query('SELECT count(*) FROM lesson_run_items WHERE lesson_run_id=$1 AND needs_remediation', [runId])).rows[0].count);
      if (unresolved && !input.acknowledge_unresolved) throw new ContractError('CONFLICT', 'Explicit unresolved-mistake acknowledgement required');
      if (run.state !== 'completed') await db.query(`UPDATE lesson_runs SET state='completed',completed_at=now(),revision=revision+1 WHERE id=$1`, [runId]);
      await this.writeOutbox(db, { eventType: 'lesson.run.completed', aggregateId: runId, correlationId: runId, causationId: runId,
        profileId: run.language_profile_id, languageId: run.language_id, payload: { run_id: runId, unresolved_count: unresolved, reason: unresolved ? 'learner_exit_acknowledged' : 'all_items_resolved' } });
      return this.runView(db, (await db.query('SELECT * FROM lesson_runs WHERE id=$1', [runId])).rows[0] as RunRow);
    });
  }

  private validateCommand(activity: ActivityContract, command: AttemptCommand): void {
    if (command.presentation.seed !== activity.runtime.presentation_seed || JSON.stringify(command.presentation.order) !== JSON.stringify(activity.runtime.presentation_order))
      throw new ContractError('VERSION_CONFLICT', 'Presentation seed/order differs from pinned activity');
    if (command.assistance.hint_count !== 0 || command.assistance.reveal !== (command.intent === 'reveal'))
      throw new ContractError('INVALID_INPUT', 'Assistance is server-authoritative in P3');
    const exposure = activity.response.answer_policy.mode === 'exposure';
    if (exposure !== (command.intent === 'continue') || (exposure && command.response.kind !== 'none'))
      throw new ContractError('INVALID_INPUT', exposure ? 'Exposure requires continue' : 'Scored activity requires submit or reveal');
    if (!exposure && !['submit','reveal'].includes(command.intent)) throw new ContractError('INVALID_INPUT', 'Invalid scored activity intent');
    if (command.intent === 'reveal' && command.response.kind !== 'none') throw new ContractError('INVALID_INPUT', 'Reveal does not accept a fabricated answer');
  }

  private evaluate(activity: ActivityContract, command: AttemptCommand): EvaluationResult {
    const resolution = resolveActivity(activity);
    if (resolution.status !== 'supported' || resolution.adapter.deferred_to_phase)
      throw new ContractError('UNSUPPORTED_CONTRACT', 'Activity evaluator is unavailable in P3');
    if (command.intent === 'reveal') return { result: 'incorrect', error_category: 'none', normalized_response: null,
      feedback: activity.feedback.reveal, evaluator_version: activity.runtime.evaluator_version,
      answer_policy_id: activity.response.answer_policy.id, answer_policy_version: activity.response.answer_policy.version };
    try { return evaluateActivity(activity, command.response as ActivityResponse); }
    catch { throw new ContractError('INVALID_INPUT', 'Response does not match the server-selected answer policy'); }
  }

  private async advance(db: pg.PoolClient, run: RunRow, item: { item_id: string; ordinal: number }, attemptId: string, outcome: AttemptView['outcome'], resolved: boolean): Promise<RunRow> {
    if (outcome === 'incorrect') {
      await db.query(`UPDATE lesson_run_items SET state='incorrect',attempt_count=attempt_count+1,needs_remediation=true,last_attempt_id=$1,updated_at=now()
        WHERE lesson_run_id=$2 AND item_id=$3`, [attemptId,run.id,item.item_id]);
      await db.query(`UPDATE lesson_runs SET client_sequence=client_sequence+1,revision=revision+1 WHERE id=$1`, [run.id]);
      return (await db.query('SELECT * FROM lesson_runs WHERE id=$1', [run.id])).rows[0] as RunRow;
    }
    const assisted = outcome === 'assisted';
    await db.query(`UPDATE lesson_run_items SET state=$1,attempt_count=attempt_count+1,revealed=revealed OR $2,needs_remediation=$6,last_attempt_id=$3,updated_at=now()
      WHERE lesson_run_id=$4 AND item_id=$5`, [assisted ? 'assisted' : 'completed',assisted,attemptId,run.id,item.item_id,assisted && !resolved]);
    let next = run.state === 'active'
      ? (await db.query(`SELECT * FROM lesson_run_items WHERE lesson_run_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 1 FOR UPDATE`, [run.id,item.ordinal])).rows[0]
      : (await db.query(`SELECT * FROM lesson_run_items WHERE lesson_run_id=$1 AND needs_remediation AND item_id<>$2 ORDER BY ordinal LIMIT 1 FOR UPDATE`, [run.id,item.item_id])).rows[0];
    if (!next) next = (await db.query(`SELECT * FROM lesson_run_items WHERE lesson_run_id=$1 AND needs_remediation ORDER BY ordinal LIMIT 1 FOR UPDATE`, [run.id])).rows[0];
    if (next) {
      await db.query(`UPDATE lesson_run_items SET state='active',updated_at=now() WHERE lesson_run_id=$1 AND item_id=$2`, [run.id,next.item_id]);
      await db.query(`UPDATE lesson_runs SET state=$1,position=$2,client_sequence=client_sequence+1,revision=revision+1 WHERE id=$3`,
        [run.state === 'active' && next.ordinal > item.ordinal ? 'active' : 'remediation',next.ordinal,run.id]);
    } else {
      await db.query(`UPDATE lesson_runs SET state='completed',completed_at=now(),client_sequence=client_sequence+1,revision=revision+1 WHERE id=$1`, [run.id]);
    }
    return (await db.query('SELECT * FROM lesson_runs WHERE id=$1', [run.id])).rows[0] as RunRow;
  }

  private async runView(db: pg.PoolClient, row: RunRow): Promise<RunView> {
    const current = row.state === 'completed' ? null : row.manifest.activities[row.position]?.id ?? null;
    const unresolved = Number((await db.query('SELECT count(*) FROM lesson_run_items WHERE lesson_run_id=$1 AND needs_remediation', [row.id])).rows[0].count);
    return { id: row.id, language_profile_id: row.language_profile_id, language_id: row.language_id, publication_id: row.publication_id,
      lesson_id: row.lesson_id, content_version_id: row.content_version_id, state: row.state, position: row.position,
      client_sequence: Number(row.client_sequence), revision: row.revision, current_activity_id: current, unresolved_count: unresolved, manifest: row.manifest };
  }

  private async attemptView(db: pg.PoolClient, attempt: Record<string, unknown>, run: RunRow, replayed: boolean): Promise<AttemptView> {
    const view = await this.runView(db, run);
    return { attempt_id: String(attempt.attempt_id), outcome: attempt.outcome as AttemptView['outcome'], feedback: String(attempt.feedback),
      evaluator_version: String(attempt.evaluator_version), answer_policy_version: String(attempt.answer_policy_version), replayed,
      run: { id: view.id, state: view.state, position: view.position, revision: view.revision, current_activity_id: view.current_activity_id, unresolved_count: view.unresolved_count } };
  }

  private async writeOutbox(db: pg.PoolClient, event: { eventType: string; aggregateId: string; correlationId: string; causationId: string; profileId: string; languageId: string; payload: Record<string, unknown> }): Promise<void> {
    const id = randomUUID(); const eventKey = `${event.eventType}:${event.aggregateId}:v${P3_VERSIONS.outbox_event}`;
    await db.query(`INSERT INTO outbox_events(id,event_key,event_type,event_version,aggregate_type,aggregate_id,correlation_id,causation_id,language_profile_id,language_id,payload)
      VALUES($1,$2,$3,$4,'learning',$5,$6,$7,$8,$9,$10) ON CONFLICT(event_key) DO NOTHING`,
    [id,eventKey,event.eventType,P3_VERSIONS.outbox_event,event.aggregateId,event.correlationId,event.causationId,event.profileId,event.languageId,event.payload]);
    await db.query(`INSERT INTO outbox_deliveries(event_id,consumer) SELECT id,'analytics-v1' FROM outbox_events WHERE event_key=$1 ON CONFLICT DO NOTHING`, [eventKey]);
  }
}
