#!/usr/bin/env python3
"""Bounded local case-sensitivity trial; --verify-only needs only Python stdlib.

Generation/ASR require the separately pinned, isolated authoring environment.
No download, production adoption, cast acceptance or publication is performed.
"""
import argparse
import array
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import resource
import subprocess
import sys
import time
import unicodedata
import wave

ROOT = Path(__file__).resolve().parents[2]
BATCH = ROOT / 'docs/p5/voice-audition/pocket-case-20261010'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def need(condition, message):
    if not condition:
        raise ValueError(message)


def rel(path):
    return str(path.relative_to(ROOT))


def bound(path, expected):
    need(sha(path) == expected, f'Hash mismatch: {path}')


def offline():
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

    def guard(event, args):
        if event in ('socket.connect', 'socket.getaddrinfo'):
            raise RuntimeError(f'Network is forbidden during inference: {event}')
    sys.addaudithook(guard)


def check_environment(plan):
    versions = {}
    for package in read(ROOT / plan['tooling_lock_path'])['packages']:
        actual = importlib.metadata.version(package['name'])
        need(actual == package['version'], f'Unpinned dependency: {package["name"]}')
        versions[package['name']] = actual
    return versions


def metrics(path):
    with wave.open(str(path), 'rb') as wav:
        rate, channels, width, frames = (wav.getframerate(), wav.getnchannels(),
                                         wav.getsampwidth(), wav.getnframes())
        need((rate, channels, width) == (24000, 1, 2), 'Unexpected PCM format')
        values = array.array('h', wav.readframes(frames))
    if sys.byteorder != 'little':
        values.byteswap()
    need(len(values) == frames and frames > 0, 'Empty/truncated WAV')
    peak = max(abs(v) for v in values)
    rms = math.sqrt(sum(v * v for v in values) / frames)
    need(1 < peak < 32767 and rms > 1, 'Silent/clipped WAV')
    return {'frames': frames, 'sample_rate': rate, 'channels': channels,
            'sample_width': width, 'duration_seconds': frames / rate,
            'peak_dbfs': 20 * math.log10(peak / 32768),
            'rms_dbfs': 20 * math.log10(rms / 32768),
            'clipped_samples': sum(abs(v) >= 32767 for v in values)}


def words(text):
    return re.findall(r"[^\W_]+(?:['’][^\W_]+)*", unicodedata.normalize('NFC', text).lower())


def distance(reference, hypothesis):
    previous = list(range(len(hypothesis) + 1))
    for i, token in enumerate(reference, 1):
        current = [i]
        for j, other in enumerate(hypothesis, 1):
            current.append(min(current[-1] + 1, previous[j] + 1,
                               previous[j - 1] + (token != other)))
        previous = current
    return previous[-1]


def generate(model_dir):
    plan = read(BATCH / 'plan.json')
    need(not (BATCH / 'results.json').exists(), 'Refusing to overwrite an executed trial')
    versions = check_environment(plan)
    lock = read(ROOT / plan['model_lock_path'])
    for name, record in lock['files'].items():
        bound(model_dir / name, record['sha256'])
    bound(ROOT / plan['source_path'], plan['source_sha256'])
    import yaml
    config = yaml.safe_load((model_dir / 'czech.yaml').read_text())
    config['weights_path'] = str(model_dir / 'model.safetensors')
    config['flow_lm']['lookup_table']['tokenizer_path'] = str(model_dir / 'tokenizer.model')
    local_config = model_dir / 'local-czech.yaml'
    local_config.write_text(yaml.safe_dump(config))
    offline()
    import numpy as np
    from scipy.io import wavfile
    import torch
    from pocket_tts import TTSModel
    from pocket_tts.models.text_chunking import prepare_text_prompt, split_into_best_sentences
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    torch.manual_seed(20261009)
    began = time.monotonic()
    model = TTSModel.load_model(config=local_config, temp=0.3,
                              sampler_decode_steps=1, noise_clamp=None, eos_threshold=-4.0)
    need(model.sample_rate == 24000, 'Unexpected synthesis sample rate')
    report = {'plan_sha256': sha(BATCH / 'plan.json'), 'generator_sha256': sha(Path(__file__)),
              'status': 'RUNNING', 'outputs': [], 'raw_turns': [], 'failures': [],
              'versions': versions, 'python': sys.version,
              'local_config_sha256': sha(local_config),
              'config_change': 'Only weights/tokenizer locations are mapped to verified local files; capitalize_first_letter is set per planned condition.',
              'network_guard': 'Python socket connect/DNS rejected after pinned downloads',
              'model_defaults': {key: getattr(model, key) for key in
                  ['pad_with_spaces_for_short_inputs', 'remove_semicolons',
                   'append_terminal_punctuation', 'capitalize_first_letter',
                   'model_recommended_frames_after_eos', 'replace_characters']}}
    samples = BATCH / 'samples'
    samples.mkdir(exist_ok=True)
    try:
        for candidate in plan['candidates']:
            reference = ROOT / candidate['reference_path']
            bound(reference, candidate['reference_sha256'])
            state = model.get_state_for_audio_prompt(reference)
            for variant in plan['variants']:
                model.capitalize_first_letter = variant['capitalize_first_letter']
                chunks, turns = [], []
                stem = candidate['candidate_id'] + '-' + variant['id']
                for index, turn in enumerate(candidate['turns']):
                    text = turn['text'] if variant['id'] == 'control' else turn['text'].lower()
                    prepared_chunks = split_into_best_sentences(
                        model.flow_lm.conditioner.tokenizer, text, 50,
                        model.pad_with_spaces_for_short_inputs, model.remove_semicolons,
                        model.append_terminal_punctuation, model.capitalize_first_letter,
                        model.replace_characters)
                    need(len(prepared_chunks) == 1, 'Unexpected text chunk split')
                    prepared, _ = prepare_text_prompt(
                        prepared_chunks[0], model.pad_with_spaces_for_short_inputs,
                        model.remove_semicolons, model.append_terminal_punctuation,
                        model.capitalize_first_letter, model.replace_characters)
                    torch.manual_seed(turn['seed'])
                    began_turn = time.monotonic()
                    pcm = model.generate_audio(state, text, max_tokens=50, copy_state=True).detach().cpu().numpy().reshape(-1)
                    need(pcm.size > 0 and np.isfinite(pcm).all(), 'Non-finite/empty synthesis')
                    path = samples / f'{stem}-turn-{index + 1}.wav'
                    wavfile.write(path, 24000, pcm.astype(np.float32))
                    row = {**turn, 'candidate_id': candidate['candidate_id'], 'variant': variant['id'],
                           'input_text': text, 'prepared_text': prepared,
                           'token_ids': model.flow_lm.conditioner.tokenizer(prepared)[0].tolist(),
                           'path': rel(path), 'sha256': sha(path), 'bytes': path.stat().st_size,
                           'frames': len(pcm), 'seconds': time.monotonic() - began_turn}
                    report['raw_turns'].append(row)
                    turns.append(row)
                    if index:
                        chunks.append(np.zeros(8400, dtype=np.float32))
                    chunks.append(pcm)
                    print(json.dumps({'generated': path.name, 'frames': len(pcm)}, ensure_ascii=False), flush=True)
                joined = np.concatenate(chunks)
                gain = min(1.0, 0.9 / float(np.max(np.abs(joined))))
                normal = samples / f'{stem}-normal.wav'
                wavfile.write(normal, 24000, np.rint(joined * gain * 32767).astype(np.int16))
                slow = samples / f'{stem}-slow.wav'
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
                                '-i', str(normal), '-af', 'atempo=0.8', '-c:a', 'pcm_s16le',
                                str(slow)], check=True)
                for pace, path in [('normal', normal), ('slow', slow)]:
                    report['outputs'].append({'candidate_id': candidate['candidate_id'],
                        'variant': variant['id'], 'pace': pace, 'text': candidate['text'],
                        'reference_path': candidate['reference_path'],
                        'reference_sha256': candidate['reference_sha256'],
                        'path': rel(path), 'sha256': sha(path), 'bytes': path.stat().st_size,
                        'gain': gain, 'metrics': metrics(path), 'turn_paths': [t['path'] for t in turns]})
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL'
        report['failures'].append(type(error).__name__ + ': ' + str(error))
        raise
    finally:
        report['elapsed_seconds'] = time.monotonic() - began
        report['peak_rss_kib'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        write(BATCH / 'results.json', report)


def screen(model_dir):
    plan, generated = read(BATCH / 'plan.json'), read(BATCH / 'results.json')
    need(generated['status'] == 'PASS', 'Cannot screen incomplete generation')
    need(not (BATCH / 'asr-screen.json').exists(), 'Refusing to overwrite ASR results')
    check_environment(plan)
    for row in read(ROOT / plan['asr_model_lock_path'])['files']:
        bound(model_dir / row['path'], row['sha256'])
    offline()
    import numpy as np
    from scipy.io import wavfile
    from scipy.signal import resample_poly
    from faster_whisper import WhisperModel
    began = time.monotonic()
    model = WhisperModel(str(model_dir), device='cpu', compute_type='int8', cpu_threads=2,
                         num_workers=1, local_files_only=True)
    old = read(ROOT / 'docs/p5/voice-audition/pocket-20261009/results.json')['outputs']
    anchor = [r for r in read(ROOT / 'docs/p5/voice-audition/results.json')['outputs'] if r['language'] == 'cs']
    report = {'status': 'RUNNING', 'plan_sha256': sha(BATCH / 'plan.json'),
              'screen_script_sha256': sha(Path(__file__)), 'parameters': plan['screen'],
              'normalization': 'NFC, lowercase word tokens; punctuation ignored, diacritics retained',
              'decoding': 'scipy PCM16 WAV read / resample_poly to mono float32 16000Hz; no PyAV decoding',
              'network_guard': 'Python socket connect/DNS rejected; local files only',
              'human_listening_review': 'PENDING', 'pronunciation_quality_asserted': False,
              'publication_ready': False, 'outputs': []}
    for row in generated['outputs'] + [{**r, 'variant': 'historical'} for r in old + anchor]:
        path = ROOT / row['path']
        bound(path, row['sha256'])
        rate, pcm = wavfile.read(path)
        need(pcm.dtype == np.int16 and pcm.ndim == 1, 'Expected mono PCM16 ASR input')
        pcm = resample_poly(pcm.astype(np.float32) / 32768, 16000 // math.gcd(rate, 16000), rate // math.gcd(rate, 16000))
        # Expected text is never passed to the recognizer.
        segments, info = model.transcribe(pcm, language='cs', beam_size=5, temperature=0,
            vad_filter=False, condition_on_previous_text=False, initial_prompt=None)
        segments = [{'start': s.start, 'end': s.end, 'text': s.text,
                     'avg_logprob': s.avg_logprob, 'no_speech_prob': s.no_speech_prob} for s in segments]
        transcript = ''.join(s['text'] for s in segments).strip()
        reference = words(row['text'])
        edits = distance(reference, words(transcript))
        result = {k: row[k] for k in ['candidate_id', 'variant', 'pace', 'path', 'sha256']}
        result.update(expected=row['text'], transcript=transcript, word_edits=edits,
                      reference_words=len(reference), diagnostic_wer=edits / len(reference), segments=segments)
        report['outputs'].append(result)
        write(BATCH / 'asr-screen.json', report)
        print(json.dumps({k: result[k] for k in ['candidate_id', 'variant', 'pace', 'transcript', 'word_edits']}, ensure_ascii=False), flush=True)
    report.update(status='PASS', elapsed_seconds=time.monotonic() - began,
                  peak_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    write(BATCH / 'asr-screen.json', report)


def verify():
    plan, result, screen_report = (read(BATCH / name) for name in ['plan.json', 'results.json', 'asr-screen.json'])
    need(result['status'] == screen_report['status'] == 'PASS', 'Incomplete experiment')
    bound(BATCH / 'plan.json', result['plan_sha256'])
    bound(BATCH / 'plan.json', screen_report['plan_sha256'])
    bound(Path(__file__), result['generator_sha256'])
    bound(Path(__file__), screen_report['screen_script_sha256'])
    for flag in ['learner_data_used', 'uploaded_person_reference', 'runtime_integration',
                 'publication_ready', 'final_cast_approved', 'p6_authorized']:
        need(plan[flag] is False, f'Scope changed: {flag}')
    need(plan['p5_milestone'] == 'NOT_READY' and plan['human_listening_review'] == 'PENDING', 'Acceptance changed')
    need(plan['paid_inference_calls'] == 0 and result['failures'] == [], 'Unexpected inference state')
    need(screen_report['parameters'] == plan['screen'] and not screen_report['pronunciation_quality_asserted'], 'ASR scope differs')
    bound(ROOT / plan['source_path'], plan['source_sha256'])
    scripts = {r['id']: r for r in read(ROOT / plan['source_path'])['scripts']}
    expected_ids = {(c['candidate_id'], v['id'], p) for c in plan['candidates'] for v in plan['variants'] for p in ['normal', 'slow']}
    need(len(result['outputs']) == 8 and {(r['candidate_id'], r['variant'], r['pace']) for r in result['outputs']} == expected_ids, 'Output set differs')
    need(len(result['raw_turns']) == plan['generation']['maximum_generated_turns'] == 20, 'Trial limit differs')
    raw = {r['path']: r for r in result['raw_turns']}
    for c in plan['candidates']:
        bound(ROOT / c['reference_path'], c['reference_sha256'])
        for t in c['turns']:
            need(t['text'] == ' '.join(x['text'] for x in scripts[t['script_id']]['turns']), 'Authored text differs')
    for row in result['raw_turns']:
        bound(ROOT / row['path'], row['sha256'])
        need((ROOT / row['path']).stat().st_size == row['bytes'], 'Raw size differs')
        c = next(c for c in plan['candidates'] if c['candidate_id'] == row['candidate_id'])
        t = next(t for t in c['turns'] if t['script_id'] == row['script_id'])
        need(row['seed'] == t['seed'] and row['text'] == t['text'], 'Seed/source differs')
        need(row['input_text'] == (t['text'] if row['variant'] == 'control' else t['text'].lower()), 'Transformation differs')
        need(row['prepared_text'].strip() == row['input_text'], 'Prepared text differs')
    for row in result['outputs']:
        bound(ROOT / row['path'], row['sha256'])
        need((ROOT / row['path']).stat().st_size == row['bytes'], 'PCM size differs')
        need(metrics(ROOT / row['path']) == row['metrics'], 'PCM metrics differ')
        turns = [raw[p] for p in row['turn_paths']]
        need(len(turns) == 5 and all(t['candidate_id'] == row['candidate_id'] and t['variant'] == row['variant'] for t in turns), 'Turn mapping differs')
        if row['pace'] == 'normal':
            need(row['metrics']['frames'] == sum(t['frames'] for t in turns) + 4 * 8400, 'Gap/duration differs')
        else:
            normal = next(r for r in result['outputs'] if r['candidate_id'] == row['candidate_id'] and r['variant'] == row['variant'] and r['pace'] == 'normal')
            need(1.2 < row['metrics']['frames'] / normal['metrics']['frames'] < 1.3, 'Slow duration ratio differs')
    need(len(screen_report['outputs']) == 14, 'Expected all eight new clips and six historical anchors')
    expected_asr = {r['path']: r for r in result['outputs']}
    expected_asr.update({r['path']: r for r in read(ROOT / 'docs/p5/voice-audition/pocket-20261009/results.json')['outputs']})
    expected_asr.update({r['path']: r for r in read(ROOT / 'docs/p5/voice-audition/results.json')['outputs'] if r['language'] == 'cs'})
    need({r['path'] for r in screen_report['outputs']} == set(expected_asr), 'ASR input set differs')
    for row in screen_report['outputs']:
        bound(ROOT / row['path'], row['sha256'])
        need(row['expected'] == expected_asr[row['path']]['text'], 'ASR expected text differs')
        n = len(words(row['expected']))
        edits = distance(words(row['expected']), words(row['transcript']))
        need(row['reference_words'] == n and row['word_edits'] == edits and row['diagnostic_wer'] == edits / n, 'ASR score differs')
    for row in read(BATCH / 'downloads.json'):
        lock = read(ROOT / plan['model_lock_path']) if row['group'] == 'tts' else read(ROOT / plan['asr_model_lock_path'])
        target = lock['files'][row['file']] if row['group'] == 'tts' else next(f for f in lock['files'] if f['path'] == row['file'])
        need(row['status'] == 'PASS' and row['sha256'] == target['sha256'] and row['bytes'] == target['bytes'], 'Download provenance differs')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True))
    if os.environ.get('GITHUB_HEAD_SHA'):
        need(head == os.environ['GITHUB_HEAD_SHA'], 'CI source differs')
    if os.environ.get('CI') == 'true':
        need(not dirty, 'CI checkout changed')
    print(json.dumps({'status': 'PASS', 'source_sha': head, 'working_tree_dirty': dirty,
        'raw_turns_verified': 20, 'main_clips_verified': 8, 'asr_bindings_verified': 14,
        'inference_executed_now': False, 'human_review': 'PENDING', 'p5_milestone': 'NOT_READY',
        'publication_ready': False, 'p6_authorized': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--generate', action='store_true')
    mode.add_argument('--screen', action='store_true')
    mode.add_argument('--verify-only', action='store_true')
    parser.add_argument('--model-dir', type=Path)
    args = parser.parse_args()
    if args.verify_only:
        verify()
    else:
        need(args.model_dir is not None and args.model_dir.is_absolute(), 'Absolute model directory required')
        (generate if args.generate else screen)(args.model_dir)
