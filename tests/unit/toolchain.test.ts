import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('rejects an unapproved package manager before installation', () => {
  const result = spawnSync(process.execPath, ['tools/p1/check-toolchain.mjs'], {
    env: { ...process.env, npm_config_user_agent: 'npm/99.0.0' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Required pnpm/);
});
