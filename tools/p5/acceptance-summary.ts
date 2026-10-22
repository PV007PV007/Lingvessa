import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const ownerAudio=read('docs/p5/m01-completion-20261014/owner-approval.json');
const ownerVisual=read('docs/p5/visual-approval-20261020/owner-approval.json');
const approvedMedia=read('artifacts/p5/approved-media-metadata-validation.json');
const libraryContract=read('artifacts/p5/media-library-validation.json');
assert.equal(ownerAudio.status,'OWNER_APPROVED');assert.equal(ownerAudio.approved_final_audio_files,420);
assert.equal(approvedMedia.status,'PASS');assert.equal(approvedMedia.source_sha,commit);assert.equal(approvedMedia.audio_bytes_verified,false);
assert.equal(libraryContract.status,'PASS');assert.equal(libraryContract.source_sha,commit);assert.equal(libraryContract.real_m01_audio_imported,false);
assert.equal(process.env.GITHUB_HEAD_SHA,commit,'Evidence must be produced from the exact hosted source');
const publicationBindings=read('artifacts/p5/m01-publication-bindings.json');
assert.equal(publicationBindings.status,'PASS');assert.equal(publicationBindings.source_sha,commit);
assert.equal(publicationBindings.resolved_assets,450);assert.equal(publicationBindings.normal_slow_pairs,210);
assert.equal(publicationBindings.bindings.length,450);assert.equal(publicationBindings.publication_ready,false);
assert.equal(publicationBindings.automatic_approval_insertion,false);assert.equal(publicationBindings.audio_bytes_verified,false);
assert.equal(ownerVisual.status,'OWNER_APPROVED');assert.equal(ownerVisual.approved_visual_assets,30);
assert.equal(publicationBindings.owner_visual_approval.status,'OWNER_APPROVED');assert.equal(publicationBindings.owner_visual_approval.assets_verified,30);
assert.equal(publicationBindings.owner_visual_approval.decision_sha256,createHash('sha256').update(readFileSync('docs/p5/visual-approval-20261020/owner-approval.json')).digest('hex'));
assert.deepEqual(approvedMedia.owner_visual_approval,publicationBindings.owner_visual_approval);
const visualManifest=read('artifacts/p5/visual-review-manifest.json'),visualReview=read('artifacts/p5/visual-review-validation.json'),visualBrowser=read('artifacts/p5/visual-review-browser-results.json');
for(const r of [visualManifest,visualReview]){assert.equal(r.source_sha,commit);assert.equal(r.working_tree_dirty,false);assert.equal(r.human_review,'PENDING');assert.equal(r.rights_approval,'PENDING');assert.equal(r.publication_ready,false);assert.equal(r.p6_authorized,false);}
assert.equal(visualReview.status,'PASS');assert.equal(visualReview.visuals_verified,30);assert.equal(visualReview.external_requests,0);
assert.equal(visualManifest.items.length,30);assert.equal(visualManifest.html_sha256,visualReview.html_sha256);
assert.equal(createHash('sha256').update(readFileSync('artifacts/p5/'+visualManifest.html_file)).digest('hex'),visualManifest.html_sha256);
assert.equal(visualBrowser.stats.expected,3);for(const key of ['unexpected','skipped','flaky'])assert.equal(visualBrowser.stats[key],0);
const libraryS3=read('artifacts/p5/library-s3-validation.json');
assert.equal(libraryS3.status,'PASS');assert.equal(libraryS3.commit,commit);assert.equal(libraryS3.source_sha,commit);
assert.equal(libraryS3.scope,'SYNTHETIC_POSTGRESQL_S3_IMPORT_NOT_M01');assert.equal(libraryS3.real_m01_audio_imported,false);
assert.equal(libraryS3.imported_versions,450);assert.equal(libraryS3.test_publications,2);
for(const key of ['exact_replay','immutable_update_and_delete_rejected','changed_bytes_rejected','database_pool_recreated','storage_adapter_restart_verified','storage_server_restart_verified','all_stored_bytes_verified','anonymous_access_denied'])assert.equal(libraryS3[key],true);
const pilot=read('artifacts/p5/acoustic-pilot-validation.json');assert.equal(pilot.status,'PASS');assert.equal(pilot.recordings,402);assert.equal(pilot.production_calibration_passed,false);
const transfer=read('artifacts/p5/m01-private-transfer.json');assert.equal(transfer.source_sha,commit);
assert(['ARCHIVE_VERIFIED','AWAITING_PRIVATE_UPLOAD','NO_AUTHORIZED_INPUT_SLOT'].includes(transfer.status));
const m01Input=read('artifacts/p5/m01-input-status.json');
const trustedM01Run=process.env.GITHUB_REPOSITORY==='PV007PV007/Lingvessa'&&['refs/heads/implementation/p5-media-speech','refs/pull/5/merge','refs/pull/5/head'].includes(process.env.GITHUB_REF??'');
if(trustedM01Run){
 assert.equal(transfer.status,'ARCHIVE_VERIFIED','Authorized P5 CI requires the existing approved private archive');
 assert.equal(transfer.release_id,414560160);assert.equal(transfer.asset_id,649769507);
 assert.equal(transfer.archive_downloaded,true);assert.equal(m01Input.status,'VERIFIED');
}
if(transfer.status==='ARCHIVE_VERIFIED')assert.equal(m01Input.status,'VERIFIED');
let m01Import=null;
if(m01Input.status==='VERIFIED'){
 m01Import=read('artifacts/p5/m01-library-import-validation.json');
 assert.equal(m01Import.status,'PASS');assert.equal(m01Import.commit,commit);assert.equal(m01Import.source_sha,commit);
 assert.equal(m01Import.scope,'REAL_M01_BYTES_POSTGRESQL_S3_IMPORT');assert.equal(m01Import.real_m01_audio_imported,true);
 assert.equal(m01Import.activity_audio_closure_verified,2);
 assert.equal(m01Import.audio_assets,420);assert.equal(m01Import.visual_drafts,30);assert.equal(m01Import.test_publications,2);
 assert.equal(m01Import.delivered_real_m01_audio_assets,420);assert.equal(m01Import.test_fixture_asset_approvals,2700);
 assert.equal(m01Import.delivered_test_avatar_assets,6);assert.equal(m01Import.delivered_test_visual_assets,30);assert.equal(m01Import.delivered_assets,450);
 assert.equal(m01Import.required_test_uses_verified,450);assert.equal(m01Import.catalog_resolved_assets,450);assert.equal(m01Import.delivered_publication_pins.length,450);
 assert.equal(m01Import.binding_plan_sha256,createHash('sha256').update(readFileSync('artifacts/p5/m01-publication-bindings.json')).digest('hex'));
 for(const binding of publicationBindings.bindings){const pin:{asset_id:string;asset_version:number;checksum:string;metadata_checksum:string}|undefined=m01Import.delivered_publication_pins.find((p:{asset_id:string})=>p.asset_id===binding.asset_id);assert(pin);assert.equal(pin.asset_version,binding.asset_version);assert.equal(pin.checksum,binding.checksum);assert.match(pin.metadata_checksum,/^[a-f0-9]{64}$/u);}
 assert.equal(m01Import.same_language_versioned_avatar_closure_checks,2);
 const http=m01Import.http_delivery;assert.equal(http.status,'PASS');assert.equal(http.executed,true);
 assert.equal(http.scope,'REAL_M01_LOOPBACK_HTTP_POSTGRESQL_S3_NOT_PRODUCTION_CDN');
 for(const [key,value]of Object.entries({metadata_lists:2,full_assets:450,audio_assets:420,visual_assets:30,byte_ranges:8,negative_responses:20,storage_outage_503:2,storage_recovery_reads:2}))assert.equal(http[key],value);
 for(const key of ['authenticated_login','all_full_response_checksums_verified','private_no_store_headers_verified','svg_sandbox_headers_verified'])assert.equal(http[key],true);
 assert.equal(http.production_delivery_profile_approved,false);
 assert.equal(m01Import.import_inserted_approvals,0);assert.equal(m01Import.production_publication_created,false);
 assert.equal(m01Import.foreign_user_and_activity_denied,true);
 for(const key of ['exact_replay','immutable_update_and_delete_rejected','changed_bytes_rejected','database_pool_recreated','storage_adapter_restart_verified','storage_server_restart_verified','all_stored_bytes_verified'])assert.equal(m01Import[key],true);
}else{
 assert.equal(m01Input.status,'NOT_PROVIDED');assert.equal(m01Input.audio_bytes_verified,false);
 assert(!existsSync('artifacts/p5/m01-library-import-validation.json'),'Do not reuse stale real-corpus evidence');
}

const storage=read('artifacts/p5/storage-validation.json');
const media=read('artifacts/p5/media-database-validation.json');
const audio=read('artifacts/p5/audio-validation.json');
const speech=read('artifacts/p5/speech-database-validation.json');
const baseline=read('artifacts/p5/baseline-validation.json');
const reference=read('artifacts/p5/reference-media-validation.json');
assert.equal(reference.approved_m01_audio.status,ownerAudio.status);
assert.equal(reference.approved_m01_audio.files,ownerAudio.approved_final_audio_files);
assert.equal(reference.approved_m01_audio.sha256,createHash('sha256').update(readFileSync('docs/p5/m01-completion-20261014/owner-approval.json')).digest('hex'));
assert.deepEqual(reference.approved_m01_visuals,publicationBindings.owner_visual_approval);
assert.equal(reference.publication_ready,false);
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
const m01Completion=read('artifacts/p5/m01-completion-validation.json');
const m01CompletionTests=read('artifacts/p5/m01-completion-tests.json');
const m01DialogueCheck=read('artifacts/p5/m01-dialogue-crosscheck-validation.json');
const p3=read('artifacts/p3/acceptance-summary.json'),p4=read('artifacts/p4/acceptance-summary.json');
const containers=read('artifacts/p1/container-smoke.json'),build=read('artifacts/p1/container-build.json');
for(const r of [storage,media,audio,speech,containers]){assert.equal(r.commit,commit);assert.equal(r.status,'PASS');}
for(const r of [media,audio,speech,reference])assert.equal(r.source_sha,commit);
for(const [r,count]of [[storage,3],[media,9],[audio,7],[speech,12]] as const){
 assert.equal(r.gates.length,count);assert(r.gates.every((g:{status:string})=>g.status==='PASS'));
}
assert.equal(media.database,'PostgreSQL 18.6');assert.equal(speech.database,'PostgreSQL 18.6');
assert.equal(baseline.status,'PASS');assert.equal(reference.structural_validation,'PASS');
assert.equal(audio.browser_executed,true);
assert.equal(audio.transcript_support.scope,'SYNTHETIC_ACTIVITY_CONTRACT_NOT_M01_OBJECTIVE_REVIEW');
assert.deepEqual(audio.transcript_support.languages,['en','cs']);
assert.deepEqual(audio.transcript_support.activity_types,['listening_gist','listening_detail','dictation']);
assert.equal(audio.transcript_support.weighted_attempts_verified,6);
assert.equal(audio.transcript_support.model_version,'weighted-evidence-1.0.0');assert.equal(audio.transcript_support.transcript_weight,0.3);
for(const key of ['client_override_rejected','inline_audit_verified'])assert.equal(audio.transcript_support[key],true);
for(const key of ['audit_creates_evidence','late_audit_mutates_evidence','replay_multiplies_evidence'])assert.equal(audio.transcript_support[key],false);
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
assert.equal(m01Continuation.tests_run,12);
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
for(const r of [m01Completion,m01CompletionTests,m01DialogueCheck]){
 assert.equal(r.status,'PASS');assert.equal(r.source_sha,commit);assert.equal(r.working_tree_dirty,false);
}
assert.equal(m01Completion.scope,'COMPLETION_METADATA_ONLY_AUDIO_EXTERNAL');
assert.equal(m01Completion.audio_bytes_verified,false);assert.equal(m01Completion.wav_files_verified,0);
assert.equal(m01Completion.counts.available_assets,420);assert.equal(m01Completion.counts.missing_assets,0);
assert.equal(m01Completion.counts.new_assets,204);assert.equal(m01Completion.counts.retained_assets,216);
assert.equal(m01Completion.counts.asr_screened_assets,420);assert.equal(m01Completion.counts.quality_retries,0);
assert.equal(m01Completion.results_sha256,createHash('sha256').update(readFileSync('docs/p5/m01-completion-20261014/results.json')).digest('hex'));
assert.equal(m01Completion.tool_sha256,createHash('sha256').update(readFileSync('tools/p5/complete-m01-audio.py')).digest('hex'));
assert.equal(m01CompletionTests.scope,'COMPLETION_INTEGRITY_TESTS');assert.equal(m01CompletionTests.tests_run,3);
for(const key of ['failures','errors','skipped'])assert.equal(m01CompletionTests[key],0);
assert.equal(m01CompletionTests.real_human_feedback_processed,false);
assert.equal(m01CompletionTests.test_sha256,createHash('sha256').update(readFileSync('tests/unit/p5-m01-completion.test.py')).digest('hex'));
for(const r of [m01Completion,m01CompletionTests]){
 assert.equal(r.publication_ready,false);assert.equal(r.p5_milestone,'NOT_READY');assert.equal(r.p6_authorized,false);
}
assert.equal(m01DialogueCheck.scope,'DIALOGUE_CROSSCHECK_METADATA_ONLY');assert.equal(m01DialogueCheck.files,10);
assert.equal(m01DialogueCheck.external_audio_bytes_verified,false);assert.equal(m01DialogueCheck.human_review,'PENDING');
assert.equal(m01DialogueCheck.pronunciation_quality_asserted,false);
assert.equal(m01DialogueCheck.result_sha256,createHash('sha256').update(readFileSync('docs/p5/m01-completion-20261014/dialogue-crosscheck.json')).digest('hex'));
assert.equal(m01DialogueCheck.script_sha256,createHash('sha256').update(readFileSync('tools/p5/crosscheck-m01-dialogues.py')).digest('hex'));
assert.equal(createHash('sha256').update(readFileSync('artifacts/p5/'+listeningManifest.html_file)).digest('hex'),listeningManifest.html_sha256);
for(const r of [p3,p4]){assert.equal(r.tested_sha,commit);assert.equal(r.status,'PASS_READY_FOR_OWNER_ACCEPTANCE');}
assert.equal(build.commit,commit);assert.deepEqual(Object.keys(build.images).sort(),['admin','api','web','worker']);
const authorization=read('docs/p5/authorization.json');assert.equal(authorization.p6_authorized,false);
const trace=read('docs/p5/requirement-evidence.json').requirements as Array<{status:string}>;
const counts=Object.fromEntries(['PASS','PARTIAL','PENDING'].map(status=>[status,trace.filter(r=>r.status===status).length]));
const paths=['docs/p5/visual-approval-20261020/owner-approval.json','docs/p5/visual-approval-20261020/reviewed-manifest.json','artifacts/p5/m01-private-transfer.json','artifacts/p5/library-s3-validation.json','artifacts/p5/acoustic-pilot-validation.json','artifacts/p5/m01-input-status.json',...(m01Import?['artifacts/p5/m01-library-import-validation.json','artifacts/p5/external-m01-byte-validation.json']:[]),'artifacts/p5/storage-validation.json','artifacts/p5/media-database-validation.json','artifacts/p5/audio-validation.json',
 'artifacts/p5/speech-database-validation.json','artifacts/p5/baseline-validation.json','artifacts/p5/reference-media-validation.json',
 'artifacts/p5/browser-results.json','artifacts/p5/speech-browser-results.json','artifacts/p1/container-build.json','artifacts/p1/container-smoke.json',
 'artifacts/p3/acceptance-summary.json','artifacts/p4/acceptance-summary.json','docs/p5/requirement-evidence.json',
 'artifacts/p5/listening-browser-results.json','artifacts/p5/listening-playback-validation.json','artifacts/p5/listening-review-manifest.json',
 'artifacts/p5/m01-audio-draft-validation.json','artifacts/p5/m01-review-catalog.json',
 'artifacts/p5/m01-review-catalog-validation.json','artifacts/p5/m01-review-ui-validation.json',
 'artifacts/p5/m01-review-browser-results.json','artifacts/p5/m01-review-fixture-manifest.json',
 'artifacts/p5/m01-feedback-validation.json','artifacts/p5/m01-feedback-browser-export.json',
 'artifacts/p5/m01-feedback-browser-intake.json','artifacts/p5/m01-continuation-validation.json',
 'artifacts/p5/m01-continuation-plan.json','artifacts/p5/m01-completion-validation.json',
 'artifacts/p5/m01-completion-tests.json','artifacts/p5/m01-dialogue-crosscheck-validation.json',
 'artifacts/p5/approved-media-metadata-validation.json','artifacts/p5/media-library-validation.json',
 'docs/p5/m01-completion-20261014/owner-approval.json',
 'artifacts/p5/m01-publication-bindings.json','artifacts/p5/visual-review-manifest.json',
 'artifacts/p5/visual-review-validation.json','artifacts/p5/visual-review-browser-results.json'];
const summary={phase:'P5',runtime_status:'PASS',milestone_status:'NOT_READY',tested_sha:commit,
 run_id:process.env.GITHUB_RUN_ID,event:process.env.GITHUB_EVENT_NAME,
 runtime_gates:{storage:storage.gates,media:media.gates,audio:audio.gates,speech:speech.gates},
 transcript_support:audio.transcript_support,
 browser:{media:mediaBrowser.stats,speech:speechBrowser.stats,total_with_p3_p4:p3.browser.expected+p4.browser.expected+mediaBrowser.stats.expected+speechBrowser.stats.expected},
 listening_review:{browser:listeningBrowser.stats,clips_verified:listeningPlayback.clips_verified,human_review:'PENDING',html_sha256:listeningManifest.html_sha256},
 m01_audio_draft:m01Draft,
 m01_completion:{metadata:m01Completion,tests:m01CompletionTests,dialogue_crosscheck:m01DialogueCheck},
 m01_owner_approval:ownerAudio,
 m01_visual_owner_approval:publicationBindings.owner_visual_approval,
 approved_media_registry:approvedMedia,
 m01_publication_preparation:{status:publicationBindings.status,source_sha:commit,resolved_assets:450,normal_slow_pairs:210,publication_ready:false},
 visual_review_packet:{scope:'HISTORICAL_UNSUBMITTED_WORKSHEET_CURRENT_DECISION_RECORDED_SEPARATELY',browser:visualBrowser.stats,visuals_verified:30,html_sha256:visualManifest.html_sha256,human_review:'PENDING',rights_approval:'PENDING',publication_ready:false},
 acoustic_candidate:{provider_code:'local_acoustic_ipa',model_version:'xlsr53-espeak-2c733782da56-1',test_only:true,production_calibration_approved:false,private_evidence_transferred:true,integrity:pilot},
 library_contract:libraryContract,
 library_s3:libraryS3,
 private_m01_transfer:transfer,
 real_m01_import:m01Import??{status:'NOT_EXECUTED_EXTERNAL_INPUT_MISSING',real_m01_audio_imported:false},
 m01_review:{catalog:m01ReviewCheck,interface:m01ReviewUI,browser:m01ReviewBrowser.stats},
 m01_feedback_intake:{tests:m01Feedback,browser_scope:m01FeedbackBrowser.scope,
  browser_counts:m01FeedbackBrowser.counts,real_human_feedback_processed:false},
 historical_m01_continuation:{tests:m01Continuation,historical_planned_turns:97,historical_planned_assets:204,retained_assets:216,
  external_audio_bytes_verified:false,real_audio_generated:false},
 database:media.database,storage_startup:storage.startup_readiness,container_checks:containers.checks,container_images:build.images,
 reference_media:reference,trace_counts:counts,p6_authorized:false,
 remaining:[...(m01Import?[]:['Real M01 PostgreSQL/S3 execution requires the approved external package; no missing authorization or regeneration is implied']),'Activity-specific reference publication/accessibility and OD-004 production delivery profile remain open; owner visual set acceptance is retained','A production speech policy requires valid labelled learner-error calibration','Remaining applicable compound P5 gates; P6 is not authorized'],
 artifacts:paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
// Green runtime CI is deliberately not owner acceptance or permission for P6.
writeFileSync('artifacts/p5/acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
