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
const listeningBrowser=read('artifacts/p5/listening-browser-results.json');
const listeningPlayback=read('artifacts/p5/listening-playback-validation.json');
const listeningManifest=read('artifacts/p5/listening-review-manifest.json');
const m01Draft=read('artifacts/p5/m01-audio-draft-validation.json');
const m01ReviewCatalog=read('artifacts/p5/m01-review-catalog.json');
const m01ReviewCheck=read('artifacts/p5/m01-review-catalog-validation.json');
const m01ReviewUI=read('artifacts/p5/m01-review-ui-validation.json');
const m01ReviewBrowser=read('artifacts/p5/m01-review-browser-results.json');
const m01Feedback=read('artifacts/p5/m01-feedback-validation.json');
const m01FeedbackBrowser=read('artifacts/p5/m01-feedback-browser-intake.json');
const m01Continuation=read('artifacts/p5/m01-continuation-validation.json');
const m01ContinuationPlan=read('artifacts/p5/m01-continuation-plan.json');
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
assert.equal(listeningBrowser.stats.expected,3);
for(const key of ['unexpected','skipped','flaky'])assert.equal(listeningBrowser.stats[key],0);
for(const r of [listeningPlayback,listeningManifest]){
 assert.equal(r.source_sha,commit);assert.equal(r.working_tree_dirty,false);
 assert.equal(r.publication_ready,false);assert.equal(r.p5_milestone,'NOT_READY');assert.equal(r.p6_authorized,false);
}
assert.equal(listeningPlayback.status,'PASS');assert.equal(listeningPlayback.clips_verified,18);
assert.equal(listeningPlayback.external_requests,0);assert.equal(listeningPlayback.human_review,'PENDING');
assert.equal(listeningPlayback.html_sha256,listeningManifest.html_sha256);
assert.equal(m01Draft.source_sha,commit);assert.equal(m01Draft.working_tree_dirty,false);
assert.equal(m01Draft.status,'PASS');assert.equal(m01Draft.scope,'METADATA_ONLY_AUDIO_BYTES_EXTERNAL');
assert.equal(m01Draft.audio_bytes_verified,false);assert.equal(m01Draft.available_assets,216);
assert.equal(m01Draft.not_generated_assets,204);assert.equal(m01Draft.asr_screened_assets,216);
assert.equal(m01Draft.integrity_negative_checks,4);assert.equal(m01Draft.human_review,'PENDING');
assert.equal(m01Draft.publication_ready,false);assert.equal(m01Draft.p5_milestone,'NOT_READY');assert.equal(m01Draft.p6_authorized,false);
for(const r of [m01ReviewCheck,m01ReviewUI]){
 assert.equal(r.status,'PASS');assert.equal(r.source_sha,commit);assert.equal(r.working_tree_dirty,false);
 assert.equal(r.human_review,'PENDING');assert.equal(r.publication_ready,false);
 assert.equal(r.p5_milestone,'NOT_READY');assert.equal(r.p6_authorized,false);
 assert.equal(r.m01_audio_bytes_verified,false);assert.equal(r.m01_wavs_verified,0);
 for(const [field,path]of [['builder_sha256','tools/p5/build-m01-review.py'],['template_sha256','tools/p5/m01-review.html']]){
  assert.equal(r[field!],createHash('sha256').update(readFileSync(path!)).digest('hex'));
 }
}
assert.equal(m01ReviewCheck.scope,'CATALOG_ONLY_EXTERNAL_AUDIO');assert.equal(m01ReviewCatalog.scope,'M01_DRAFT');
assert.deepEqual(m01ReviewCheck.counts,{slots:420,pairs:210,available:216,missing:204,flagged:109});
assert.deepEqual(m01ReviewCatalog.counts,m01ReviewCheck.counts);
assert.equal(m01ReviewCatalog.dataset_sha256,m01ReviewCheck.dataset_sha256);
assert.equal(m01ReviewCheck.results_sha256,m01Draft.results_sha256);
assert.equal(m01ReviewUI.scope,'UI_TEST_FIXTURE');assert.equal(m01ReviewUI.fixture_wavs_verified,4);
assert.equal(m01ReviewUI.external_requests,0);
assert.equal(m01ReviewUI.manifest_sha256,createHash('sha256').update(readFileSync('artifacts/p5/m01-review-fixture-manifest.json')).digest('hex'));
assert.equal(m01ReviewBrowser.stats.expected,5);
for(const key of ['unexpected','skipped','flaky'])assert.equal(m01ReviewBrowser.stats[key],0);
assert.equal(m01Feedback.status,'PASS');assert.equal(m01Feedback.scope,'FEEDBACK_INTAKE_TESTS');
assert.equal(m01Feedback.tests_run,10);
for(const key of ['failures','errors','skipped'])assert.equal(m01Feedback[key],0);
assert.equal(m01Feedback.real_human_feedback_processed,false);assert.equal(m01Feedback.human_review,'PENDING');
assert.equal(m01Feedback.catalog_dataset_sha256,m01ReviewCatalog.dataset_sha256);
assert.deepEqual(m01Feedback.catalog_counts,m01ReviewCatalog.counts);
assert.equal(m01Feedback.test_sha256,createHash('sha256').update(readFileSync('tests/unit/p5-m01-feedback.test.py')).digest('hex'));
for(const r of [m01Feedback,m01FeedbackBrowser]){
 assert.equal(r.source_sha,commit);assert.equal(r.working_tree_dirty,false);
 assert.equal(r.publication_ready,false);assert.equal(r.p5_milestone,'NOT_READY');assert.equal(r.p6_authorized,false);
 assert.equal(r.validator_sha256,createHash('sha256').update(readFileSync('tools/p5/validate-m01-feedback.py')).digest('hex'));
 assert.equal(r.catalog_builder_sha256,createHash('sha256').update(readFileSync('tools/p5/build-m01-review.py')).digest('hex'));
}
assert.equal(m01FeedbackBrowser.status,'VALID');assert.equal(m01FeedbackBrowser.scope,'UI_TEST_FIXTURE');
assert.equal(m01FeedbackBrowser.review_provenance,'UNVERIFIED_SELF_REPORT');
assert.equal(m01FeedbackBrowser.human_linguistic_approval,'PENDING');assert.equal(m01FeedbackBrowser.rights_approval,'PENDING');
assert.equal(m01FeedbackBrowser.feedback_status,'PARTIAL');
assert.deepEqual(m01FeedbackBrowser.counts,{available_files:4,missing_files:2,completed_attestations:1,
 buckets:{needs_work:1,clarify:0,unreviewed:3,reported_no_issues:0}});
assert.equal(m01FeedbackBrowser.input_sha256,createHash('sha256').update(readFileSync('artifacts/p5/m01-feedback-browser-export.json')).digest('hex'));
assert.equal(m01Continuation.status,'PASS');assert.equal(m01Continuation.scope,'CONTINUATION_SYNTHETIC_TESTS');
assert.equal(m01Continuation.source_sha,commit);assert.equal(m01Continuation.working_tree_dirty,false);
assert.equal(m01Continuation.tests_run,11);
for(const key of ['failures','errors','skipped'])assert.equal(m01Continuation[key],0);
assert.equal(m01Continuation.real_audio_generated,false);assert.equal(m01Continuation.external_audio_bytes_verified,false);
assert.equal(m01Continuation.publication_ready,false);assert.equal(m01Continuation.p5_milestone,'NOT_READY');assert.equal(m01Continuation.p6_authorized,false);
assert.equal(m01Continuation.pending_turns,97);assert.equal(m01Continuation.pending_assets,204);assert.equal(m01Continuation.retained_assets,216);
assert.equal(m01Continuation.test_sha256,createHash('sha256').update(readFileSync('tests/unit/p5-m01-continuation.test.py')).digest('hex'));
for(const r of [m01Continuation,m01ContinuationPlan])assert.equal(r.tool_sha256,createHash('sha256').update(readFileSync('tools/p5/continue-m01-audio.py')).digest('hex'));
assert.equal(m01ContinuationPlan.scope,'M01_POCKET_CONTINUATION');assert.equal(m01ContinuationPlan.audio_bytes_verified,false);
assert.equal(m01ContinuationPlan.wav_files_verified,0);assert.equal(m01ContinuationPlan.synthesis_executed,false);assert.equal(m01ContinuationPlan.asr_executed,false);
assert.equal(m01ContinuationPlan.parent_results_sha256,m01Draft.results_sha256);
assert.equal(m01ContinuationPlan.pending_turns.length,97);assert.equal(m01ContinuationPlan.pending_asset_ids.length,204);assert.equal(m01ContinuationPlan.retained_assets.length,216);
assert.deepEqual(m01ContinuationPlan.constraints,read('docs/p5/m01-audio-draft-20261011/plan.json').constraints);
assert.equal(createHash('sha256').update(readFileSync('artifacts/p5/'+listeningManifest.html_file)).digest('hex'),listeningManifest.html_sha256);
for(const r of [p3,p4]){assert.equal(r.tested_sha,commit);assert.equal(r.status,'PASS_READY_FOR_OWNER_ACCEPTANCE');}
assert.equal(build.commit,commit);assert.deepEqual(Object.keys(build.images).sort(),['admin','api','web','worker']);
const authorization=read('docs/p5/authorization.json');assert.equal(authorization.p6_authorized,false);
const trace=read('docs/p5/requirement-evidence.json').requirements as Array<{status:string}>;
const counts=Object.fromEntries(['PASS','PARTIAL','PENDING'].map(status=>[status,trace.filter(r=>r.status===status).length]));
const paths=['artifacts/p5/storage-validation.json','artifacts/p5/media-database-validation.json','artifacts/p5/audio-validation.json',
 'artifacts/p5/speech-database-validation.json','artifacts/p5/baseline-validation.json','artifacts/p5/reference-media-validation.json',
 'artifacts/p5/browser-results.json','artifacts/p5/speech-browser-results.json','artifacts/p1/container-build.json','artifacts/p1/container-smoke.json',
 'artifacts/p3/acceptance-summary.json','artifacts/p4/acceptance-summary.json','docs/p5/requirement-evidence.json',
 'artifacts/p5/listening-browser-results.json','artifacts/p5/listening-playback-validation.json','artifacts/p5/listening-review-manifest.json',
 'artifacts/p5/m01-audio-draft-validation.json','artifacts/p5/m01-review-catalog.json',
 'artifacts/p5/m01-review-catalog-validation.json','artifacts/p5/m01-review-ui-validation.json',
 'artifacts/p5/m01-review-browser-results.json','artifacts/p5/m01-review-fixture-manifest.json',
 'artifacts/p5/m01-feedback-validation.json','artifacts/p5/m01-feedback-browser-export.json',
 'artifacts/p5/m01-feedback-browser-intake.json','artifacts/p5/m01-continuation-validation.json',
 'artifacts/p5/m01-continuation-plan.json'];
const summary={phase:'P5',runtime_status:'PASS',milestone_status:'NOT_READY',tested_sha:commit,
 run_id:process.env.GITHUB_RUN_ID,event:process.env.GITHUB_EVENT_NAME,
 runtime_gates:{storage:storage.gates,media:media.gates,audio:audio.gates,speech:speech.gates},
 browser:{media:mediaBrowser.stats,speech:speechBrowser.stats,total_with_p3_p4:p3.browser.expected+p4.browser.expected+mediaBrowser.stats.expected+speechBrowser.stats.expected},
 listening_review:{browser:listeningBrowser.stats,clips_verified:listeningPlayback.clips_verified,human_review:'PENDING',html_sha256:listeningManifest.html_sha256},
 m01_audio_draft:m01Draft,
 m01_review:{catalog:m01ReviewCheck,interface:m01ReviewUI,browser:m01ReviewBrowser.stats},
 m01_feedback_intake:{tests:m01Feedback,browser_scope:m01FeedbackBrowser.scope,
  browser_counts:m01FeedbackBrowser.counts,real_human_feedback_processed:false},
 m01_continuation:{tests:m01Continuation,planned_turns:97,planned_assets:204,retained_assets:216,
  external_audio_bytes_verified:false,real_audio_generated:false},
 database:media.database,storage_startup:storage.startup_readiness,container_checks:containers.checks,container_images:build.images,
 reference_media:reference,trace_counts:counts,p6_authorized:false,
 remaining:['204 M01 draft audio files blocked on pinned PyTorch download; all 420 still need approved voices and media publication QA','OD-004/005/006 integration decisions','Remaining compound requirement gates; no blanket PASS from synthetic fixtures'],
 artifacts:paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
// Green runtime CI is deliberately not owner acceptance or permission for P6.
writeFileSync('artifacts/p5/acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
