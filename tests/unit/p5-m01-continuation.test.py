"""Continuation integrity tests using synthetic tones; no TTS or real new audio."""
import argparse
import array
import copy
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / 'tools/p5/continue-m01-audio.py'
spec = importlib.util.spec_from_file_location('continuation', TOOL)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
SELECTION, GROUPS, COMPLETED, PLAN, REGISTRY, CAST = c.load_parent()


def tone(path, frames, frequency):
    path.parent.mkdir(parents=True, exist_ok=True)
    samples = array.array('h', [int(2500 * math.sin(2 * math.pi * frequency * n / 24000)) for n in range(frames)])
    if sys.byteorder != 'little':
        samples.byteswap()
    data = samples.tobytes()
    with wave.open(str(path), 'wb') as f:
        f.setparams((1, 2, 24000, frames, 'NONE', 'not compressed'))
        f.writeframes(data)
    return data


class ContinuationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.new = self.base / 'new'
        self.new.mkdir()
        self.selection = copy.deepcopy(SELECTION)
        # Two synthetic records exercise the validator, not the full real 97-turn run.
        self.selection['pending_turns'] = self.selection['pending_turns'][:2]
        locked = c.m.read(ROOT / 'docs/p5/voice-audition/pocket-20261009/models.lock.json')
        self.rows = []
        for expected in self.selection['pending_turns']:
            key = expected['turn_id']
            row = dict(expected, status='GENERATED_UNREVIEWED', engine='pocket', infrastructure_retry=False,
                       continuation_plan_sha256=None, plan_sha256=self.selection['plan_sha256'],
                       generator_sha256=self.selection['generator_sha256'],
                       engine_result={'model_sha256': locked['files']['model.safetensors']['sha256'],
                                      'reference_sha256': CAST[expected['voice_code']]['reference_sha256'],
                                      'prepared_text': 'SYNTHETIC TEST ONLY', 'token_ids': [1]})
            for speed, relative, frames in [('raw', 'raw/' + key + '.wav', 12000),
                                           ('normal', 'turns/' + key + '.wav', 12000),
                                           ('slow', 'turns/' + key + '-slow.wav', 15000)]:
                tone(self.new / relative, frames, 330 if not self.rows else 440)
                row[speed] = c.m.file_record(self.new / relative, self.new, speed != 'raw')
            self.rows.append(row)
            c.m.write(self.new / 'attempts' / (key + '.json'), row)
        lock = c.m.read(ROOT / 'docs/p5/voice-audition/pocket-20261009/tooling-lock.json')
        self.job = {'status': 'COMPLETE', 'engine': 'pocket', 'attempts': [t['turn_id'] for t in self.rows],
                    'constraints': PLAN['constraints'], 'continuation_plan_sha256': None,
                    'versions': {p['name']: p['version'] for p in lock['packages']},
                    'network_guard': {'kernel': 'Linux seccomp',
                        'denied_syscalls': ['socket', 'socketpair', 'connect', 'sendto', 'sendmsg', 'sendmmsg'],
                        'native_socket_probe': 'EPERM', 'inherited_by_children': True,
                        'python_socket_and_dns_audit': True}}
        for key in ['plan_sha256', 'generator_sha256', 'network_guard_sha256']:
            self.job[key] = self.selection[key]
        c.m.write(self.new / 'generation-pocket.json', self.job)

    def validate(self):
        return c.validate_continuation(self.new, self.selection, PLAN, CAST)

    def test_real_metadata_selects_only_missing_pocket_turns(self):
        self.assertEqual((len(SELECTION['pending_turns']), len(SELECTION['pending_asset_ids']),
                          len(SELECTION['retained_assets'])), (97, 204, 216))
        self.assertTrue(set(t['turn_id'] for t in SELECTION['pending_turns']).isdisjoint(COMPLETED))
        self.assertFalse(SELECTION['audio_bytes_verified'])
        self.assertFalse(SELECTION['synthesis_executed'])
        self.assertEqual(SELECTION['constraints'], PLAN['constraints'])

    def test_complete_fixture_validates_without_inference(self):
        rows, provenance = self.validate()
        self.assertEqual(set(rows), set(self.job['attempts']))
        self.assertEqual(len(provenance['attempt_records']), 2)
        self.assertEqual(provenance['journal_sha256'], c.m.sha(self.new / 'generation-pocket.json'))

    def test_changed_raw_bytes_are_rejected(self):
        path = self.new / self.rows[0]['raw']['path']
        data = bytearray(path.read_bytes())
        data[-2] ^= 1
        path.write_bytes(data)
        with self.assertRaisesRegex(ValueError, 'Audio bytes changed'):
            self.validate()

    def test_explicit_processing_recovery_preserves_original_and_rejects_false_proof(self):
        derived = copy.deepcopy(self.rows[0])
        original = {k:v for k,v in derived.items() if k not in ['engine_result','raw','normal','slow']}
        original['status'] = 'STARTED'
        path = self.new / 'attempts' / (original['turn_id'] + '.json')
        c.m.write(path, original)
        proof = {'kind':'VERIFIED_PROCESSING_CHECKPOINT','synthesis_repeated':False,
            'journal_sha256':c.m.sha(self.new/'generation-pocket.json'),
            'script_sha256':c.m.sha(ROOT/'tools/p5/recover-m01-pocket-journal.py'),
            'turns':[{'turn':derived,'original_record_sha256':c.m.sha(path),'normal_and_slow_byte_identical_to_rederived':True}]}
        recovery = self.new/'processing-recovery.json'
        c.m.write(recovery,proof)
        rows,provenance=self.validate()
        self.assertEqual(rows[derived['turn_id']],derived)
        self.assertEqual(c.m.read(path),original)
        self.assertFalse(provenance['synthesis_repeated'])
        changes=[lambda p:p.update(synthesis_repeated=True),lambda p:p['turns'].append(p['turns'][0]),
                 lambda p:p['turns'][0].update(normal_and_slow_byte_identical_to_rederived=False),
                 lambda p:p['turns'][0]['turn'].update(elapsed_seconds=1),
                 lambda p:p['turns'][0]['turn'].update(text='changed')]
        for change in changes:
            bad=copy.deepcopy(proof);change(bad);c.m.write(recovery,bad)
            with self.assertRaises(ValueError):self.validate()

    def test_turn_identity_seed_retry_and_metrics_are_bound(self):
        row = self.rows[0]
        changes = [{'text': 'altered'}, {'language': 'en'}, {'seed': row['seed'] + 1},
                   {'candidate_id': 'other'}, {'status': 'STARTED'}, {'infrastructure_retry': True},
                   {'plan_sha256': '0' * 64}, {'generator_sha256': '0' * 64},
                   {'normal': dict(row['normal'], metrics=dict(row['normal']['metrics'], frames=1))},
                   {'engine_result': dict(row['engine_result'], reference_sha256='0' * 64)}]
        path = self.new / 'attempts' / (row['turn_id'] + '.json')
        for change in changes:
            with self.subTest(change=list(change)):
                c.m.write(path, dict(row, **change))
                with self.assertRaises(ValueError):
                    self.validate()
        c.m.write(path, row)

    def test_incomplete_duplicate_and_unpinned_jobs_are_rejected(self):
        for change in [{'status': 'RUNNING'}, {'attempts': self.job['attempts'] * 2}, {'versions': {}},
                       {'network_guard': {}}, {'constraints': {}}, {'continuation_plan_sha256': 'unapproved'}]:
            with self.subTest(change=list(change)):
                c.m.write(self.new / 'generation-pocket.json', dict(self.job, **change))
                with self.assertRaises(ValueError):
                    self.validate()

    def test_extra_attempt_is_rejected(self):
        c.m.write(self.new / 'attempts/extra.json', {})
        with self.assertRaisesRegex(ValueError, 'Attempt inventory'):
            self.validate()

    def test_paths_and_symlinks_cannot_escape_sources(self):
        for relative in ['../outside.wav', '/etc/passwd', 'turns/../x.wav', 'turns\\x.wav', './x.wav']:
            with self.subTest(relative=relative), self.assertRaises(ValueError):
                c.checked_file(self.new, relative)
        (self.new / 'linked').symlink_to(self.new / 'turns', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            c.checked_file(self.new, 'linked/' + self.rows[0]['turn_id'] + '.wav')

    def test_pcm_joins_retain_exact_samples_and_speed_specific_timing(self):
        rows, _ = self.validate()
        ids = list(rows)
        roots = {key: self.new for key in rows}
        for speed, gap, frames in [('normal', 8400, 12000), ('slow', 10500, 15000)]:
            asset = {'speed': speed, 'turns': [rows[key] for key in ids]}
            data, timing = c.asset_pcm(asset, rows, roots, PLAN)
            with wave.open(str(self.new / rows[ids[0]][speed]['path']), 'rb') as f:
                first = f.readframes(f.getnframes())
            with wave.open(str(self.new / rows[ids[1]][speed]['path']), 'rb') as f:
                second = f.readframes(f.getnframes())
            self.assertEqual(data, first + b'\0' * (gap * 2) + second)
            self.assertEqual([(t['start_frame'], t['end_frame']) for t in timing],
                             [(0, frames), (frames + gap, 2 * frames + gap)])
            self.assertEqual(timing[-1]['end_ms'], (2 * frames + gap) / 24)

    def test_retained_asset_copy_and_new_dialogue_preserve_parent_bytes(self):
        rows, _ = self.validate()
        audio = self.base / 'parent'
        old_path = audio / 'audio/cs/retained.wav'
        tone(old_path, 12000, 220)
        before = old_path.read_bytes()
        old = dict(asset_id='retained', **c.m.file_record(old_path, audio, True))
        asset = {'asset_id': 'new', 'stable_code': 'new-dialogue', 'language': 'cs', 'speed': 'normal',
                 'normal_asset_id': None, 'script_id': 'fixture', 'script_hash': 'fixture',
                 'transcript': 'SYNTHETIC TEST ONLY', 'turns': list(rows.values())}
        out = self.base / 'assembled'
        roots = {key: self.new for key in rows}
        roots['parent'] = audio
        result = c.write_assets(out, [dict(asset_id='retained', language='cs', stable_code='retained'), asset],
                                {'retained': old}, rows, roots, PLAN)
        self.assertEqual(result[0], old)
        self.assertEqual(old_path.read_bytes(), before)
        self.assertEqual((out / old['path']).read_bytes(), before)
        self.assertEqual(result[1]['metrics']['frames'], 32400)
        self.assertEqual(result[1]['status'], 'GENERATED_UNREVIEWED')
        with self.assertRaises(FileExistsError):
            c.write_assets(out, [dict(asset_id='retained', language='cs', stable_code='retained')],
                           {'retained': old}, rows, roots, PLAN)

    def test_outputs_cannot_replace_inputs_or_existing_files(self):
        for path in [self.new, self.new / 'inside', self.base]:
            with self.assertRaises(ValueError):
                c.destination_for(path, self.new)
        path = self.base / 'output.json'
        c.exclusive_json(path, {'first': True})
        before = path.read_bytes()
        with self.assertRaises(FileExistsError):
            c.exclusive_json(path, {'first': False})
        self.assertEqual(path.read_bytes(), before)
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        dangling = self.base / 'dangling'
        dangling.symlink_to(self.base / 'missing')
        with self.assertRaises(FileExistsError):
            c.exclusive_json(dangling, {})

    def test_assembly_failure_retains_incomplete_marker(self):
        # A synthetic interrupted assembly must not present a completion report.
        out = self.base / 'assembled'
        fake_parent = (self.selection, GROUPS, dict(COMPLETED), PLAN, REGISTRY, CAST)
        with patch.object(c, 'load_parent', return_value=fake_parent), \
             patch.object(c, 'write_assets', side_effect=RuntimeError('simulated interruption')):
            with self.assertRaisesRegex(RuntimeError, 'simulated interruption'):
                c.assemble(self.base / 'parent', self.new, out)
        self.assertTrue((out / 'INCOMPLETE.json').is_file())
        self.assertFalse((out / 'assembly.json').exists())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    outcome = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ContinuationTests))
    report = {'status': 'PASS' if outcome.wasSuccessful() else 'FAIL', 'scope': 'CONTINUATION_SYNTHETIC_TESTS',
              'tests_run': outcome.testsRun, 'failures': len(outcome.failures), 'errors': len(outcome.errors),
              'skipped': len(outcome.skipped), 'real_audio_generated': False, 'external_audio_bytes_verified': False,
              'tool_sha256': c.m.sha(TOOL), 'test_sha256': c.m.sha(Path(__file__)),
              'pending_turns': len(SELECTION['pending_turns']), 'pending_assets': len(SELECTION['pending_asset_ids']),
              'retained_assets': len(SELECTION['retained_assets']), 'publication_ready': False,
              'p5_milestone': 'NOT_READY', 'p6_authorized': False}
    try:
        report['source_sha'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
        report['working_tree_dirty'] = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=ROOT, text=True))
    except subprocess.CalledProcessError:
        report.update(source_sha=None, working_tree_dirty=None)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        c.exclusive_json(args.report, report)
    print(json.dumps(report))
    sys.exit(0 if outcome.wasSuccessful() else 1)
