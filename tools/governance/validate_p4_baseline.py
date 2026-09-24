#!/usr/bin/env python3
"""P4 extends historical phase gates without rewriting accepted source checksums."""
import json,runpy,hashlib
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[2]
try:runpy.run_path(str(root/'tools/governance/validate_p3_baseline.py'),run_name='__main__')
except SystemExit as e:
    if e.code:raise
checks=[]
def check(label,ok):checks.append({'check':label,'status':'PASS' if ok else 'FAIL'})
def read(path):return json.loads((root/path).read_text())
a=read('docs/p4/authorization.json')
check('P4 authorized, P5 hard stop',a['p4_authorized'] and not a['p5_authorized'])
check('accepted P3 merge and final tested SHA',a['accepted_main_sha']=='07b6aae9b001dbb4d620df3d491473a95f674ad2' and a['accepted_p3_tested_sha']=='9932a1bbf4b95353445422cb7bde7396d8f1fab5')
rows=read('docs/p4/requirement-evidence.json')['requirements'];catalog=[r for r in read('docs/baseline/requirement-catalog.json') if r['implementation_phase']=='P4']
check('all 148 P4 trace rows exactly once',len(rows)==148 and len({r['requirement_id'] for r in rows})==148 and {r['requirement_id'] for r in rows}=={r['requirement_id'] for r in catalog})
check('P4 trace source/priority preserved',all(any(r['requirement_id']==c['requirement_id'] and r['priority']==c['priority'] and r['source_version']==c['source_version'] for c in catalog) for r in rows))
check('P4 tasks ordered',[t['task_id'] for t in read('docs/p4/task-status.json')['tasks']]==['IMP-P4-001','IMP-P4-002','IMP-P4-003'])
schema=(root/'prisma/schema.prisma').read_text();sql=(root/'prisma/migrations/202609180001_p4_mastery_review/migration.sql').read_text()
for table in ['learning_policies','mastery_facets','knowledge_mastery_states','skill_mastery_states','review_schedules','mistake_instances','learning_reset_jobs','mastery_reset_targets','collections','collection_entries','review_sessions','review_session_items']:
 check('P4 schema '+table,'model '+table in schema and 'CREATE TABLE '+table in sql)
check('P5/P8/P9 tables absent',all('model '+t not in schema for t in ['speech_jobs','ai_sessions','ai_runs']))
check('no locked source or previous migration rewrite',all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in read('docs/p4/evidence/accepted-file-checksums.json').items()))
check('P4 phase-specific workflow exists',(root/'.github/workflows/p4.yml').exists())
# Closure cannot mark a planning row verified without concrete existing code and gate links.
if read('docs/p4/task-status.json')['status']=='PASS_READY_FOR_OWNER_ACCEPTANCE':
 import re
 integration=(root/'tests/integration/p4-mastery-review.test.ts').read_text()
 gate_ids=set(re.findall(r"gate\('(P4-[A-Z]+-\d+)",integration))
 valid_statuses={'P4_VERIFIED','P4_FOUNDATION_PARTIAL','FUTURE_RUNTIME_ACCEPTANCE'}
 check('P4 closure trace statuses explicit',all(r.get('status') in valid_statuses for r in rows))
 check('P4 verified trace links existing code/test/gate',all(
  r.get('actual_code_schema') and r.get('actual_test_files') and r.get('actual_gate_ids') and
  all((root/f).is_file() for f in r['actual_code_schema']+r['actual_test_files']) and
  set(r['actual_gate_ids'])<=gate_ids and bool(re.fullmatch('[0-9a-f]{40}',r.get('verified_implementation_sha') or ''))
  for r in rows if r.get('status')!='FUTURE_RUNTIME_ACCEPTANCE'))
 check('P4 deferred trace cannot claim future runtime',all(
  r.get('remaining_acceptance_phases') and all(int(p[1:])>4 for p in r['remaining_acceptance_phases']) and
  (r.get('status')!='FUTURE_RUNTIME_ACCEPTANCE' or not r.get('verified_implementation_sha'))
  for r in rows if r.get('status')!='P4_VERIFIED'))
 checkpoint=read('docs/p4/evidence/verified-runtime-checkpoint.json')['summary']
 hosted=read('docs/p4/evidence/hosted-ci.json')
 check('P4 checkpoint twelve runtime and two browser gates',checkpoint['status']=='PASS_READY_FOR_OWNER_ACCEPTANCE' and
  len(checkpoint['database']['gates'])==12 and all(g['status']=='PASS' for g in checkpoint['database']['gates']) and
  checkpoint['browser']['expected']==2 and all(checkpoint['browser'][k]==0 for k in ['unexpected','skipped','flaky']))
 check('P4 checkpoint six matching green hosted runs',len(hosted['runs'])==6 and all(
  r['conclusion']=='success' and r['head_sha']==checkpoint['tested_sha'] for r in hosted['runs']))
 check('P4 documented migration checksum matches',hashlib.sha256((root/'prisma/migrations/202609180001_p4_mastery_review/migration.sql').read_bytes()).hexdigest()==read('docs/p4/evidence/schema-api-diff.json')['migration']['sha256'])

old=read('artifacts/p3/baseline-validation.json');checks=old['checks']+checks
report={'phase':'P4','status':'PASS' if all(c['status']=='PASS' for c in checks) else 'FAIL','timestamp':datetime.now(timezone.utc).isoformat(),'checks':checks}
(root/'artifacts/p4').mkdir(parents=True,exist_ok=True);(root/'artifacts/p4/baseline-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'passed':sum(c['status']=='PASS' for c in checks),'total':len(checks),'failures':[c['check'] for c in checks if c['status']=='FAIL']}))
raise SystemExit(0 if report['status']=='PASS' else 1)
