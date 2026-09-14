import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('Container gate NOT RUN: an operational Docker daemon is required.');
  process.exit(1);
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const tag = `p1-${commit.slice(0, 12)}`;
const images: Record<string, { tag: string; image_id: string }> = {};
for (const target of ['api', 'worker', 'web', 'admin']) {
  const imageTag = `lingvessa-${target}:${tag}`;
  const result = spawnSync('docker', ['build', '--file', 'infra/containers/Dockerfile', '--target', target,
    '--label', `org.opencontainers.image.revision=${commit}`, '--tag', imageTag, '.'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
  images[target] = { tag: imageTag, image_id: execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', imageTag], { encoding: 'utf8' }).trim() };
}
mkdirSync('artifacts/p1', { recursive: true });
writeFileSync('artifacts/p1/container-build.json', JSON.stringify({ commit, tag, images }, null, 2) + '\n');

if (process.argv.includes('--smoke')) {
  // bootstrap:local must have completed first. Never creates/replaces credentials here.
  const args = ['compose', '--env-file', '.local/runtime.env', '-f', 'infra/development/compose.yml'];
  const env = { ...process.env, LINGVESSA_IMAGE_TAG: tag };
  const compose = (...command: string[]) => {
    const result = spawnSync('docker', [...args, ...command], { env, stdio: 'pipe', timeout: 180000 });
    if (result.status !== 0) throw new Error(`Compose ${command[0]} failed; output redacted`);
  };
  async function expectStatus(url: string, status: number) {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (response.status === status) return;
      } catch { /* Service may still be starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Health gate failed: expected ${status} at ${url}`);
  }
  try {
    compose('up', '-d', '--wait');
    for (const port of [3002, 3003]) await expectStatus(`http://127.0.0.1:${port}/api/v1/health/ready`, 200);
    for (const port of [3000, 3001]) await expectStatus(`http://127.0.0.1:${port}/health/ready`, 200);
    compose('stop', 'postgres');
    for (const port of [3002, 3003]) {
      await expectStatus(`http://127.0.0.1:${port}/api/v1/health/ready`, 503);
      await expectStatus(`http://127.0.0.1:${port}/api/v1/health/live`, 200);
    }
    compose('start', 'postgres');
    for (const port of [3002, 3003]) await expectStatus(`http://127.0.0.1:${port}/api/v1/health/ready`, 200);
    writeFileSync('artifacts/p1/container-smoke.json', JSON.stringify({ commit, status: 'PASS', checks: ['four services ready', 'DB down => API/worker 503', 'liveness remains 200', 'DB restored => readiness 200'] }, null, 2) + '\n');
  } finally {
    // Restore the existing synthetic database and stop only this P1 app stack.
    compose('start', 'postgres');
    compose('stop', 'web', 'admin', 'api', 'worker');
  }
}
