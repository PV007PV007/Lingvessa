#!/usr/bin/env python3
"""Run the separately planned held-out authored-text check using the same engine."""
import argparse
import importlib.util
from pathlib import Path

path = Path(__file__).with_name('pocket-case-trial.py')
spec = importlib.util.spec_from_file_location('case_trial', path)
trial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trial)
initial = trial.read(trial.BATCH / 'plan.json')
trial.BATCH = trial.ROOT / 'docs/p5/voice-audition/pocket-case-holdout-20261010'
plan = trial.read(trial.BATCH / 'plan.json')
trial.bound(Path(__file__), plan['entrypoint_sha256'])
old_ids = {t['script_id'] for c in initial['candidates'] for t in c['turns']}
new_ids = {t['script_id'] for c in plan['candidates'] for t in c['turns']}
trial.need(len(new_ids) == 5 and old_ids.isdisjoint(new_ids), 'Held-out text must be disjoint')
parser = argparse.ArgumentParser(description=__doc__)
mode = parser.add_mutually_exclusive_group(required=True)
mode.add_argument('--generate', action='store_true')
mode.add_argument('--screen', action='store_true')
mode.add_argument('--verify-only', action='store_true')
parser.add_argument('--model-dir', type=Path)
args = parser.parse_args()
if args.verify_only:
    trial.verify()
else:
    trial.need(args.model_dir is not None and args.model_dir.is_absolute(), 'Absolute model path required')
    (trial.generate if args.generate else trial.screen)(args.model_dir)
