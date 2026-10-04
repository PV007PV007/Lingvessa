import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(process.env.GITHUB_HEAD_SHA,commit,'Evidence must be produced from the exact hosted source');
const storage=read('artifacts/p5/storage-validation.json');
const media=read('artifacts/p5/media-database-validation.json');
const audio=read('artifacts/p5/audio-validation.json');
const speech=read('artifacts/p5/speech-database-validation.json');
const baseline=read('artifacts/p5/baseline-validation.json');
const reference=read('artifacts/p5/reference-media-validation.json');
const mediaBrowser=read('artifacts/p5/browser-results.json');
const speechBrowser=read('artifacts/p5/speech-browser-results.json');
const p3=read('artifacts/p3/acceptance-summary.json'),p4=read('artifacts/p4/acceptance-summary.json');
const containers=read('artifacts/p1/container-smoke.json'),build=read('artifacts/p1/container-build.json');
for(const r of [storage,media,audio,speech,containers]){assert.equal(r.commit,commit);assert.equal(r.status,'PASS');}
for(const r of [media,audio,speech,reference])assert.equal(r.source_sha,commit);
for(const [r,count]of [[storage,3],[media,8],[audio,4],[speech,12]] as const){
 assert.equal(r.gates.length,count);assert(r.gates.every((g:{status:string})=>g.status==='PASS'));
}
assert.equal(media.database,'PostgreSQL 18.6');assert.equal(speech.database,'PostgreSQL 18.6');
assert.equal(baseline.status,'PASS');assert.equal(reference.structural_validation,'PASS');
assert.equal(audio.browser_executed,true);
for(const [r,count]of [[mediaBrowser,9],[speechBrowser,2]] as const){
 assert.equal(r.stats.expected,count);for(const key of ['unexpected','skipped','flaky'])assert.equal(r.stats[key],0);
}
for(const r of [p3,p4]){assert.equal(r.tested_sha,commit);assert.equal(r.status,'PASS_READY_FOR_OWNER_ACCEPTANCE');}
assert.equal(build.commit,commit);assert.deepEqual(Object.keys(build.images).sort(),['admin','api','web','worker']);
const authorization=read('docs/p5/authorization.json');assert.equal(authorization.p6_authorized,false);
const trace=read('docs/p5/requirement-evidence.json').requirements as Array<{status:string}>;
const counts=Object.fromEntries(['PASS','PARTIAL','PENDING'].map(status=>[status,trace.filter(r=>r.status===status).length]));
const paths=['artifacts/p5/storage-validation.json','artifacts/p5/media-database-validation.json','artifacts/p5/audio-validation.json',
 'artifacts/p5/speech-database-validation.json','artifacts/p5/baseline-validation.json','artifacts/p5/reference-media-validation.json',
 'artifacts/p5/browser-results.json','artifacts/p5/speech-browser-results.json','artifacts/p1/container-build.json','artifacts/p1/container-smoke.json',
 'artifacts/p3/acceptance-summary.json','artifacts/p4/acceptance-summary.json','docs/p5/requirement-evidence.json'];
const summary={phase:'P5',runtime_status:'PASS',milestone_status:'NOT_READY',tested_sha:commit,
 run_id:process.env.GITHUB_RUN_ID,event:process.env.GITHUB_EVENT_NAME,
 runtime_gates:{storage:storage.gates,media:media.gates,audio:audio.gates,speech:speech.gates},
 browser:{media:mediaBrowser.stats,speech:speechBrowser.stats,total_with_p3_p4:p3.browser.expected+p4.browser.expected+mediaBrowser.stats.expected+speechBrowser.stats.expected},
 database:media.database,container_checks:containers.checks,container_images:build.images,
 reference_media:reference,trace_counts:counts,p6_authorized:false,
 remaining:['M01 required audio bytes, complete approved voices and media publication QA','OD-004/005/006 integration decisions','Remaining compound requirement gates; no blanket PASS from synthetic fixtures'],
 artifacts:paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
// Green runtime CI is deliberately not owner acceptance or permission for P6.
writeFileSync('artifacts/p5/acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
