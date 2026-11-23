"""One explicitly requested P6 push: isolated final-only export, then read-only receipt.

The original draft is only read. No release is created/published, no audio is generated,
and the full test never falls back to synthetic input or an older run's artifact.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('p6_legacy_receiver', ROOT / 'tools/p6/receive-final-wavs.py')
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
p5, require = legacy.p5, legacy.require
REQUEST = 'docs/p6/same-run-input-request.json'
AUTHORIZATION = 'docs/p6/final-input-authorization-20261111.json'
MARKER = '[p6:verify-final-l01]'


def validate_context(q, env, event, head, parents):
    require(isinstance(q, dict) and set(q) == {'consumer_parent_sha'}
            and re.fullmatch(r'[a-f0-9]{40}', q.get('consumer_parent_sha', '')), 'Invalid one-push request')
    require(env.get('GITHUB_REPOSITORY') == legacy.REPO and env.get('GITHUB_EVENT_NAME') == 'push'
            and env.get('GITHUB_REF') == event.get('ref') == 'refs/heads/' + legacy.BRANCH
            and event.get('repository', {}).get('full_name') == legacy.REPO
            and event.get('repository', {}).get('private') is False
            and re.fullmatch(r'[a-f0-9]{40}', head)
            and env.get('GITHUB_HEAD_SHA') == head == event.get('after') == event.get('head_commit', {}).get('id')
            and parents == [event.get('before')] == [q['consumer_parent_sha']]
            and MARKER in event.get('head_commit', {}).get('message', ''), 'Not the explicitly requested P6 push')
    require(all(re.fullmatch(r'[1-9][0-9]*', env.get(k, '')) for k in
                ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REPOSITORY_ID']), 'Missing run identity')
    return {'source_sha': head, 'run_id': env['GITHUB_RUN_ID'], 'run_attempt': env['GITHUB_RUN_ATTEMPT'],
            'event': 'push', 'consumer_parent_sha': q['consumer_parent_sha']}


def context():
    approval = json.loads((ROOT / AUTHORIZATION).read_text())
    public_scope = json.loads((ROOT / p5.POLICY).read_text())
    require(approval['status'] == 'OWNER_AUTHORIZED' and approval['owner_response'] == 'ДОЗВОЛЯЮ'
            and approval['final_wav_count'] == 420 and approval['original_archive_publication_authorized'] is False
            and approval['audio_regeneration_authorized'] is False
            and json.loads((ROOT / 'docs/p6/authorization.json').read_text())['p6_authorized'] is True,
            'P6 final-input scope lacks owner authorization')
    require(public_scope['status'] == 'OWNER_AUTHORIZED' and public_scope['final_wav_count'] == 420
            and public_scope['public_final_wavs_allowed'] is True and public_scope['original_archive_public'] is False
            and public_scope['retention_days'] == 1, 'Approved final-only public transport scope changed')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    header = subprocess.check_output(['git', 'cat-file', '-p', head], cwd=ROOT, text=True).split('\n\n', 1)[0]
    return validate_context(json.loads((ROOT / REQUEST).read_text()), os.environ,
                            json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text()), head,
                            [line[7:] for line in header.splitlines() if line.startswith('parent ')])


def receipt(identity):
    record = p5.receipt(identity)
    paths = [REQUEST, AUTHORIZATION, 'docs/p6/authorization.json', '.github/workflows/p6.yml',
             'tools/p6/same-run-input.py', 'tools/p6/receive-final-wavs.py']
    record.update(schema_version='p6-same-run-final-input-1', p6_authorized=True,
                  scope='P6_DEVELOPMENT_TEST_ONLY', code_bindings={**record['code_bindings'],
                  **{p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths}})
    return record


def destination():
    temp = Path(os.environ['RUNNER_TEMP'])
    require(temp.is_absolute() and temp.resolve() == temp and temp.is_dir()
            and not temp.is_relative_to(ROOT), 'Require external runner temporary storage')
    return temp / 'p6-approved-input'


def export(identity):
    target = destination()
    require(not target.exists(), 'Input already exists; inspect before retrying')
    os.environ['P5_M01_TRANSFER_DIR'] = str(target)
    # Reuse the unchanged approved draft-identity, checksum, privacy and allowlist checks.
    p5.export(os.environ.get('GH_TOKEN', ''), identity)
    try:
        record = receipt(identity)
        (target / p5.RECEIPT).write_text(json.dumps(record, indent=2) + '\n')
        require(p5.verify_wavs(target) == record['audio_bytes'], 'Final WAV verification failed')
    except BaseException:
        shutil.rmtree(target)
        raise


def artifact_identity(identity, artifact, artifact_id, digest, repository_id):
    require(type(artifact_id) is int and artifact_id > 0 and re.fullmatch(r'[a-f0-9]{64}', digest),
            'Invalid dependency artifact output')
    w = artifact.get('workflow_run') or {}
    require(w.get('id') == int(identity['run_id']) and w.get('head_sha') == identity['source_sha']
            and w.get('head_branch') == legacy.BRANCH and w.get('repository_id') == repository_id
            and artifact.get('id') == artifact_id and artifact.get('expired') is False
            and artifact.get('name') == f"p6-approved-audio-{identity['run_id']}-{identity['run_attempt']}"
            and artifact.get('digest') == 'sha256:' + digest
            and type(artifact.get('size_in_bytes')) is int and 0 < artifact['size_in_bytes'] <= 40 * 1024 * 1024,
            'Artifact differs from the successful same-run transport job')


def unpack(archive, target, size, digest, expected):
    require(archive.is_absolute() and archive.is_file() and not archive.is_symlink()
            and archive.stat().st_size == size and p5.sha(archive) == digest, 'ZIP checksum or length differs')
    require(target.is_absolute() and target.resolve() == target and target.parent.is_dir()
            and not target.is_relative_to(ROOT) and not target.exists(), 'Require a new external directory')
    with zipfile.ZipFile(archive) as z:
        lengths = {e['path']: e['bytes'] for e in p5.catalog()}
        info = z.getinfo(p5.RECEIPT)
        require(0 < info.file_size <= 16384, 'Invalid receipt length')
        lengths.update({p5.RECEIPT: info.file_size, 'ATTRIBUTION.md': len(p5.attribution().encode())})
        legacy.validate_members(z.infolist(), lengths)
        require(json.loads(z.read(info)) == expected, 'Receipt or immutable code bindings differ')
        with tempfile.TemporaryDirectory(prefix='p6-verified-', dir=target.parent) as temporary:
            staged = Path(temporary) / 'input'
            staged.mkdir(mode=0o700)
            for name in sorted(lengths):
                path = staged / name  # exact immutable allowlist, checked before any extraction
                path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with path.open('xb') as out:
                    out.write(z.read(name))
            require(p5.verify_wavs(staged) == expected['audio_bytes'], 'WAV bytes differ')
            require(not target.exists(), 'Destination already exists')
            staged.rename(target)


def receive(identity):
    require(os.environ.get('P6_INPUT_JOB_RESULT') == 'success', 'Input job did not succeed')
    artifact_id = int(os.environ['P6_INPUT_ARTIFACT_ID'])
    digest = os.environ['P6_INPUT_SHA256']
    metadata = json.loads(legacy.gh(f'/actions/artifacts/{artifact_id}'))
    artifact_identity(identity, metadata, artifact_id, digest, int(os.environ['GITHUB_REPOSITORY_ID']))
    target, record = destination(), receipt(identity)
    with tempfile.TemporaryDirectory(prefix='p6-download-', dir=target.parent) as temporary:
        archive = Path(temporary) / 'final.zip'
        with archive.open('xb') as out:
            legacy.gh(f'/actions/artifacts/{artifact_id}/zip', out)
        unpack(archive, target, metadata['size_in_bytes'], digest, record)
    result = {**identity, 'consumer_sha': identity['source_sha'], 'status': 'VERIFIED_FINAL_ONLY_INPUT',
              'artifact_id': artifact_id, 'zip_sha256': digest, 'zip_bytes': metadata['size_in_bytes'],
              'files': 420, 'languages': record['languages'], 'audio_bytes': record['audio_bytes'],
              'attribution_verified': True, 'code_bindings': record['code_bindings'],
              'original_archive_received': False, 'audio_regenerated': False,
              'postgresql_executed': False, 's3_executed': False, 'milestone_status': 'NOT_READY'}
    report = ROOT / 'artifacts/p6/l01-input.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['export', 'receive'])
    args = parser.parse_args()
    try:
        identity = context()
        (export if args.mode == 'export' else receive)(identity)
    except Exception:
        raise SystemExit('P6 approved input failed; remote details and original archive identifiers suppressed') from None
