#!/usr/bin/env python3
"""Owner-authorized final WAV relay. The original archive never enters an artifact."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import wave

ROOT = Path(__file__).resolve().parents[2]
POLICY = 'docs/p5/public-test-input-20261026/owner-scope.json'
MANIFEST = 'assets/media/m01/source-all-assets.json'
ATTRIBUTION = 'docs/p5/m01-completion-attribution.md'
PROFILE = 'PUBLIC_APPROVED_WAVS'
RECEIPT = 'm01-approved-input.json'


class InputError(RuntimeError):
    """Messages are fixed strings; remote details and archive identifiers stay private."""


def require(condition, message):
    if not condition:
        raise InputError(message)


def load_helper(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools/p5' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


transport = load_helper('p5_existing_transport', 'private-m01-transfer.py')
staging = load_helper('p5_existing_staging', 'stage-m01-audio.py')


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def context():
    env = os.environ
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text())
    source = env.get('GITHUB_HEAD_SHA', '')
    require(env.get('GITHUB_REPOSITORY') == transport.REPOSITORY and
            re.fullmatch('[a-f0-9]{40}', source), 'Unexpected repository or source')
    if env.get('GITHUB_EVENT_NAME') == 'push':
        trusted = (env.get('GITHUB_REF') == 'refs/heads/implementation/p5-media-speech'
                   and event.get('after') == source)
    else:
        pr = event.get('pull_request', {})
        trusted = (env.get('GITHUB_EVENT_NAME') == 'pull_request' and event.get('number') == 5
                   and pr.get('head', {}).get('repo', {}).get('full_name') == transport.REPOSITORY
                   and pr.get('head', {}).get('ref') == 'implementation/p5-media-speech'
                   and pr.get('head', {}).get('sha') == source)
    require(trusted, 'Only the authorized P5 branch and same-repository PR are allowed')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip() == source,
            'Checkout does not match the event source')
    for key in ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT']:
        require(env.get(key, '').isdigit(), 'Missing run identity')
    policy = json.loads((ROOT / POLICY).read_text())
    require(policy['status'] == 'OWNER_AUTHORIZED' and policy['final_wav_count'] == 420
            and policy['public_final_wavs_allowed'] is True and policy['original_archive_public'] is False
            and policy['retention_days'] == 1 and policy['p6_authorized'] is False,
            'Public test-input scope is not authorized')
    return {'source_sha': source, 'run_id': env['GITHUB_RUN_ID'], 'run_attempt': env['GITHUB_RUN_ATTEMPT'],
            'event': env['GITHUB_EVENT_NAME']}


def anonymous_denied(url, *, binary=False):
    headers = {'User-Agent': 'Lingvessa-P5-input-privacy',
               'Accept': 'application/octet-stream' if binary else 'application/vnd.github+json'}
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.build_opener(transport.NoRedirect()).open(request, timeout=60):
            raise InputError('Original archive is anonymously accessible; export refused')
    except urllib.error.HTTPError as error:
        require(error.code == 404, 'Original archive access boundary is unproven')


def preflight(token):
    require(bool(token), 'Ephemeral isolated-job token is required')
    repo = transport.api('', token)
    require(repo.get('full_name') == transport.REPOSITORY and repo.get('private') is False,
            'This profile requires the authorized public repository')
    release_path = '/releases/' + str(transport.RELEASE_ID)
    transport.validate_release(transport.api(release_path, token))
    assets = transport.api(release_path + '/assets?per_page=100', token)
    names = {transport.EXPECTED['filename'], transport.EXPECTED['filename'].removesuffix('.zip') + '(1).zip'}
    candidates = [asset for asset in assets if asset.get('name') in names]
    require(len(assets) < 100 and len(candidates) == 1, 'Approved input is missing or ambiguous')
    asset = candidates[0]
    require(asset.get('id') == transport.ASSET_ID and asset.get('state') == 'uploaded'
            and asset.get('size') == transport.EXPECTED['bytes']
            and asset.get('digest') in (None, 'sha256:' + transport.EXPECTED['sha256']),
            'Pinned input identity mismatch')
    browser = urllib.parse.urlsplit(asset.get('browser_download_url', ''))
    require(browser.scheme == 'https' and browser.hostname == 'github.com' and not browser.port
            and not browser.username and not browser.password and not browser.query and not browser.fragment
            and browser.path.startswith('/' + transport.REPOSITORY + '/releases/download/'),
            'Unexpected archive download location')
    anonymous_denied(transport.API + release_path)
    anonymous_denied(transport.API + '/releases/assets/' + str(transport.ASSET_ID), binary=True)
    anonymous_denied(browser.geturl(), binary=True)
    return asset


def catalog():
    entries = json.loads((ROOT / MANIFEST).read_text())
    require(len(entries) == 420 and len({x['path'] for x in entries}) == 420,
            'Final WAV manifest must contain exactly 420 unique paths')
    require(Counter(x['language'] for x in entries) == {'en': 210, 'cs': 210}, 'Language counts differ')
    records = {}
    for path in sorted((ROOT / 'assets/media/m01/records').glob('audio-*.json')):
        for record in json.loads(path.read_text()):
            key = record['metadata']['asset_id']
            require(key not in records, 'Duplicate immutable asset record')
            records[key] = record
    require(len(records) == 420, 'Immutable record count differs')
    for item in entries:
        require(item['path'] == f"audio/{item['language']}/{item['stable_code']}.wav"
                and re.fullmatch(r'[A-Z0-9_]+', item['stable_code']), 'Invalid final WAV path')
        record = records[item['asset_id']]
        metadata = record['metadata']
        require(metadata['checksum'] == item['sha256'] and metadata['byte_length'] == item['bytes']
                and metadata['stable_code'] == item['stable_code']
                and metadata['scope']['language'] == item['language'], 'Immutable manifest mismatch')
    return entries


def code_bindings():
    paths = [POLICY, MANIFEST, ATTRIBUTION, 'tools/p5/public-m01-input.py',
             'tools/p5/private-m01-transfer.py', 'tools/p5/stage-m01-audio.py',
             'docs/p5/m01-completion-20261014/owner-approval.json']
    paths += [str(p.relative_to(ROOT)) for p in sorted((ROOT / 'assets/media/m01/records').glob('audio-*.json'))]
    return {path: sha(ROOT / path) for path in paths}


def attribution():
    return ('# Approved M01 audio: temporary test input\n\n'
            'Quality, six voices and rights were approved by the owner on 2026-10-14. '
            'On 2026-10-26 the owner allowed the audio to be non-private. This one-day test artifact '
            'contains only the 420 final, unchanged WAVs. It does not select a production delivery profile.\n\n'
            'The original source credits and pre-approval history follow unchanged. Their historical '
            'pending-review statements are superseded by the decisions above.\n\n' + (ROOT / ATTRIBUTION).read_text())


def directory():
    value = Path(os.environ['P5_M01_TRANSFER_DIR'])
    require(value.is_absolute() and not value.is_symlink(), 'Test input requires an absolute real directory')
    value = value.resolve()
    require(not value.is_relative_to(ROOT), 'Audio must remain outside the checkout')
    return value


def verify_wavs(destination):
    entries = catalog()
    expected = {item['path'] for item in entries}
    actual = set()
    for path in destination.rglob('*'):
        require(not path.is_symlink(), 'Symlinks are not allowed in test input')
        if path.is_file():
            actual.add(path.relative_to(destination).as_posix())
    require(actual == expected | {RECEIPT, 'ATTRIBUTION.md'}, 'Unexpected or missing test-input files')
    require((destination / 'ATTRIBUTION.md').read_text() == attribution(), 'Attribution was modified')
    for item in entries:
        path = destination / item['path']
        require(path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], 'Final WAV checksum mismatch')
        with wave.open(str(path), 'rb') as source:
            metrics = item['metrics']
            require((source.getnchannels(), source.getsampwidth(), source.getframerate(), source.getnframes()) ==
                    (metrics['channels'], metrics['sample_width'], metrics['sample_rate'], metrics['frames']),
                    'Approved PCM format or frame count differs')
    return sum(item['bytes'] for item in entries)


def receipt(identity):
    return {**identity, 'status': 'ARCHIVE_VERIFIED', 'transport_profile': PROFILE,
            'archive_downloaded': True, 'pinned_input_identity_verified': True,
            'original_archive_checksum_verified': True, 'original_archive_anonymous_denied': True,
            'original_archive_in_artifact': False, 'release_draft_verified': True,
            'repository_public_verified': True, 'files': 420, 'languages': {'en': 210, 'cs': 210},
            'audio_bytes': sum(item['bytes'] for item in catalog()), 'audio_regenerated': False,
            'relay_retention_days': 1, 'code_bindings': code_bindings(),
            'production_delivery_profile_approved': False, 'p6_authorized': False}


def export(token, identity):
    asset = preflight(token)
    destination = directory()
    require(not destination.exists(), 'Test-input destination already exists; inspect before retrying')
    destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix='p5-original-', dir=destination.parent) as private:
            archive = Path(private) / 'input.zip'
            transport.download_asset(token, asset, archive)
            staging.stage(archive, destination)
            (destination / 'ATTRIBUTION.md').write_text(attribution())
            report = receipt(identity)
            (destination / RECEIPT).write_text(json.dumps(report, indent=2) + '\n')
            require(verify_wavs(destination) == report['audio_bytes'], 'WAV byte count differs')
            preflight(token)  # Reject a concurrent publication/replacement before upload.
        print(json.dumps({'status': 'FINAL_WAV_EXPORT_VERIFIED', 'files': 420,
                          'original_archive_in_artifact': False, 'source_sha': identity['source_sha']}))
    except BaseException:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def receive(identity):
    destination = directory()
    path = destination / RECEIPT
    require(path.is_file() and not path.is_symlink() and path.stat().st_size < 32000, 'Invalid input receipt')
    result = json.loads(path.read_text())
    require(result == receipt(identity), 'Test input is not bound to this source, run and approved manifest')
    require(verify_wavs(destination) == result['audio_bytes'], 'WAV byte count differs')
    result.update(relay_received_and_source_bound=True, test_job_needs_no_release_token=True,
                  immutable_wav_checksums_verified=420)
    target = ROOT / 'artifacts/p5'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'm01-private-transfer.json').write_text(json.dumps(result, indent=2) + '\n')
    status = {'status': 'VERIFIED', 'scope': 'OWNER_AUTHORIZED_FINAL_WAV_TEST_INPUT',
              'source_sha': identity['source_sha'], 'audio_bytes_verified': True, 'files': 420,
              'languages': {'en': 210, 'cs': 210}, 'original_archive_checksum_verified': True,
              'real_m01_postgresql_executed': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}
    (target / 'm01-input-status.json').write_text(json.dumps(status, indent=2) + '\n')
    transport.output('P5_M01_AUDIO_ROOT', destination / 'audio', 'GITHUB_ENV')
    print(json.dumps(status))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['preflight', 'export', 'receive'])
    args = parser.parse_args()
    identity = context()
    if args.mode == 'receive':
        receive(identity)
    elif args.mode == 'export':
        export(os.environ.get('GH_TOKEN', ''), identity)
    else:
        preflight(os.environ.get('GH_TOKEN', ''))
        print(json.dumps({'status': 'PUBLIC_AUDIO_SCOPE_PRIVATE_ARCHIVE_VERIFIED', **identity}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        raise SystemExit('Approved WAV input failed; remote details and original archive identifiers suppressed') from None
