#!/usr/bin/env python3
"""P5 governance validation is not runtime or milestone acceptance."""
import json,runpy,hashlib
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[2]
try:runpy.run_path(str(root/'tools/governance/validate_p4_baseline.py'),run_name='__main__')
except SystemExit as e:
    if e.code:raise
def read(p):return json.loads((root/p).read_text())
checks=[]
def check(name,ok):checks.append({'check':name,'status':'PASS' if ok else 'FAIL'})
a=read('docs/p5/authorization.json')
check('P5 explicitly authorized and P6 hard stop',a['p5_authorized'] and not a['p6_authorized'])
check('P4 merge baseline pinned',a['accepted_main_sha']=='5027f001237b6451237d87343ebeca58cd0af007' and a['accepted_p4_tested_sha']=='ee16aeea822d7cccb09f65e310d19fd5a1807747')
check('owner-locked sources and prior migrations unchanged',all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in read('docs/p5/evidence/accepted-file-checksums.json').items()))
rows=read('docs/p5/requirement-evidence.json')['requirements'];catalog=[r for r in read('docs/baseline/requirement-catalog.json') if r['implementation_phase']=='P5']
check('all 356 P5 planning rows retained exactly once',len(rows)==356 and len({r['requirement_id'] for r in rows})==356 and {r['requirement_id'] for r in rows}=={r['requirement_id'] for r in catalog})
check('P5 task order retained',[r['task_id'] for r in read('docs/p5/task-status.json')['tasks']]==['IMP-P5-001','IMP-P5-002','IMP-P5-003'])
schema=(root/'prisma/schema.prisma').read_text();sql=(root/'prisma/migrations/202609260001_p5_media_foundation/migration.sql').read_text()
check('P5 media scalar schema and SQL tables present',all('model '+t in schema and 'CREATE TABLE '+t in sql for t in ['voices','characters','media_requirements','media_jobs','assets','asset_versions','asset_approvals','content_media_bindings','publication_assets']))
check('AI runtime remains absent',all('model '+t not in schema for t in ['ai_runs','ai_sessions']))
check('P5 workflow with historical regression retained',all((root/f'.github/workflows/p{i}.yml').exists() for i in range(1,6)))
check('P5 not falsely accepted during implementation',read('docs/p5/task-status.json')['status']=='IN_PROGRESS')
old=read('artifacts/p4/baseline-validation.json');checks=old['checks']+checks
report={'phase':'P5','scope':'governance integrity; runtime acceptance is separate','status':'PASS' if all(c['status']=='PASS' for c in checks) else 'FAIL','timestamp':datetime.now(timezone.utc).isoformat(),'checks':checks}
(root/'artifacts/p5').mkdir(parents=True,exist_ok=True);(root/'artifacts/p5/baseline-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'passed':sum(c['status']=='PASS' for c in checks),'total':len(checks),'failures':[c['check'] for c in checks if c['status']=='FAIL']}))
raise SystemExit(0 if report['status']=='PASS' else 1)
