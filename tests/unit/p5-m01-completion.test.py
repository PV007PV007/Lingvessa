#!/usr/bin/env python3
"""Completed-catalog integrity and artificial feedback boundaries; no human review."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj)
    return obj
complete=load('complete','tools/p5/complete-m01-audio.py')
intake=load('intake','tools/p5/validate-m01-feedback.py')

class CompletionTests(unittest.TestCase):
    def test_complete_inventory_and_six_voice_catalog(self):
        manifest,assets,result=complete.catalog()
        self.assertEqual(manifest['scope'],'M01_COMPLETE_DRAFT')
        self.assertEqual({k:v for k,v in manifest['counts'].items() if k!='flagged'},
                         {'slots':420,'pairs':210,'available':420,'missing':0})
        self.assertEqual({speaker for p in manifest['pairs'] for speaker in p['speakers']},
                         {'Maya','Daniel','Alex','Klára','Adam','Oksana'})
        self.assertEqual(result['counts']['languages'],{'en':210,'cs':210})
        self.assertEqual(len({a['asset_id'] for a in assets}),420)
        self.assertFalse(manifest['publication_ready'])

    def test_mutations_in_identity_audio_asr_and_seed_are_rejected(self):
        _,_,_,data=complete.load()
        mutations=[('assets',lambda a:a[0].update(sha256='0'*64)),
                   ('assets',lambda a:a[0].update(transcript='changed')),
                   ('assets',lambda a:a[0]['timing'][0].update(start_frame=1)),
                   ('screens',lambda a:a[0].update(word_edits=999)),
                   ('screens',lambda a:a[0].update(pronunciation_quality_asserted=True)),
                   ('turns',lambda a:a[0].update(seed=1))]
        for role,mutate in mutations:
            changed=copy.deepcopy(data);mutate(changed[role])
            with self.subTest(role=role):
                with self.assertRaises(ValueError): complete.validate_data(changed['assets'],changed['screens'],changed['turns'])

    def test_complete_cli_ignores_claimed_completion_and_checks_bindings(self):
        manifest=complete.catalog()[0]
        slots=[s for p in manifest['pairs'] for s in p['slots']]
        value={'schema_version':1,'tool':'lingvessa-m01-listening','scope':manifest['scope'],
            'dataset_sha256':manifest['dataset_sha256'],'audio_source_sha':manifest['audio_source_sha'],
            'saved_at':'2026-10-14T00:00:00.000Z','bindings':[{'asset_id':s['id'],'sha256':s['sha256']} for s in slots],
            'feedback':{'levels':{'en':'unspecified','cs':'unspecified'},'records':[
                {'asset_id':s['id'],'listened':False,'choice':'pending','issue':'none','notes':'','updated_at':None} for s in slots]},
            'completed_files':420,'feedback_status':'APPROVED','publication_ready':False,'p5_milestone':'NOT_READY','p6_authorized':False}
        raw=json.dumps(value).encode()
        with tempfile.TemporaryDirectory() as temp:
            source=Path(temp)/'input.json';target=Path(temp)/'report.json';source.write_bytes(raw)
            run=subprocess.run([sys.executable,str(ROOT/'tools/p5/validate-m01-feedback.py'),'--complete-batch',
                                '--input',str(source),'--output',str(target)],capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            report=json.loads(target.read_text())
            self.assertEqual(report['counts']['available_files'],420)
            self.assertEqual(report['counts']['missing_files'],0)
            self.assertEqual(report['counts']['completed_attestations'],0)
            self.assertEqual(report['feedback_status'],'PARTIAL')
            self.assertEqual(report['human_linguistic_approval'],'PENDING')
            self.assertFalse(report['publication_ready'])
        value['bindings'][0]['sha256']='0'*64
        with self.assertRaises(intake.FeedbackError):intake.summarize(json.dumps(value).encode(),manifest)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--report',type=Path);args=p.parse_args()
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CompletionTests))
    report={'status':'PASS' if result.wasSuccessful() else 'FAIL','scope':'COMPLETION_INTEGRITY_TESTS',
        **complete.b.source_state(),'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
        'test_sha256':complete.m.sha(Path(__file__)),'real_human_feedback_processed':False,'publication_ready':False,
        'p5_milestone':'NOT_READY','p6_authorized':False}
    if args.report:complete.m.write(args.report,report)
    print(json.dumps(report));sys.exit(not result.wasSuccessful())
