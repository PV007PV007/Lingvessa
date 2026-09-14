import { loadP1Config, safeStartupRecord } from '../../../infra/config/runtime.js';
import { postgresProbe } from '../../../infra/health/probe.js';
import { createApi } from './app.js';

async function main() {
  const config = loadP1Config({ ...process.env, SERVICE_NAME: 'api' });
  const probe = postgresProbe(config);
  const app = await createApi(probe);
  let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.close().then(() => probe.close());
  });
  await app.listen(config.PORT, config.HOST);
  console.log(JSON.stringify({ event: 'started', ...safeStartupRecord(config) }));
}
main().catch(() => {
  console.error('API startup failed; configuration and connection details redacted.');
  process.exitCode = 1;
});
