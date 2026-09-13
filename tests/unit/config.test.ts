import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ConfigurationError, loadP1Config, parseRuntimeConfig, safeStartupRecord } from '../../infra/config/runtime.js';

const env = { LINGVESSA_ENV: 'local', SERVICE_NAME: 'api', DATABASE_URL: 'postgresql://localhost/lingvessa_local' };

test('one schema across all four environments with safe AI defaults', () => {
  for (const LINGVESSA_ENV of ['local', 'preview', 'staging', 'production']) {
    const c = loadP1Config({ ...env, LINGVESSA_ENV });
    assert.equal(c.AI_ENABLED, false);
    assert.equal(c.LEARNER_AI_ENABLED, false);
    assert.equal(c.ADMIN_AI_ENABLED, false);
    assert.equal(c.PAID_INFERENCE_ENABLED, false);
    assert.equal(c.MONTHLY_PAID_BUDGET, 0);
    assert.equal(c.AI_FREE_ONLY, true);
    assert.deepEqual(c.AI_PROVIDER_ALLOWLIST, []);
    assert.deepEqual(c.AI_CAPABILITY_QUOTAS, {});
  }
});

test('required values and malformed ports, booleans, budgets and URLs fail closed', () => {
  const patches = [{ LINGVESSA_ENV: undefined }, { DATABASE_URL: undefined }, { DATABASE_URL: 'https://localhost/db' },
    { PORT: '70000' }, { PORT: '80abc' }, { AI_ENABLED: 'FALSE' }, { PAID_INFERENCE_ENABLED: '1' },
    { MONTHLY_PAID_BUDGET: '-1' }, { MONTHLY_PAID_BUDGET: '1' }, { AI_CAPABILITY_QUOTAS: '[]' },
    { AI_CAPABILITY_QUOTAS: '{"test":-1}' }];
  for (const patch of patches) assert.throws(() => loadP1Config({ ...env, ...patch }), ConfigurationError);
});

test('phase gate prevents any AI routing or paid capability activation in P1', () => {
  for (const patch of [{ AI_ENABLED: 'true' }, { LEARNER_AI_ENABLED: 'true' }, { ADMIN_AI_ENABLED: 'true' },
    { PAID_INFERENCE_ENABLED: 'true', MONTHLY_PAID_BUDGET: '10' }, { AI_MODE: 'auto' },
    { AI_FREE_ONLY: 'false' }, { AI_PROVIDER_ALLOWLIST: 'local' }, { AI_MODEL_ALLOWLIST: 'model' },
    { AI_CAPABILITY_QUOTAS: '{"chat":1}' }]) {
    assert.throws(() => loadP1Config({ ...env, ...patch }), ConfigurationError);
  }
  assert.equal(parseRuntimeConfig({ ...env, AI_ENABLED: 'false' }).AI_ENABLED, false);
});

test('errors and startup diagnostics never include credential values', () => {
  const sentinel = randomBytes(32).toString('hex');
  const c = loadP1Config({ ...env, DATABASE_URL: `postgresql://local:${sentinel}@localhost/db` });
  assert.ok(!JSON.stringify(safeStartupRecord(c)).includes(sentinel));
  try { loadP1Config({ ...env, DATABASE_URL: sentinel }); assert.fail('expected error'); }
  catch (error) {
    assert.ok(error instanceof ConfigurationError);
    assert.ok(!String(error).includes(sentinel));
    assert.ok(!JSON.stringify(error).includes(sentinel));
  }
});

test('frontend projection has no implicit public environment variables', () => {
  assert.throws(() => loadP1Config({ ...env, NEXT_PUBLIC_DATABASE_URL: 'postgresql://localhost/db' }), ConfigurationError);
  const c = loadP1Config({ LINGVESSA_ENV: 'local', SERVICE_NAME: 'web' });
  assert.equal(c.DATABASE_URL, undefined);
});
