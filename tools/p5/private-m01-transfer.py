#!/usr/bin/env python3
"""Private, checksum-bound GitHub input transport; never publish a release or store WAVs in Git."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
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
    if not isinstance(release.get('id'), int) or release['id'] <= 0:
        raise TransferError('Invalid input container ID')


def output(name, value, file='GITHUB_OUTPUT'):
    if os.environ.get(file):
        with open(os.environ[file], 'a') as stream:
            stream.write(name + '=' + str(value) + '\n')


def prepare(token, repo):
    # This job has the sole write token; only the trusted P5 branch/PR can run it.
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
    found = []
    for page in range(1, 11):
        releases = api('/releases?per_page=100&page=' + str(page), token)
        found.extend(release for release in releases if release.get('tag_name') == TAG)
        if len(releases) < 100:
            break
    else:
        raise TransferError('Release inventory exceeded bounded pagination')
    if len(found) > 1:
        raise TransferError('Duplicate input containers; manual inspection required')
    if found:
        release = found[0]
    else:
        # A transport container, not a release of P5 code. Target the existing default branch.
        # GITHUB_TOKEN cannot request workflows:write; no default-branch/workflow change is made.
        release = api('/releases', token, {
            'tag_name': TAG, 'target_commitish': repo['default_branch'], 'name': TITLE,
            'draft': True, 'prerelease': True, 'make_latest': 'false',
            'body': MARKER + '\n\nPrivate temporary input for P5 development/test only. DO NOT PUBLISH.\n'
                    'Upload the unchanged approved ' + EXPECTED['filename'] + ' (' + str(EXPECTED['bytes']) + ' bytes).\n'
                    'Not a code release, production delivery profile, approval, or P6 authorization.\n'
                    'Actions verifies the complete archive and all 420 immutable WAV checksums before import.\n'
                    'No automatic replacement, deletion or public URL. Remove only after durable ingestion evidence and owner-authorized cleanup.'})
    validate_release(release)
    output('release_id', release['id'])
    print(json.dumps({'status': 'PRIVATE_DRAFT_READY', 'release_id': release['id'], 'draft': True,
                      'archive_upload_attempted': False, 'note': 'Asset availability is independently checked by the read-only test job'}))


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


def download(token, release_id):
    if not release_id or not release_id.isdecimal():
        result = {'status': 'NO_AUTHORIZED_INPUT_SLOT', 'archive_downloaded': False}
    else:
        release = api('/releases/' + release_id, token)
        validate_release(release)
        names = {EXPECTED['filename'], EXPECTED['filename'].removesuffix('.zip') + '(1).zip'}
        assets = api('/releases/' + release_id + '/assets?per_page=100', token)
        candidates = [asset for asset in assets if asset.get('name') in names]
        if len(assets) >= 100 or len(candidates) > 1:
            raise TransferError('Ambiguous private input assets')
        result = {'status': 'AWAITING_PRIVATE_UPLOAD', 'release_id': int(release_id),
                  'repository_private_verified': True, 'release_draft_verified': True,
                  'read_only_release_access_verified': True, 'archive_downloaded': False,
                  'expected_archive_sha256': EXPECTED['sha256'], 'expected_archive_bytes': EXPECTED['bytes']}
        if candidates:
            asset = candidates[0]
            if (asset.get('state') != 'uploaded' or asset.get('size') != EXPECTED['bytes']
                    or asset.get('digest') not in (None, 'sha256:' + EXPECTED['sha256'])):
                raise TransferError('Private input asset metadata mismatch')
            directory = Path(tempfile.mkdtemp(prefix='lingvessa-private-m01-'))
            destination = directory / EXPECTED['filename']
            download_asset(token, asset, destination)
            output('P5_M01_ARCHIVE_PATH', destination, 'GITHUB_ENV')
            result.update(status='ARCHIVE_VERIFIED', archive_downloaded=True, asset_id=asset['id'])
    report = ROOT / 'artifacts/p5/m01-private-transfer.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    result.update(source_sha=os.environ.get('GITHUB_HEAD_SHA'), real_m01_postgresql_executed=False,
                  production_delivery_profile_approved=False, p6_authorized=False)
    report.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'download'])
    args = parser.parse_args()
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
