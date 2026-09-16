import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { referenceFixtureSchema } from '../../packages/content-tools/src/fixture.js';
const results = ['en', 'cs'].map((language) => {
  const fixture = referenceFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p2/${language}-m01.json`, 'utf8')));
  return { language, entities: fixture.entities.length, units: fixture.entities.filter((e) => e.kind === 'lesson').length, scope: fixture.scope, status: 'PASS' };
});
mkdirSync('artifacts/p2', { recursive: true });
const report = { phase: 'P2', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), results, status: 'PASS' };
writeFileSync('artifacts/p2/reference-validation.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
