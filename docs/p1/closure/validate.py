#!/usr/bin/env python3
"""Validate closure reconciliation only. Never fabricates or reruns hosted CI."""
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SHA = '3b0a45e2c143fb538edb7a626f8c84356cdcc34f'
checks = []

def check(name, condition):
    checks.append({'check': name, 'status': 'PASS' if condition else 'FAIL'})

def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def documentation(path):
    return path == 'README.md' or path == '00_CONTEXT/01_implementation_state_and_handoff.md' or path.startswith('docs/')

def digest(data):
    return hashlib.sha256(data).hexdigest()

owner = read('docs/p1/closure/owner-verification.json')
current = read('docs/p1/closure/current-validation.json')
exception = read('docs/p1/closure/operational-exception.json')
baseline = read('docs/baseline/baseline.yml')
tasks = read('docs/p1/task-status.json')
overlay = read('docs/p1/requirement-evidence.json')
mapping = read('docs/p1/closure/acceptance-map.json')
check('Git HEAD remains exact tested source SHA; no new implementation commit', git('rev-parse', 'HEAD').decode().strip() == SHA)
files = git('ls-tree', '-r', '--name-only', SHA).decode().splitlines()
unchanged_runtime = all((ROOT / p).is_file() and (ROOT / p).read_bytes() == git('show', SHA + ':' + p) for p in files if not documentation(p))
check('Every original non-document file exactly matches tested source', unchanged_runtime)
changed = git('diff', '--name-only', SHA).decode().splitlines()
untracked = git('ls-files', '--others', '--exclude-standard').decode().splitlines()
check('All closure additions/changes are documentation metadata only', all(documentation(p) for p in changed + untracked))
check('Single current tested SHA across owner/baseline/task/trace/validation', all(v == SHA for v in [owner['hosted_ci']['tested_commit'], current['tested_commit'], baseline['repository']['commit_sha'], tasks['tested_code_commit'], overlay['tested_commit'], mapping['tested_commit']]))
check('Current documents state single tested SHA and pending owner acceptance', all(SHA in (ROOT / p).read_text() and 'PENDING' in (ROOT / p).read_text() for p in ['00_CONTEXT/01_implementation_state_and_handoff.md', 'docs/p1/exit-evidence.md']))
check('Hosted provenance is owner attestation, not fabricated raw logs', owner['evidence_type'] == 'OWNER_VERIFIED_ATTESTATION' and owner['independent_github_log_inspection'] is False and owner['hosted_ci']['runtime_artifact_downloaded_here'] is False and current['record_type'] == 'P1_CLOSURE_RECONCILIATION_NOT_RAW_CI_LOG')
check('Push and pull_request success recorded for tested subject', {r['event'] for r in owner['hosted_ci']['events']} == {'push', 'pull_request'} and all(r['result'] == 'SUCCESS' and r['subject_commit'] == SHA for r in owner['hosted_ci']['events']))
check('Seven non-skipped commands and actual committed workflow verified', len(owner['commands']) == 7 and all(r['result'] == 'SUCCESS' and r['executed'] and not r['skipped'] and r['workflow_command'] in git('show', SHA + ':.github/workflows/p1.yml').decode() for r in owner['commands']))
check('Exactly one source integration test backs glob reconciliation', [p for p in files if p.startswith('tests/integration/') and p.endswith('.test.ts')] == ['tests/integration/bootstrap.test.ts'])
check('13 acceptance anchors resolve to unchanged tested source', len(mapping['gates']) == 13 and all(g['source_assertion']['anchor'] in (ROOT / g['source_assertion']['path']).read_text().splitlines()[g['source_assertion']['line']-1] for g in mapping['gates']))
check('PR remains open, unmerged and unauthorized for automatic merge', owner['pull_request']['number'] == 1 and owner['pull_request']['state'] == 'OPEN' and owner['pull_request']['merge_authorized'] is False and owner['pull_request']['merged_by_this_agent'] is False)
check('Private repository + technical main protection explicitly absent', owner['repository']['visibility'] == 'PRIVATE' and owner['branch_protection']['technically_enforced'] is False and baseline['repository']['technical_branch_protection'] is False and current['technical_main_protection'] is False)
check('Narrow explicit owner exception with all seven process controls', exception['exception_id'] == 'EXC-P1-001' and exception['status'] == 'OWNER_APPROVED' and exception['technical_branch_protection'] is False and len(exception['controls']) == 7 and exception['governing_document_change'] is False and 'EXC-P1-001' in current['accepted_operational_exceptions'])
check('P1 environment/remote/SHA items reconciled', all(r['status'].startswith('CLOSED') for r in current['issues'] if r['id'] in ['P1-ENV-001', 'P1-REMOTE-001', 'P1-SHA-001']))
check('Only minor active debt; no remaining P1 blocker/important', current['remaining_blocker'] == 0 and current['remaining_important'] == 0 and {r['id'] for r in current['issues'] if r['status'] == 'OPEN'} == {'P1-ACTIONS-001', 'P1-DEPS-001'})
catalog = read('docs/baseline/requirement-catalog.json')
with (ROOT / 'docs/baseline/requirements-trace.csv').open(newline='', encoding='utf-8') as f:
    matrix = list(csv.DictReader(f))
check('Full P0 planning trace preserved byte-for-byte', (ROOT / 'docs/baseline/requirements-trace.csv').read_bytes() == git('show', SHA + ':docs/baseline/requirements-trace.csv') and (ROOT / 'docs/baseline/requirement-catalog.json').read_bytes() == git('show', SHA + ':docs/baseline/requirement-catalog.json'))
check('2453 MUST and 22 SHOULD rows retained without duplicates', len(matrix) == 2475 and len({r['requirement_id'] for r in matrix}) == 2475 and sum(r['priority'] == 'MUST' for r in matrix) == 2453)
expected = {r['requirement_id'] for r in catalog if r['implementation_phase'] == 'P1'}
check('105 P1 trace IDs retained, all current pointers valid', len(overlay['requirements']) == 105 and {r['requirement_id'] for r in overlay['requirements']} == expected and all(r['tested_commit'] == SHA and r['execution_evidence'] == 'docs/p1/closure/current-validation.json' and (ROOT / r['execution_evidence']).is_file() for r in overlay['requirements']))
old_overlay = json.loads(git('show', SHA + ':docs/p1/requirement-evidence.json'))
old_future = {r['requirement_id'] for r in old_overlay['requirements'] if r['status'] == 'FUTURE_RUNTIME_ACCEPTANCE'}
check('Later runtime requirements not accepted as P1 implementation', {r['requirement_id'] for r in overlay['requirements'] if r['status'] == 'FUTURE_RUNTIME_ACCEPTANCE'} == old_future and not any(r['status'] == 'P1_GATE_PENDING' for r in overlay['requirements']))
check('Task order unchanged and P1 readiness pending owner acceptance', tasks['authored_order'] == ['IMP-P1-001', 'IMP-P1-002', 'IMP-P1-003', 'IMP-P1-004'] and tasks['owner_acceptance'] == 'PENDING' and all(t['status'].startswith('PASS') for t in tasks['tasks']))
check('No P2 domain schema; placeholder engines remain unchanged', re.findall(r'^model\s+(\w+)', (ROOT / 'prisma/schema.prisma').read_text(), re.M) == ['BootstrapFixture'] and all((ROOT / ('packages/' + p + '/src/index.ts')).read_text().strip().endswith('export {};') for p in ['domain', 'application', 'lesson-engine', 'mastery-review', 'ai-core']))
check('No P2 authorization', current['p2_authorized'] is False and tasks['p2_authorized'] is False and baseline['phase_authorization']['p2_authorized'] is False)
check('Seven locked PDFs and manifest/checksum preserved', all(digest((ROOT / d['path']).read_bytes()) == d['sha256'] for d in baseline['governing_documents']) and digest((ROOT / baseline['architecture_manifest']['path']).read_bytes()) == baseline['architecture_manifest']['sha256'] and digest((ROOT / baseline['checksum_manifest']['path']).read_bytes()) == baseline['checksum_manifest']['sha256'])
check('Original local execution evidence remains immutable history', all((ROOT / p).read_bytes() == git('show', SHA + ':' + p) for p in files if p.startswith('docs/p1/evidence/')))
result = {'scope': 'Closure document/source reconciliation only; no new runtime or hosted execution', 'tested_source_commit': SHA, 'status': 'PASS' if all(c['status'] == 'PASS' for c in checks) else 'FAIL', 'checks': checks, 'passed': sum(c['status'] == 'PASS' for c in checks), 'total': len(checks)}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['status'] == 'PASS' else 1)
