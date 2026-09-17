import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { localDatabaseUrl } from '../../infra/local/database-guard.js';
import { createFoundationPool } from '../../infra/persistence/database.js';
import { IdentityRepository } from '../../infra/persistence/identity.js';
import { ContentRepository } from '../../infra/persistence/content.js';
import { LessonRepository } from '../../infra/persistence/lessons.js';
import { OutboxRepository } from '../../infra/persistence/outbox.js';
import { loadReferenceFixture } from '../../infra/persistence/fixtures.js';
import { loadExecutableLessonFixture } from '../../infra/persistence/p3-fixtures.js';
import { createApi } from '../../apps/api/src/app.js';
import { browserGate } from '../../tools/p3/browser-gate.js';
import { executableLessonFixtureSchema } from '../../packages/content-tools/src/p3-fixture.js';
import type { ActivityContract } from '../../packages/activity-schemas/src/lesson.js';
import type { ActivityResponse } from '../../packages/lesson-engine/src/evaluator.js';
import { seedBootstrap } from '../../prisma/seed.js';
import { languageIds } from '../../packages/domain/src/identity.js';

type P2Fixture = { language: 'en' | 'cs'; language_id: string; entities: Array<{ id: string; kind: string; version_id: string }> };
type P3Fixture = { language: 'en' | 'cs'; language_id: string; lesson_id: string; content_version_id: string;
  ancestor_versions: Array<{ entity_id: string; content_version_id: string }>; activities: Array<{ id: string; runtime: { presentation_seed: string; presentation_order: string[] } }> };
type Gate = { gate: string; status: 'PASS' };

test('P3 PostgreSQL: pinned bilingual lesson runtime, attempts, idempotency, remediation and outbox', { timeout: 360000 }, async () => {
  const baseUrl = localDatabaseUrl(process.env);
  const admin = new pg.Client({ connectionString: baseUrl, connectionTimeoutMillis: 2000 });
  const name = `lingvessa_p3_test_${randomBytes(8).toString('hex')}`;
  const url = new URL(baseUrl); url.pathname = `/${name}`;
  const env = { ...process.env, LINGVESSA_ENV: 'local', DATABASE_URL: url.toString() };
  const results: Gate[] = [];
  let created = false; let pool: pg.Pool | undefined;
  const run = async (gate: string, action: () => Promise<void>) => { await action(); results.push({ gate, status: 'PASS' }); };
  const migrate = () => {
    const result = spawnSync('pnpm', ['db:migrate'], { env, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, `Migration failed: ${result.stderr.slice(0, 500)}`);
  };
  const sqlReject = async (database: pg.Pool, sql: string, values: unknown[], code: string) => {
    await assert.rejects(database.query(sql, values), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === code));
  };
  try {
    await admin.connect();
    assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num, '180006');
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
    migrate(); await seedBootstrap(env); await seedBootstrap(env);
    pool = createFoundationPool(url.toString());
    const db = pool;
    const identity = new IdentityRepository(db); const content = new ContentRepository(db); const lessons = new LessonRepository(db);
    const p2 = Object.fromEntries(['en','cs'].map((language) => [language, JSON.parse(readFileSync(`content/fixtures/p2/${language}-m01.json`, 'utf8')) as P2Fixture])) as Record<'en'|'cs',P2Fixture>;
    const p3 = Object.fromEntries(['en','cs'].map((language) => [language, JSON.parse(readFileSync(`content/fixtures/p3/${language}-lesson.json`, 'utf8')) as P3Fixture])) as Record<'en'|'cs',P3Fixture>;
    const authorId = await identity.provision('p3-author@example.invalid','Synthetic P3 author password!');
    const reviewerId = await identity.provision('p3-reviewer@example.invalid','Synthetic P3 reviewer password!');
    const learnerId = await identity.provision('p3-learner@example.invalid','Synthetic P3 learner password!');
    const otherId = await identity.provision('p3-other@example.invalid','Synthetic P3 other password!');
    await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='content_editor'`, [authorId]);
    await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code IN ('linguistic_reviewer','pedagogical_reviewer','administrator')`, [reviewerId]);
    const profiles = { en: randomUUID(), cs: randomUUID(), otherEn: randomUUID() };
    await db.query(`INSERT INTO language_profiles(id,user_id,language_id,variant_id) VALUES
      ($1,$2,$3,'0198f000-0000-7000-8000-000000000011'),
      ($4,$2,$5,'0198f000-0000-7000-8000-000000000013'),
      ($6,$7,$3,'0198f000-0000-7000-8000-000000000011')`,
    [profiles.en,learnerId,languageIds.en,profiles.cs,languageIds.cs,profiles.otherEn,otherId]);

    await run('P3-DB-001 clean migration/replay and exact phase table boundary', async () => {
      migrate();
      assert.equal((await db.query(`SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL`)).rows[0].count, '3');
      const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).rows.map((row) => row.tablename);
      for (const table of ['lesson_runs','lesson_run_items','activity_attempts','attempt_receipts','evidence_events','outbox_events','outbox_deliveries']) assert(tables.includes(table));
      for (const table of ['knowledge_mastery_states','skill_mastery_states','review_schedules','speech_jobs','ai_runs','ai_sessions']) assert(!tables.includes(table));
      assert.equal((await db.query('SELECT count(*) FROM p1_bootstrap.fixtures')).rows[0].count, '2');
    });

    const publications: Record<'en'|'cs',{ id: string; versionIds: string[] }> = { en: { id: randomUUID(), versionIds: [] }, cs: { id: randomUUID(), versionIds: [] } };
    const coreStarts:Partial<Record<'en'|'cs',{language_profile_id:string;publication_id:string;lesson_id:string}>>={};
    const gateTypes = ['linguistic','pedagogical','technical','accessibility','media','originality'];
    await run('P3-FIX-001 EN/CS executable fixtures load idempotently and publish complete immutable closure', async () => {
      for (const language of ['en','cs'] as const) {
        await loadReferenceFixture(db,authorId,p2[language]);
        assert.equal((await loadReferenceFixture(db,authorId,p2[language])).status,'unchanged');
        const loaded = await loadExecutableLessonFixture(db,authorId,p3[language]);
        assert.equal(loaded.version_ids.length,4);
        assert.equal((await loadExecutableLessonFixture(db,authorId,p3[language])).status,'unchanged');
        const replacements = new Map([[p3[language].lesson_id,p3[language].content_version_id],...p3[language].ancestor_versions.map((entry) => [entry.entity_id,entry.content_version_id] as const)]);
        publications[language].versionIds = p2[language].entities.map((entity) => replacements.get(entity.id) ?? entity.version_id);
        for (const versionId of publications[language].versionIds) {
          await content.validateVersion(versionId);
          const version = (await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[versionId])).rows[0];
          for (const gate of gateTypes) await content.approve(reviewerId,versionId,version.checksum,version.revision,gate,'approved',`Synthetic P3 ${gate} approval`);
        }
        const courseId = p2[language].entities.find((entity) => entity.kind === 'course')!.id;
        const published = await content.publish({ id: publications[language].id, actorId: reviewerId, courseId, languageId: p2[language].language_id,
          channel: 'test', versionCode: `p3-${language}-1`, versionIds: publications[language].versionIds });
        assert.equal(published.checksum.length,64);
      }
    });

    let enRun = await lessons.start(learnerId,{ language_profile_id: profiles.en, publication_id: publications.en.id, lesson_id: p3.en.lesson_id });
    await run('P3-ISO-001 DB owner/profile/language/publication lineage rejects EN/CS and IDOR mismatches', async () => {
      await assert.rejects(lessons.start(learnerId,{ language_profile_id: profiles.en, publication_id: publications.cs.id, lesson_id: p3.cs.lesson_id }), /unavailable/u);
      await assert.rejects(lessons.start(otherId,{ language_profile_id: profiles.en, publication_id: publications.en.id, lesson_id: p3.en.lesson_id }), /unavailable/u);
      await assert.rejects(lessons.get(otherId,enRun.id), /not found/u);
      await sqlReject(db,'UPDATE lesson_runs SET language_id=$1,revision=revision+1 WHERE id=$2',[languageIds.cs,enRun.id],'23514');
      await sqlReject(db,`INSERT INTO lesson_runs(id,user_id,language_profile_id,language_id,variant_id,publication_id,publication_checksum,lesson_id,content_version_id,content_checksum,manifest)
        SELECT $1,$2,language_profile_id,language_id,variant_id,publication_id,publication_checksum,lesson_id,content_version_id,content_checksum,manifest FROM lesson_runs WHERE id=$3`,
      [randomUUID(),otherId,enRun.id],'23503');
    });

    await run('P3-RUN-001 start/resume returns one exact pinned manifest and run pin is immutable', async () => {
      const resumed = await lessons.start(learnerId,{ language_profile_id: profiles.en, publication_id: publications.en.id, lesson_id: p3.en.lesson_id });
      assert.equal(resumed.id,enRun.id); assert.equal(resumed.content_version_id,p3.en.content_version_id); assert.equal(resumed.manifest.activities.length,2);
      await sqlReject(db,`UPDATE lesson_runs SET manifest=jsonb_set(manifest,'{variety}','"en-US"'),revision=revision+1 WHERE id=$1`,[enRun.id],'23514');
      await assert.rejects(lessons.exit(learnerId,enRun.id,{ expected_revision: enRun.revision, acknowledge_unresolved:true }), /scored lesson path/u);
      await sqlReject(db,'DELETE FROM lesson_runs WHERE id=$1',[enRun.id],'23514');
    });

    const enActivity1 = p3.en.activities[0]!; const enActivity2 = p3.en.activities[1]!;
    const command = (attemptId: string, sequence: number, item: typeof enActivity1, optionId: string, intent: 'submit'|'reveal'='submit') => ({
      attempt_id: attemptId, content_version_id: p3.en.content_version_id, item_id: item.id, client_sequence: sequence, intent,
      response: intent === 'reveal' ? { kind: 'none' as const } : { kind: 'single' as const, option_id: optionId },
      presentation: { seed: item.runtime.presentation_seed, order: item.runtime.presentation_order }, assistance: { hint_count: 0, reveal: intent === 'reveal' },
    });
    const wrongId = randomUUID(); const wrong = command(wrongId,1,enActivity1,'goodbye'); let wrongRevision = 0;
    await run('P3-ATT-001 authoritative incorrect/retry/correct records immutable exact-version evidence', async () => {
      const result = await lessons.submit(learnerId,enRun.id,wrong); assert.equal(result.outcome,'incorrect'); assert.equal(result.run.position,0); wrongRevision=result.run.revision;
      assert.equal((await db.query('SELECT count(*) FROM evidence_events WHERE user_id=$1 AND attempt_id=$2',[learnerId,wrongId])).rows[0].count,'1');
      assert.equal((await db.query('SELECT evaluator_version FROM activity_attempts WHERE user_id=$1 AND attempt_id=$2',[learnerId,wrongId])).rows[0].evaluator_version,'deterministic-choice-1.0.0');
      const retry = await lessons.submit(learnerId,enRun.id,command(randomUUID(),2,enActivity1,'hello'));
      assert.equal(retry.outcome,'correct'); assert.equal(retry.run.position,1);
      await sqlReject(db,'UPDATE activity_attempts SET feedback=$1 WHERE user_id=$2 AND attempt_id=$3',['rewrite',learnerId,wrongId],'23514');
      await sqlReject(db,'UPDATE evidence_events SET effective_weight=0 WHERE user_id=$1 AND attempt_id=$2',[learnerId,wrongId],'23514');
    });

    await run('P3-ATT-002 same attempt semantic replay is one effect; changed payload and client score tampering reject', async () => {
      const replay = await lessons.submit(learnerId,enRun.id,wrong); assert.equal(replay.replayed,true); assert.equal(replay.run.revision,wrongRevision);
      assert.equal((await db.query('SELECT count(*) FROM activity_attempts WHERE user_id=$1 AND attempt_id=$2',[learnerId,wrongId])).rows[0].count,'1');
      assert.equal((await db.query('SELECT count(*) FROM outbox_events WHERE aggregate_id=$1',[wrongId])).rows[0].count,'1');
      await assert.rejects(lessons.submit(learnerId,enRun.id,{ ...wrong, response: { kind:'single',option_id:'hello' } }), /different semantic payload/u);
      await assert.rejects(lessons.submit(learnerId,enRun.id,{ ...command(randomUUID(),3,enActivity2,'informal'), correct:true }), /unrecognized|Unrecognized|invalid/i);
    });

    await run('P3-REM-001 reveal is assisted zero-weight evidence; remediation has explicit exit and no fabricated success', async () => {
      const revealed = await lessons.submit(learnerId,enRun.id,command(randomUUID(),3,enActivity2,'', 'reveal'));
      assert.equal(revealed.outcome,'assisted'); assert.equal(revealed.run.state,'remediation'); assert.equal(revealed.run.unresolved_count,1);
      const event = (await db.query(`SELECT result_class,effective_weight FROM evidence_events WHERE attempt_id=$1`,[revealed.attempt_id])).rows[0];
      assert.equal(event.result_class,'assisted'); assert.equal(Number(event.effective_weight),0);
      await assert.rejects(lessons.exit(learnerId,enRun.id,{ expected_revision: revealed.run.revision, acknowledge_unresolved:false }), /acknowledgement/u);
      enRun = await lessons.exit(learnerId,enRun.id,{ expected_revision: revealed.run.revision, acknowledge_unresolved:true });
      assert.equal(enRun.state,'completed'); assert.equal(enRun.unresolved_count,1);
    });

    await run('P3-POLICY-001 retry cap requires explicit reveal; later correction remains assisted', async()=>{
      let retryRun=await lessons.start(otherId,{language_profile_id:profiles.otherEn,publication_id:publications.en.id,lesson_id:p3.en.lesson_id});
      for(let index=1;index<=3;index++)await lessons.submit(otherId,retryRun.id,command(randomUUID(),index,enActivity1,'goodbye'));
      assert.equal((await lessons.get(otherId,retryRun.id)).retry_available,false);
      await assert.rejects(lessons.submit(otherId,retryRun.id,command(randomUUID(),4,enActivity1,'hello')),/Retry limit/u);
      await lessons.submit(otherId,retryRun.id,command(randomUUID(),4,enActivity1,'','reveal'));
      await lessons.submit(otherId,retryRun.id,command(randomUUID(),5,enActivity2,'informal'));
      retryRun=await lessons.get(otherId,retryRun.id);assert.equal(retryRun.state,'remediation');
      const corrected=await lessons.submit(otherId,retryRun.id,command(randomUUID(),6,enActivity1,'hello'));
      assert.equal(corrected.outcome,'assisted');assert.equal(corrected.run.state,'completed');
      const event=(await db.query('SELECT independence,effective_weight FROM evidence_events WHERE user_id=$1 AND attempt_id=$2',[otherId,corrected.attempt_id])).rows[0];
      assert.equal(event.independence,'assisted');assert.equal(Number(event.effective_weight),0);
    });

    const faultRun = await lessons.start(learnerId,{ language_profile_id: profiles.en, publication_id: publications.en.id, lesson_id: p3.en.lesson_id });
    await run('P3-TXN-001 injected failure rolls back attempt/evidence/run/outbox atomically', async () => {
      const attemptId = randomUUID(); const before = Number((await db.query('SELECT count(*) FROM outbox_events')).rows[0].count);
      await assert.rejects(lessons.submit(learnerId,faultRun.id,command(attemptId,1,enActivity1,'hello'),'after_attempt'), /P3_FAULT/u);
      assert.equal((await db.query('SELECT count(*) FROM activity_attempts WHERE attempt_id=$1',[attemptId])).rows[0].count,'0');
      assert.equal((await db.query('SELECT count(*) FROM evidence_events WHERE attempt_id=$1',[attemptId])).rows[0].count,'0');
      assert.equal(Number((await db.query('SELECT client_sequence FROM lesson_runs WHERE id=$1',[faultRun.id])).rows[0].client_sequence),0);
      assert.equal(Number((await db.query('SELECT count(*) FROM outbox_events')).rows[0].count),before);
    });

    const csRun = await lessons.start(learnerId,{ language_profile_id: profiles.cs, publication_id: publications.cs.id, lesson_id: p3.cs.lesson_id });
    const csActivity = p3.cs.activities[0]!;
    const csAttempt = { attempt_id:randomUUID(),content_version_id:p3.cs.content_version_id,item_id:csActivity.id,client_sequence:1,intent:'submit' as const,
      response:{kind:'single' as const,option_id:'dobry_den'},presentation:{seed:csActivity.runtime.presentation_seed,order:csActivity.runtime.presentation_order},assistance:{hint_count:0,reveal:false} };
    await run('P3-E2E-001 English and Czech traverse same repository/evaluator; concurrent retry creates one effect set', async () => {
      const outcomes = await Promise.all([lessons.submit(learnerId,csRun.id,csAttempt),lessons.submit(learnerId,csRun.id,csAttempt)]);
      assert(outcomes.every((result) => result.outcome==='correct')); assert.equal(outcomes.filter((result) => result.replayed).length,1);
      assert.equal((await db.query('SELECT count(*) FROM activity_attempts WHERE attempt_id=$1',[csAttempt.attempt_id])).rows[0].count,'1');
      assert.equal((await db.query('SELECT count(*) FROM evidence_events WHERE attempt_id=$1',[csAttempt.attempt_id])).rows[0].count,'1');
      await sqlReject(db,`INSERT INTO evidence_events(attempt_db_id,independence,difficulty,model_version,user_id,attempt_id,language_profile_id,language_id,item_id,knowledge_item_id,skill,facet,result_class,assisted,
        base_weight,effective_weight,content_version_id,content_schema_version,evaluator_version,mastery_model_version,scheduler_version)
        SELECT attempt_db_id,independence,difficulty,model_version,user_id,attempt_id,language_profile_id,$1,item_id,$2,skill,facet,result_class,assisted,base_weight,effective_weight,content_version_id,
          content_schema_version,evaluator_version,mastery_model_version,scheduler_version FROM evidence_events WHERE attempt_id=$3`,
      [languageIds.en,'49db33a3-4a56-48d6-8a73-0676c3133625',csAttempt.attempt_id],'23514');
    });

    await run('P3-OUT-001 durable outbox has bounded retry/idempotent settlement and sink failure leaves attempt committed', async () => {
      const outbox = new OutboxRepository(db); const claimed = await outbox.claim('p3-test-consumer',2,new Date()); assert(claimed.length>0);
      const first = claimed[0]!; assert.equal(await outbox.fail('p3-test-consumer',first.id,'SYNTHETIC_OUTAGE',true,first.attempt_count,new Date()),'retry');
      assert.equal((await db.query('SELECT count(*) FROM activity_attempts WHERE attempt_id=$1',[wrongId])).rows[0].count,'1');
      await db.query(`UPDATE outbox_deliveries SET next_attempt_at=now()-interval '1 second' WHERE event_id=$1 AND consumer='p3-test-consumer'`,[first.id]);
      const retried = await outbox.claim('p3-test-consumer',20,new Date()); assert(retried.some((event) => event.id===first.id));
      assert.equal(await outbox.succeed('p3-test-consumer',first.id,first.attempt_count),false);
      assert.equal(await outbox.succeed('p3-test-consumer',first.id,retried.find(event=>event.id===first.id)!.attempt_count),true);
      assert.equal(await outbox.fail('p3-test-consumer',first.id,'LATE_FAILURE',true,first.attempt_count), 'stale');
      const second = retried.find((event) => event.id!==first.id) ?? (await outbox.claim('p3-test-consumer',20,new Date()))[0];
      assert(second); assert.equal(await outbox.fail('p3-test-consumer',second.id,'NON_RETRYABLE',false,second.attempt_count,new Date()),'terminal');
      const crashClaim = (await outbox.claim('p3-crash-consumer',1,new Date()))[0]!; assert(crashClaim);
      await db.query(`UPDATE outbox_deliveries SET attempt_count=8,lease_expires_at=now()-interval '1 second' WHERE consumer='p3-crash-consumer' AND event_id=$1`,[crashClaim.id]);
      await outbox.claim('p3-crash-consumer',1,new Date());
      assert.equal((await db.query(`SELECT status FROM outbox_deliveries WHERE consumer='p3-crash-consumer' AND event_id=$1`,[crashClaim.id])).rows[0].status,'terminal_failure');
      assert.equal(await outbox.succeed('p3-crash-consumer',crashClaim.id,8),false);
      assert((await outbox.metrics()).some((metric) => metric.consumer==='p3-test-consumer'));
      assert.equal((await db.query(`SELECT count(*) FROM outbox_events WHERE payload::text ~* 'raw_audio|password|full_response'`)).rows[0].count,'0');
      await sqlReject(db,'DELETE FROM outbox_events WHERE id=$1',[first.id],'23514');
    });

    await run('P3-CORE-001 EN/CS intro/matching/construction/typing/grammar/listening/dialogue/text-roleplay/result share one engine', async()=>{
      for(const language of ['en','cs'] as const){
        const fixture=executableLessonFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p3/${language}-core.json`,'utf8')));
        const loaded=await loadExecutableLessonFixture(db,authorId,fixture);assert.equal(loaded.version_ids.length,14);
        assert.equal((await loadExecutableLessonFixture(db,authorId,fixture)).status,'unchanged');
        const replacements=new Map([[fixture.lesson_id,fixture.content_version_id],...fixture.ancestor_versions.map(entry=>[entry.entity_id,entry.content_version_id] as const)]);
        const versionIds=[...p2[language].entities.map(entity=>replacements.get(entity.id)??entity.version_id),...fixture.new_items.map(entry=>entry.content_version_id)];
        for(const versionId of versionIds){
          await content.validateVersion(versionId);const version=(await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1',[versionId])).rows[0];
          for(const gate of gateTypes){
            const existing=(await db.query('SELECT target_checksum,decision FROM approvals WHERE target_content_version_id=$1 AND target_revision=$2 AND gate_type=$3 AND reviewer_id=$4',[versionId,version.revision,gate,reviewerId])).rows[0];
            if(existing){assert.equal(existing.target_checksum,version.checksum);assert.equal(existing.decision,'approved');}
            else await content.approve(reviewerId,versionId,version.checksum,version.revision,gate,'approved',`Synthetic P3 core ${gate} approval`);
          }
        }
        const publicationId=randomUUID();await content.publish({id:publicationId,actorId:reviewerId,courseId:p2[language].entities.find(entity=>entity.kind==='course')!.id,
          languageId:fixture.language_id,channel:'test',versionCode:`p3-core-${language}-1`,versionIds});
        coreStarts[language]={language_profile_id:profiles[language],publication_id:publicationId,lesson_id:fixture.lesson_id};
        let coreRun=await lessons.start(learnerId,coreStarts[language]);
        assert(!JSON.stringify(coreRun.manifest).includes('accepted_text'));
        for(const activity of fixture.activities){
          const policy=activity.response.answer_policy;
          const response:ActivityResponse=policy.mode==='exposure'?{kind:'none'}:policy.mode==='single'?{kind:'single',option_id:policy.accepted_option_ids![0]!}:
            policy.mode==='text'?{kind:'text',text:policy.accepted_text![0]!}:policy.mode==='mapping'?{kind:'mapping',pairs:policy.accepted_pairs!}:{kind:'order',option_ids:policy.accepted_order!};
          const result=await lessons.submit(learnerId,coreRun.id,{attempt_id:randomUUID(),content_version_id:fixture.content_version_id,item_id:activity.id,client_sequence:coreRun.client_sequence+1,
            intent:response.kind==='none'?'continue':'submit',response,presentation:{seed:activity.runtime.presentation_seed,order:activity.runtime.presentation_order},assistance:{hint_count:0,reveal:false}});
          assert.equal(result.outcome,response.kind==='none'?'accepted':'correct');coreRun=await lessons.get(learnerId,coreRun.id);
        }
        assert.equal(coreRun.state,'completed');assert.equal(coreRun.unresolved_count,0);
        assert.equal((await db.query(`SELECT count(*) FROM outbox_events WHERE aggregate_id=$1 AND event_type='lesson.run.completed'`,[coreRun.id])).rows[0].count,'1');
      }
    });

    await run('P3-API-001 auth/CSRF/strict-body/problem details and resume surface are enforced', async () => {
      const app = await createApi({ ready:async()=>true,close:async()=>undefined },{ identity,content,lessons }); await app.listen(0,'127.0.0.1');
      try {
        const base = await app.getUrl();
        const login = await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'content-type':'application/json','x-lingvessa-client':'web'},body:JSON.stringify({email:'p3-learner@example.invalid',password:'Synthetic P3 learner password!'})});
        assert.equal(login.status,200); const body=await login.json() as {csrf_token:string}; const cookie=login.headers.get('set-cookie')!.split(';')[0]!;
        const startBody={language_profile_id:profiles.en,publication_id:publications.en.id,lesson_id:p3.en.lesson_id};
        const denied=await fetch(`${base}/api/v1/lesson-runs`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(startBody)});
        assert.equal(denied.status,403); const problem=await denied.json() as {code:string;correlation_id:string;detail_safe:string};
        assert.equal(problem.code,'FORBIDDEN'); assert.match(problem.correlation_id,/^[0-9a-f-]{36}$/u); assert(!JSON.stringify(problem).includes('SELECT'));
        const headers={cookie,'content-type':'application/json','x-csrf-token':body.csrf_token};
        const started=await fetch(`${base}/api/v1/lesson-runs`,{method:'POST',headers,body:JSON.stringify(startBody)}); assert.equal(started.status,201);
        const apiRun=await started.json() as {id:string;client_sequence:number;manifest:{activities:P3Fixture['activities']}};
        const item=apiRun.manifest.activities[0]!; const valid=command(randomUUID(),apiRun.client_sequence+1,item,'hello');
        const tampered=await fetch(`${base}/api/v1/lesson-runs/${apiRun.id}/attempts`,{method:'POST',headers,body:JSON.stringify({...valid,score:1,correct:true})}); assert.equal(tampered.status,400);
        const timings:number[]=[];
        for(let sample=0;sample<20;sample++){
          const current=await lessons.start(learnerId,startBody);
          const submitted=command(randomUUID(),current.client_sequence+1,item,'hello');
          const startedAt=performance.now();
          const accepted=await fetch(`${base}/api/v1/lesson-runs/${current.id}/attempts`,{method:'POST',headers,body:JSON.stringify(submitted)});
          assert.equal(accepted.status,200);await accepted.json();timings.push(performance.now()-startedAt);
          await lessons.submit(learnerId,current.id,command(randomUUID(),current.client_sequence+2,enActivity2,'informal'));
        }
        timings.sort((a,b)=>a-b);const p95=timings[Math.ceil(timings.length*0.95)-1]!;assert(p95<=700,`Attempt API p95 ${p95.toFixed(2)}ms exceeds 700ms`);
        mkdirSync('artifacts/p3',{recursive:true});writeFileSync('artifacts/p3/attempt-latency.json',JSON.stringify({samples:timings.length,p95_ms:p95,budget_ms:700,scope:'loopback API + real PostgreSQL deterministic attempts; not production load',status:'PASS'})+'\n');
        for(let index=0;index<120;index++)assert.equal(await identity.allowLearningAction(otherId),true);
        assert.equal(await identity.allowLearningAction(otherId),false);
        const resumed=await fetch(`${base}/api/v1/lesson-runs?language_profile_id=${profiles.en}`,{headers:{cookie}}); assert.equal(resumed.status,200);
        assert((await resumed.json() as Array<{id:string}>).some((entry)=>entry.id===apiRun.id));
        assert(!JSON.stringify(apiRun.manifest).includes('answer_policy'));
        const safeError=await fetch(`${base}/api/v1/lesson-runs/not-a-uuid`,{headers:{cookie}});assert.equal(safeError.status,400);assert.equal((await safeError.json() as {code:string}).code,'INVALID_INPUT');
        if(process.env.P3_BROWSER_TESTS==='true'){
          for(const [language,runId] of [['en',faultRun.id],['cs',csRun.id]] as const){
            const current=await lessons.get(learnerId,runId);if(current.state==='completed')continue;const activity=(JSON.parse(readFileSync(`content/fixtures/p3/${language}-lesson.json`,'utf8')).activities as ActivityContract[])[current.position]!;
            await lessons.submit(learnerId,runId,{attempt_id:randomUUID(),content_version_id:current.content_version_id,item_id:activity.id,client_sequence:current.client_sequence+1,intent:'submit',
              response:{kind:'single',option_id:activity.response.answer_policy.accepted_option_ids![0]},presentation:{seed:activity.runtime.presentation_seed,order:activity.runtime.presentation_order},assistance:{hint_count:0,reveal:false}});
          }
          const freshEn=await lessons.start(learnerId,{language_profile_id:profiles.en,publication_id:publications.en.id,lesson_id:p3.en.lesson_id});
          const freshCs=await lessons.start(learnerId,{language_profile_id:profiles.cs,publication_id:publications.cs.id,lesson_id:p3.cs.lesson_id});
          const enCore=await lessons.start(learnerId,coreStarts.en!);const csCore=await lessons.start(learnerId,coreStarts.cs!);
          await run('P3-UI-001 real Chromium EN/CS login/reload/lost-response/reveal/remediation/core-family rendering',()=>browserGate(base,freshEn.id,freshCs.id,enCore.id,csCore.id));
        }

      } finally { await app.close(); }
    });

    await pool.end(); pool=undefined;
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); created=false;
    await run('P3-DB-002 clean database recreation repeats all migrations and synthetic seed', async () => {
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`); created=true; migrate(); await seedBootstrap(env); await seedBootstrap(env);
      const fresh=createFoundationPool(url.toString()); try {
        assert.equal((await fresh.query('SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].count,'3');
        assert.equal((await fresh.query('SELECT count(*) FROM lesson_runs')).rows[0].count,'0');
        assert.equal((await fresh.query('SELECT count(*) FROM p1_bootstrap.fixtures')).rows[0].count,'2');
      } finally { await fresh.end(); }
    });
  } finally {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    mkdirSync('artifacts/p3',{recursive:true});
    writeFileSync('artifacts/p3/database-validation.json',JSON.stringify({ timestamp:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      source_sha:process.env.GITHUB_HEAD_SHA??null,phase:'P3',database:'PostgreSQL 18.6',gates:results,status:results.length===(process.env.P3_BROWSER_TESTS==='true'?15:14)&&results.every((entry)=>entry.status==='PASS')?'PASS':'FAIL' },null,2)+'\n');
  }
});
