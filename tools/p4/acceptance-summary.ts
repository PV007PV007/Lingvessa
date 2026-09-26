import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(process.env.GITHUB_HEAD_SHA,commit);
const database=read('artifacts/p4/database-validation.json'),browser=read('artifacts/p4/browser-results.json'),baseline=read('artifacts/p4/baseline-validation.json'),fixtures=read('artifacts/p4/reference-validation.json'),p3=read('artifacts/p3/acceptance-summary.json');
for(const r of [database,fixtures]){assert.equal(r.commit,commit);assert.equal(r.status,'PASS');}assert.equal(p3.tested_sha,commit);assert.equal(database.source_sha,commit);assert.equal(database.gates.length,12);assert(database.gates.every((g:{status:string})=>g.status==='PASS'));
assert.equal(baseline.status,'PASS');assert.equal(browser.stats.expected,2);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);assert.equal(browser.stats.flaky,0);
const paths=['artifacts/p4/database-validation.json','artifacts/p4/browser-results.json','artifacts/p4/baseline-validation.json','artifacts/p4/reference-validation.json','artifacts/p4/introspected.prisma','artifacts/p3/acceptance-summary.json'];
const summary={phase:'P4',status:'PASS_READY_FOR_OWNER_ACCEPTANCE',tested_sha:commit,run_id:process.env.GITHUB_RUN_ID,event:process.env.GITHUB_EVENT_NAME,database:{engine:database.database,gates:database.gates},browser:browser.stats,fixtures:fixtures.results,
 baseline:{passed:baseline.checks.filter((c:{status:string})=>c.status==='PASS').length,total:baseline.checks.length},p3_regression:p3.status,container_checks:p3.container_checks,
 artifacts:paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),p5_authorized:false,owner_acceptance_pending:true};
writeFileSync('artifacts/p4/acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
