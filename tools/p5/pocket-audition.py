#!/usr/bin/env python3
"""Verify retained Czech audition bytes and provenance; never run inference.

Reconstructed after checkpoint recovery on 2026-10-10. Historical execution
reports are immutable evidence, not a claim of a new inference/listening run.
Uses only the standard library and does not download tooling or model weights.
"""
import argparse
import array
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import unicodedata
import wave

ROOT = Path(__file__).resolve().parents[2]
BATCH = ROOT / 'docs/p5/voice-audition/pocket-20261009'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def repo_path(relative):
    path = (ROOT / relative).resolve()
    require(path.is_relative_to(ROOT), f'Path outside repository: {relative}')
    return path


def verified_bytes(relative, expected_hash, expected_size=None):
    data = repo_path(relative).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected_hash, f'Hash mismatch: {relative}')
    if expected_size is not None:
        require(len(data) == expected_size, f'Size mismatch: {relative}')
    return data


def pcm_metrics(relative):
    with wave.open(str(repo_path(relative)), 'rb') as wav:
        rate, channels, width, frames = (wav.getframerate(), wav.getnchannels(),
                                         wav.getsampwidth(), wav.getnframes())
        require((rate, channels, width) == (24000, 1, 2), f'Unexpected PCM format: {relative}')
        pcm = array.array('h', wav.readframes(frames))
    if sys.byteorder != 'little':
        pcm.byteswap()
    require(len(pcm) == frames and frames > 0, f'Truncated or empty PCM: {relative}')
    peak = max(abs(sample) for sample in pcm)
    rms = math.sqrt(sum(sample * sample for sample in pcm) / frames)
    require(1 < peak < 32767 and rms > 1, f'Silent or clipped PCM: {relative}')
    return {'sample_rate': rate, 'channels': channels, 'sample_width': width,
            'frames': frames, 'duration_seconds': frames / rate,
            'peak_dbfs': 20 * math.log10(peak / 32768),
            'rms_dbfs': 20 * math.log10(rms / 32768),
            'clipped_samples': sum(abs(sample) >= 32767 for sample in pcm)}


def float_wav_duration(data):
    require(data[:4] == b'RIFF' and data[8:12] == b'WAVE', 'Not a RIFF WAV')
    require(struct.unpack_from('<I', data, 4)[0] + 8 == len(data), 'RIFF size mismatch')
    chunks, offset = {}, 12
    while offset + 8 <= len(data):
        tag, size = struct.unpack_from('<4sI', data, offset)
        require(offset + 8 + size <= len(data), 'Truncated WAV chunk')
        require(tag not in chunks, 'Duplicate WAV chunk')
        chunks[tag] = data[offset + 8:offset + 8 + size]
        offset += 8 + size + size % 2
    require(offset == len(data), 'Trailing incomplete WAV chunk')
    require(b'fmt ' in chunks and b'data' in chunks, 'Missing WAV chunks')
    require(struct.unpack_from('<HHIIHH', chunks[b'fmt ']) ==
            (3, 1, 24000, 96000, 4, 32), 'Unexpected raw turn float WAV format')
    samples = array.array('f', chunks[b'data'])
    if sys.byteorder != 'little':
        samples.byteswap()
    require(samples and all(math.isfinite(value) for value in samples), 'Invalid raw float samples')
    return len(samples) / 24000


def words(text):
    return re.findall(r"[^\W_]+(?:['’][^\W_]+)*", unicodedata.normalize('NFC', text).lower())


def word_distance(reference, hypothesis):
    previous = list(range(len(hypothesis) + 1))
    for i, token in enumerate(reference, 1):
        current = [i]
        for j, other in enumerate(hypothesis, 1):
            current.append(min(current[-1] + 1, previous[j] + 1,
                               previous[j - 1] + (token != other)))
        previous = current
    return previous[-1]


def verify_screen(screen, manifest):
    rows = screen['outputs']
    require(len(rows) == len(manifest), 'ASR row count differs from retained audio')
    require({row['path'] for row in rows} == set(manifest), 'ASR audio set differs')
    require(screen['publication_ready'] is False, 'ASR cannot approve publication')
    for row in rows:
        audio = manifest[row['path']]
        require(row['candidate_id'] == audio['candidate_id'], 'ASR candidate differs')
        require(row['sha256'] == audio['sha256'], 'ASR input hash differs')
        require(row['expected'] == audio['text'], 'ASR expected text differs')
        verified_bytes(row['path'], row['sha256'])
        reference = words(row['expected'])
        edits = word_distance(reference, words(row['transcript']))
        require(row['reference_words'] == len(reference) and row['word_edits'] == edits,
                f'ASR diagnostic calculation differs: {row["path"]}')
        if 'diagnostic_wer' in row:
            require(math.isclose(row['diagnostic_wer'], edits / len(reference)), 'WER differs')


def verify():
    recovered = read(BATCH / 'recovery.json')
    for row in recovered['retained_files']:
        verified_bytes(row['path'], row['sha256'], row['bytes'])
    require(recovered['audio_regenerated'] is False, 'Recovery must preserve historical audio')
    report = read(BATCH / 'results.json')
    for flag in ['learner_data_used', 'uploaded_person_reference', 'runtime_integration',
                 'publication_ready', 'final_cast_approved', 'p6_authorized']:
        require(report[flag] is False, f'Unexpected acceptance/scope flag: {flag}')
    require(report['paid_inference_calls'] == 0, 'Paid inference outside scope')
    require(report['human_listening_review'] == 'PENDING' and report['p5_milestone'] == 'NOT_READY',
            'Human/milestone status must remain pending')
    for name, key in [('models.lock.json', 'model_lock_sha256'), ('tooling-lock.json', 'tooling_lock_sha256')]:
        verified_bytes(str((BATCH / name).relative_to(ROOT)), report[key])
    model = read(BATCH / 'models.lock.json')['files']['README.md']
    verified_bytes(str((BATCH / 'MODEL_CARD.md').relative_to(ROOT)), model['sha256'], model['bytes'])
    source = json.loads(verified_bytes(report['source_path'], report['source_sha256']))
    scripts = {row['id']: row for row in source['scripts']}
    old = read(ROOT / 'docs/p5/voice-audition/results.json')['outputs']
    old_by_path = {row['path']: row for row in old}
    outputs = report['outputs']
    require(len(outputs) == 4 and {(r['candidate_id'], r['pace']) for r in outputs} ==
            {(c, p) for c in ['cs-B-pocket-A', 'cs-C-pocket-C'] for p in ['normal', 'slow']},
            'Expected exactly two distinct normal/slow candidate pairs')
    raw_paths, durations = set(), {}
    for row in outputs:
        candidate, pace = row['candidate_id'], row['pace']
        require(row['language'] == 'cs', 'Unexpected language')
        authored = [scripts[sid] for sid in row['source_script_ids']]
        require(len(authored) == 5 and all(s['language'] == 'cs' for s in authored), 'Unexpected script set')
        texts = [' '.join(t['text'] for t in s['turns']) for s in authored]
        require(row['text'] == ' '.join(texts), 'Text differs from authored M01 source')
        reference = old_by_path[row['reference_path']]
        require(reference['candidate_id'] == row['reference_candidate'] and
                reference['sha256'] == row['reference_sha256'], 'Synthetic reference differs')
        require(row['reference_candidate'] == ('en-A-p225' if candidate == 'cs-B-pocket-A' else 'en-C-p228'),
                'Incorrect synthetic reference mapping')
        verified_bytes(row['reference_path'], row['reference_sha256'])
        verified_bytes(row['path'], row['sha256'], row['bytes'])
        measured = pcm_metrics(row['path'])
        for key, value in measured.items():
            require(math.isclose(value, row['metrics'][key], rel_tol=1e-9, abs_tol=1e-8),
                    f'PCM metric differs: {row["path"]} {key}')
        durations[(candidate, pace)] = measured['duration_seconds']
        require(row['playback_rate'] == (1.0 if pace == 'normal' else 0.8), 'Unexpected pace')
        require(row['slow_method'] is None if pace == 'normal' else 'atempo=0.8' in row['slow_method'],
                'Unexpected slow derivation')
        require(len(row['turns']) == 5, 'Unexpected turn count')
        end = 0.0
        for index, turn in enumerate(row['turns']):
            require(turn['script_id'] == authored[index]['id'] and turn['text'] == texts[index], 'Turn source differs')
            require(turn['seed'] == 20261009 + (100 if candidate == 'cs-C-pocket-C' else 0) + index,
                    'Turn seed differs')
            raw = verified_bytes(turn['raw_path'], turn['raw_sha256'])
            duration = float_wav_duration(raw)
            require(math.isclose(turn['start_seconds'], end + (0.35 if index else 0), abs_tol=1e-8), 'Turn gap differs')
            require(math.isclose(turn['end_seconds'] - turn['start_seconds'], duration, abs_tol=1e-8), 'Turn duration differs')
            end = turn['end_seconds']
            raw_paths.add(turn['raw_path'])
        if pace == 'normal':
            require(math.isclose(end, measured['duration_seconds']), 'Normal duration differs from turns')
    require(len(raw_paths) == 10, 'Expected ten raw generated turns')
    for candidate in ['cs-B-pocket-A', 'cs-C-pocket-C']:
        require(1.2 < durations[(candidate, 'slow')] / durations[(candidate, 'normal')] < 1.3, 'Slow duration ratio differs')
    screen = read(BATCH / 'asr-screen.json')
    require(screen['human_listening_review'] == 'PENDING' and screen['pronunciation_quality_asserted'] is False,
            'ASR is diagnostic only')
    require(screen['parameters'] == {'beam_size': 5, 'temperature': 0, 'vad_filter': False,
                                    'condition_on_previous_text': False, 'initial_prompt': None}, 'ASR parameters differ')
    verify_screen(screen, {r['path']: r for r in old + outputs})
    continuous = read(BATCH / 'continuous/results.json')
    require(continuous['human_review'] == 'PENDING' and continuous['publication_ready'] is False,
            'Continuous trial is unapproved')
    require(len(continuous['outputs']) == 2, 'Expected two continuous diagnostics')
    for row in continuous['outputs']:
        verified_bytes(row['path'], row['sha256'])
        verified_bytes(row['reference_path'], row['reference_sha256'])
        require(math.isclose(pcm_metrics(row['path'])['duration_seconds'], row['duration_seconds']), 'Continuous duration differs')
        require(row['text'] == outputs[0]['text'], 'Continuous text differs')
    verify_screen(read(BATCH / 'continuous/asr-screen.json'), {r['path']: r for r in continuous['outputs']})
    auth = read(ROOT / 'docs/p5/voice-audition/authorization.json')
    require(auth['stage'] == 'LOCAL_AUDITION_AUTHORIZED', 'Audition authorization missing')
    require(all(value is False for key, value in auth['constraints'].items() if key != 'monthly_paid_budget'),
            'Authorization scope changed')
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if os.environ.get('GITHUB_HEAD_SHA'):
        require(sha == os.environ['GITHUB_HEAD_SHA'], 'CI source differs from checked-out HEAD')
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=ROOT, text=True))
    if os.environ.get('CI') == 'true':
        require(not dirty, 'CI checkout changed during verification')
    print(json.dumps({'status': 'PASS', 'source_sha': sha, 'working_tree_dirty': dirty,
                      'retained_files_verified': len(recovered['retained_files']),
                      'main_samples_verified': 4, 'raw_turns_verified': 10,
                      'continuous_diagnostics_verified': 2, 'asr_bindings_verified': 14,
                      'inference_executed_now': False, 'human_review': 'PENDING',
                      'candidate_status': 'HOLD_FOR_REVIEW', 'publication_ready': False,
                      'p5_milestone': 'NOT_READY', 'p6_authorized': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true', required=True)
    parser.parse_args()
    try:
        verify()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        print(json.dumps({'status': 'FAIL', 'error': str(error)}))
        raise SystemExit(1)
