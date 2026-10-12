"""Verify M01 authoring metadata; optionally verify every external WAV byte.

Metadata-only CI is deliberately not audio-byte QA, pronunciation approval, or P5 acceptance.
"""
import argparse
from collections import Counter
import copy
import importlib.util
import json
from pathlib import Path, PurePosixPath
import subprocess
import wave

SPEC = importlib.util.spec_from_file_location('m01', Path(__file__).with_name('m01-audio-draft.py'))
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


def load():
    result = m.read(m.BATCH / 'results.json')
    groups = {'attempts': [], 'assets': [], 'screens': [], 'payload_files': []}
    for entry in result['records']:
        path = m.ROOT / entry['path']
        m.need(path.resolve().is_relative_to(m.BATCH.resolve()), 'Record path escapes batch')
        m.need(m.sha(path) == entry['sha256'], 'Record shard checksum mismatch')
        rows = m.read(path)
        m.need(len(rows) == entry['count'], 'Record count mismatch')
        groups[entry['role']].extend(rows)
    for entry in result['evidence']:
        m.need(m.sha(m.ROOT / entry['path']) == entry['sha256'], 'Evidence checksum mismatch')
    return result, groups


def validate(result, groups, audio_root=None):
    plan, registry, turns, cast = m.inputs()
    continuation = m.read(m.BATCH / 'continuation-plan.json')
    m.need(result['plan_sha256'] == m.sha(m.BATCH / 'plan.json'), 'Plan mismatch')
    m.need(result['continuation_plan_sha256'] == m.sha(m.BATCH / 'continuation-plan.json'), 'Continuation mismatch')
    m.need(result['authoring_script_sha256'] == m.sha(Path(__file__).with_name('m01-audio-draft.py')), 'Authoring script changed')
    m.need(result['export_script_sha256'] == m.sha(Path(__file__).with_name('export-m01-audio-draft.py')), 'Export script changed')
    m.need(continuation['original_generator_sha256'] == m.sha(m.ROOT / continuation['original_generator_path']), 'Initial source archive changed')
    m.need(continuation['network_guard_sha256'] == m.sha(m.ROOT / continuation['network_guard_path']), 'Offline guard changed')
    m.need(result['constraints'] == plan['constraints'], 'Constraints changed')
    c = result['constraints']
    for field in ['paid_inference', 'learner_data', 'uploaded_real_voice_reference', 'runtime_provider', 'publication_ready', 'final_cast_approved', 'p6_authorized']:
        m.need(c[field] is False, 'Closed gate changed: ' + field)
    m.need(c['human_review'] == 'PENDING' and c['p5_milestone'] == 'NOT_READY', 'Human/milestone gates changed')
    m.need(result['technical_status'] == 'PARTIAL_DEPENDENCY_BLOCK' and result['quality_retries'] == 0, 'Partial scope hidden')
    for candidate in cast.values():
        if 'reference_path' in candidate:
            m.need(m.sha(m.ROOT / candidate['reference_path']) == candidate['reference_sha256'], 'Synthetic reference changed')
    attempts = groups['attempts']
    m.need(len(attempts) == 106, 'Attempt inventory changed')
    m.need(Counter(a['attempt_batch'] for a in attempts) == {'initial': 78, 'infrastructure_recovery': 28}, 'Attempt scopes changed')
    m.need(len({(a['attempt_batch'], a['turn_id']) for a in attempts}) == 106, 'Duplicate attempt record')
    completed = {}
    for a in attempts:
        expected = turns[a['turn_id']]
        for key, value in expected.items():
            m.need(a[key] == value, 'Turn source mismatch: ' + key)
        candidate = cast[a['voice_code']]
        m.need(a['candidate_id'] == candidate['candidate_id'] and candidate['engine'] == 'piper', 'Wrong cast/engine')
        m.need(a['seed'] == (20261011 + int(a['turn_id'][:8], 16)) % 2147483647, 'Seed mismatch')
        m.need(a['plan_sha256'] == result['plan_sha256'], 'Attempt plan mismatch')
        recovery = a['attempt_batch'] == 'infrastructure_recovery'
        m.need(a['generator_sha256'] == (continuation['generator_sha256'] if recovery else continuation['original_generator_sha256']), 'Attempt source mismatch')
        if recovery:
            m.need(a['turn_id'] in continuation['selected_turn_ids'], 'Unplanned continuation turn')
            m.need(a['continuation_plan_sha256'] == result['continuation_plan_sha256'], 'Unbound continuation attempt')
            m.need(a['infrastructure_retry'] == (a['turn_id'] in continuation['interrupted_turn_ids']), 'Retry hidden/misclassified')
        m.need(a['status'] in ['STARTED', 'GENERATED_UNREVIEWED'], 'Unexpected attempted status')
        if a['status'] == 'GENERATED_UNREVIEWED':
            m.need(a['turn_id'] not in completed, 'Completed turn silently replaced')
            completed[a['turn_id']] = a
    recovered = m.read(m.BATCH / 'journal-recovery.json')
    m.need(recovered['kind'] == 'VERIFIED_PROCESSING_CHECKPOINT' and recovered['synthesis_repeated'] is False, 'Recovery scope changed')
    m.need(recovered['normal_and_slow_byte_identical_to_rederived'] is True, 'Unverified processing recovery')
    m.need(recovered['script_sha256'] == result['journal_recovery_script_sha256'] == m.sha(m.ROOT / result['journal_recovery_script_path']), 'Recovery source changed')
    row = recovered['turn']
    m.need(row['turn_id'] not in completed and row['status'] == 'GENERATED_UNREVIEWED', 'Recovery replaced completed audio')
    for key, value in turns[row['turn_id']].items():
        m.need(row[key] == value, 'Recovered turn source mismatch')
    completed[row['turn_id']] = row
    m.need(len(completed) == 104, 'Available unique turn count changed')
    expected_available = {k for k, t in turns.items() if cast[t['voice_code']]['engine'] == 'piper'}
    m.need(set(completed) == expected_available, 'Available turn set mismatch')
    for t in completed.values():
        for speed in ['normal', 'slow']:
            z = t[speed]['metrics']
            m.need((z['sample_rate'], z['channels'], z['sample_width']) == (24000, 1, 2), 'Unexpected audio format')
            m.need(z['frames'] > 0 and z['clipped_samples'] == 0 and z['duration_seconds'] == z['frames'] / 24000, 'Bad turn metrics')
        m.need(t['slow']['metrics']['frames'] > t['normal']['metrics']['frames'], 'Slow turn duration invalid')
    assets = groups['assets']
    m.need(len(assets) == len({a['asset_id'] for a in assets}) == 420, 'Duplicate/missing assets')
    source = {a['asset_id']: a for a in registry['audio']}
    generated = {}
    for a in assets:
        m.need(a['asset_id'] in source, 'Unknown asset ID')
        s = source[a['asset_id']]
        for key in ['stable_code', 'language', 'speed', 'normal_asset_id', 'script_id', 'script_hash', 'transcript']:
            m.need(a[key] == s[key], 'Asset source mismatch: ' + key)
        m.need(a['turn_ids'] == [t['turn_id'] for t in s['turns']], 'Turn order changed')
        missing = [k for k in a['turn_ids'] if k not in completed]
        if missing:
            m.need(a['status'] == 'NOT_GENERATED' and a['missing_turn_ids'] == missing, 'Missing audio hidden')
            m.need('path' not in a and 'sha256' not in a, 'Ungenerated asset has fake bytes')
            continue
        m.need(a['status'] == 'GENERATED_UNREVIEWED', 'Available asset status changed')
        m.need(a['path'] == f"audio/{a['language']}/{a['stable_code']}.wav", 'Unexpected final path')
        m.need(len(a['timing']) == len(s['turns']), 'Timing inventory changed')
        cursor, pieces = 0, []
        gap = plan['processing']['normal_gap_frames' if a['speed'] == 'normal' else 'slow_gap_frames']
        for i, (t, timing) in enumerate(zip(s['turns'], a['timing'])):
            clip = completed[t['turn_id']][a['speed']]
            if i:
                cursor += gap
                if audio_root:
                    pieces.append(bytes(gap * 2))
            m.need(timing['turn_id'] == t['turn_id'] and timing['voice_id'] == t['voice_id'] and timing['character_id'] == t.get('character_id'), 'Timing identity changed')
            m.need(timing['candidate_id'] == cast[t['voice_code']]['candidate_id'] and timing['text'] == t['text'], 'Timing text/cast mismatch')
            m.need(timing['start_frame'] == cursor and timing['start_ms'] == cursor / 24, 'Incorrect start timing')
            cursor += clip['metrics']['frames']
            m.need(timing['end_frame'] == cursor and timing['end_ms'] == cursor / 24, 'Incorrect end timing')
            m.need(timing['turn_sha256'] == clip['sha256'], 'Timing audio binding mismatch')
            if audio_root:
                pieces.append(m.pcm(audio_root / clip['path']))
        m.need(a['metrics']['frames'] == cursor and a['metrics']['duration_seconds'] == cursor / 24000, 'Asset frame count mismatch')
        m.need(a['metrics']['clipped_samples'] == 0, 'Clipped final asset')
        if audio_root:
            m.need(m.pcm(audio_root / a['path']) == b''.join(pieces), 'Dialogue PCM differs from measured turn bytes/gaps')
            m.need(m.metrics(audio_root / a['path']) == a['metrics'], 'Measured asset metrics changed')
        generated[a['asset_id']] = a
    m.need(len(generated) == 216 and Counter(a['language'] for a in generated.values()) == {'en': 210, 'cs': 6}, 'Available asset totals changed')
    screens = groups['screens']
    m.need(len(screens) == len({s['asset_id'] for s in screens}) == 216, 'ASR inventory mismatch')
    m.need({s['asset_id'] for s in screens} == set(generated), 'ASR set differs from generated set')
    for s in screens:
        a = generated[s['asset_id']]
        m.need(s['status'] == 'SCREENED' and s['audio_sha256'] == a['sha256'] and s['expected'] == a['transcript'], 'ASR binding mismatch')
        m.need(s['transcript'] == ''.join(segment['text'] for segment in s['segments']).strip(), 'ASR transcript differs from segments')
        expected = m.words(s['expected'])
        edits = m.distance(expected, m.words(s['transcript']))
        m.need(s['word_edits'] == edits and s['reference_words'] == len(expected) and s['diagnostic_wer'] == edits / len(expected), 'ASR edit bookkeeping mismatch')
        m.need(s['review_flag'] == ('ASR_DISCREPANCY' if edits else 'NO_ASR_DISCREPANCY'), 'ASR flag mismatch')
        m.need(s['human_review'] == 'PENDING' and s['pronunciation_quality_asserted'] is False, 'ASR promoted to human QA')
    files = groups['payload_files']
    m.need(len(files) == len({f['path'] for f in files}), 'Duplicate payload files')
    mapping = {f['path']: f for f in files}
    for record in [*generated.values(), *(t[k] for t in completed.values() for k in ['raw', 'normal', 'slow'])]:
        m.need(record['path'] in mapping and mapping[record['path']]['sha256'] == record['sha256'] and mapping[record['path']]['bytes'] == record['bytes'], 'Payload binding mismatch')
    for f in files:
        p = PurePosixPath(f['path'])
        m.need(not p.is_absolute() and '..' not in p.parts and p.suffix == '.wav', 'Unsafe payload path')
        m.need(len(f['sha256']) == 64 and f['bytes'] > 44, 'Bad file identity')
        if audio_root:
            actual = audio_root / f['path']
            m.need(m.sha(actual) == f['sha256'] and actual.stat().st_size == f['bytes'], 'WAV checksum mismatch')
    counts = result['counts']
    m.need(counts['available_assets'] == 216 and counts['not_generated_assets'] == 204 and counts['generated_unique_turns'] == 104, 'Summary completion mismatch')
    m.need(counts['asr_screened_assets'] == len(screens) and counts['asr_discrepancy_assets'] == sum(s['word_edits'] > 0 for s in screens), 'ASR summary mismatch')
    m.need(counts['asr_word_edits'] == sum(s['word_edits'] for s in screens) and counts['asr_reference_words'] == sum(s['reference_words'] for s in screens), 'ASR totals mismatch')
    m.need(counts['payload_wavs'] == len(files), 'Payload summary mismatch')
    return {'status': 'PASS', 'scope': 'FULL_WAV_BYTES_AND_METADATA' if audio_root else 'METADATA_ONLY_AUDIO_BYTES_EXTERNAL',
            'available_assets': 216, 'not_generated_assets': 204, 'asr_screened_assets': 216,
            'asr_discrepancy_assets': counts['asr_discrepancy_assets'], 'audio_bytes_verified': bool(audio_root),
            'wav_files_verified': len(files) if audio_root else 0, 'human_review': 'PENDING',
            'publication_ready': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}


def tamper_checks(result, groups):
    def reject(edit):
        changed = copy.deepcopy(groups)
        edit(changed)
        try:
            validate(result, changed)
        except (ValueError, KeyError):
            return
        raise ValueError('A deliberate integrity violation was not rejected')
    reject(lambda g: g['assets'][0].update(asset_id='unknown'))
    reject(lambda g: next(a for a in g['assets'] if a['status'] == 'GENERATED_UNREVIEWED')['timing'][0].update(end_frame=1))
    reject(lambda g: g['screens'][0].update(audio_sha256='0' * 64))
    reject(lambda g: g['attempts'][0].update(text='Wrong authored text'))
    return 4


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--metadata-only', action='store_true')
    mode.add_argument('--audio-root', type=Path)
    args = parser.parse_args()
    result, groups = load()
    report = validate(result, groups, args.audio_root.resolve() if args.audio_root else None)
    report['integrity_negative_checks'] = tamper_checks(result, groups)
    report['results_sha256'] = m.sha(m.BATCH / 'results.json')
    report['verifier_sha256'] = m.sha(Path(__file__))
    try:
        report['source_sha'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=m.ROOT, text=True, stderr=subprocess.DEVNULL).strip()
        report['working_tree_dirty'] = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=m.ROOT, text=True))
    except subprocess.CalledProcessError:
        report.update(source_sha=None, working_tree_dirty=None)
    print(json.dumps(report))
