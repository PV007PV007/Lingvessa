#!/usr/bin/env python3
"""Artificial feedback only; never record or approve a human M01 review."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / 'tools/p5/validate-m01-feedback.py'
spec = importlib.util.spec_from_file_location('m01_feedback', VALIDATOR)
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)
builder = intake.load_builder()
REAL = builder.catalog()[0]
FIXTURE = builder.fixture()[0]
STAMP = '2026-10-12T00:00:00.000Z'  # Deliberately fixed artificial test timestamp.


def export(manifest):
    slots = [s for p in manifest['pairs'] for s in p['slots'] if s['available']]
    return {'schema_version': 1, 'tool': 'lingvessa-m01-listening', 'scope': manifest['scope'],
            'dataset_sha256': manifest['dataset_sha256'], 'audio_source_sha': manifest['audio_source_sha'],
            'saved_at': STAMP, 'bindings': [{'asset_id': s['id'], 'sha256': s['sha256']} for s in slots],
            'feedback': {'levels': {'en': 'unspecified', 'cs': 'unspecified'}, 'records': [
                {'asset_id': s['id'], 'listened': False, 'choice': 'pending', 'issue': 'none',
                 'notes': '', 'updated_at': None} for s in slots]},
            'completed_files': 0, 'feedback_status': 'PARTIAL',
            'publication_ready': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}


def raw(value):
    return (json.dumps(value, ensure_ascii=False) + '\n').encode()


class IntakeTests(unittest.TestCase):
    def test_blank_real_catalog_keeps_every_available_and_missing_identity(self):
        value = export(REAL)
        value.update(completed_files=999, feedback_status='APPROVED')
        report = intake.summarize(raw(value), REAL)
        self.assertEqual(report['counts'], {'available_files': 216, 'missing_files': 204,
            'completed_attestations': 0, 'buckets': {'needs_work': 0, 'clarify': 0, 'unreviewed': 216, 'reported_no_issues': 0}})
        self.assertEqual(report['feedback_status'], 'PARTIAL')
        self.assertEqual({r['asset_id'] for r in report['records']}, {b['asset_id'] for b in value['bindings']})
        self.assertTrue(all('feedback' not in r for r in report['missing']))
        self.assertTrue({r['asset_id'] for r in report['missing']}.isdisjoint(b['asset_id'] for b in value['bindings']))

    def test_triage_keeps_attestations_contradictions_notes_and_language_context(self):
        value = export(FIXTURE)
        rows = value['feedback']['records']
        rows[0].update(listened=True, choice='needs_work', issue='text', notes='TEST ONLY <img src=x onerror=alert(1)>', updated_at=STAMP)
        rows[1].update(choice='no_issues', notes='TEST ONLY not listened', updated_at=STAMP)
        rows[2].update(listened=True, choice='no_issues', issue='noise', updated_at=STAMP)
        rows[3].update(listened=True, choice='no_issues', updated_at=STAMP)
        value['feedback']['levels']['cs'] = 'cannot_assess'
        report = intake.summarize(raw(value), FIXTURE)
        self.assertEqual(report['counts']['completed_attestations'], 3)
        self.assertEqual(report['counts']['buckets'], {'needs_work': 1, 'clarify': 2, 'unreviewed': 1, 'reported_no_issues': 0})
        self.assertEqual(report['records'][0]['feedback'], rows[0])
        self.assertEqual(report['records'][0]['review_bucket'], 'needs_work')
        self.assertEqual(report['records'][-1]['review_bucket'], 'unreviewed')
        self.assertEqual(report['input_sha256'], intake.sha(raw(value)))

    def test_complete_attestations_never_approve_linguistics_rights_or_publication(self):
        value = export(REAL)
        for row in value['feedback']['records']:
            row.update(listened=True, choice='no_issues', updated_at=STAMP)
        report = intake.summarize(raw(value), REAL)
        self.assertEqual(report['counts']['completed_attestations'], 216)
        self.assertEqual(report['feedback_status'], 'RECORDED_UNAPPROVED')
        self.assertEqual(report['review_provenance'], 'UNVERIFIED_SELF_REPORT')
        self.assertEqual(report['human_linguistic_approval'], 'PENDING')
        self.assertEqual(report['rights_approval'], 'PENDING')
        self.assertIs(report['publication_ready'], False)
        self.assertIs(report['p6_authorized'], False)
        self.assertEqual(report['p5_milestone'], 'NOT_READY')

    def test_changed_dataset_source_schema_and_approval_claims_are_rejected(self):
        for field, wrong in [('schema_version', True), ('schema_version', 2), ('tool', 'other'),
            ('dataset_sha256', '0'*64), ('audio_source_sha', '0'*40), ('scope', 'M01_DRAFT'),
            ('publication_ready', True), ('publication_ready', 0), ('p6_authorized', True), ('p5_milestone', 'READY')]:
            with self.subTest(field=field, wrong=wrong):
                value = export(FIXTURE)
                value[field] = wrong
                with self.assertRaises(intake.FeedbackError): intake.summarize(raw(value), FIXTURE)

    def test_binding_hash_membership_duplicates_and_order_are_checked(self):
        changes = [lambda b: b[0].update(sha256='0'*64), lambda b: b[0].update(asset_id='fixture-missing-normal'),
                   lambda b: b.append(b[0]), lambda b: b.pop(), lambda b: b.reverse(),
                   lambda b: b[0].update(extra='not permitted')]
        for change in changes:
            value = export(FIXTURE)
            change(value['bindings'])
            with self.assertRaises(intake.FeedbackError): intake.summarize(raw(value), FIXTURE)

    def test_feedback_rows_cannot_target_missing_duplicate_or_unbound_assets(self):
        changes = [lambda rows: rows[0].update(asset_id='fixture-missing-normal'),
                   lambda rows: rows[0].update(asset_id=rows[1]['asset_id']), lambda rows: rows.reverse(),
                   lambda rows: rows.pop(), lambda rows: rows.append(rows[0])]
        for change in changes:
            value = export(FIXTURE)
            change(value['feedback']['records'])
            with self.assertRaises(intake.FeedbackError): intake.summarize(raw(value), FIXTURE)

    def test_fields_dates_and_browser_utf16_note_limits_are_enforced(self):
        for field, wrong in [('listened', 1), ('listened', 'true'), ('choice', 'APPROVED'),
            ('issue', 'arbitrary'), ('notes', 23), ('notes', 'x'*2001), ('notes', '🙂'*1001),
            ('updated_at', '2026-02-30T12:00:00.000Z'), ('updated_at', '2026-10-12'), ('extra', True)]:
            value = export(FIXTURE)
            value['feedback']['records'][0][field] = wrong
            with self.subTest(field=field), self.assertRaises(intake.FeedbackError): intake.summarize(raw(value), FIXTURE)
        value = export(FIXTURE)
        value['feedback']['records'][0]['notes'] = '🙂'*1000
        self.assertEqual(intake.summarize(raw(value), FIXTURE)['records'][-1]['review_bucket'], 'unreviewed')
        for change in [lambda v: v.update(saved_at='not a date'), lambda v: v.update(extra=1),
                       lambda v: v['feedback']['levels'].update(cs='approved'),
                       lambda v: v['feedback'].update(extra=True)]:
            value = export(FIXTURE)
            change(value)
            with self.assertRaises(intake.FeedbackError): intake.summarize(raw(value), FIXTURE)

    def test_decoder_rejects_duplicate_keys_nonfinite_oversize_and_malformed_json(self):
        for payload in [b'{"scope":"a","scope":"b"}', b'{"x":NaN}', b'{"x":Infinity}', b'{"x":1e9999}',
                        b'\xff', b'{', b'x'*(intake.MAX_BYTES+1), b'['*2000+b']'*2000]:
            with self.assertRaises(intake.FeedbackError): intake.decode(payload)
        value = export(FIXTURE)
        value['feedback']['records'][0]['notes'] = '\ud800'
        with self.assertRaises(intake.FeedbackError): intake.summarize(json.dumps(value).encode(), FIXTURE)

    def test_fixture_and_real_feedback_cannot_cross_datasets(self):
        for value, manifest in [(export(REAL), FIXTURE), (export(FIXTURE), REAL)]:
            with self.assertRaises(intake.FeedbackError): intake.summarize(raw(value), manifest)

    def test_cli_preserves_inputs_and_existing_reports_and_never_echoes_private_notes(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source, output = directory/'notes.json', directory/'report.json'
            value = export(REAL)
            value['feedback']['records'][0]['notes'] = 'PRIVATE_TEST_NOTE_NOT_FOR_LOGS'
            source.write_bytes(raw(value))
            before = source.read_bytes()
            command = [sys.executable, str(VALIDATOR), '--input', str(source), '--output', str(output)]
            def run(): return subprocess.run(command, capture_output=True, text=True, cwd=ROOT, timeout=30)
            first = run()
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertNotIn('PRIVATE_TEST_NOTE_NOT_FOR_LOGS', first.stdout+first.stderr)
            self.assertEqual(source.read_bytes(), before)
            report = output.read_bytes()
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(report)['input_sha256'], intake.sha(before))
            self.assertEqual(run().returncode, 2)
            self.assertEqual(output.read_bytes(), report)
            command[-1] = str(source)
            self.assertEqual(run().returncode, 2)
            self.assertEqual(source.read_bytes(), before)
            command[-1] = str(directory/'rejected.json')
            source.write_text('{"broken":true}')
            self.assertEqual(run().returncode, 2)
            self.assertFalse((directory/'rejected.json').exists())
            source.write_bytes(raw(export(FIXTURE)))
            self.assertEqual(run().returncode, 2)
            self.assertFalse((directory/'rejected.json').exists())
            command.append('--test-fixture')
            self.assertEqual(run().returncode, 0)
            self.assertEqual(json.loads((directory/'rejected.json').read_text())['scope'], 'UI_TEST_FIXTURE')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(IntakeTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {'status': 'PASS' if result.wasSuccessful() else 'FAIL', **builder.source_state(),
              'scope': 'FEEDBACK_INTAKE_TESTS', 'tests_run': result.testsRun,
              'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped),
              'validator_sha256': intake.sha(VALIDATOR.read_bytes()),
              'test_sha256': intake.sha(Path(__file__).read_bytes()),
              'catalog_builder_sha256': intake.sha((ROOT/'tools/p5/build-m01-review.py').read_bytes()),
              'catalog_dataset_sha256': REAL['dataset_sha256'], 'catalog_counts': REAL['counts'],
              'real_human_feedback_processed': False, 'human_review': 'PENDING',
              'publication_ready': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    sys.exit(0 if result.wasSuccessful() else 1)
