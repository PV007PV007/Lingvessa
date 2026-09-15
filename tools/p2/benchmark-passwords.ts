import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { hashPassword, verifyPassword, passwordPolicy } from '../../infra/security/passwords.js';
const samples = [];
for (let n = 0; n < 5; n++) {
  const value = randomBytes(24).toString('base64url'); const started = performance.now(); const hash = await hashPassword(value);
  const hashMs = performance.now() - started; const verifyStarted = performance.now();
  if (!await verifyPassword(value, hash)) throw new Error('Credential self-check failed');
  samples.push({ hash_ms: Math.round(hashMs), verify_ms: Math.round(performance.now() - verifyStarted) });
}
mkdirSync('artifacts/p2', { recursive: true });
const report = { timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, logical_cpus: cpus().length, policy: passwordPolicy, samples, scope: 'Implementation parameters benchmark; production capacity/latency acceptance belongs to the selected P13 hosting environment.', status: 'PASS' };
writeFileSync('artifacts/p2/password-benchmark.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
