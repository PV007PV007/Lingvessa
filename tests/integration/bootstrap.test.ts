import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { localDatabaseUrl } from '../../infra/local/database-guard.js';
import { seedBootstrap } from '../../prisma/seed.js';

test('real PostgreSQL 18.6: fresh migration, replay, bilingual seed and DB constraints', { timeout: 120000 }, async () => {
  // Intentionally fails when PostgreSQL/config is missing. A skipped DB test is not P1 evidence.
  const baseUrl = localDatabaseUrl(process.env);
  const admin = new pg.Client({ connectionString: baseUrl, connectionTimeoutMillis: 1500 });
  const database = `lingvessa_p1_test_${randomBytes(8).toString('hex')}`;
  const url = new URL(baseUrl); url.pathname = `/${database}`;
  const env = { ...process.env, LINGVESSA_ENV: 'local', DATABASE_URL: url.toString() };
  let created = false;
  let db: pg.Client | undefined;
  try {
    await admin.connect();
    assert.equal((await admin.query('SHOW server_version_num')).rows[0].server_version_num, '180006');
    await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0 ENCODING 'UTF8'`);
    created = true;
    for (let i = 0; i < 2; i++) {
      const result = spawnSync('pnpm', ['db:migrate'], { env, encoding: 'utf8', timeout: 45000 });
      assert.equal(result.status, 0, 'migration must succeed; wrapper redacts datasource diagnostics');
      await seedBootstrap(env);
    }
    db = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 1500 });
    await db.connect();
    const result = await db.query('SELECT * FROM p1_bootstrap.fixtures ORDER BY language_code');
    assert.equal(result.rowCount, 2);
    for (const file of ['english', 'czech']) {
      const expected = JSON.parse(readFileSync(new URL(`../fixtures/bootstrap/${file}.json`, import.meta.url), 'utf8'));
      const row = result.rows.find((r) => r.id === expected.id);
      assert.equal(row.sample_text, expected.sampleText);
      assert.equal(row.stable_code, expected.stableCode);
      assert.equal(row.version_code, expected.versionCode);
      assert.equal(row.locale, expected.locale);
    }
    assert.equal((await db.query('SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].count, '2');
    await assert.rejects(db.query("UPDATE p1_bootstrap.fixtures SET locale = 'en-GB' WHERE language_code = 'cs'"), { code: '23514' });
    await assert.rejects(db.query("UPDATE p1_bootstrap.fixtures SET id = 'not-a-uuid' WHERE language_code = 'en'"), { code: '22P02' });
    await db.query("UPDATE p1_bootstrap.fixtures SET sample_text = 'changed' WHERE language_code = 'cs'");
    await assert.rejects(seedBootstrap(env), /refusing to overwrite/);
  } finally {
    await db?.end();
    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
