import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import pg from 'pg';
import { localDatabaseUrl } from '../../infra/local/database-guard.js';
import { createFoundationPool } from '../../infra/persistence/database.js';
import { IdentityRepository } from '../../infra/persistence/identity.js';
import { ContentRepository } from '../../infra/persistence/content.js';
import { loadReferenceFixture } from '../../infra/persistence/fixtures.js';
import { referenceFixtureSchema } from '../../packages/content-tools/src/fixture.js';
import { languageIds } from '../../packages/domain/src/identity.js';
import { skillFacetMatrix } from '../../packages/activity-schemas/src/content.js';
import { createApi } from '../../apps/api/src/app.js';
import { seedBootstrap } from '../../prisma/seed.js';

const fixture = (lang: string) => referenceFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p2/${lang}-m01.json`, 'utf8')));
const en = fixture('en'); const cs = fixture('cs');
const entity = (lang: typeof en, kind: string) => lang.entities.find((e) => e.kind === kind)!;
const sqlReject = async (pool: pg.Pool, sql: string, parameters: unknown[], code = '23503') => assert.rejects(pool.query(sql, parameters), { code });

test('P2 real PostgreSQL: identity, DB isolation, immutable publication and recreation', { timeout: 240000 }, async (t) => {
  const baseUrl = localDatabaseUrl(process.env);
  const admin = new pg.Client({ connectionString: baseUrl }); await admin.connect();
  const name = `lingvessa_p2_test_${randomBytes(8).toString('hex')}`;
  const url = new URL(baseUrl); url.pathname = `/${name}`;
  const env = { ...process.env, LINGVESSA_ENV: 'local', DATABASE_URL: url.toString() };
  const results: { gate: string; status: string }[] = [];
  let created = false; let pool: pg.Pool | undefined;
  const run = async (gate: string, fn: () => Promise<void>) => t.test(gate, async () => {
    try { await fn(); results.push({ gate, status: 'PASS' }); } catch (error) { results.push({ gate, status: 'FAIL' }); throw error; }
  });
  const migrate = () => {
    const result = spawnSync('pnpm', ['db:migrate'], { env, encoding: 'utf8', timeout: 45000 });
    assert.equal(result.status, 0, 'Real migration deploy must succeed');
  };
  try {
    assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num, '180006');
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
    migrate(); migrate(); await seedBootstrap(env); await seedBootstrap(env);
    pool = createFoundationPool(url.toString()); const db = pool;
    const identity = new IdentityRepository(db); const content = new ContentRepository(db);
    const authorId = await identity.provision('p2-author@example.invalid', 'Only synthetic test identity!');
    const reviewerId = await identity.provision('p2-reviewer@example.invalid', 'Only synthetic test identity!');
    const learnerId = await identity.provision('p2-learner@example.invalid', 'Only synthetic test identity!');
    const strangerId = await identity.provision('p2-other@example.invalid', 'Only synthetic test identity!');
    await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='content_editor'`, [authorId]);
    await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code IN ('administrator','linguistic_reviewer','pedagogical_reviewer')`, [reviewerId]);
    const session = await identity.login('p2-learner@example.invalid', 'Only synthetic test identity!');
    const principal = await identity.authenticate(session.token);
    const enProfile = await identity.createProfile(principal, languageIds.en);
    const csProfile = await identity.createProfile(principal, languageIds.cs);
    await loadReferenceFixture(db, authorId, en); await loadReferenceFixture(db, authorId, cs);

    await run('P2-DB-001 clean migrations, replay, seed/reseed and registry parity', async () => {
      const migrations = (await db.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name')).rows;
      assert.equal(migrations.length, 3);
      for (const m of migrations) assert.equal(m.checksum, createHash('sha256').update(readFileSync(`prisma/migrations/${m.migration_name}/migration.sql`)).digest('hex'));
      assert.equal((await db.query('SELECT count(*) FROM p1_bootstrap.fixtures')).rows[0].count, '2');
      assert.equal((await db.query('SELECT count(*) FROM roles')).rows[0].count, '7');
      const pairs = (await db.query('SELECT skill,facet FROM skill_facet_pairs')).rows.map((r) => `${r.skill}/${r.facet}`).sort();
      assert.deepEqual(pairs, Object.entries(skillFacetMatrix).flatMap(([skill, facets]) => facets.map((f) => `${skill}/${f}`)).sort());
      for (const f of [en, cs]) assert.equal((await loadReferenceFixture(db, authorId, f)).status, 'unchanged');
      const changed = structuredClone(en); changed.entities[0]!.title = 'Changed fixture';
      await assert.rejects(loadReferenceFixture(db, authorId, changed), /refusing to overwrite/);
      assert.equal((await db.query('SELECT title FROM content_entities WHERE id=$1', [entity(cs, 'module').id])).rows[0].title, 'Dobrý den!');
    });
    await run('P2-ISO-001 profile uniqueness, ownership, English/Czech lineage and variety enforced by SQL', async () => {
      await sqlReject(db, 'INSERT INTO language_profiles(id,user_id,language_id,variant_id) SELECT $1,user_id,language_id,variant_id FROM language_profiles WHERE id=$2', [randomUUID(), enProfile], '23505');
      await sqlReject(db, 'UPDATE user_settings SET active_language_profile_id=$1,active_language_id=$2 WHERE user_id=$3', [enProfile, languageIds.en, strangerId]);
      await sqlReject(db, 'UPDATE language_profiles SET user_id=$1 WHERE id=$2', [strangerId, enProfile], '23514');
      await sqlReject(db, 'UPDATE language_profiles SET variant_id=(SELECT id FROM variants WHERE code=$1) WHERE id=$2', ['cs-CZ', enProfile]);
      await db.query(`INSERT INTO user_courses(id,user_id,language_profile_id,language_id,course_id,selected_lesson_id) VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), learnerId, enProfile, languageIds.en, entity(en, 'course').id, entity(en, 'lesson').id]);
      await sqlReject(db, 'UPDATE user_courses SET selected_lesson_id=$1 WHERE language_profile_id=$2', [entity(cs, 'lesson').id, enProfile], '23514');
      await sqlReject(db, 'UPDATE user_courses SET course_id=$1,selected_lesson_id=NULL WHERE language_profile_id=$2', [entity(cs, 'course').id, enProfile], '23514');
      await sqlReject(db, 'INSERT INTO user_courses(id,user_id,language_profile_id,language_id,course_id) VALUES($1,$2,$3,$4,$5)', [randomUUID(), strangerId, csProfile, languageIds.cs, entity(cs, 'course').id]);
      await sqlReject(db, 'UPDATE item_knowledge_map SET knowledge_item_id=$1 WHERE item_id=$2', [entity(cs, 'knowledge').id, entity(en, 'activity').id]);
      await sqlReject(db, `INSERT INTO knowledge_edges(id,language_id,from_id,to_id,edge_type,direction,weight,version_code,review_status,provenance)
        VALUES($1,$2,$3,$4,'component','directed',1,'p2-negative-cross-language','draft','{}')`,
        [randomUUID(), languageIds.en, entity(en, 'knowledge').id, entity(cs, 'knowledge').id]);
      await sqlReject(db, 'UPDATE content_version_refs SET target_entity_id=$1,target_version_id=$2 WHERE source_version_id=$3', [entity(cs, 'module').id, entity(cs, 'module').version_id, entity(en, 'level').version_id]);
      await sqlReject(db, 'UPDATE item_knowledge_map SET skill=$1,facet=$2 WHERE item_id=$3', ['speaking', 'interaction_goal', entity(en, 'activity').id], '23514');
      await sqlReject(db, 'UPDATE item_knowledge_map SET facet=$1 WHERE item_id=$2', ['intelligibility', entity(en, 'activity').id]);
      await sqlReject(db, 'UPDATE users SET id=$1 WHERE id=$2', ['E-A1-M01', learnerId], '22P02');
    });
    await run('P2-ISO-002 EN -> CS -> EN changes context only; IDOR and optimistic concurrency fail closed', async () => {
      const before = (await db.query('SELECT * FROM user_courses WHERE language_profile_id=$1', [enProfile])).rows;
      let revision = (await identity.settings(principal))!.revision as number;
      for (const id of [enProfile, csProfile, enProfile]) revision = await identity.switchProfile(principal, id, revision);
      assert.deepEqual((await db.query('SELECT * FROM user_courses WHERE language_profile_id=$1', [enProfile])).rows, before);
      const otherSession = await identity.login('p2-other@example.invalid', 'Only synthetic test identity!');
      const other = await identity.authenticate(otherSession.token);
      await assert.rejects(identity.switchProfile(other, enProfile, 1), { code: 'NOT_FOUND' });
      await assert.rejects(identity.switchProfile(principal, csProfile, 1), { code: 'CONFLICT' });
      await identity.selectVariety(principal, enProfile, 'en-US');
      assert.equal((await identity.profiles(principal)).find((p) => p.id === csProfile)?.variety, 'cs-CZ');
      assert.equal((await identity.settings(principal))?.learner_ai_opt_in, false);
      await identity.consent(principal, true, 'learner-ai-consent-p2-1'); await identity.consent(principal, false, 'learner-ai-consent-p2-1');
      assert.equal((await identity.settings(principal))?.learner_ai_opt_in, false);
      assert.equal((await db.query('SELECT count(*) FROM consents WHERE user_id=$1', [learnerId])).rows[0].count, '2');
      await sqlReject(db, 'DELETE FROM consents WHERE user_id=$1', [learnerId], '23514');
    });
    const approveAll = async (versionId: string) => {
      const result = await content.validateVersion(versionId);
      for (const gate of ['linguistic', 'pedagogical', 'technical', 'accessibility', 'media', 'originality'])
        await content.approve(reviewerId, versionId, result.checksum, result.revision, gate, 'approved', 'Synthetic P2 gate fixture. Not a real editorial/media review or production release.');
    };
    const publicationId = randomUUID();
    const publicationInput = { id: publicationId, actorId: reviewerId, courseId: entity(en, 'course').id, languageId: languageIds.en, channel: 'test' as const, versionCode: 'p2-publication-1', versionIds: en.entities.map((e) => e.version_id) };
    await run('P2-PUB-001 exact UUID resolution, draft validation and mandatory current approvals', async () => {
      assert.deepEqual(await content.resolve(languageIds.en, entity(en, 'knowledge').stable_code, 'p2-schema-1'), { entity_id: entity(en, 'knowledge').id, content_version_id: entity(en, 'knowledge').version_id });
      assert.equal(await content.resolve(languageIds.cs, entity(en, 'knowledge').stable_code, 'p2-schema-1'), null);
      assert.equal((await content.catalog(languageIds.en, 'test')).length, 0);
      await assert.rejects(content.publish(publicationInput), /validation required/);
      for (const e of en.entities) await approveAll(e.version_id);
      const id = entity(en, 'knowledge').version_id;
      const prior = (await db.query('SELECT payload FROM content_versions WHERE id=$1', [id])).rows[0].payload;
      await db.query(`UPDATE content_versions SET payload=jsonb_set(payload,'{title}','"Edited greeting"') WHERE id=$1`, [id]);
      await db.query('UPDATE content_versions SET payload=$1 WHERE id=$2', [prior, id]);
      await assert.rejects(content.publish(publicationInput), /validation required|approval required/);
      await approveAll(id);
      const lesson = entity(en, 'lesson');
      const translationId = randomUUID();
      await db.query('INSERT INTO translations(id,language_id,content_version_id,locale,payload,version_code) VALUES($1,$2,$3,$4,$5,$6)', [translationId, languageIds.en, lesson.version_id, 'uk-UA', { title: 'Привіт!' }, '1']);
      await assert.rejects(content.publish(publicationInput), /validation required|approval required/);
      await approveAll(lesson.version_id);
      const courseVersion = (await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1', [entity(en, 'course').version_id])).rows[0];
      await db.query(`INSERT INTO content_validations(id,content_version_id,target_checksum,target_revision,validator_version,passed,report)
        VALUES($1,$2,$3,$4,'p2-negative-validator',false,$5)`, [randomUUID(), entity(en, 'course').version_id, courseVersion.checksum, courseVersion.revision, { reason: 'synthetic current failure' }]);
      await assert.rejects(content.publish(publicationInput), /latest validation required/);
      await content.validateVersion(entity(en, 'course').version_id);
      await sqlReject(db, 'UPDATE translations SET language_id=$1 WHERE id=$2', [languageIds.cs, translationId], '23514');
      await assert.rejects(content.approve(learnerId, id, 'invalid', 1, 'technical', 'approved', 'invalid approval'), /target changed/);
      const v = (await db.query('SELECT checksum,revision FROM content_versions WHERE id=$1', [id])).rows[0];
      await assert.rejects(content.approve(learnerId, id, v.checksum, v.revision, 'technical', 'approved', 'no reviewer role'), { code: '42501' });
      const pub = await content.publish(publicationInput);
      assert.equal(pub.checksum.length, 64);
      assert.equal((pub.manifest as { knowledge_edges: unknown[] }).knowledge_edges.length, 1);
      await content.activate(reviewerId, publicationId, null);
      assert.equal((await content.catalog(languageIds.en, 'test')).length, 1);
      assert.equal((await content.catalog(languageIds.cs, 'test')).length, 0);
    });
    await run('P2-PUB-002 published versions/manifests/entries/translations/refs are immutable', async () => {
      const versionId = entity(en, 'lesson').version_id;
      for (const sql of ['UPDATE content_versions SET payload=payload WHERE id=$1', 'DELETE FROM content_versions WHERE id=$1']) await sqlReject(db, sql, [versionId], '23514');
      await sqlReject(db, 'UPDATE publications SET manifest=manifest WHERE id=$1', [publicationId], '23514');
      await sqlReject(db, 'DELETE FROM publications WHERE id=$1', [publicationId], '23514');
      await sqlReject(db, 'UPDATE publication_entries SET content_checksum=$1 WHERE publication_id=$2', ['incorrect', publicationId], '23514');
      await sqlReject(db, 'UPDATE publication_knowledge_edges SET edge_checksum=$1 WHERE publication_id=$2', ['incorrect', publicationId], '23514');
      await sqlReject(db, 'UPDATE knowledge_edges SET weight=$1 WHERE language_id=$2', [0.5, languageIds.en], '23514');
      await sqlReject(db, 'UPDATE translations SET payload=$1 WHERE content_version_id=$2', [{ title: 'Інший' }, versionId], '23514');
      await sqlReject(db, 'DELETE FROM content_version_refs WHERE source_version_id=$1', [versionId], '23514');
      await sqlReject(db, 'UPDATE approvals SET notes=$1', ['rewritten history'], '23514');
      await sqlReject(db, 'UPDATE audit_events SET action=$1', ['rewritten history'], '23514');
      await sqlReject(db, 'UPDATE content_entities SET stable_code=$1 WHERE id=$2', ['NEW_CODE', entity(en, 'knowledge').id], '23514');
      await sqlReject(db, 'TRUNCATE publications CASCADE', [], '23514');
      await sqlReject(db, 'DELETE FROM publication_pointers WHERE publication_id=$1', [publicationId], '23514');
    });
    await run('P2-PUB-003 new immutable version, pointer rollback, stale/concurrent activation and language mismatch', async () => {
      const course = entity(en, 'course');
      const previous = (await db.query('SELECT payload FROM content_versions WHERE id=$1', [course.version_id])).rows[0].payload;
      const newVersionId = randomUUID();
      await content.saveDraft(authorId, languageIds.en, { ...previous, content_version_id: newVersionId, version_code: 'p2-schema-2', title: 'New course title' });
      await approveAll(newVersionId);
      const newPubId = randomUUID();
      await content.publish({ ...publicationInput, id: newPubId, previousId: publicationId, versionCode: 'p2-publication-2', versionIds: publicationInput.versionIds.map((id) => id === course.version_id ? newVersionId : id) });
      assert.equal(await content.activate(reviewerId, newPubId, 1), 2);
      const checksums = (await db.query('SELECT id,checksum FROM publications ORDER BY id')).rows;
      const races = await Promise.allSettled([content.activate(reviewerId, publicationId, 2), content.activate(reviewerId, newPubId, 2)]);
      assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(races.filter((r) => r.status === 'rejected').length, 1);
      await content.activate(reviewerId, publicationId, 3);
      assert.deepEqual((await db.query('SELECT id,checksum FROM publications ORDER BY id')).rows, checksums);
      assert.equal((await content.catalog(languageIds.en, 'test'))[0]?.id, publicationId);
      await sqlReject(db, 'UPDATE publication_pointers SET language_id=$1 WHERE publication_id=$2', [languageIds.cs, publicationId], '23514');
      await assert.rejects(content.publish({ ...publicationInput, id: randomUUID(), languageId: languageIds.cs, versionCode: 'bad-language' }), { code: '23503' });
      await assert.rejects(content.publish({ ...publicationInput, id: randomUUID(), actorId: learnerId, versionCode: 'unauthorized' }), { code: '42501' });
      await assert.rejects(content.publish({ ...publicationInput, id: randomUUID(), channel: 'stable', versionCode: 'premature-production' }), { code: 'FORBIDDEN' });
    });
    await run('P2-AUTH-001 opaque hashed sessions, CSRF, expiry, role revocation and server-derived API ownership', async () => {
      const s = await identity.login('p2-learner@example.invalid', 'Only synthetic test identity!');
      const p = await identity.authenticate(s.token);
      assert.throws(() => identity.checkCsrf(p, 'wrong'), { code: 'FORBIDDEN' }); identity.checkCsrf(p, s.csrf);
      assert.equal((await db.query('SELECT octet_length(token_hash) AS n FROM sessions WHERE id=$1', [s.sessionId])).rows[0].n, 32);
      const app = await createApi({ ready: async () => true, close: async () => undefined }, { identity, content });
      await app.listen(0, '127.0.0.1');
      try {
        const base = await app.getUrl();
        const anonymous = await fetch(`${base}/api/v1/me`); assert.equal(anonymous.status, 401); assert.match(anonymous.headers.get('content-type') ?? '', /application\/problem\+json/);
        const login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lingvessa-client': 'web' }, body: JSON.stringify({ email: 'p2-learner@example.invalid', password: 'Only synthetic test identity!' }) });
        assert.equal(login.status, 200); const loginBody = await login.json() as { csrf_token: string }; const cookie = login.headers.get('set-cookie')!;
        for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert(cookie.includes(flag));
        const headers = { cookie: cookie.split(';')[0]!, 'content-type': 'application/json' };
        const me = await fetch(`${base}/api/v1/me`, { headers }); assert.equal(me.status, 200); assert.equal((await me.json() as { id: string }).id, learnerId);
        assert.match(me.headers.get('cache-control') ?? '', /no-store/);
        assert.equal((await fetch(`${base}/api/v1/me/active-language`, { method: 'PUT', headers, body: JSON.stringify({ language_profile_id: enProfile, expected_revision: 1 }) })).status, 403);
        const currentRevision = (await identity.settings(principal))!.revision as number;
        const updated = await fetch(`${base}/api/v1/me`, { method: 'PATCH', headers: { ...headers, 'x-csrf-token': loginBody.csrf_token }, body: JSON.stringify({ timezone: 'Europe/Prague', expected_revision: currentRevision }) });
        assert.equal(updated.status, 200); assert.equal((await updated.json() as { timezone: string }).timezone, 'Europe/Prague');
        assert.equal((await fetch(`${base}/api/v1/lesson-runs`, { headers })).status, 404);
        assert.equal((await fetch(`${base}/api/v1/auth/register`, { method: 'POST', headers, body: '{}' })).status, 404);
      } finally { await app.close(); }
      await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='content_editor'`, [learnerId]);
      await assert.rejects(identity.authenticate(s.token), { code: 'UNAUTHENTICATED' });
      const newSession = await identity.login('p2-learner@example.invalid', 'Only synthetic test identity!');
      await identity.logout(await identity.authenticate(newSession.token));
      await assert.rejects(identity.authenticate(newSession.token), { code: 'UNAUTHENTICATED' });
      for (let n = 1; n <= 9; n++) assert.equal(await identity.allowLogin('synthetic-rate-window'), n <= 8);
    });
    await run('P2-SCOPE-001 accepted P2 invariants with authorized P4 extension; P5+ absent; cascade limited to owned collection entries', async () => {
      const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).rows.map((r) => r.tablename);
      for (const table of ['speech_jobs', 'ai_runs', 'ai_sessions']) assert(!tables.includes(table));
      assert.deepEqual((await db.query(`SELECT conrelid::regclass::text AS child,confrelid::regclass::text AS parent FROM pg_constraint WHERE contype='f' AND confdeltype='c'`)).rows,[{child:'collection_entries',parent:'collections'}]);
      assert.equal((await db.query("SELECT count(*) FROM users WHERE email_normalized LIKE '%@example.invalid'")).rows[0].count, '4');
      await sqlReject(db, 'UPDATE knowledge_items SET status=$1 WHERE id=$2', ['deprecated', entity(cs, 'knowledge').id], '23514');
      await sqlReject(db, 'DELETE FROM knowledge_items WHERE id=$1', [entity(cs, 'knowledge').id], '23514');
      const reportId = randomUUID();
      await db.query(`INSERT INTO knowledge_migration_reports(id,language_id,operation,version_code,mapping,impact_report,status,created_by)
        VALUES($1,$2,'deprecate','p2-test-impact',$3,$4,'approved',$5)`, [reportId, languageIds.cs, { retained: [], deprecated: [entity(cs, 'knowledge').id] }, { mastery_tables_present: false, future_recompute_required: true }, reviewerId]);
      await sqlReject(db, 'UPDATE knowledge_migration_reports SET impact_report=$1 WHERE id=$2', [{ changed: true }, reportId], '23514');
    });
    // Schema introspection is an execution artifact; the committed Prisma view is checked separately.
    const inspected = spawnSync('pnpm', ['exec', 'prisma', 'db', 'pull', '--print'], { env, encoding: 'utf8', timeout: 45000 });
    if (inspected.status === 0) { mkdirSync('artifacts/p2', { recursive: true }); writeFileSync('artifacts/p2/introspected.prisma', inspected.stdout); }
    await db.end(); pool = undefined;
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); created = false;
    await run('P2-DB-002 clean database recreation and repeated migration/seed after teardown', async () => {
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
      migrate(); await seedBootstrap(env); await seedBootstrap(env);
      const fresh = createFoundationPool(url.toString());
      try {
        assert.equal((await fresh.query('SELECT count(*) FROM users')).rows[0].count, '0');
        assert.equal((await fresh.query('SELECT count(*) FROM languages')).rows[0].count, '2');
        assert.equal((await fresh.query('SELECT count(*) FROM publications')).rows[0].count, '0');
      } finally { await fresh.end(); }
    });
  } finally {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    mkdirSync('artifacts/p2', { recursive: true });
    writeFileSync('artifacts/p2/database-validation.json', JSON.stringify({ timestamp: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), source_sha: process.env.GITHUB_HEAD_SHA ?? null, phase: 'P2', database: 'PostgreSQL 18.6', gates: results, status: results.length === 9 && results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL' }, null, 2) + '\n');
  }
});
