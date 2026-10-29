import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { secretRuleIds } from './secret-rules.js';
import { reviewedNonSecretFixture } from './reviewed-secret-fixtures.js';

const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const findings: { location: string; rules: string[] }[] = [];
const reviewedFixtures: {location:string;rules:string[]}[]=[];
function inspect(location: string, bytes: Buffer) {
  if (bytes.subarray(0, 8192).includes(0) || bytes.subarray(0, 4).toString() === '%PDF') return;
  const rawRules = secretRuleIds(bytes.toString('utf8'));
  const reviewed=reviewedNonSecretFixture(location,bytes).filter(rule=>rawRules.includes(rule));
  if(reviewed.length)reviewedFixtures.push({location,rules:reviewed});
  const rules = rawRules.filter(rule=>!reviewed.includes(rule));
  if (rules.length) findings.push({ location, rules });
}
for (const file of new Set(files)) {
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.example')) {
    findings.push({ location: file, rules: ['runtime-env-file-in-git'] });
  }
  inspect(file, readFileSync(file));
}
// Deleted secrets still matter. Scan every reachable historical blob, not just HEAD.
const blobs = new Set<string>();
for (const line of git(['rev-list', '--objects', '--all']).trim().split('\n')) {
  const [oid, ...parts] = line.split(' ');
  if (!oid || !parts.length) continue;
  const type = git(['cat-file', '-t', oid]).trim();
  if (type !== 'blob' || blobs.has(oid)) continue;
  blobs.add(oid);
  inspect(`history:${oid.slice(0, 12)}:${parts.join(' ')}`, execFileSync('git', ['cat-file', 'blob', oid], { maxBuffer: 32 * 1024 * 1024 }));
}
console.log(JSON.stringify({ source_files: new Set(files).size, history_blobs: blobs.size, findings, reviewed_non_secret_fixtures:reviewedFixtures }, null, 2));
if (findings.length) process.exitCode = 1;
