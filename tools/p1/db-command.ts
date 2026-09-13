import { spawnSync } from 'node:child_process';
import { localDatabaseUrl } from '../../infra/local/database-guard.js';

const commands: Record<string, string[]> = {
  generate: ['generate'], validate: ['validate'], migrate: ['migrate', 'deploy'],
  status: ['migrate', 'status'], seed: ['db', 'seed'],
};
const name = process.argv[2] ?? '';
const args = commands[name];
if (!args) throw new Error('Expected generate, validate, migrate, status or seed');
try {
  if (!['generate', 'validate'].includes(name)) localDatabaseUrl(process.env);
  const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
    encoding: 'utf8', env: { ...process.env, DEBUG: '' }, timeout: 120000,
  });
  // Prisma may print datasource URLs/errors. Keep console output free of values.
  if (result.status !== 0) {
    console.error(`Prisma ${name} failed (exit ${result.status ?? 'not-started'}). Details withheld to protect credentials.`);
    process.exitCode = 1;
  } else console.log(`Prisma ${name}: PASS`);
} catch {
  console.error('Database command refused: valid isolated local configuration required.');
  process.exitCode = 1;
}
