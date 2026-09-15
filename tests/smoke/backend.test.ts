import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

for (const app of ['api', 'worker']) test(`compiled ${app}: liveness, DB-unavailable readiness, redacted logs and shutdown`, { timeout: 20000 }, async () => {
  const reserve = createServer().listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = (reserve.address() as AddressInfo).port;
  await new Promise<void>((done) => reserve.close(() => done()));
  const sentinel = randomBytes(32).toString('hex');
  const child = spawn(process.execPath, [`dist/apps/${app}/src/main.js`], {
    env: { ...process.env, LINGVESSA_ENV: 'local', PORT: String(port), HOST: '127.0.0.1',
      DATABASE_URL: `postgresql://local:${sentinel}@127.0.0.1:1/lingvessa_p1_local` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', (chunk) => { logs += String(chunk); });
  child.stderr.on('data', (chunk) => { logs += String(chunk); });
  try {
    let live: Response | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { live = await fetch(`http://127.0.0.1:${port}/api/v1/health/live`); if (live.ok) break; } catch { /* Await startup. */ }
      await new Promise((done) => setTimeout(done, 100));
    }
    assert.equal(live?.status, 200);
    const ready = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), { status: 'not_ready' });
    assert.equal(logs.includes(sentinel), false);
    assert.match(logs, /"event":"started"/);
  } finally {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    const [code, signal] = await once(child, 'exit'); clearTimeout(timer);
    assert.equal(code, 0);
    assert.equal(signal, null);
  }
});
