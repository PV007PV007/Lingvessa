import { loadP1Config, safeStartupRecord } from '../../../infra/config/runtime.js';
import { postgresProbe } from '../../../infra/health/probe.js';
import { createWorkerHealthServer } from '../../../infra/health/worker-server.js';
import { createFoundationPool } from '../../../infra/persistence/database.js';
import { OutboxRepository, startOutboxLoop } from '../../../infra/persistence/outbox.js';

try {
  const config = loadP1Config({ ...process.env, SERVICE_NAME: 'worker' });
  const probe = postgresProbe(config);
  const pool = createFoundationPool(config.DATABASE_URL!);
  // The P3 default consumer acknowledges redacted learning diagnostics. A remote analytics
  // sink may be added later; its outage can never roll back accepted learning progress.
  const stopOutbox = startOutboxLoop(new OutboxRepository(pool), 'analytics-v1', async (event) => { console.log(JSON.stringify({ event: 'outbox_delivery', event_key: event.event_key, event_type: event.event_type, event_version: event.event_version })); });
  const server = createWorkerHealthServer(probe);
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
    stopOutbox();
    server.close(() => { void Promise.all([probe.close(), pool.end()]); });
  });
  server.on('error', () => {
    console.error('Worker listener failed; details redacted.');
    stopOutbox();
    void Promise.all([probe.close(), pool.end()]);
    process.exitCode = 1;
  });
  server.listen(config.PORT, config.HOST, () => {
    console.log(JSON.stringify({ event: 'started', ...safeStartupRecord(config) }));
  });
} catch {
  console.error('Worker startup failed; configuration values redacted.');
  process.exitCode = 1;
}
