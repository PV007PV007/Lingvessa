import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { secretRuleIds } from '../../tools/p1/secret-rules.js';

test('secret gate catches credentials without echoing their contents', () => {
  const value = randomBytes(24).toString('hex');
  for (const text of [`postgresql://local:${value}@localhost/db`, `API_KEY="${value}"`,
    'ghp_' + 'a'.repeat(40), '-----BEGIN ' + 'PRIVATE KEY-----']) {
    const result = secretRuleIds(text);
    assert.ok(result.length > 0);
    assert.ok(!JSON.stringify(result).includes(value));
  }
});

test('templates and runtime references are not credential literals', () => {
  assert.deepEqual(secretRuleIds('DATABASE_URL=<injected at runtime>\nPASSWORD=${LOCAL_PASSWORD}'), []);
});
