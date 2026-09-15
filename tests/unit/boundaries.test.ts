import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

test('dependency gate rejects a framework import and infrastructure re-export in domain', () => {
  const filename = `packages/domain/src/negative-${randomBytes(6).toString('hex')}.ts`;
  try {
    for (const source of [
      "export { Injectable } from '@nestjs/common';",
      "export { loadP1Config } from '../../../infra/config/runtime.js';",
    ]) {
      // Second case uses a real path from packages/domain/src to root infra.
      writeFileSync(filename, source);
      const result = spawnSync('pnpm', ['exec', 'depcruise', '--config', '.dependency-cruiser.cjs', filename], { encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /domain-is-pure/);
    }
  } finally { unlinkSync(filename); }
});
