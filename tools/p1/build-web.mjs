import { spawnSync } from 'node:child_process';
for (const app of ['web', 'admin']) {
  const result = spawnSync('pnpm', ['--filter', `@lingvessa/${app}`, 'build'], {
    stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
