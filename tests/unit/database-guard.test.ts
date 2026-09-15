import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDatabaseUrl } from '../../infra/local/database-guard.js';

test('bootstrap refuses production, remote and unrelated databases', () => {
  for (const env of [
    { LINGVESSA_ENV: 'production', DATABASE_URL: 'postgresql://localhost/lingvessa_p1_local' },
    { LINGVESSA_ENV: 'local', DATABASE_URL: 'postgresql://db.example.com/lingvessa_p1_local' },
    { LINGVESSA_ENV: 'local', DATABASE_URL: 'postgresql://localhost/postgres' },
  ]) assert.throws(() => localDatabaseUrl(env));
});

test('bootstrap accepts only explicit local synthetic database names', () => {
  for (const name of ['lingvessa_p1_local', 'lingvessa_p1_test_ab12']) {
    const DATABASE_URL = `postgresql://127.0.0.1/${name}`;
    assert.equal(localDatabaseUrl({ LINGVESSA_ENV: 'local', DATABASE_URL }), DATABASE_URL);
  }
});
