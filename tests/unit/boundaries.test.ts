import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('dependency gate rejects a framework import and infrastructure re-export in domain', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lingvessa-boundaries-'));
  const executable = resolve('node_modules/.bin/depcruise');
  try {
    mkdirSync(join(directory, 'packages/domain/src'), { recursive: true });
    mkdirSync(join(directory, 'infra/config'), { recursive: true });
    cpSync('.dependency-cruiser.cjs', join(directory, '.dependency-cruiser.cjs'));
    cpSync('tsconfig.json', join(directory, 'tsconfig.json'));
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
    writeFileSync(join(directory, 'infra/config/runtime.ts'), 'export const loadP1Config = () => ({});');
    for (const source of [
      "export { Injectable } from '@nestjs/common';",
      "export { loadP1Config } from '../../../infra/config/runtime.js';",
    ]) {
      writeFileSync(join(directory, 'packages/domain/src/negative.ts'), source);
      const result = spawnSync(executable, ['--config', '.dependency-cruiser.cjs', 'packages/domain/src/negative.ts'], { cwd: directory, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /domain-is-pure/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
