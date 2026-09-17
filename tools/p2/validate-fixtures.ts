import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { referenceFixtureSchema } from '../../packages/content-tools/src/fixture.js';
import { executableLessonFixtureSchema } from '../../packages/content-tools/src/p3-fixture.js';
import { resolveActivity } from '../../packages/lesson-engine/src/registry.js';
const results = ['en', 'cs'].map((language) => {
  const fixture = referenceFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p2/${language}-m01.json`, 'utf8')));
  return { language, entities: fixture.entities.length, units: fixture.entities.filter((e) => e.kind === 'lesson').length, scope: fixture.scope, status: 'PASS' };
});
mkdirSync('artifacts/p2', { recursive: true });
const report = { phase: 'P2', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), results, status: 'PASS' };
writeFileSync('artifacts/p2/reference-validation.json', JSON.stringify(report, null, 2) + '\n');
const p3Results = ['en', 'cs'].flatMap((language) => ['lesson','core'].map((kind) => {
  const fixture = executableLessonFixtureSchema.parse(JSON.parse(readFileSync(`content/fixtures/p3/${language}-${kind}.json`, 'utf8')));
  if (fixture.activities.some((activity) => resolveActivity(activity).status !== 'supported')) throw new Error('Unsupported P3 fixture activity');
  return { language, kind, activities: fixture.activities.length, content_version_id: fixture.content_version_id, ancestor_versions: fixture.ancestor_versions.length, status: 'PASS' };
}));
mkdirSync('artifacts/p3', { recursive: true });
const p3Report = { phase: 'P3', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), results: p3Results, status: 'PASS' };
writeFileSync('artifacts/p3/reference-validation.json', JSON.stringify(p3Report, null, 2) + '\n');
console.log(JSON.stringify({ p2: report, p3: p3Report }));
