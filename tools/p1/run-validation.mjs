import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('artifacts/p1');
mkdirSync(directory, { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  node: process.versions.node,
  phase: 'P1', p2_authorized: false, commands: [], status: 'NOT_READY',
};
function run(id, command) {
  const start = Date.now();
  const result = spawnSync(command[0], command.slice(1), {
    encoding: 'utf8', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    maxBuffer: 16 * 1024 * 1024, timeout: 1200000,
  });
  writeFileSync(resolve(directory, `${id}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
  const record = { id, command, exit_code: result.status, status: result.status === 0 ? 'PASS' : 'FAIL',
    duration_ms: Date.now() - start, log: `artifacts/p1/${id}.log` };
  report.commands.push(record);
  console.log(`${id}: ${record.status} (exit ${record.exit_code})`);
  return record.status === 'PASS';
}
const installed = run('frozen-install', ['pnpm', 'install', '--frozen-lockfile']);
const baseline = installed && run('baseline-integrity', ['pnpm', 'validate:baseline']);
if (baseline) {
  run('quality', ['pnpm', 'check']);
  run('dependency-audit', ['pnpm', 'audit:dependencies']);
  const bootstrapped = run('postgres-bootstrap', ['pnpm', 'bootstrap:local']);
  if (bootstrapped) run('database-integration', ['node', '--env-file=.local/runtime.env', '--import', 'tsx', '--test', 'tests/integration/bootstrap.test.ts']);
  else report.commands.push({ id: 'database-integration', command: ['node', '--env-file=.local/runtime.env', '--import', 'tsx', '--test', 'tests/integration/bootstrap.test.ts'],
    status: 'NOT_RUN_DEPENDENCY_FAILED', reason: 'PostgreSQL bootstrap did not pass; no skip/pass substitution.' });
  run('container-build-and-recovery', ['pnpm', 'test:containers']);
}
report.status = report.commands.length === 7 && report.commands.every((r) => r.status === 'PASS') ? 'PASS' : 'NOT_READY';
writeFileSync(resolve(directory, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`P1: ${report.status}`);
if (report.status !== 'PASS') process.exitCode = 1;
