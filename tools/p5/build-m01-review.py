#!/usr/bin/env python3
"""Build an offline, audio-bound M01 reviewer; never mark source assets approved."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import subprocess
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[2]
BATCH = ROOT / 'docs/p5/m01-audio-draft-20261011'
TEMPLATE = ROOT / 'tools/p5/m01-review.html'
AUDIO_SOURCE = '785fff956f7b7c5c017921d96103f7a0ae8f8d44'
CAST = {'en-A-p225': 'Maya', 'en-B-p226': 'Daniel', 'en-C-p228': 'Alex', 'cs-A-jirka': 'Adam'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def source_state():
    try:
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True).strip()
        dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=ROOT, text=True).strip())
        return {'source_sha': commit, 'working_tree_dirty': dirty}
    except subprocess.CalledProcessError:
        return {'source_sha': None, 'working_tree_dirty': None}


def finalize(pairs, scope, results_hash):
    slots = [slot for pair in pairs for slot in pair['slots']]
    assert len({s['id'] for s in slots}) == len(slots)
    counts = {'slots': len(slots), 'pairs': len(pairs),
              'available': sum(s['available'] for s in slots),
              'missing': sum(not s['available'] for s in slots),
              'flagged': sum(s['available'] and s['asr']['flagged'] for s in slots)}
    dataset = {'schema_version': 1, 'scope': scope, 'audio_source_sha': AUDIO_SOURCE,
               'results_sha256': results_hash, 'counts': counts, 'pairs': pairs}
    return {**dataset, 'dataset_sha256': sha(canonical(dataset)),
            'human_review': 'PENDING', 'publication_ready': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}


def catalog():
    results = read(BATCH / 'results.json')
    data = {'assets': [], 'screens': []}
    for entry in results['records']:
        if entry['role'] not in data:
            continue
        raw = (ROOT / entry['path']).read_bytes()
        assert sha(raw) == entry['sha256'], entry['path']
        rows = json.loads(raw)
        assert len(rows) == entry['count']
        data[entry['role']].extend(rows)
    assets = data['assets']
    screens = {s['asset_id']: s for s in data['screens']}
    assert len(assets) == len({a['asset_id'] for a in assets}) == 420
    assert len(screens) == len(data['screens']) == 216
    slow = {a['normal_asset_id']: a for a in assets if a['speed'] == 'slow'}
    assert len(slow) == 210
    pairs = []
    for normal in (a for a in assets if a['speed'] == 'normal'):
        other = slow[normal['asset_id']]
        assert other['script_id'] == normal['script_id'] and other['transcript'] == normal['transcript']
        assert other['language'] == normal['language'] and other['status'] == normal['status']
        slots = []
        for asset in [normal, other]:
            available = asset['status'] == 'GENERATED_UNREVIEWED'
            assert available or asset['status'] == 'NOT_GENERATED'
            slot = {'id': asset['asset_id'], 'code': asset['stable_code'], 'pace': asset['speed'],
                    'available': available, 'sha256': asset.get('sha256'), 'path': asset.get('path'),
                    'duration': asset.get('metrics', {}).get('duration_seconds'), 'cues': [], 'asr': None}
            if available:
                screen = screens[asset['asset_id']]
                assert screen['audio_sha256'] == asset['sha256']
                assert screen['expected'] == asset['transcript'] and screen['language'] == asset['language']
                assert screen['human_review'] == 'PENDING' and screen['pronunciation_quality_asserted'] is False
                slot['asr'] = {'transcript': screen['transcript'], 'word_edits': screen['word_edits'],
                               'flagged': screen['review_flag'] == 'ASR_DISCREPANCY'}
                slot['cues'] = [{'speaker': CAST[t['candidate_id']], 'text': t['text'],
                                 'start': t['start_ms'] / 1000, 'end': t['end_ms'] / 1000}
                                for t in asset['timing']]
                assert all(0 <= c['start'] < c['end'] <= slot['duration'] + .001 for c in slot['cues'])
            else:
                assert asset['asset_id'] not in screens and 'path' not in asset and 'sha256' not in asset
            slots.append(slot)
        code = normal['stable_code']
        kind = 'turn' if '_TURN_' in code else 'dialogue' if '_DIALOGUES_' in code else 'word'
        pairs.append({'id': normal['asset_id'], 'language': normal['language'], 'kind': kind,
                      'text': normal['transcript'], 'slots': slots,
                      'speakers': sorted({c['speaker'] for s in slots for c in s['cues']})})
    result = finalize(pairs, 'M01_DRAFT', sha((BATCH / 'results.json').read_bytes()))
    assert result['counts'] == {'slots': 420, 'pairs': 210, 'available': 216, 'missing': 204, 'flagged': 109}
    return result, assets, results


def validate_wav(raw, expected_sha, duration, metrics=None):
    assert sha(raw) == expected_sha
    with wave.open(io.BytesIO(raw)) as wav:
        assert wav.getnchannels() == 1 and wav.getsampwidth() == 2 and wav.getcomptype() == 'NONE'
        assert abs(wav.getnframes() / wav.getframerate() - duration) < .000001
        if metrics:
            assert wav.getframerate() == metrics['sample_rate'] == 24000
            assert wav.getnframes() == metrics['frames']


def fixture():
    # Only four pre-existing audition WAVs; IDs, ASR flags and cue positions are UI test fixtures.
    # Never export this document as the real M01 review, or count these as M01 byte/playback QA.
    source = ROOT / 'docs/p5/voice-audition/results.json'
    outputs = read(source)['outputs']
    pairs, encoded = [], {}
    for candidate in ['en-A-p225', 'cs-A-jirka']:
        rows = [r for r in outputs if r['candidate_id'] == candidate]
        assert len(rows) == 2
        slots = []
        for row in sorted(rows, key=lambda r: r['pace'] != 'normal'):
            ident = 'fixture-' + candidate + '-' + row['pace']
            raw = (ROOT / row['path']).read_bytes()
            duration = row['metrics']['duration_seconds']
            validate_wav(raw, row['sha256'], duration)
            slots.append({'id': ident, 'code': ident, 'pace': row['pace'], 'available': True,
                          'sha256': row['sha256'], 'path': row['path'], 'duration': duration,
                          'cues': [{'speaker': 'Тест', 'text': 'Початок тестового запису', 'start': 0, 'end': duration / 2},
                                   {'speaker': 'Тест', 'text': 'Тестовий перехід', 'start': duration / 2, 'end': duration}],
                          'asr': {'transcript': 'Тестова підказка', 'word_edits': int(row['pace'] == 'slow'), 'flagged': row['pace'] == 'slow'}})
            encoded[ident] = base64.b64encode(raw).decode()
        pairs.append({'id': 'fixture-' + candidate, 'language': rows[0]['language'], 'kind': 'dialogue',
                      'text': rows[0]['text'], 'speakers': ['Тест'], 'slots': slots})
    pairs.append({'id': 'fixture-missing', 'language': 'cs', 'kind': 'word', 'text': 'Тест відсутнього запису',
                  'speakers': [], 'slots': [{'id': 'fixture-missing-' + pace, 'code': 'fixture-missing-' + pace,
                  'pace': pace, 'available': False, 'sha256': None, 'path': None, 'duration': None, 'cues': [], 'asr': None}
                  for pace in ['normal', 'slow']]})
    return finalize(pairs, 'UI_TEST_FIXTURE', sha(source.read_bytes())), encoded


def write_page(manifest, encoded, destination, name):
    assert set(encoded) == {s['id'] for p in manifest['pairs'] for s in p['slots'] if s['available']}
    document = TEMPLATE.read_text(encoding='utf-8')
    for token, value in [('__MANIFEST__', manifest), ('__AUDIO__', encoded)]:
        assert document.count(token) == 1
        document = document.replace(token, json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
    target = destination / name
    target.write_text(document, encoding='utf-8')
    return {'html_file': name, 'html_sha256': sha(target.read_bytes()), 'embedded_wavs': len(encoded)}


def build(args):
    destination = args.output_dir.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    base = {'status': 'PASS', **source_state(), 'builder_sha256': sha(Path(__file__).read_bytes()),
            'template_sha256': sha(TEMPLATE.read_bytes()), 'human_review': 'PENDING', 'publication_ready': False,
            'p5_milestone': 'NOT_READY', 'p6_authorized': False}
    if args.mode == 'fixture':
        manifest, encoded = fixture()
        name = 'M01_REVIEW_UI_TEST_FIXTURE.html'
        report = {**base, 'scope': 'UI_TEST_FIXTURE', **write_page(manifest, encoded, destination, name),
                  'm01_audio_bytes_verified': False, 'm01_wavs_verified': 0}
        (destination / 'm01-review-fixture-manifest.json').write_text(json.dumps({**manifest, **report}, indent=2, ensure_ascii=False) + '\n')
    else:
        manifest, assets, results = catalog()
        report = {**base, 'scope': 'CATALOG_ONLY_EXTERNAL_AUDIO', 'counts': manifest['counts'],
                  'dataset_sha256': manifest['dataset_sha256'], 'results_sha256': manifest['results_sha256'],
                  'm01_audio_bytes_verified': False, 'm01_wavs_verified': 0}
        if args.mode == 'full':
            assert args.audio_zip, '--audio-zip is required in full mode'
            payload = args.audio_zip.read_bytes()
            assert len(payload) == results['artifact']['bytes'] and sha(payload) == results['artifact']['sha256']
            encoded = {}
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                assert len(archive.namelist()) == len(set(archive.namelist())) and archive.testzip() is None
                for asset in assets:
                    if asset['status'] != 'GENERATED_UNREVIEWED':
                        continue
                    raw = archive.read(asset['path'])
                    assert len(raw) == asset['bytes']
                    validate_wav(raw, asset['sha256'], asset['metrics']['duration_seconds'], asset['metrics'])
                    encoded[asset['asset_id']] = base64.b64encode(raw).decode()
            report.update(write_page(manifest, encoded, destination, 'Lingvessa_M01_Listening_Review_2026-10-12.html'))
            report.update(scope='FULL_M01_REVIEW_BYTES', m01_audio_bytes_verified=True, m01_wavs_verified=216,
                          audio_archive_sha256=sha(payload))
        (destination / 'm01-review-catalog.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    report_name = 'm01-review-fixture-build.json' if args.mode == 'fixture' else 'm01-review-catalog-validation.json'
    (destination / report_name).write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['catalog', 'full', 'fixture'], default='catalog')
    parser.add_argument('--audio-zip', type=Path)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/p5')
    build(parser.parse_args())
