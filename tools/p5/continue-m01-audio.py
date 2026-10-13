"""Plan and assemble the unattempted Pocket portion of the immutable M01 draft.

No model import, synthesis, ASR, download, publication or approval occurs here.
The historical generator/verifier and their hash-bound evidence remain unchanged.
"""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

SPEC = importlib.util.spec_from_file_location('m01_parent', Path(__file__).with_name('verify-m01-audio-draft.py'))
parent = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parent)
m = parent.m


def checked_file(root, relative):
    """Only regular, canonical files below the supplied root; never follow links."""
    p = PurePosixPath(relative)
    m.need(isinstance(relative, str) and relative and not p.is_absolute()
           and '..' not in p.parts and '\\' not in relative and str(p) == relative,
           'Unsafe input path')
    current = root
    m.need(not current.is_symlink(), 'Input root is a symlink')
    for part in p.parts:
        current = current / part
        m.need(not current.is_symlink(), 'Input symlink is forbidden')
    m.need(current.is_file() and current.resolve().is_relative_to(root.resolve()), 'Missing or escaped input')
    return current


def checked_record(root, record, measured=False):
    path = checked_file(root, record['path'])
    m.need(path.stat().st_size == record['bytes'] and m.sha(path) == record['sha256'], 'Audio bytes changed')
    if measured:
        m.need(m.metrics(path) == record['metrics'], 'Audio measurements changed')
    return path


def load_parent(audio_root=None):
    result, groups = parent.load()
    if audio_root is not None:
        for record in groups['payload_files']:
            checked_record(audio_root, record)
    report = parent.validate(result, groups, audio_root)
    plan, registry, turns, cast = m.inputs()
    completed = {a['turn_id']: a for a in groups['attempts'] if a['status'] == 'GENERATED_UNREVIEWED'}
    recovered = m.read(m.BATCH / 'journal-recovery.json')['turn']
    m.need(recovered['turn_id'] not in completed, 'Recovered turn was already complete')
    completed[recovered['turn_id']] = recovered
    pending = [t for key, t in turns.items() if key not in completed]
    m.need(len(pending) == 97 and all(cast[t['voice_code']]['engine'] == 'pocket' for t in pending),
           'Continuation must contain exactly the 97 unattempted Pocket turns')
    attempted = {a['turn_id'] for a in groups['attempts']}
    m.need(not attempted.intersection(t['turn_id'] for t in pending), 'Continuation would retry an attempt')
    selection = {
        'schema_version': 1, 'scope': 'M01_POCKET_CONTINUATION',
        'parent_results_sha256': m.sha(m.BATCH / 'results.json'),
        'plan_sha256': result['plan_sha256'], 'generator_sha256': result['authoring_script_sha256'],
        'network_guard_sha256': m.sha(Path(__file__).with_name('authoring_offline.py')),
        'tool_sha256': m.sha(Path(__file__)),
        'audio_bytes_verified': report['audio_bytes_verified'], 'wav_files_verified': report['wav_files_verified'],
        'pending_turns': [dict(t, candidate_id=cast[t['voice_code']]['candidate_id'],
                              seed=(20261011 + int(t['turn_id'][:8], 16)) % 2147483647) for t in pending],
        'pending_asset_ids': [a['asset_id'] for a in groups['assets'] if a['status'] == 'NOT_GENERATED'],
        'retained_assets': [{'asset_id': a['asset_id'], 'path': a['path'], 'sha256': a['sha256']}
                            for a in groups['assets'] if a['status'] == 'GENERATED_UNREVIEWED'],
        'constraints': copy.deepcopy(plan['constraints']),
        'synthesis_executed': False, 'asr_executed': False,
    }
    m.need(len(selection['pending_asset_ids']) == 204 and len(selection['retained_assets']) == 216,
           'Continuation asset scope changed')
    return selection, groups, completed, plan, registry, cast


def validate_continuation(root, selection, plan, cast):
    """Require a completed, unretried run by the unchanged, pinned generator."""
    job_path = checked_file(root, 'generation-pocket.json')
    job = m.read(job_path)
    pending = selection['pending_turns']
    ids = [t['turn_id'] for t in pending]
    m.need(job['status'] == 'COMPLETE' and job['engine'] == 'pocket' and job['attempts'] == ids,
           'Incomplete, duplicate, reordered or out-of-scope generation')
    for key in ['plan_sha256', 'generator_sha256', 'network_guard_sha256']:
        m.need(job[key] == selection[key], 'Generation provenance changed: ' + key)
    m.need(job['constraints'] == plan['constraints'] and job['continuation_plan_sha256'] is None,
           'Generation constraints or retry scope changed')
    lock = m.read(m.ROOT / 'docs/p5/voice-audition/pocket-20261009/tooling-lock.json')
    m.need(job['versions'] == {p['name']: p['version'] for p in lock['packages']}, 'Pinned environment changed')
    m.need(job['network_guard'] == {'kernel': 'Linux seccomp',
           'denied_syscalls': ['socket', 'socketpair', 'connect', 'sendto', 'sendmsg', 'sendmmsg'],
           'native_socket_probe': 'EPERM', 'inherited_by_children': True, 'python_socket_and_dns_audit': True},
           'Offline execution evidence missing')
    m.need({p.name for p in (root / 'attempts').iterdir()} == {key + '.json' for key in ids},
           'Attempt inventory differs from selected turns')
    model = m.read(m.ROOT / 'docs/p5/voice-audition/pocket-20261009/models.lock.json')
    rows = {}
    records = []
    for expected in pending:
        key = expected['turn_id']
        path = checked_file(root, 'attempts/' + key + '.json')
        row = m.read(path)
        m.need(all(row.get(k) == v for k, v in expected.items()), 'Turn text, identity, cast or seed changed')
        m.need(row['engine'] == 'pocket' and row['status'] == 'GENERATED_UNREVIEWED', 'Turn is not complete')
        m.need(row['infrastructure_retry'] is False and row['continuation_plan_sha256'] is None, 'Retry not permitted')
        for field in ['plan_sha256', 'generator_sha256']:
            m.need(row[field] == selection[field], 'Turn provenance changed')
        candidate = cast[row['voice_code']]
        engine = row['engine_result']
        m.need(engine['model_sha256'] == model['files']['model.safetensors']['sha256']
               and engine['reference_sha256'] == candidate['reference_sha256'], 'Model or synthetic voice changed')
        m.need(isinstance(engine['prepared_text'], str) and engine['prepared_text']
               and isinstance(engine['token_ids'], list) and engine['token_ids']
               and all(type(x) is int and x >= 0 for x in engine['token_ids']), 'Missing tokenizer provenance')
        for speed, relative in [('raw', 'raw/' + key + '.wav'), ('normal', 'turns/' + key + '.wav'),
                                ('slow', 'turns/' + key + '-slow.wav')]:
            m.need(row[speed]['path'] == relative, 'Unexpected continuation audio path')
            checked_record(root, row[speed], speed != 'raw')
        m.need(row['slow']['metrics']['frames'] > row['normal']['metrics']['frames'], 'Invalid slow pace')
        m.need(row['normal']['metrics']['duration_seconds'] <= plan['generation']['maximum_turn_seconds'],
               'Turn exceeds duration limit')
        rows[key] = row
        records.append({'path': 'attempts/' + key + '.json', 'sha256': m.sha(path)})
    return rows, {'journal_sha256': m.sha(job_path), 'attempt_records': records}


def asset_pcm(asset, completed, roots, plan):
    pieces, timing, cursor = [], [], 0
    gap = plan['processing']['normal_gap_frames' if asset['speed'] == 'normal' else 'slow_gap_frames']
    for i, turn in enumerate(asset['turns']):
        row = completed[turn['turn_id']]
        clip = row[asset['speed']]
        path = checked_record(roots[turn['turn_id']], clip, True)
        data = m.pcm(path)
        if i:
            pieces.append(bytes(gap * 2))
            cursor += gap
        end = cursor + len(data) // 2
        timing.append({'turn_id': turn['turn_id'], 'voice_id': turn['voice_id'],
                       'character_id': turn.get('character_id'), 'candidate_id': row['candidate_id'],
                       'text': turn['text'], 'start_frame': cursor, 'end_frame': end,
                       'start_ms': cursor / 24, 'end_ms': end / 24, 'turn_sha256': clip['sha256']})
        pieces.append(data)
        cursor = end
    return b''.join(pieces), timing


def exclusive_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
    # O_EXCL rejects existing files and dangling symlinks, without replacing either.
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as f:
        f.write(data)


def destination_for(output, *inputs):
    m.need(not output.exists() and not output.is_symlink(), 'Output already exists')
    target = output.resolve()
    for root in inputs:
        origin = root.resolve()
        m.need(not target.is_relative_to(origin) and not origin.is_relative_to(target),
               'Output must be separate from all input directories')
    return target


def write_assets(output, assets, previous, completed, roots, plan):
    """Inputs are validated before entry. Copy retained files; assemble only absent IDs."""
    rows = []
    for asset in assets:
        old = previous.get(asset['asset_id'])
        relative = f"audio/{asset['language']}/{asset['stable_code']}.wav"
        m.need(PurePosixPath(relative).parts == ('audio', asset['language'], asset['stable_code'] + '.wav')
               and '\\' not in relative and '..' not in PurePosixPath(relative).parts, 'Unsafe asset output path')
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if old is not None:
            m.need(old['path'] == relative, 'Retained asset path changed')
            source = checked_record(roots['parent'], old, True)
            with path.open('xb') as f:
                f.write(source.read_bytes())
            m.need(m.sha(path) == old['sha256'], 'Retained asset was changed during copying')
            rows.append(copy.deepcopy(old))
            continue
        data, timing = asset_pcm(asset, completed, roots, plan)
        m.wav(path, data)
        row = {k: asset[k] for k in ['asset_id', 'stable_code', 'language', 'speed',
                                    'normal_asset_id', 'script_id', 'script_hash', 'transcript']}
        row.update(status='GENERATED_UNREVIEWED', turn_ids=[t['turn_id'] for t in asset['turns']],
                   timing=timing, **m.file_record(path, output, True))
        loud = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-i', str(path), '-af',
                               'ebur128=peak=true', '-f', 'null', '-'], check=True,
                              capture_output=True, text=True, timeout=30)
        values = re.findall(r'I:\s*(-?[0-9.]+) LUFS', loud.stderr)
        m.need(values, 'Missing LUFS measurement')
        row['integrated_lufs'] = float(values[-1])
        row['loudness_note'] = 'Measured diagnostic only; short clips can make gated LUFS unstable. No loudness QA approval.'
        rows.append(row)
    return rows


def assemble(audio_root, continuation_root, output):
    output = destination_for(output, audio_root, continuation_root, m.ROOT)
    selection, groups, completed, plan, registry, cast = load_parent(audio_root)
    new, provenance = validate_continuation(continuation_root, selection, plan, cast)
    m.need(not set(completed).intersection(new), 'A completed turn would be replaced')
    roots = {key: audio_root for key in completed}
    roots.update({key: continuation_root for key in new})
    roots['parent'] = audio_root
    completed.update(new)
    previous = {a['asset_id']: a for a in groups['assets'] if a['status'] == 'GENERATED_UNREVIEWED'}
    # All parent WAVs and all new attempts are checked before the first output write.
    output.mkdir(mode=0o700)
    marker = output / 'INCOMPLETE.json'
    exclusive_json(marker, {'status': 'ASSEMBLING', 'parent_results_sha256': selection['parent_results_sha256']})
    rows = write_assets(output, registry['audio'], previous, completed, roots, plan)
    m.need(len(rows) == 420 and len({r['asset_id'] for r in rows}) == 420, 'Final inventory mismatch')
    report = {'schema_version': 1, 'scope': selection['scope'], 'status': 'ASSEMBLED_ASR_PENDING',
              'parent_results_sha256': selection['parent_results_sha256'], 'plan_sha256': selection['plan_sha256'],
              'assembler_sha256': m.sha(Path(__file__)), 'continuation': provenance,
              'counts': {'retained_assets': 216, 'new_assets': 204, 'total_assets': 420},
              'assets': rows, 'retained_screens': groups['screens'],
              'asr_pending_asset_ids': selection['pending_asset_ids'],
              'new_asr_screened': 0, 'synthesis_executed': False,
              'constraints': copy.deepcopy(plan['constraints']),
              'retention': 'Keep the parent archive and continuation directory; raw/turn bytes remain there unchanged.'}
    exclusive_json(output / 'assembly.json', report)
    marker.unlink()
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['plan', 'assemble'])
    parser.add_argument('--audio-root', type=Path)
    parser.add_argument('--metadata-only', action='store_true')
    parser.add_argument('--continuation-root', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    m.need(args.metadata_only != (args.audio_root is not None), 'Choose --audio-root or --metadata-only')
    if args.command == 'plan':
        m.need(args.continuation_root is None, 'Plan does not consume generated continuation')
        output = destination_for(args.output, m.BATCH, *([args.audio_root] if args.audio_root else []))
        result = load_parent(args.audio_root)[0]
        exclusive_json(output, result)
        print(json.dumps({'scope': result['scope'], 'pending_turns': len(result['pending_turns']),
                          'pending_assets': len(result['pending_asset_ids']), 'retained_assets': len(result['retained_assets']),
                          'audio_bytes_verified': result['audio_bytes_verified'], 'synthesis_executed': False}))
    else:
        m.need(args.audio_root is not None and args.continuation_root is not None and not args.metadata_only,
               'Assembly requires --audio-root and --continuation-root; metadata-only is forbidden')
        m.offline()
        result = assemble(args.audio_root, args.continuation_root, args.output)
        print(json.dumps({'status': result['status'], **result['counts'], 'new_asr_screened': 0,
                          'publication_ready': False, 'p5_milestone': 'NOT_READY'}))
