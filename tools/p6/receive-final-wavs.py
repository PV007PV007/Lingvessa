"""Consume an existing, explicitly pinned final-only P5 artifact for a P6 test.

There is no export, rerun, release API, upload or generation in this consumer.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
REPO = 'PV007PV007/Lingvessa'
BRANCH = 'implementation/p6-english-reference'
PRODUCER = '8f353cf44945738cff1b2ea49bfd9ce730ebf022'
RUN = 40746611469
REQUEST = 'docs/p6/approved-input-request.json'
spec = importlib.util.spec_from_file_location('p5_final_validation', ROOT / 'tools/p5/public-m01-input.py')
p5 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p5)


def require(ok, message):
    if not ok:
        raise ValueError(message)


def pin(value):
    require(isinstance(value, dict) and set(value) == {
        'producer_run_attempt', 'artifact_id', 'zip_bytes', 'zip_sha256', 'consumer_parent_sha'
    }, 'Unexpected input request')
    for k in ['producer_run_attempt', 'artifact_id', 'zip_bytes']:
        require(type(value[k]) is int and value[k] > 0, 'Invalid numerical pin')
    require(value['zip_bytes'] <= 40 * 1024 * 1024, 'Pinned artifact too large')
    require(isinstance(value['zip_sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', value['zip_sha256'])
            and isinstance(value['consumer_parent_sha'], str) and re.fullmatch(r'[0-9a-f]{40}', value['consumer_parent_sha']),
            'Invalid digest or consumer parent')
    return value


def hosted_context(q, env, event, head, parents):
    require(env.get('GITHUB_REPOSITORY') == REPO and env.get('GITHUB_EVENT_NAME') == 'push'
            and env.get('GITHUB_REF') == 'refs/heads/' + BRANCH and event.get('ref') == env['GITHUB_REF']
            and env.get('GITHUB_HEAD_SHA') == head == event.get('after') == event.get('head_commit', {}).get('id')
            and parents == [event.get('before')] == [q['consumer_parent_sha']]
            and event.get('repository', {}).get('full_name') == REPO
            and '[p6:verify-final-l01]' in event['head_commit'].get('message', '')
            and q['producer_run_attempt'] > 1, 'Not the explicitly pinned single-commit P6 push')


def api_identity(q, run, artifact):
    require(run.get('id') == RUN and run.get('head_sha') == PRODUCER and run.get('event') == 'push'
            and run.get('head_branch') == 'implementation/p5-media-speech' and run.get('conclusion') == 'success'
            and run.get('run_attempt') == q['producer_run_attempt'] and run.get('repository', {}).get('full_name') == REPO,
            'Unexpected producer run')
    w = artifact.get('workflow_run') or {}
    require(w.get('id') == RUN and w.get('head_sha') == PRODUCER and w.get('repository_id') == run['repository']['id']
            and artifact.get('id') == q['artifact_id'] and artifact.get('expired') is False
            and artifact.get('name') == f"p5-approved-audio-{RUN}-{q['producer_run_attempt']}"
            and artifact.get('size_in_bytes') == q['zip_bytes'] and artifact.get('digest') == 'sha256:' + q['zip_sha256'],
            'Artifact missing, expired or inconsistent with pinned producer')


def validate_members(infos, lengths):
    require(len(infos) == len(lengths) and {i.filename for i in infos} == set(lengths),
            'Missing, duplicate or unexpected ZIP member')
    for i in infos:
        mode = stat.S_IFMT(i.external_attr >> 16)
        require(mode in (0, stat.S_IFREG) and not i.is_dir() and i.filename == i.orig_filename
                and not (i.flag_bits & 1) and i.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                and i.file_size == lengths[i.filename], 'Unsafe member type or length')


def receive(q, archive, destination):
    require(archive.is_absolute() and not archive.is_symlink() and archive.is_file()
            and archive.stat().st_size == q['zip_bytes'], 'Unexpected ZIP file or length')
    require(destination.is_absolute() and destination.resolve() == destination and destination.parent.is_dir()
            and not destination.is_relative_to(ROOT) and not destination.exists(), 'Require a new external directory')
    with archive.open('rb') as source:
        require(hashlib.file_digest(source, 'sha256').hexdigest() == q['zip_sha256'], 'ZIP checksum mismatch')
        source.seek(0)
        with zipfile.ZipFile(source) as z:
            entries = p5.catalog()
            lengths = {e['path']: e['bytes'] for e in entries}
            receipt = p5.receipt({'source_sha': PRODUCER, 'run_id': str(RUN),
                                  'run_attempt': str(q['producer_run_attempt']), 'event': 'push'})
            rinfo = z.getinfo(p5.RECEIPT)
            require(0 < rinfo.file_size <= 16384, 'Invalid receipt size')
            lengths.update({p5.RECEIPT: rinfo.file_size, 'ATTRIBUTION.md': len(p5.attribution().encode())})
            validate_members(z.infolist(), lengths)
            require(json.loads(z.read(rinfo)) == receipt, 'Producer receipt or code bindings differ')
            with tempfile.TemporaryDirectory(prefix='p6-stage-', dir=destination.parent) as tmp:
                work = Path(tmp) / 'verified'
                work.mkdir(mode=0o700)
                for name in sorted(lengths):
                    target = work / name  # exact member of immutable catalog plus receipt/attribution
                    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                    with target.open('xb') as out:
                        out.write(z.read(name))
                require(p5.verify_wavs(work) == receipt['audio_bytes'], 'WAV bytes differ')
                require(not destination.exists(), 'Destination exists')
                work.rename(destination)
    return {'source_sha': PRODUCER, 'producer_run_id': RUN, 'producer_run_attempt': q['producer_run_attempt'],
            'artifact_id': q['artifact_id'], 'zip_sha256': q['zip_sha256'], 'files': 420,
            'languages': receipt['languages'], 'audio_bytes': receipt['audio_bytes'], 'attribution_verified': True,
            'postgresql_executed': False, 's3_executed': False, 'original_archive_received': False}


def gh(path, out=None):
    return subprocess.run(['gh', 'api', '--hostname', 'github.com', '--method', 'GET', 'repos/' + REPO + path],
                          stdout=out if out is not None else subprocess.PIPE, check=True, timeout=120).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['offline', 'hosted'])
    parser.add_argument('--request', type=Path, required=True)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    q = pin(json.loads(args.request.read_text()))
    if args.mode == 'offline':
        require(args.archive is not None, 'Offline mode needs the already retained final ZIP')
        report = receive(q, args.archive, args.out)
    else:
        require(args.archive is None and args.request.resolve() == ROOT / REQUEST, 'Unexpected hosted request')
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        header = subprocess.check_output(['git', 'cat-file', '-p', head], cwd=ROOT, text=True).split('\n\n', 1)[0]
        parents = [line[7:] for line in header.splitlines() if line.startswith('parent ')]
        hosted_context(q, os.environ, json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text()), head, parents)
        temp = Path(os.environ['RUNNER_TEMP']).resolve()
        require(args.out == temp / 'p6-approved-input' and not temp.is_relative_to(ROOT), 'Unexpected runner output')
        api_identity(q, json.loads(gh(f'/actions/runs/{RUN}/attempts/{q["producer_run_attempt"]}')),
                     json.loads(gh(f'/actions/artifacts/{q["artifact_id"]}')))
        with tempfile.TemporaryDirectory(prefix='p6-input-', dir=temp) as tmp:
            archive = Path(tmp) / 'final.zip'
            with archive.open('xb') as out:
                gh(f'/actions/artifacts/{q["artifact_id"]}/zip', out)
            report = receive(q, archive, args.out)
        report['consumer_sha'] = head
        target = ROOT / 'artifacts/p6/l01-input.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
