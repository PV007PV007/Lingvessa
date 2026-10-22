#!/usr/bin/env python3
"""Private, checksum-bound GitHub input transport; never publish a release or store WAVs in Git."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
REPOSITORY = 'PV007PV007/Lingvessa'
API = 'https://api.github.com/repos/' + REPOSITORY
TAG = 'p5-m01-private-input-20261014'
TITLE = 'P5 private M01 input — DO NOT PUBLISH'
APPROVAL = json.loads((ROOT / 'docs/p5/m01-completion-20261014/owner-approval.json').read_text())
EXPECTED = next(item for item in APPROVAL['approved_deliverables'] if item['filename'].endswith('.zip'))
MARKER = 'P5_PRIVATE_INPUT_SHA256=' + EXPECTED['sha256']
# Existing approved private input, independently verified through the connector.
# Release listings can omit drafts; an empty inventory must never create a replacement.
RELEASE_ID = 414560160
ASSET_ID = 649769507


class TransferError(RuntimeError):
    """Only predetermined, credential-free messages may cross the process boundary."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def request(path, token, *, payload=None, binary=False):
    if path and (not path.startswith('/') or path.startswith('//')):
        raise TransferError('Invalid API resource')
    headers = {'Authorization': 'Bearer ' + token, 'User-Agent': 'Lingvessa-P5-private-input',
               'Accept': 'application/octet-stream' if binary else 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28'}
    data = None if payload is None else json.dumps(payload).encode()
    if data is not None:
        headers['Content-Type'] = 'application/json'
    return urllib.request.build_opener(NoRedirect()).open(
        urllib.request.Request(API + path, data=data, headers=headers), timeout=60)


def api(path, token, payload=None):
    try:
        with request(path, token, payload=payload) as response:
            body = response.read(2_000_001)
            if len(body) > 2_000_000:
                raise TransferError('Oversized API response')
            return json.loads(body)
    except urllib.error.HTTPError as error:
        raise TransferError('GitHub API request failed: HTTP ' + str(error.code)) from None
    except TransferError:
        raise
    except Exception:
        raise TransferError('GitHub API request failed; details suppressed') from None


def validate_release(release):
    if not (release.get('draft') is True and release.get('prerelease') is True
            and release.get('tag_name') == TAG and release.get('name') == TITLE
            and MARKER in (release.get('body') or '')):
        raise TransferError('Input container identity/draft restriction failed; do not modify it automatically')
    if release.get('id') != RELEASE_ID:
        raise TransferError('Pinned input container identity mismatch')


def output(name, value, file='GITHUB_OUTPUT'):
    if os.environ.get(file):
        with open(os.environ[file], 'a') as stream:
            stream.write(name + '=' + str(value) + '\n')


def prepare(token, repo):
    # Only the trusted P5 branch/PR may resolve the existing private input.
    if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY:
        raise TransferError('Unexpected repository context')
    event = os.environ.get('GITHUB_EVENT_NAME')
    if event == 'push':
        trusted = os.environ.get('GITHUB_REF') == 'refs/heads/implementation/p5-media-speech'
    elif event == 'pull_request':
        event_data = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        pr = event_data.get('pull_request', {})
        trusted = (event_data.get('number') == 5 and pr.get('head', {}).get('ref') == 'implementation/p5-media-speech'
                   and pr.get('head', {}).get('repo', {}).get('full_name') == REPOSITORY)
    else:
        trusted = False
    if not trusted:
        raise TransferError('Input preparation requires the authorized P5 branch or PR #5')
    release = api('/releases/' + str(RELEASE_ID), token)
    validate_release(release)
    output('release_id', release['id'])
    print(json.dumps({'status': 'PRIVATE_DRAFT_READY', 'release_id': release['id'], 'draft': True,
                      'archive_upload_attempted': False, 'note': 'Asset availability is independently checked by the isolated transport job'}))


def redirect_url(value):
    parsed = urllib.parse.urlsplit(value)
    if not (parsed.scheme == 'https' and parsed.hostname in {'release-assets.githubusercontent.com', 'objects.githubusercontent.com'}
            and parsed.port in (None, 443) and not parsed.username and not parsed.password):
        raise TransferError('Untrusted asset redirect rejected')
    return value


def download_asset(token, asset, destination):
    try:
        try:
            response = request('/releases/assets/' + str(asset['id']), token, binary=True)
        except urllib.error.HTTPError as error:
            if error.code != 302:
                raise TransferError('Private asset download failed: HTTP ' + str(error.code)) from None
            location = redirect_url(error.headers.get('Location', ''))
            # The signed CDN request has NO Authorization header and cannot redirect again.
            response = urllib.request.build_opener(NoRedirect()).open(location, timeout=60)
        digest = hashlib.sha256()
        count = 0
        with response, destination.open('xb') as stream:
            while body := response.read(1024 * 1024):
                count += len(body)
                if count > EXPECTED['bytes']:
                    raise TransferError('Archive exceeds the approved byte length')
                digest.update(body)
                stream.write(body)
        if count != EXPECTED['bytes'] or digest.hexdigest() != EXPECTED['sha256']:
            raise TransferError('Private archive checksum/length mismatch')
    except Exception:
        destination.unlink(missing_ok=True)
        # Never leak signed redirect URLs, authorization, response bodies or remote exception text.
        raise TransferError('Private archive download/verification failed; credentials and response suppressed') from None


def transfer_directory():
    directory = Path(os.environ['P5_M01_TRANSFER_DIR'])
    if not directory.is_absolute():
        raise TransferError('Private relay requires an absolute directory')
    directory = directory.resolve()
    if directory.is_relative_to(ROOT):
        raise TransferError('Private relay must remain outside the checkout')
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    return directory


def download(token, release_id):
    directory = transfer_directory()
    if release_id != str(RELEASE_ID):
        raise TransferError('Pinned input container identity mismatch')
    release = api('/releases/' + release_id, token)
    validate_release(release)
    names = {EXPECTED['filename'], EXPECTED['filename'].removesuffix('.zip') + '(1).zip'}
    assets = api('/releases/' + release_id + '/assets?per_page=100', token)
    candidates = [asset for asset in assets if asset.get('name') in names]
    if len(assets) >= 100 or len(candidates) > 1:
        raise TransferError('Ambiguous private input assets')
    if not candidates:
        raise TransferError('Pinned approved archive unavailable; no replacement or upload attempted')
    asset = candidates[0]
    if (asset.get('id') != ASSET_ID or asset.get('state') != 'uploaded' or asset.get('size') != EXPECTED['bytes']
            or asset.get('digest') not in (None, 'sha256:' + EXPECTED['sha256'])):
        raise TransferError('Private input asset metadata mismatch')
    destination = directory / EXPECTED['filename']
    download_asset(token, asset, destination)
    output('P5_M01_ARCHIVE_PATH', destination, 'GITHUB_ENV')
    result = {'status': 'ARCHIVE_VERIFIED', 'release_id': RELEASE_ID, 'asset_id': ASSET_ID,
              'repository_private_verified': True, 'release_draft_verified': True,
              'draft_asset_access_verified': True, 'archive_downloaded': True,
              'expected_archive_sha256': EXPECTED['sha256'], 'expected_archive_bytes': EXPECTED['bytes'],
              'source_sha': os.environ.get('GITHUB_HEAD_SHA'), 'real_m01_postgresql_executed': False,
              'production_delivery_profile_approved': False, 'p6_authorized': False,
              'transport_token_scope': 'ISOLATED_INPUT_JOB_CONTENTS_WRITE', 'relay_retention_days': 1}
    report = directory / 'm01-private-transfer.json'
    report.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


def receive():
    directory = transfer_directory()
    report = ROOT / 'artifacts/p5/m01-private-transfer.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    release_id = os.environ.get('P5_M01_RELEASE_ID', '')
    if not release_id:
        result = {'status': 'NO_AUTHORIZED_INPUT_SLOT', 'archive_downloaded': False,
                  'source_sha': os.environ.get('GITHUB_HEAD_SHA'), 'real_m01_postgresql_executed': False,
                  'production_delivery_profile_approved': False, 'p6_authorized': False}
    else:
        result = json.loads((directory / 'm01-private-transfer.json').read_text())
        if not (str(result.get('release_id')) == release_id == str(RELEASE_ID)
                and result.get('asset_id') == ASSET_ID and result.get('source_sha') == os.environ.get('GITHUB_HEAD_SHA')
                and result.get('status') == 'ARCHIVE_VERIFIED'
                and result.get('repository_private_verified') is True and result.get('release_draft_verified') is True
                and result.get('draft_asset_access_verified') is True
                and result.get('expected_archive_sha256') == EXPECTED['sha256']
                and result.get('expected_archive_bytes') == EXPECTED['bytes']):
            raise TransferError('Private relay provenance/identity mismatch')
        archive = directory / EXPECTED['filename']
        with archive.open('rb') as stream:
            checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
        if archive.stat().st_size != EXPECTED['bytes'] or checksum != EXPECTED['sha256']:
            raise TransferError('Private relay archive checksum/length mismatch')
        output('P5_M01_ARCHIVE_PATH', archive, 'GITHUB_ENV')
        result['relay_received_and_source_bound'] = True
        result['test_job_needs_no_release_token'] = True
    report.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'download', 'receive'])
    args = parser.parse_args()
    if args.mode == 'receive':
        receive()
        return
    token = os.environ.get('GH_TOKEN', '')
    if not token:
        raise TransferError('Ephemeral GitHub token is required')
    repo = api('', token)  # Validated below without exposing credentials.
    if repo.get('private') is not True or repo.get('full_name') != REPOSITORY:
        raise TransferError('Private repository restriction failed')
    if args.mode == 'prepare':
        prepare(token, repo)
    else:
        download(token, os.environ.get('P5_M01_RELEASE_ID', ''))


if __name__ == '__main__':
    try:
        main()
    except TransferError as error:
        raise SystemExit(str(error)) from None
