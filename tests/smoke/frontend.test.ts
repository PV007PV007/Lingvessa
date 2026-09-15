import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { cpSync, readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
import { secretRuleIds } from '../../tools/p1/secret-rules.js';

async function freePort() {
  const server = createServer().listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(path, e.name)) : [join(path, e.name)]);
}

for (const app of ['web', 'admin']) test(`${app} standalone artifact serves its shell, assets and health without exposing configuration`, { timeout: 25000 }, async () => {
  const output = resolve(`apps/${app}/.next/standalone`);
  const appRoot = join(output, 'apps', app);
  cpSync(`apps/${app}/.next/static`, join(appRoot, '.next/static'), { recursive: true });
  cpSync(`apps/${app}/public`, join(appRoot, 'public'), { recursive: true });
  const sentinel = randomBytes(32).toString('hex');
  const port = await freePort();
  const child = spawn(process.execPath, [join(appRoot, 'server.js')], {
    env: { ...process.env, LINGVESSA_ENV: 'local', PORT: String(port), HOSTNAME: '127.0.0.1',
      NEXT_TELEMETRY_DISABLED: '1', RUNTIME_PRIVATE_SENTINEL: sentinel }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', (chunk) => { logs += String(chunk); });
  child.stderr.on('data', (chunk) => { logs += String(chunk); });
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) break;
      } catch { /* Await startup. */ }
      await new Promise((done) => setTimeout(done, 250));
    }
    assert.equal(response?.status, 200, 'standalone process must serve /');
    const html = await response!.text();
    assert.match(html, /lang="uk"/);
    assert.match(html, /Lingvessa/);
    assert.match(html, /Čeština/);
    const css = html.match(/href="([^"]+\.css[^"]*)"/)?.[1];
    assert.ok(css, 'built CSS must be referenced');
    assert.equal((await fetch(`http://127.0.0.1:${port}${css}`)).status, 200);
    for (const route of ['live', 'ready']) assert.equal((await fetch(`http://127.0.0.1:${port}/health/${route}`)).status, 200);
    for (const file of files(`apps/${app}/.next/static`)) {
      const body = readFileSync(file, 'utf8');
      assert.equal(body.includes(sentinel), false);
      assert.deepEqual(secretRuleIds(body), [], 'no credential signatures in public artifact');
    }
    assert.equal(html.includes(sentinel), false);
    assert.equal(logs.includes(sentinel), false);
  } finally {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    await once(child, 'exit'); clearTimeout(timer);
  }
});
