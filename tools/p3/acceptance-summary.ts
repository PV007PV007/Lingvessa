import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(process.env.GITHUB_HEAD_SHA,commit,'Acceptance must check the exact PR head, not a different merge/document commit');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const database=read('artifacts/p3/database-validation.json');
const fixtures=read('artifacts/p3/reference-validation.json');
const containers=read('artifacts/p1/container-smoke.json');
const images=read('artifacts/p1/container-build.json');
const browser=read('artifacts/p3/browser-results.json');
const latency=read('artifacts/p3/attempt-latency.json');
const baseline=read('artifacts/p3/baseline-validation.json');
for(const report of [database,fixtures,containers]){assert.equal(report.status,'PASS');assert.equal(report.commit,commit);}
assert.equal(database.source_sha,commit);assert.equal(database.gates.length,15);assert(database.gates.every((gate:{status:string})=>gate.status==='PASS'));
assert.equal(fixtures.results.length,4);assert.equal(images.commit,commit);assert.deepEqual(Object.keys(images.images).sort(),['admin','api','web','worker']);
assert.equal(browser.stats.expected,4);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);assert.equal(browser.stats.flaky,0);
assert.equal(latency.status,'PASS');assert.equal(baseline.status,'PASS');
const artifacts=['artifacts/p3/database-validation.json','artifacts/p3/reference-validation.json','artifacts/p3/browser-results.json',
  'artifacts/p3/attempt-latency.json','artifacts/p1/container-build.json','artifacts/p1/container-smoke.json','artifacts/p3/baseline-validation.json'];
const summary={phase:'P3',status:'PASS_READY_FOR_OWNER_ACCEPTANCE',tested_sha:commit,run_id:process.env.GITHUB_RUN_ID,event:process.env.GITHUB_EVENT_NAME,
  database:{engine:database.database,gates:database.gates},fixtures:fixtures.results,browser:browser.stats,latency,
  container_checks:containers.checks,container_images:images.images,baseline:{passed:baseline.checks.filter((entry:{status:string})=>entry.status==='PASS').length,total:baseline.checks.length},
  artifacts:artifacts.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),
  p4_authorized:false,owner_acceptance_pending:true};
mkdirSync('artifacts/p3',{recursive:true});writeFileSync('artifacts/p3/acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
