#!/usr/bin/env python3
"""Bounded private Actions transport. This never sends GitHub credentials."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs/p5/integration-20261017/private-transfer-plan.json'


def verify(path, expected):
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if path.stat().st_size != expected['bytes'] or digest != expected['sha256']:
        raise ValueError('Checksum/length mismatch')


def pack(source, destination, plan):
    verify(source, plan['archive'])
    if destination.exists():
        verify(destination, plan['envelope'])
        return
    info = zipfile.ZipInfo(plan['archive']['filename'], (1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = 0o100600 << 16
    with zipfile.ZipFile(destination, 'x') as archive:
        archive.writestr(info, source.read_bytes())
    verify(destination, plan['envelope'])


def unpack(source, destination, plan):
    verify(source, plan['envelope'])
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if (len(entries) != 1 or entries[0].filename != plan['archive']['filename']
                or entries[0].file_size != plan['archive']['bytes']
                or entries[0].compress_type != zipfile.ZIP_STORED):
            raise ValueError('Envelope entry mismatch')
        with destination.open('xb') as stream:
            stream.write(archive.read(entries[0]))
    verify(destination, plan['archive'])


def signed_blob(value):
    parsed = urllib.parse.urlsplit(value)
    params = urllib.parse.parse_qs(parsed.query)
    if not (parsed.scheme == 'https' and parsed.hostname
            and parsed.hostname.endswith('.blob.core.windows.net')
            and parsed.port in (None, 443) and not parsed.username and not parsed.password
            and not parsed.fragment and params.get('sr') == ['b']
            and set(params.get('sp', [''])[0]) <= set('rcw')
            and 'w' in params.get('sp', [''])[0] and params.get('sig')):
        raise ValueError('Not a single-blob upload capability')
    from datetime import datetime, timezone, timedelta
    expiry = datetime.fromisoformat(params['se'][0].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    if not now < expiry <= now + timedelta(days=1):
        raise ValueError('Upload capability expiry rejected')
    return value


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def upload(control_path, envelope, head, receipt_path, plan):
    control = json.loads(control_path.read_text())
    if not (control['repository'] == plan['repository'] and control['source_sha'] == head
            and control['release_id'] == plan['release_id']
            and control['archive'] == plan['archive'] and control['envelope'] == plan['envelope']):
        raise ValueError('Control provenance mismatch')
    verify(envelope, plan['envelope'])
    ack = control['ack_content'].encode()
    ack_sha = hashlib.sha1(b'blob ' + str(len(ack)).encode() + b'\0' + ack).hexdigest()
    if ack_sha != control['ack_blob_sha']:
        raise ValueError('Receipt identity mismatch')
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text())
        if receipt['ack_blob_sha'] != ack_sha or receipt['envelope'] != plan['envelope']:
            raise ValueError('Existing receipt belongs to another upload')
        print(json.dumps({'status': 'ALREADY_UPLOADED', 'ack_blob_sha': ack_sha}))
        return
    url = signed_blob(control['signed_upload_url'])
    data = envelope.read_bytes()
    request = urllib.request.Request(url, data=data, method='PUT', headers={
        'Content-Type': 'application/zip', 'Content-Length': str(len(data)),
        'Content-MD5': base64.b64encode(hashlib.md5(data).digest()).decode(),
        'x-ms-blob-type': 'BlockBlob', 'x-ms-version': '2021-08-06', 'If-None-Match': '*'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=180) as response:
        if response.status != 201:
            raise ValueError('Upload did not return HTTP 201')
        receipt = {'status': 'UPLOADED_HTTP_201', 'source_sha': head,
                   'run_id': control['run_id'], 'ack_blob_sha': ack_sha,
                   'envelope': plan['envelope'], 'etag': response.headers.get('ETag'),
                   'request_id': response.headers.get('x-ms-request-id')}
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    receipt_path.with_suffix('.ack.txt').write_text(control['ack_content'])
    print(json.dumps(receipt))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pack', 'unpack', 'control', 'upload'])
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--head')
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text())
    if args.mode == 'pack':
        pack(args.source, args.destination, plan)
    elif args.mode == 'unpack':
        unpack(args.source, args.destination, plan)
    elif args.mode == 'control':
        data = sys.stdin.buffer.read(32001)
        if len(data) > 32000:
            raise ValueError('Control record too large')
        with zipfile.ZipFile(args.destination, 'x', compression=zipfile.ZIP_STORED) as archive:
            archive.writestr('private-upload-control.json', data)
    else:
        if not args.head or not args.receipt:
            raise ValueError('Explicit source SHA and receipt path required')
        upload(args.source, args.destination, args.head, args.receipt, plan)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # URLs, server responses and credentials must never appear in logs.
        sys.exit('Private envelope operation failed; inspect local state without printing capability URLs')
