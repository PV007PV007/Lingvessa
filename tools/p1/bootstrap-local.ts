import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

if (spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status !== 0) {
  console.error('Docker with Compose is required for local PostgreSQL 18.6. No database was changed.');
  process.exit(1);
}
const directory = resolve('.local');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = resolve(directory, 'runtime.env');
let vars: Record<string, string>;
if (existsSync(filename)) {
  vars = Object.fromEntries(readFileSync(filename, 'utf8').trim().split('\n').map((line) => {
    const equals = line.indexOf('='); return [line.slice(0, equals), line.slice(equals + 1)];
  }));
} else {
  const password = randomBytes(32).toString('hex');
  vars = {
    LINGVESSA_ENV: 'local', SERVICE_NAME: 'api', LINGVESSA_LOCAL_DB_PORT: '55432',
    LINGVESSA_LOCAL_DB_PASSWORD: password,
    DATABASE_URL: `postgresql://lingvessa_local:${password}@127.0.0.1:55432/lingvessa_p1_local`,
  };
  writeFileSync(filename, Object.entries(vars).map(([k, v]) => `${k}=${v}\n`).join(''), { mode: 0o600, flag: 'wx' });
}
const env = { ...process.env, ...vars };
for (const [cmd, ...args] of [
  ['docker', 'compose', '-f', 'infra/local/compose.yml', 'up', '-d', '--wait'],
  ['pnpm', 'db:generate'], ['pnpm', 'db:migrate'], ['pnpm', 'db:seed'],
]) {
  if (!cmd) throw new Error('Missing bootstrap command');
  const result = spawnSync(cmd, args, { env, encoding: 'utf8', timeout: 180000 });
  if (result.status !== 0) {
    console.error(`Local bootstrap failed at ${cmd} ${args.filter((s) => s !== '-d').join(' ')}; values redacted.`);
    process.exit(1);
  }
}
console.log('Local PostgreSQL 18.6 migrated and seeded. Credentials remain in ignored .local/runtime.env.');
