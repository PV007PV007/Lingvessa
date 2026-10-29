# P5 transcript support and evidence — 2026-10-22

P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. PR #5 OPEN DRAFT. No merge or P6.

## Verified baseline

Parent `96cc9607c3a05481dddd9f8e6c763d8241db26eb` passed seven workflows / eleven jobs and 28 runtime gates. Both ordinary P5 archives were downloaded again and independently verified against the exact source: 90 acceptance references, 450 immutable versions/pins/test-use declarations, actual PostgreSQL/S3 import, replay, byte reads after restart and authenticated HTTP delivery. [Retained evidence](verified-ci-96cc960.json). The previously failed `742bbdc` migration-count assertion is historical and was corrected by 96cc960.

All 420 approved WAVs remain exact: 210 EN + 210 CS; 402 acoustic single-turn results (202 EN + 200 CS) plus 18 dialogues (8 EN + 10 CS). Audio quality, six voices and rights remain approved from 2026-10-14. The exact 30-visual set decision remains retained. No media bytes, immutable manifests or approval records change in this batch.

## Defect and implementation

The media player's transcript opening was audited, but the inline activity transcript was not. The support endpoint also rejected an inline-only alternative because it required an audio asset. Both existing disclosure paths now call the same per-run/item client callback. The endpoint accepts an inline alternative only from that learner's immutable run manifest; client-supplied text or assistance flags cannot grant support. Audio publication pin checks remain in place.

The existing CSRF-protected, transactionally idempotent audit remains separate from performance evidence. A failed audit request leaves text and answering available; reopening retries it. Reopening after reload is safely idempotent. No new transcript visibility, accessibility-mode or learning-model policy is introduced.

The accepted `weighted-evidence-1.0.0` policy already applies `transcript_weight: 0.3` conservatively to listening_gist, listening_detail and dictation. It does not infer unaided listening from a missing browser event. The new PostgreSQL gate verifies six EN/CS supported attempts, actual stored projections, rejected client overrides, late audit without evidence changes, and exact attempt replay. This preserves the existing policy, including its unchanged scheduling semantics; it does not claim a fresh pedagogical calibration.

## Exact-source gates

- `P5-AUDIO-API-003`: inline-only alternatives, ownership/item isolation, CSRF, absent-transcript rejection, concurrent audit idempotency, no evidence insertion.
- `P5-AUDIO-DB-002`: six actual PostgreSQL attempts across EN/CS and all three supported activity types, 0.3 weighting in persisted projections, before/after audit, immutable evidence and replay.
- `P5-AUDIO-UI-001`: existing audio playback checks plus keyboard inline disclosure, audit 503, retry, reload and database audit verification in EN/CS.

These use explicitly synthetic activity contracts and tone fixtures. They cannot substitute for the separately executed real M01 import/delivery gate or the actual course/objective accessibility review. Current-source acceptance now requires 31 runtime gates (3 storage + 9 media + 7 audio + 12 speech), all seven workflows / eleven jobs and both independently audited ordinary P5 artifacts. Parent success is not current-revision success. Exact final results are in PR #5 and its source-bound artifacts; do not create an untested evidence-only descendant.

## Requirement review

`N-CUR-P12-B04-C12` is promoted from PENDING to PASS using parent execution, not a proposed test: all 420 audio metadata records require language, exact variety, versioned voice/script, speed, provenance/rights and transcript. The importer compares every stored PostgreSQL metadata object with the checksum-bound source after restart. The complete atomic storage clause has evidence in both 96cc960 runs. This promotion does not assert objective compatibility or course publication.

`AUD-005` remains PARTIAL. `N-REF-P24-T02-R03` retains PENDING at full clause scope; the inline logging subgap is addressed, but conditional first-attempt/accessibility-mode behavior and authored objectives are not invented. Aggregate trace: **175 PASS / 30 PARTIAL / 151 PENDING** (356 clauses).

## Follow-up: per-activity audio closure and observed fixture failure

The first transcript revision `c2e0226bc13b38ab357b04dd0286c0644cbdb9d8` passed both real M01 steps but failed all seven workflows: new disposable activity references were appended outside the canonical relation/stable-code order. [Observed failure](ci-c2e0226-failure.json). The fixture now sorts these references using the existing PostgreSQL C-order contract; the publication guard is unchanged. No whole-run or new audio-gate PASS is claimed for c2e0226.

The normal/slow audit found a separate delivery defect. Publication-wide normal-source closure allowed an activity to reference only a slow clip when another activity carried its normal source. The learner endpoint returns only activity-local references, and the player renders normal sources with their slow alternatives. Such an activity could therefore publish without a usable player.

Additive migration `202610220001_p5_audio_activity_closure` checks the exact normal asset/version in the same activity. Content validation, repository publication and direct SQL publication enforce the same predicate. `P5-AUDIO-DB-003` exercises EN/CS missing, wrong-version and foreign-language normal pins; the critical normal-in-another-activity negative; repository/direct SQL rejection and rollback; correct pair, normal-only and empty-media positives. All migration-count/recreation assertions now require nine migrations. Historical migrations and approved media remain unchanged.

The real M01 gate additionally checks both EN/CS activity closures across the unchanged 210 pairs, reports `activity_audio_closure_verified: 2` and binds the new migration hash. Its two publications remain disposable test fixtures, not real course acceptance. This extends AUD-001 evidence without promoting its full objective-specific clause.

## Follow-up: pinned private input reuse

`b57ae9c55acd33808407e82b0e1a96244b85eedd` exposed a distinct transport defect. The release inventory returned an empty list even though the existing approved draft was accessible directly. The PR input job therefore created empty private draft `420910401` and relayed only 780 bytes of status metadata; its real M01 step was SKIPPED. The push input correctly reused release `414560160` / asset `649769507`, but its FFmpeg package installation timed out after ten minutes before real import. [Observed state](ci-b57ae9c-input-defect.json). Neither is a current real-M01 acceptance PASS.

Input preparation now directly reads the already authorized release ID and never creates a container. Download and receipt validation require the exact existing asset ID, approved byte length and SHA-256. Missing/replaced input fails explicitly. Trusted branch/PR acceptance also requires verified real input, so a synthetic-only run cannot silently satisfy the gate. Eighteen focused artificial-byte transport/relay checks cover private scope, absent or wrong input, checksum changes, source mismatch and credential boundaries; only hosted real execution proves M01.

The empty duplicate remains unpublished and untouched; it is not used or automatically deleted. Original archive and owner approval records are unchanged. No new upload, private archive disclosure, cost or production profile is introduced. Both new P5 runs must independently show the actual real-M01 step and summary PASS; final exact-source results belong in PR #5 and its bound artifacts.

## Recovery and remaining work

Reuse private draft release `414560160`, asset `649769507`: 63,346,796 bytes, ZIP SHA-256 `3edaeaaeb000479921a0b3ff5ec2b52042faeee54bf943eff25e4a4a0f4e516d`. No upload, regeneration, public publication or new paid service is needed. The real command remains `verify-m01-s3-import.ts --real-m01` under [the existing test instructions](../integration-20261015/README.md).

On interruption, first read the branch and its existing runs; never create a duplicate commit or blindly re-upload input:

```text
GET /repos/PV007PV007/Lingvessa/git/ref/heads/implementation/p5-media-speech
GET /repos/PV007PV007/Lingvessa/actions/runs?head_sha=<verified HEAD>&per_page=100
```

BLOCKER: OD-004 production storage/delivery profile; OD-006 labelled learner-error calibration and approved target policy; applicable full reference publication/objective accessibility acceptance. Current storage/HTTP execution remains disposable development/test. Neutral unavailable speech remains default.

IMPORTANT: continue the remaining atomic/compound-clause evidence review without claiming an entire course clause from a synthetic test. The next technical action after passing this batch is to complete the remaining P5 clause/applicability evidence review, keeping authored-course/objective acceptance and OD-004/006 explicitly open.

MINOR: 41 historical unreferenced Git blob receipts cannot be revalidated through the binary-limited connector; they are unnecessary for the verified archive/S3 route.
