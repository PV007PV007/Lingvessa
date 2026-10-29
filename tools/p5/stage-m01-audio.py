#!/usr/bin/env python3
"""Stage only checksum-approved M01 bytes outside Git; never generate or approve audio."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stage(archive, destination):
    approval = json.loads((ROOT / 'docs/p5/m01-completion-20261014/owner-approval.json').read_text())
    expected = next(x for x in approval['approved_deliverables'] if x['filename'].endswith('.zip'))
    assert approval['status'] == 'OWNER_APPROVED' and approval['approved_final_audio_files'] == 420
    assert archive.stat().st_size == expected['bytes'] and sha(archive) == expected['sha256'], 'Approved archive checksum/size mismatch'
    assert not destination.resolve().is_relative_to(ROOT), 'Audio staging must be outside the Git checkout'
    assets = json.loads((ROOT / 'assets/media/m01/source-all-assets.json').read_text())
    assert len(assets) == len({x['path'] for x in assets}) == 420
    destination.mkdir(parents=True, exist_ok=False)
    try:
        with zipfile.ZipFile(archive) as source:
            names = source.namelist()
            for item in assets:
                path = item['path']
                assert path == f"audio/{item['language']}/{item['stable_code']}.wav"
                assert Path(path).parts[:2] in [('audio', 'en'), ('audio', 'cs')] and '..' not in Path(path).parts
                assert names.count(path) == 1, 'Missing/duplicate approved WAV'
                assert source.getinfo(path).file_size == item['bytes']
                body = source.read(path)
                assert len(body) == item['bytes'] and hashlib.sha256(body).hexdigest() == item['sha256']
                target = destination / path
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as output:
                    output.write(body)
        return destination / 'audio', expected
    except BaseException:
        shutil.rmtree(destination)
        raise


class HTTPSOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != 'https':
            raise ValueError('Only HTTPS redirects are allowed')
        return super().redirect_request(request, fp, code, message, headers, newurl)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--destination', type=Path)
    args = parser.parse_args()
    if not args.archive and os.environ.get('P5_M01_ARCHIVE_PATH'):
        args.archive = Path(os.environ['P5_M01_ARCHIVE_PATH'])
    report = ROOT / 'artifacts/p5/m01-input-status.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    url = os.environ.get('P5_M01_AUDIO_ARCHIVE_URL', '')
    result = {'status': 'NOT_PROVIDED', 'scope': 'EXTERNAL_APPROVED_M01_INPUT', 'audio_bytes_verified': False,
              'real_m01_postgresql_executed': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}
    if not args.archive and not url:
        report.write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result))
        return
    with tempfile.TemporaryDirectory(prefix='lingvessa-m01-download-') as temporary:
        archive = args.archive
        if not archive:
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError('A private HTTPS read URL is required')
            archive = Path(temporary) / 'approved.zip'
            limit = 63346796
            try:
                with urllib.request.build_opener(HTTPSOnly()).open(url, timeout=60) as response, archive.open('xb') as output:
                    count = 0
                    while body := response.read(1024 * 1024):
                        count += len(body)
                        if count > limit:
                            raise ValueError('Input exceeds approved archive size')
                        output.write(body)
            except Exception:
                # A signed URL is a credential: never print response bodies, redirects or exception URLs.
                raise RuntimeError('Private M01 download failed; URL and remote response suppressed') from None
        if args.destination:
            destination = args.destination.resolve()
        else:
            parent = Path(tempfile.mkdtemp(prefix='lingvessa-m01-input-'))
            destination = parent / 'verified'
        audio, expected = stage(archive, destination)
    result.update(status='VERIFIED', audio_bytes_verified=True, files=420, languages={'en': 210, 'cs': 210},
                  archive_sha256=expected['sha256'], archive_bytes=expected['bytes'], source_root=str(audio))
    report.write_text(json.dumps(result, indent=2) + '\n')
    if os.environ.get('GITHUB_ENV'):
        with open(os.environ['GITHUB_ENV'], 'a') as environment:
            environment.write('P5_M01_AUDIO_ROOT=' + str(audio) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
