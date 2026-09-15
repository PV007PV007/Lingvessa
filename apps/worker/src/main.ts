import { loadP1Config, safeStartupRecord } from '../../../infra/config/runtime.js';
import { postgresProbe } from '../../../infra/health/probe.js';
import { createWorkerHealthServer } from '../../../infra/health/worker-server.js';

try {
  const config = loadP1Config({ ...process.env, SERVICE_NAME: 'worker' });
  const probe = postgresProbe(config);
  const server = createWorkerHealthServer(probe);
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
    server.close(() => { void probe.close(); });
  });
  server.on('error', () => {
    console.error('Worker listener failed; details redacted.');
    void probe.close();
    process.exitCode = 1;
  });
  server.listen(config.PORT, config.HOST, () => {
    console.log(JSON.stringify({ event: 'started', ...safeStartupRecord(config) }));
  });
} catch {
  console.error('Worker startup failed; configuration values redacted.');
  process.exitCode = 1;
}
