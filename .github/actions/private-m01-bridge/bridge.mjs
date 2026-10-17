// Minimal v4 artifact wire protocol, reviewed against @actions/artifact 2.3.2
// used by the pinned upload-artifact action. No general token leaves this runner.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'PV007PV007/Lingvessa';
const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const ensure = (condition) => { if (!condition) throw new Error('Private input boundary rejected'); };
let phase = 'preflight';
let failedHttpStatus = null;

export function validateBlobUrl(value, writing = false) {
  const url = new URL(value);
  ensure(url.protocol === 'https:' && url.hostname.endsWith('.blob.core.windows.net') &&
    !url.username && !url.password && !url.port && !url.hash &&
    url.searchParams.get('sr') === 'b' && url.searchParams.has('sig'));
  if (writing) {
    const permissions = url.searchParams.get('sp') ?? '';
    ensure(permissions.includes('w') && [...permissions].every((p) => 'rcw'.includes(p)));
    const expiry = Date.parse(url.searchParams.get('se'));
    ensure(expiry > Date.now() && expiry <= Date.now() + 86400000);
  }
  return url.href;
}

export function validateRelease(release, plan) {
  ensure(release.id === plan.release_id && release.draft === true && release.prerelease === true &&
    release.tag_name === 'p5-m01-private-input-20261014' && release.name === 'P5 private M01 input — DO NOT PUBLISH' &&
    release.body?.includes(`P5_PRIVATE_INPUT_SHA256=${plan.archive.sha256}`));
}

async function response(url, options = {}) {
  const result = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(180000) });
  if (!result.ok) failedHttpStatus = result.status;
  ensure(result.ok);
  return result;
}

async function main() {
  process.umask(0o077);
  const env = process.env;
  const plan = JSON.parse(await readFile(join(root, 'docs/p5/integration-20261017/private-transfer-plan.json'), 'utf8'));
  const approval = JSON.parse(await readFile(join(root, 'docs/p5/m01-completion-20261014/owner-approval.json'), 'utf8'));
  const approved = approval.approved_deliverables.find((item) => item.filename === plan.archive.filename);
  ensure(approved?.sha256 === plan.archive.sha256 && approved?.bytes === plan.archive.bytes);
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  const trusted = (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/implementation/p5-media-speech') ||
    (env.GITHUB_EVENT_NAME === 'pull_request' && event.number === 5 &&
     event.pull_request?.head?.repo?.full_name === REPO && event.pull_request?.head?.ref === 'implementation/p5-media-speech');
  ensure(trusted && env.GITHUB_REPOSITORY === REPO && plan.repository === REPO && /^[a-f0-9]{40}$/.test(env.GITHUB_HEAD_SHA));
  const token = env.GH_TOKEN;
  ensure(token && env.ACTIONS_RUNTIME_TOKEN);
  const ghHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const api = async (path) => (await response(`https://api.github.com/repos/${REPO}${path}`, { headers: ghHeaders })).json();
  ensure((await api('')).private === true);
  const release = await api(`/releases/${plan.release_id}`);
  validateRelease(release, plan);
  const assets = await api(`/releases/${plan.release_id}/assets?per_page=100`);
  ensure(assets.length < 100);
  const names = [plan.archive.filename, plan.archive.filename.replace('.zip', '(1).zip')];
  const candidates = assets.filter((a) => names.includes(a.name));
  ensure(candidates.length <= 1);
  if (candidates.length) {
    const asset = candidates[0];
    ensure(asset.state === 'uploaded' && asset.size === plan.archive.bytes &&
      (!asset.digest || asset.digest === `sha256:${plan.archive.sha256}`));
    console.log(JSON.stringify({ status: 'EXISTING_PRIVATE_ASSET_REUSED', asset_id: asset.id,
      note: 'The following input job independently downloads and verifies its bytes.' }));
    return;
  }
  const temp = resolve(env.RUNNER_TEMP, `p5-private-bridge-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`);
  ensure(!temp.startsWith(root + sep) && temp !== root);
  await mkdir(temp, { mode: 0o700 });
  const claims = JSON.parse(Buffer.from(env.ACTIONS_RUNTIME_TOKEN.split('.')[1], 'base64url').toString());
  const scope = claims.scp.split(' ').find((item) => item.startsWith('Actions.Results:'))?.split(':');
  ensure(scope?.length === 3 && scope[1] && scope[2]);
  const ids = { workflow_run_backend_id: scope[1], workflow_job_run_backend_id: scope[2] };
  const service = new URL(env.ACTIONS_RESULTS_URL);
  ensure(service.protocol === 'https:' && service.hostname.endsWith('.actions.githubusercontent.com') && !service.port);
  const rpc = async (method, body) => (await response(new URL(`/twirp/github.actions.results.api.v1.ArtifactService/${method}`, service.origin), {
    method: 'POST', headers: { Authorization: `Bearer ${env.ACTIONS_RUNTIME_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ids, ...body }),
  })).json();
  const create = async (name) => {
    const created = await rpc('CreateArtifact', { name, version: 4, expires_at: new Date(Date.now() + 86400000).toISOString() });
    ensure(created.ok);
    return validateBlobUrl(created.signed_upload_url ?? created.signedUploadUrl, true);
  };
  const finalize = async (name, data) => {
    const result = await rpc('FinalizeArtifact', { name, size: String(data.bytes), hash: `sha256:${data.sha256}` });
    ensure(result.ok);
    return result.artifact_id ?? result.artifactId;
  };
  phase = 'create_single_object_upload';
  const name = `p5-private-m01-ingress-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  const signedUploadUrl = await create(name);
  const ackContent = JSON.stringify({ type: 'P5_PRIVATE_INPUT_UPLOAD_ACK_V1', repository: REPO,
    run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, source_sha: env.GITHUB_HEAD_SHA,
    artifact_name: name, envelope: plan.envelope, nonce: randomUUID() }) + '\n';
  const ackSha = createHash('sha1').update(`blob ${Buffer.byteLength(ackContent)}\0`).update(ackContent).digest('hex');
  const control = { repository: REPO, source_sha: env.GITHUB_HEAD_SHA, release_id: plan.release_id,
    run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, archive: plan.archive,
    envelope: plan.envelope, artifact_name: name, signed_upload_url: signedUploadUrl,
    ack_content: ackContent, ack_blob_sha: ackSha };
  const helper = join(root, 'tools/p5/private-m01-envelope.py');
  const controlZip = join(temp, 'control.zip');
  execFileSync('python3', [helper, 'control', '-', controlZip], { input: JSON.stringify(control), stdio: ['pipe', 'pipe', 'pipe'] });
  const controlBytes = await readFile(controlZip);
  const controlName = `p5-private-upload-control-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  const controlUrl = await create(controlName);
  const put = await response(controlUrl, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob',
    'x-ms-version': '2021-08-06', 'Content-Type': 'application/zip', 'If-None-Match': '*' }, body: controlBytes });
  ensure(put.status === 201);
  const controlId = await finalize(controlName, { bytes: controlBytes.length, sha256: sha256(controlBytes) });
  console.log(JSON.stringify({ status: 'AWAITING_SINGLE_OBJECT_UPLOAD', control_artifact_id: controlId,
    control_artifact_name: controlName, ack_blob_sha: ackSha, source_sha: env.GITHUB_HEAD_SHA }));
  phase = 'wait_for_upload_receipt';
  let acknowledged = false;
  const deadline = Date.now() + 12 * 60000;
  while (Date.now() < deadline) {
    const result = await fetch(`https://api.github.com/repos/${REPO}/git/blobs/${ackSha}`, {
      headers: ghHeaders, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (result.status === 200) {
      const blob = await result.json();
      ensure(blob.encoding === 'base64' && Buffer.from(blob.content, 'base64').toString() === ackContent);
      acknowledged = true;
      break;
    }
    ensure(result.status === 404);
    await new Promise((done) => setTimeout(done, 5000));
  }
  ensure(acknowledged);
  phase = 'verify_received_envelope';
  const ingressId = await finalize(name, plan.envelope);
  const signed = await rpc('GetSignedArtifactURL', { name });
  const download = await response(validateBlobUrl(signed.signed_url ?? signed.signedUrl));
  const chunks = [];
  let count = 0;
  for await (const chunk of download.body) {
    count += chunk.length;
    ensure(count <= plan.envelope.bytes);
    chunks.push(chunk);
  }
  const envelope = Buffer.concat(chunks);
  ensure(envelope.length === plan.envelope.bytes && sha256(envelope) === plan.envelope.sha256);
  const envelopePath = join(temp, 'envelope.zip');
  await writeFile(envelopePath, envelope, { flag: 'wx', mode: 0o600 });
  const archivePath = join(temp, plan.archive.filename);
  execFileSync('python3', [helper, 'unpack', envelopePath, archivePath], { stdio: 'pipe' });
  const archive = await readFile(archivePath);
  ensure(archive.length === plan.archive.bytes && sha256(archive) === plan.archive.sha256);
  phase = 'attach_verified_private_archive';
  validateRelease(await api(`/releases/${plan.release_id}`), plan);
  // No overwrite/delete endpoint. A conflicting upload fails closed and is inspected on retry.
  const upload = await response(`https://uploads.github.com/repos/${REPO}/releases/${plan.release_id}/assets?name=${encodeURIComponent(plan.archive.filename)}`, {
    method: 'POST', headers: { ...ghHeaders, 'Content-Type': 'application/zip' }, body: archive });
  ensure(upload.status === 201);
  const asset = await upload.json();
  ensure(asset.state === 'uploaded' && asset.size === plan.archive.bytes && asset.name === plan.archive.filename &&
    (!asset.digest || asset.digest === `sha256:${plan.archive.sha256}`));
  console.log(JSON.stringify({ status: 'PRIVATE_ARCHIVE_ATTACHED', source_sha: env.GITHUB_HEAD_SHA,
    release_id: plan.release_id, asset_id: asset.id, ingress_artifact_id: ingressId,
    archive_sha256: plan.archive.sha256, archive_bytes: plan.archive.bytes,
    next: 'Independent release download, all 420 immutable WAV checks, real PostgreSQL/S3 import.' }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error(JSON.stringify({ status: 'PRIVATE_BRIDGE_FAILED', phase, http_status: failedHttpStatus,
      note: 'Remote responses, capabilities and credentials suppressed' }));
    process.exitCode = 1;
  });
}
