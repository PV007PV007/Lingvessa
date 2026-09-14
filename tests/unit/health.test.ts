import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApi } from '../../apps/api/src/app.js';
import { createWorkerHealthServer } from '../../infra/health/worker-server.js';
import { postgresProbe } from '../../infra/health/probe.js';
import { loadP1Config } from '../../infra/config/runtime.js';

test('API liveness remains available; readiness changes 503 → 200 → 503 without leaking errors', async () => {
  let state = false;
  const app = await createApi({ ready: async () => state, close: async () => undefined });
  await app.listen(0, '127.0.0.1');
  try {
    const base = await app.getUrl();
    const live = await fetch(`${base}/api/v1/health/live`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-powered-by'), null);
    for (state of [false, true, false]) {
      const result = await fetch(`${base}/api/v1/health/ready`);
      assert.equal(result.status, state ? 200 : 503);
      assert.deepEqual(await result.json(), { status: state ? 'ready' : 'not_ready' });
      assert.equal(result.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await fetch(`${base}/api/v1/lessons`)).status, 404);
  } finally { await app.close(); }
});

test('worker exposes operational probes only and redacts dependency failures', async () => {
  const server = createWorkerHealthServer({ ready: async () => { throw new Error('sensitive backend details'); }, close: async () => undefined });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    assert.equal((await fetch(`${base}/api/v1/health/live`)).status, 200);
    const result = await fetch(`${base}/api/v1/health/ready`);
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { status: 'not_ready' });
    assert.equal((await fetch(`${base}/api/v1/health/live`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/jobs`)).status, 404);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('real PostgreSQL driver handles missing DB within the timeout and drains safely', async () => {
  const probe = postgresProbe(loadP1Config({ LINGVESSA_ENV: 'local', SERVICE_NAME: 'api',
    DATABASE_URL: 'postgresql://127.0.0.1:1/lingvessa_p1_local', DATABASE_CONNECT_TIMEOUT_MS: '200' }));
  try { assert.equal(await probe.ready(), false); }
  finally { await probe.close(); }
  assert.equal(await probe.ready(), false);
});
