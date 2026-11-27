#!/usr/bin/env python3
"""P6 authorization and source preservation; never substitutes for vertical-slice QA."""
import hashlib
import json
import runpy
from pathlib import Path

root=Path(__file__).resolve().parents[2]
try:
    runpy.run_path(str(root/'tools/governance/validate_p5_baseline.py'),run_name='__main__')
except SystemExit as error:
    if error.code: raise
def read(path): return json.loads((root/path).read_text())
checks=read('artifacts/p5/baseline-validation.json')['checks']
def check(label,ok): checks.append({'check':label,'status':'PASS' if ok else 'FAIL'})
a=read('docs/p6/authorization.json'); accepted=read('docs/p6/evidence/p5-acceptance.json')
proof=read('docs/p6/evidence/verified-p5-ci-8f353cf.json')
check('P6 explicitly authorized; P7 still stopped',a['p6_authorized'] is True and a['p7_authorized'] is False)
check('P5 owner acceptance points to exactly tested source and equal merge tree',
      accepted['status']=='OWNER_ACCEPTED' and accepted['owner_reply']=='дозволяю' and
      accepted['tested_head_sha']==proof['tested_sha']==a['accepted_p5_tested_sha'] and
      accepted['tree_sha']==proof['tree_sha']==a['accepted_p5_tree_sha'] and
      accepted['merge_commit_sha']==a['accepted_main_sha'] and
      accepted['parents']==['5027f001237b6451237d87343ebeca58cd0af007',proof['tested_sha']])
check('P5 retained seven source-bound green workflows and eleven jobs',
      len(proof['github']['workflows'])==7 and len(proof['github']['jobs'])==11 and
      all(r['conclusion']=='success' and r['head_sha']==proof['tested_sha'] for r in proof['github']['workflows']+proof['github']['jobs']))
check('locked sources, migrations and approved media records preserved',all(
    hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in read('docs/p6/evidence/accepted-file-checksums.json').items()))
rows=read('docs/p6/requirement-evidence.json')['requirements']
catalog={r['requirement_id']:r for r in read('docs/baseline/requirement-catalog.json') if r['implementation_phase']=='P6'}
check('all 97 P6 source clauses retained once',len(rows)==len(catalog)==97 and len({r['requirement_id'] for r in rows})==97 and {r['requirement_id'] for r in rows}==set(catalog))
fields=['source_document','source_version','source_page','source_section','source_locator','requirement_summary','priority','implementation_task','implementation_phase']
check('P6 source and task assignments unchanged',all(all(r[k]==catalog[r['requirement_id']][k] for k in fields) for r in rows))
status=read('docs/p6/task-status.json')
check('P6 preparation does not claim milestone or runtime acceptance',status['status']=='IN_PROGRESS' and status['milestone_status']=='NOT_READY' and all(r['status']=='PENDING' and r['verified_implementation_sha'] is None for r in rows))
outline=read('content/english/m01/sequence.json')
check('all four English lessons and Recap source rows retained',
      [l['stable_code'] for l in outline['lessons']]==['E-A1-M01-'+s for s in ['L01','L02','L03','L04','R01']] and
      [len(l['steps']) for l in outline['lessons']]==[12,12,12,12,10] and outline['publication_ready'] is False)
check('OD-004/006 and production boundary remain open',status['od_004']==status['od_006']=='OPEN' and accepted['production_profile_approved'] is False)
check('separate P6 workflow and bounded probe validation exist',all((root/p).is_file() for p in ['.github/workflows/p6.yml','tools/p6/reference-preflight.ts','tests/unit/p6-reference.test.ts']))
report={'phase':'P6','scope':'governance and authoring preparation, not milestone acceptance','status':'PASS' if all(c['status']=='PASS' for c in checks) else 'FAIL','checks':checks}
(root/'artifacts/p6').mkdir(parents=True,exist_ok=True)
(root/'artifacts/p6/baseline-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'passed':sum(c['status']=='PASS' for c in checks),'total':len(checks),'failures':[c['check'] for c in checks if c['status']=='FAIL']}))
raise SystemExit(0 if report['status']=='PASS' else 1)
