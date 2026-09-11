#!/usr/bin/env python3
"""Validate P0 governance artifacts. Standard library; optional Poppler source scan.

This utility does not implement or test the product, schemas, UI or AI runtime.
Run from any directory; repository-ready root is resolved from this file.
"""
import argparse
import collections
import csv
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    'FS': ('Formal_Specification', '1.7', 26),
    'TS': ('Technical_Specification', '1.7', 30),
    'TD': ('Technical_Design', '1.7', 24),
    'CUR': ('Curriculum_Blueprint_A1', '1.6', 20),
    'REF': ('Reference_Module_Design', '1.6', 30),
    'AI': ('AI_Integration_Specification', '1.4', 26),
    'PLAN': ('Implementation_Plan', '1.4', 28),
}
ID_PATTERNS = {
    'FS': r'(?<![A-Z0-9-])(?:ROLE|LANG|PED|CURR|LESS|STATE|MAST|REV|AUD|COLL|CONT|MED|AI|UX|A11Y|SET|TECH|DATA|API|SEC|LEGAL|ACC|NFR-(?:PERF|REL|DR|COMP|SCALE|LOC|AI))-\d{3}\b',
    'TS': r'\b(?:TS-[A-Z0-9]+-\d{3}|TAC-\d{3})\b',
    'TD': r'\b(?:TD-[A-Z0-9]+-\d{3}|TDA-\d{2})\b',
    'CUR': r'\b(?:CUR-A1-\d{3}|A1-OUT-\d{2})\b',
    'REF': r'\b(?:REF-A1-\d{3}|T\d{2})\b',
    'AI': r'\b(?:AI-(?:GOV|FALL|PROV|COST|LRN|GRD|MAST|ADM|PRIV|SEC|PRM|OBS)-\d{3}|AIA-\d{2})\b',
}
REQUIRED_FILES = [
    'docs/baseline/baseline.yml', 'docs/baseline/decision-log.md',
    'docs/baseline/requirements-trace.csv', 'docs/baseline/requirement-catalog.json',
    'docs/baseline/source-coverage.json', 'docs/baseline/implementation-backlog.json',
    'docs/baseline/validation-gates.json', 'docs/baseline/open-decisions.md',
    'docs/baseline/open-decisions.json', 'docs/baseline/p1-task-packets.md',
    'docs/baseline/trace-methodology.md', 'docs/baseline/p0-exit-checklist.md',
    'docs/baseline/milestones.json', 'docs/baseline/conflicts.json',
    'docs/governance/change-control.md', 'docs/governance/definition-of-ready.md',
    'docs/governance/issue-taxonomy.md', '.github/labels.yml',
    '.github/PULL_REQUEST_TEMPLATE.md', '.github/ISSUE_TEMPLATE/implementation-task.yml',
    '00_CONTEXT/01_implementation_state_and_handoff.md', 'README_P0.md',
]
REQUIRED_COLUMNS = [
    'requirement_id', 'source_document', 'source_version', 'source_section/page',
    'requirement_summary', 'priority', 'implementation_phase', 'implementation_task',
    'test_or_gate', 'owner/workstream', 'status', 'ADR_or_exception',
    'planned_code_schema', 'actual_code_schema', 'implementation_status', 'milestone_evidence',
]


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', action='store_true', help='Independently scan locked PDFs using pdftotext')
    parser.add_argument('--write-report', action='store_true')
    args = parser.parse_args()
    checks = []

    def check(name, ok, detail):
        checks.append({'check': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})

    missing = [p for p in REQUIRED_FILES if not (ROOT / p).is_file()]
    check('required_governance_files', not missing, {'missing': missing})
    if missing:
        print(json.dumps({'status': 'NOT READY', 'checks': checks}, ensure_ascii=False, indent=2))
        return 1

    baseline = read_json('docs/baseline/baseline.yml')
    ds = baseline['governing_documents']
    check('exact_seven_versions', len(ds) == 7 and {d['document_id']: d['version'] for d in ds} == {k: v[1] for k, v in EXPECTED.items()}, {d['document_id']: d['version'] for d in ds})
    check('owner_lock_and_phase_authority', baseline['owner_lock']['status'] == 'OWNER_LOCKED' and baseline['owner_lock']['date'] == '2026-09-10' and baseline['p0']['p1_authorized'] is False and baseline['precedence']['execution_order']['version'] == '1.4' and baseline['precedence']['execution_order']['sole_authority'].endswith('Lingvessa_Implementation_Plan.pdf'), 'Owner lock 2026-09-10; Plan v1.4 sole execution authority; P1 not authorized.')
    checksum_file = ROOT / baseline['checksum_manifest']['path']
    original = {line.split()[-1]: line.split()[0] for line in checksum_file.read_text().splitlines() if line.strip()}
    resolution = baseline['checksum_manifest']['resolution']
    hashes = []
    for name, expected_hash in original.items():
        rel = '01_GOVERNING_DOCUMENTS/' + name if name.endswith('.pdf') else resolution[name]
        actual = sha(ROOT / rel)
        hashes.append({'original_entry': name, 'verified_path': rel, 'expected_sha256': expected_hash, 'actual_sha256': actual, 'match': actual == expected_hash})
    check('nine_original_owner_lock_hashes', len(hashes) == 9 and all(x['match'] for x in hashes), hashes)
    check('checksum_manifest_unchanged', sha(checksum_file) == baseline['checksum_manifest']['sha256'], 'Original checksum manifest remains unchanged; mutable handoff resolves to preserved initial snapshot for original lock verification.')
    check('baseline_sha_references', all(sha(ROOT / d['path']) == d['sha256'] == original[Path(d['path']).name] for d in ds) and sha(ROOT / baseline['architecture_manifest']['path']) == baseline['architecture_manifest']['sha256'], 'Recorded SHA-256 values equal unchanged source bytes.')

    catalog = read_json('docs/baseline/requirement-catalog.json')
    with (ROOT / 'docs/baseline/requirements-trace.csv').open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        matrix = list(reader)
    check('matrix_required_columns', all(x in headers for x in REQUIRED_COLUMNS), headers)
    empty = [{'id': r.get('requirement_id'), 'column': k} for r in matrix for k in REQUIRED_COLUMNS if not r.get(k)]
    check('no_empty_required_trace_fields', not empty, {'empty_fields': empty})
    ids = [r['requirement_id'] for r in matrix]
    counts = collections.Counter(ids)
    duplicates = [x for x, n in counts.items() if n > 1]
    check('unique_trace_ids', not duplicates, {'duplicate_ids': duplicates})
    cat = {r['requirement_id']: r for r in catalog}
    check('csv_catalog_round_trip', len(cat) == len(catalog) == len(matrix) and set(cat) == set(ids) and all(str(cat[r['requirement_id']].get(k, '')) == r[k] for r in matrix for k in headers), {'csv_rows': len(matrix), 'catalog_rows': len(catalog)})
    current_versions = {'Lingvessa_' + v[0] + '.pdf': v[1] for k, v in EXPECTED.items() if k != 'PLAN'}
    check('trace_current_source_versions', all(r['source_document'] in current_versions and r['source_version'] == current_versions[r['source_document']] for r in matrix), current_versions)

    tasks = read_json('docs/baseline/implementation-backlog.json')
    task_map = {t['task_id']: t for t in tasks}
    gates = read_json('docs/baseline/validation-gates.json')
    gate_map = {g['gate_id']: g for g in gates}
    broken = []
    for r in matrix:
        t = task_map.get(r['implementation_task'])
        g = gate_map.get(r['test_or_gate'])
        if not t or not g or r['requirement_id'] not in t['requirement_ids'] or g['requirement_id'] != r['requirement_id'] or g['implementation_task'] != r['implementation_task'] or t['phase'] != r['implementation_phase']:
            broken.append(r['requirement_id'])
        adr = r['ADR_or_exception'].split(';')[0]
        if not (ROOT / adr).is_file():
            broken.append(r['requirement_id'] + ':ADR')
    check('requirement_task_gate_ADR_chain', not broken and len(gate_map) == len(matrix), {'broken_links': broken, 'gates': len(gates), 'tasks': len(tasks)})
    check('gate_expectations_and_fixtures', all(g.get('source_expectation') and g.get('verification_method') and g.get('fixture') and g.get('test_layer') and g.get('planned_test_path') for g in gates), 'Every source-located row has its own expected behavior, verification strategy and fixture family.')
    check('no_fabricated_product_evidence', all(r['actual_code_schema'] == 'NOT_IMPLEMENTED_P0' and r['implementation_status'] == 'NOT_STARTED' for r in matrix) and all(g['status'] == 'PLANNED_NOT_EXECUTED' and g['result_evidence'] is None for g in gates), 'Product code and tests are explicitly planned, not passed. P0 governance evidence is this separate report.')
    families = {
        'CUR-A1': [f'CUR-A1-{i:03}' for i in range(1, 23)],
        'A1-OUT': [f'A1-OUT-{i:02}' for i in range(1, 9)],
        'REF-A1': [f'REF-A1-{i:03}' for i in range(1, 15)],
        'REF-tests': [f'T{i:02}' for i in range(1, 33)],
        'AIA': [f'AIA-{i:02}' for i in range(1, 17)],
        'TAC': [f'TAC-{i:03}' for i in range(1, 21)],
        'TDA': [f'TDA-{i:02}' for i in range(1, 21)],
    }
    family_report = {family: {'expected': len(want), 'traced': sum(x in cat for x in want), 'missing': [x for x in want if x not in cat]} for family, want in families.items()}
    check('all_named_curriculum_reference_AI_acceptance_families', all(not f['missing'] for f in family_report.values()), family_report)
    p1 = [t for t in tasks if t['phase'] == 'P1']
    check('P1_tasks_traceable_and_unstarted', len(p1) == 4 and all(t['requirement_ids'] and t['test_or_gate_ids'] and t['status'] == 'PLANNED_NOT_STARTED' for t in p1), {t['task_id']: len(t['requirement_ids']) for t in p1})
    check('P8_foundation_P9_handoff', 'IMP-P8-002' in task_map['IMP-P8-003']['dependencies'] and 'IMP-P8-002' in task_map['IMP-P9-001']['dependencies'] and cat['AIA-10']['implementation_phase'] == 'P9', 'P8 Admin Assist depends on shared foundation; P9 reuses it; AIA-10 Auto activation mapped to P9.')
    phases = read_json('docs/baseline/milestones.json')
    phase_order = [p['phase'] for p in phases]
    check('P0_P13_order_and_boundaries', phase_order == [f'P{i}' for i in range(14)] and phase_order.index('P10') < phase_order.index('P11') < phase_order.index('P12') < phase_order.index('P13'), phase_order)
    open_decisions = read_json('docs/baseline/open-decisions.json')
    invalid_open = [o['decision_id'] for o in open_decisions if not all(o.get(k) for k in ['source', 'why_unresolved', 'latest_phase', 'affected_requirements', 'default_behavior', 'owner']) or any(i not in cat for i in o['affected_requirements']) or o['status'] != 'OPEN_DEFERRED_NOT_P0_BLOCKING']
    check('sourced_deferred_open_decisions', not invalid_open, {'count': len(open_decisions), 'invalid': invalid_open, 'P0_blocking': 0})
    check('accepted_ADR_materialization', all((ROOT / f'docs/adr/adr-d{i:02}.md').is_file() and 'Status: ACCEPTED' in (ROOT / f'docs/adr/adr-d{i:02}.md').read_text() for i in range(1, 21)), '20 accepted transcriptions; original ADR-D01–D11 preserved; no new architecture decision.')
    conflicts = read_json('docs/baseline/conflicts.json')
    check('no_unresolved_P0_contract_conflict', not conflicts['BLOCKER'] and not conflicts['IMPORTANT'] and not conflicts['accepted_exceptions'], conflicts)
    prohibited = [p for p in ['apps','packages','prisma','infra','package.json','pnpm-lock.yaml'] if (ROOT / p).exists()]
    check('P0_scope_no_P1_or_feature_files', not prohibited, {'unexpected_runtime_roots': prohibited})
    handoff = (ROOT / '00_CONTEXT/01_implementation_state_and_handoff.md').read_text()
    check('handoff_updated_and_P1_hard_stop', 'P0 batch' in handoff and 'No contract change' in handoff and 'P0 accepted. Proceed to P1.' in handoff and 'validate_p0.py --sources --write-report' in handoff, 'Operational handoff populated with batch metadata, files, validation/evidence and hard stop.')

    source_report = {}
    if args.sources:
        if not shutil.which('pdftotext'):
            check('independent_PDF_source_scan', False, 'pdftotext is required with --sources; install Poppler outside P0 artifacts and rerun.')
        else:
            for code, (name, version, pages) in EXPECTED.items():
                p = ROOT / '01_GOVERNING_DOCUMENTS' / ('Lingvessa_' + name + '.pdf')
                run = subprocess.run(['pdftotext', '-layout', str(p), '-'], check=True, capture_output=True, text=True)
                actual_pages = run.stdout.count('\f')
                if code == 'PLAN':
                    source_report[code] = {'pages': actual_pages, 'expected_pages': pages, 'scope': 'Execution authority; not a seventh normative-requirement source.'}
                    continue
                found = set(re.findall(ID_PATTERNS[code], run.stdout))
                owned = {r['requirement_id'] for r in catalog if r['source_document'] == p.name and r['source_kind'] in ['explicit_requirement','acceptance_scenario']}
                source_report[code] = {'pages': actual_pages, 'expected_pages': pages, 'explicit_ids_in_pdf': len(found), 'explicit_ids_traced': len(owned), 'missing': sorted(found-owned), 'not_found_in_pdf': sorted(owned-found)}
            check('independent_PDF_source_scan', all(v['pages'] == v['expected_pages'] and not v.get('missing') and not v.get('not_found_in_pdf') for v in source_report.values()), source_report)
    else:
        check('independent_PDF_source_scan_requested', False, 'Full P0 exit validation requires --sources. Structural-only validation cannot claim P0 PASS.')

    coverage = read_json('docs/baseline/source-coverage.json')
    coverage_broken = []
    for section in ['tables','prose']:
        for entry in coverage[section]:
            bad = [i for i in entry.get('requirement_ids', []) if i not in cat]
            if bad:
                coverage_broken.append({'document': entry['document'], 'page': entry['page'], 'unknown_ids': bad})
    check('source_coverage_links', not coverage_broken, {'broken': coverage_broken, 'table_classifications': len(coverage['tables']), 'prose_blocks': len(coverage['prose'])})

    must = [r for r in matrix if r['priority'] == 'MUST']
    untraced = [r['requirement_id'] for r in must if r['requirement_id'] in broken or any(not r.get(k) for k in REQUIRED_COLUMNS)]
    stats = {'total_trace_rows': len(matrix), 'total_MUST': len(must), 'traced_MUST': len(must)-len(untraced), 'untraced_MUST': len(untraced), 'untraced_ids': untraced, 'SHOULD': sum(r['priority'] == 'SHOULD' for r in matrix), 'duplicate_trace_ids': duplicates, 'ambiguous_trace_ids': [], 'explicit_requirement_and_acceptance_MUST': sum(r['priority']=='MUST' and r['source_kind'] in ['explicit_requirement','acceptance_scenario'] for r in catalog), 'source_granularity_note':'Counts source-located normative obligations/contract/fixture rows; mirrored source contracts retained, not unique feature counts.', 'by_document': {d: dict(collections.Counter(r['priority'] for r in matrix if r['source_document']==d)) for d in current_versions}}
    check('zero_untraced_MUST', not untraced and len(must)>0, stats)
    passed = all(c['status']=='PASS' for c in checks)
    report = {'generated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'phase':'P0', 'status':'PASS' if passed else 'NOT READY', 'owner_acceptance':'PENDING', 'P1_authorized':False, 'command':'python3 tools/governance/validate_p0.py --sources --write-report', 'product_tests_executed':False, 'statistics':stats, 'checks':checks, 'BLOCKER':[] if passed else [c['check'] for c in checks if c['status']=='FAIL'], 'IMPORTANT':[], 'next_task':'Owner reviews P0 evidence. Wait for “P0 accepted. Proceed to P1.” Then IMP-P1-001; do not start it now.'}
    if args.write_report:
        (ROOT/'docs/baseline/p0-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'checks_passed':sum(c['status']=='PASS' for c in checks),'checks_total':len(checks),'statistics':stats,'failed_checks':[c for c in checks if c['status']=='FAIL']}, ensure_ascii=False,indent=2))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
