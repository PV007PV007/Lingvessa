"""OD-005 approved offline audition. No application/provider/publication integration."""
import argparse
import array
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import re
import subprocess
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'docs/p5/voice-audition'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def source_text(plan, language):
    source = ROOT / plan['source_path']
    assert digest(source) == plan['source_sha256'], 'authored source changed'
    scripts = {s['stable_code']: s for s in read_json(source)['scripts']}
    selected = [scripts[code] for code in plan['script_codes'][language]]
    assert all(s['language'] == language and len(s['turns']) == 1 for s in selected)
    return ' '.join(s['turns'][0]['text'] for s in selected), [s['id'] for s in selected]


def measure(path):
    with wave.open(str(path), 'rb') as f:
        assert (f.getnchannels(), f.getsampwidth(), f.getframerate()) == (1, 2, 22050)
        frames = f.getnframes()
        pcm = array.array('h', f.readframes(frames))
    if sys.byteorder != 'little':
        pcm.byteswap()
    assert len(pcm) == frames and frames > 0
    peak = max(abs(x) for x in pcm)
    rms = math.sqrt(sum(x * x for x in pcm) / frames)
    assert 1 < peak < 32767 and rms > 1, 'silent or clipped audio'
    return {'sample_rate': 22050, 'channels': 1, 'sample_width': 2,
            'frames': frames, 'duration_seconds': frames / 22050,
            'peak_dbfs': 20 * math.log10(peak / 32768),
            'rms_dbfs': 20 * math.log10(rms / 32768),
            'clipped_samples': sum(abs(x) >= 32767 for x in pcm)}


def offline_guard(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo'):
        raise RuntimeError('Audition synthesis is offline; network calls are forbidden')


def generate(models_root):
    from piper import PiperVoice, SynthesisConfig
    import onnxruntime as ort
    sys.addaudithook(offline_guard)
    plan = read_json(DATA / 'audition-plan.json')
    assert not plan['publication_ready']
    authorization = read_json(DATA / 'authorization.json')
    assert authorization['stage'] == 'LOCAL_AUDITION_AUTHORIZED'
    assert not authorization['constraints']['paid_inference_enabled']
    locks = read_json(DATA / 'tooling-lock.json')['packages']
    for package in locks:
        assert importlib.metadata.version(package['name']) == package['version']
    models = {m['id']: m for m in read_json(DATA / 'models.lock.json')['models']}
    output = DATA / 'samples'
    output.mkdir(exist_ok=True)
    assert not list(output.glob('*.wav')), 'existing audition bytes are immutable; use a reviewed new batch'
    outputs = []
    for model_id, model in models.items():
        path = models_root / model['path']
        config = models_root / model['config_path']
        assert digest(path) == model['sha256'] and digest(config) == model['config_sha256']
        config_data = read_json(config)
        voice = PiperVoice.load(path, config_path=config, use_cuda=False)
        assert voice.session.get_providers() == ['CPUExecutionProvider']
        for candidate in [c for c in plan['candidates'] if c['model'] == model_id]:
            assert candidate['language'] == model['language']
            if model['speaker_count'] > 1:
                assert config_data['speaker_id_map'][candidate['speaker_name']] == candidate['speaker_id']
            else:
                assert candidate['speaker_id'] == 0
            text, script_ids = source_text(plan, candidate['language'])
            for pace in plan['paces']:
                ort.set_seed(plan['seed'])
                syn = SynthesisConfig(speaker_id=candidate['speaker_id'], length_scale=pace['length_scale'],
                                      noise_scale=plan['noise_scale'], noise_w_scale=plan['noise_w_scale'],
                                      volume=plan['volume'], normalize_audio=True)
                target = output / (candidate['id'] + '-' + pace['id'] + '.wav')
                start = time.monotonic()
                with wave.open(str(target), 'wb') as f:
                    voice.synthesize_wav(text, f, syn_config=syn)
                elapsed = time.monotonic() - start
                metrics = measure(target)
                result = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(target), '-af',
                                         'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, check=True, timeout=30)
                loudness = re.findall(r'I:\s*(-?[0-9.]+) LUFS', result.stderr)
                assert loudness, 'missing measured loudness'
                entry = {'candidate_id': candidate['id'], 'pace': pace['id'], 'model_id': model_id,
                         'model_sha256': model['sha256'], 'speaker_id': candidate['speaker_id'],
                         'language': candidate['language'], 'text': text, 'source_script_ids': script_ids,
                         'text_sha256': hashlib.sha256(text.encode()).hexdigest(),
                         'path': str(target.relative_to(ROOT)), 'sha256': digest(target),
                         'bytes': target.stat().st_size, 'metrics': metrics,
                         'integrated_lufs': float(loudness[-1]), 'generation_seconds': elapsed,
                         'length_scale': pace['length_scale'], 'seed': plan['seed']}
                outputs.append(entry)
                print(json.dumps({'sample': target.name, 'duration': metrics['duration_seconds'],
                                  'seconds_to_generate': elapsed}), flush=True)
        del voice
    report = {'schema_version': 1, 'phase': 'P5', 'scope': 'authorized local audition only',
              'technical_generation_status': 'PASS', 'human_listening_review': 'PENDING',
              'publication_ready': False, 'final_cast_approved': False,
              'voices_auditioned': {'en': 3, 'cs': 1}, 'remaining_czech_voices': 2,
              'paid_inference_calls': 0, 'learner_data_used': False,
              'runtime_integration': False, 'p6_authorized': False,
              'python': platform.python_version(), 'machine': platform.machine(),
              'onnx_providers': ['CPUExecutionProvider'],
              'network_guard': 'Python socket connect/getaddrinfo rejected during synthesis; local model paths only',
              'reproducibility': 'Revisions, package hashes, parameters and output bytes pinned. Cross-hardware bit identity is not promised.',
              'plan_sha256': digest(DATA / 'audition-plan.json'), 'outputs': outputs}
    (DATA / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def verify():
    plan = read_json(DATA / 'audition-plan.json')
    report = read_json(DATA / 'results.json')
    authorization = read_json(ROOT / plan['owner_authorization'])
    assert authorization['decision_id'] == 'OD-005'
    assert authorization['stage'] == 'LOCAL_AUDITION_AUTHORIZED'
    assert all(value is False or value == 0 for value in authorization['constraints'].values())
    assert report['plan_sha256'] == digest(DATA / 'audition-plan.json')
    assert not report['publication_ready'] and not report['final_cast_approved']
    assert report['human_listening_review'] == 'PENDING'
    assert report['paid_inference_calls'] == 0 and not report['learner_data_used']
    assert not report['runtime_integration'] and not report['p6_authorized']
    expected = {(c['id'], p['id']) for c in plan['candidates'] for p in plan['paces']}
    actual = {(o['candidate_id'], o['pace']) for o in report['outputs']}
    assert expected == actual and len(report['outputs']) == len(expected) == 8
    models = {m['id']: m for m in read_json(DATA / 'models.lock.json')['models']}
    for model in models.values():
        assert digest(DATA / (model['id'] + '-MODEL_CARD.md')) == model['model_card_sha256']
    for candidate in plan['candidates']:
        rows = [o for o in report['outputs'] if o['candidate_id'] == candidate['id']]
        for row in rows:
            text, script_ids = source_text(plan, candidate['language'])
            assert row['text'] == text and row['source_script_ids'] == script_ids
            assert row['text_sha256'] == hashlib.sha256(text.encode()).hexdigest()
            assert row['language'] == candidate['language'] and row['speaker_id'] == candidate['speaker_id']
            assert row['model_id'] == candidate['model']
            assert models[candidate['model']]['language'] == candidate['language']
            assert row['model_sha256'] == models[candidate['model']]['sha256']
            pace = next(p for p in plan['paces'] if p['id'] == row['pace'])
            assert row['length_scale'] == pace['length_scale'] and row['seed'] == plan['seed']
            file = ROOT / row['path']
            assert file.resolve().is_relative_to((DATA / 'samples').resolve())
            assert digest(file) == row['sha256'] and file.stat().st_size == row['bytes']
            assert measure(file) == row['metrics']
        normal = next(x for x in rows if x['pace'] == 'normal')
        slow = next(x for x in rows if x['pace'] == 'slow')
        assert slow['metrics']['duration_seconds'] > normal['metrics']['duration_seconds'] * 1.1
    assert len({o['sha256'] for o in report['outputs']}) == 8
    print(json.dumps({'status': 'PASS', 'samples_verified': 8, 'model_text_speaker_pairs_verified': 4,
                      'human_review': 'PENDING', 'publication_ready': False, 'p5_milestone': 'NOT_READY'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--models', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if not args.verify_only:
        if args.models is None:
            parser.error('--models is required for generation')
        generate(args.models.resolve())
    verify()
