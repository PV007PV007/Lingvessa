## Current bounded dependency follow-up — 2026-10-28

P5 **IN PROGRESS / NOT READY**; PR #5 OPEN DRAFT; no merge/P6. Exact `e9a831061216272514a3c9dc22a605ff65351ef8` passed all seven workflows / eleven jobs on attempt 1 and both independent input/runtime audits: 420 unchanged WAVs, 450 pins, 31 gates and 28 browser cases per event, 46 acceptance references each. [Retained proof](../docs/p5/exit-review-20261028/verified-ci-e9a8310.json). All 850 source blobs matched GitHub. No historical/synthetic result substituted for a real M01 run.

The production dependency gate passed its high/critical threshold but logged one moderate advisory, GHSA-6pq8-jhm2-2vcw, in Express's qs 6.16.0. [Remediation record](../docs/p5/exit-review-20261028/dependency-remediation.json): narrow override to the already-present qs 6.16.1; no API/schema/media change. Full JSON audit reports are now retained and hash-bound; the original audit exit status/high-critical threshold is preserved. Local read-only advisory inspection is not pinned-toolchain acceptance. The successor must pass its own seven workflows, both real M01 runs and independent artifacts before phase acceptance is presented.

Next: read HEAD and existing attempts; verify the bounded dependency successor, then put final exact-source proof in PR #5 without an untested evidence-only descendant. P5 acceptance scope and 178 PASS / 31 PARTIAL / 147 PENDING trace below remain current. OD-004/006 stay OPEN. No repeat generation/approval/upload or new service is needed.

## P5 exit review retained with dependency follow-up above — 2026-10-28

P5 **IN PROGRESS / NOT READY pending owner acceptance**. P0–P4 ACCEPTED. PR #5 OPEN DRAFT; prior no-merge instruction active; P6 not implemented.

[Plan §12 criterion matrix and concrete transition scope](../docs/p5/exit-review-20261028/README.md) distinguish P5 runtime/asset readiness from P6/P7 authored lessons, P8 workflow and production/calibrated speech. Earlier blanket production/full-course blockers below are historical interpretations, superseded by this source review. No baseline source or open-decision record is changed. OD-004 and OD-006 remain OPEN; production storage/CDN and usable learner scoring are not enabled.

Verified parent `9215dbbbb6eb0fdc23e754d216730b64ee8a3c9c`, tree `b7927419d527c5f391e56733356b3e3d62d79470`: seven workflows / eleven jobs PASS on attempt 1; P5 push 40500393519 and PR 40500402007 both execute actual approved M01. [Retained source-bound proof](../docs/p5/exit-review-20261028/verified-ci-9215dbb.json): 420 immutable WAVs + 30 SVGs, 450 version/pin/readback checks, replay, update/delete/changed-byte rejection, PG/S3 server/adapter restart, authenticated HTTP 450 full reads/eight ranges/twenty negatives/two recovery reads, 31 gates and 28 browser cases per event. Both input/runtime artifacts were independently downloaded and verified; all 848 parent source blobs match GitHub. The current reporting revision still needs its own CI; final descendant results belong in PR #5.

420 final WAVs = 210 EN + 210 CS = 402 single-turn acoustic files + 18 dialogues. Quality/six-voice/rights approval 2026-10-14 and visual approval 2026-10-20 remain valid. No generation, media changes, repeat set approval, original ZIP publication or new M01 WAV Git storage. Existing one-day final-WAV transport feeds disposable S3-compatible tests; no new paid service, secret or PC access.

N-REF-P24-T01-R03/R04/R09 are now PASS on complete atomic metadata evidence. N-REF-P24-T02-R03 is PARTIAL on executed transcript/keyboard/audit/retry/evidence subgates; actual objective and future hiding-mode review remains open. Trace: **178 PASS / 31 PARTIAL / 147 PENDING**, all 356 original source/task/phase assignments retained.

BLOCKER for transition: final exact-source regression/artifact verification for this revision, then owner milestone acceptance/phase decision. IMPORTANT before enabling their scope: OD-004 production delivery; OD-006 labelled learner-error calibration/policy; full authored-objective/publication checks in Plan order. MINOR: historical 41 unreferenced blob receipts and unused unpublished draft, neither used by ingestion.

Next: read actual HEAD and existing attempts; complete and independently audit this revision's seven workflows and two real M01 runs; update PR #5 with exact SHA, runs and artifact digests. Then present the concrete P5 development/reference acceptance and merge/P6 decision once. Do not claim owner acceptance, merge, start P6, repeat input upload or regenerate audio. [Idempotent recovery procedure](../docs/p5/public-test-input-20261026/README.md); an identified retry requires an attempt-matched input job and its dependent exit job.

## Historical P5 verified real integration — 2026-10-27

P5 **IN PROGRESS / NOT READY**. P0–P4 ACCEPTED; PR #5 OPEN DRAFT; no merge or P6.

Verified source `5230d48846f902782b388d9d019632e77ffc6cc7`, tree `e72fc3a2a39bef7ddb44cc887deaefff6a2a6286`: all seven workflows and eleven latest-attempt jobs PASS. P5 push 40460988576 attempt 2 and PR 40460994664 attempt 1 both executed real M01. [Retained exact-source evidence](../docs/p5/public-test-input-20261026/verified-ci-5230d48.json) records independent input/runtime artifact audits, 90 acceptance references and 31 runtime gates per event. Any later revision requires its own exact-source CI; final results are in [PR #5](https://github.com/PV007PV007/Lingvessa/pull/5).

Both runs imported/replayed 450 immutable versions (420 approved WAVs + 30 SVGs), rejected updates/deletes/changed bytes, recreated PostgreSQL pools and S3 servers/adapters, and verified every stored byte and publication pin. Authenticated HTTP delivery passed 450 full reads, eight ranges, twenty negative responses and recovery after storage outage. The two test publications are disposable; the importer inserts no approvals or production publication.

All 420 final WAVs match their immutable checksums: 210 EN + 210 CS, comprising 402 single-turn acoustic results (202 EN / 200 CS) and 18 dialogues (8 EN / 10 CS). Original archive SHA-256/CRC also passed. Quality/six-voice/rights approval from 2026-10-14 remains effective. No audio was regenerated or changed. No final M01 WAV was added to Git; retained historical audition files are unchanged.

The owner's public-audio scope permits only the 420 finals in a one-day Actions artifact with receipt/attribution. The original ZIP and its 607 historical/intermediate WAVs remain unpublished. This is test transport into disposable S3-compatible storage, with no new service, cost, secret or PC access. [Scope and recovery](../docs/p5/public-test-input-20261026/README.md).

The first 5230d48 push attempt timed out during slow Ubuntu package downloads, before real M01. One same-source retry passed. The input job was necessarily repeated because receipts bind the exact run attempt; the old receipt cannot be used in a new attempt. No older failed/synthetic artifact was counted as current acceptance.

All 356 trace rows retain **175 PASS / 30 PARTIAL / 151 PENDING**. Five core media clauses now cite the executed 5230d48 gates without claiming whole-clause acceptance. BLOCKER: OD-004 production delivery profile, OD-006 labelled learner-error calibration/policy, and applicable full reference publication/objective accessibility. IMPORTANT: remaining clause-level applicability/evidence review. MINOR: retained historical unreferenced blob receipts and unused unpublished draft; neither blocks ingestion.

Next: read actual branch HEAD and latest attempts, verify this documentation revision's complete CI, then review remaining atomic media/transcript requirements against existing code and full source clauses. Do not author P6 content, change approval/production policy, repeat generation or re-upload the original. Runtime results belong in PR #5 without another evidence-only descendant cycle.

## Historical P5 public-input correction — 2026-10-26

2026-10-27 follow-up: d0cff4f passed both complete input pipelines and independent 420-WAV artifact audits. Both full pnpm checks passed, then the historical Pocket gate correctly rejected untracked Python bytecode caches before real PostgreSQL/S3. The cache cause was reproduced; the workflow now prevents bytecode writes without weakening clean-tree checks. [Exact observed evidence](../docs/p5/public-test-input-20261026/ci-d0cff4f-input-and-failure.json). Successor exact-source execution and final results remain required in PR #5.

P5 IN PROGRESS / NOT READY; P0–P4 ACCEPTED; PR #5 OPEN DRAFT; no merge/P6. The owner requires continued work without a new paid service and clarified that audio need not be private. [Scope and implementation](../docs/p5/public-test-input-20261026/README.md) permit a one-day Actions artifact containing only 420 approved final WAVs, a safe receipt and source attribution. The original archive and its 607 historical/intermediate WAVs remain unpublished. Original quality/six-voice/rights approval is retained; no audio is regenerated, modified or committed to Git.

Public runs now use isolated draft download and exact allowlist extraction, followed by a read-only test job that independently checks every WAV against immutable records and source/run/attempt bindings. Anonymous access to the original is rejected before export. The old private-only whole-archive relay cannot run in Public. No new storage account, billing setting, secret or PC access is needed. PostgreSQL/S3 and HTTP delivery remain disposable development/test scope; OD-004/006 stay OPEN.

The preceding exact HEAD 6debfb91 passed all five P1–P4 workflows and 31/31 technical runtime gates in both P5 exit jobs, but the old input condition blocked both actual M01 executions. Those results do not prove the new source. [Local recovered-byte checks](../docs/p5/public-test-input-20261026/local-byte-verification.json) verify all 420 final WAVs and reconcile 402 single-turn results +18 dialogues; they explicitly do not claim PostgreSQL/S3 execution. The successor requires its own seven workflows/eleven jobs, both real M01 runs and independent artifact audits. Final exact-source results and run links are recorded in PR #5. No requirement status is promoted merely by transport changes.

Next: read actual HEAD and current Actions attempts, inspect the new input jobs and then verify the real import/replay/immutability/restart/readback/HTTP results. Do not switch to Private, regenerate audio, upload the original again or blindly rerun an older commit. Missing real input remains a hard failure. All 356 rows retain 175 PASS / 30 PARTIAL / 151 PENDING. Remaining BLOCKER: current-source actual execution, OD-004/006 and applicable full reference publication/objective accessibility; IMPORTANT: clause applicability/evidence; MINOR: historical cleanup.

## Historical P5 dependency-audit continuation — 2026-10-26

Public-summary privacy correction: private release identifiers, archive digests and review-file locators are omitted here. Historical work/results and original approval records remain retained; no media bytes or approvals are changed.

The exact scanner correction 6998b70 passed full `pnpm check` in all seven exit jobs: generation, lint, full typecheck, zero secret findings, unit tests, builds and smoke tests. All seven workflows then failed the production dependency audit (two critical/four high advisories). [Exact execution](../docs/p5/integration-20261026/ci-6998b70.json). This continuation updates affected dependency pins and narrow transitive overrides; its own CI must pass. The approved private input boundary remains blocked by Public visibility, and no real M01 execution is claimed. No acceptance/requirement promotion, new paid service, merge or P6.

## Historical P5 resumed Actions and private-input boundary — 2026-10-26

P5 IN PROGRESS / NOT READY; P0–P4 ACCEPTED; PR #5 OPEN DRAFT; no merge/P6. Run 39811276331 attempt 3 on 875461c acquired runners, then failed private-input preflight and the exact-content secret-fixture scan. The repository is now Public; the approved private-media bridge requires Private. The approved archive remains unpublished and unchanged. No real M01 execution occurred in that attempt.

This correction reviews the exact updated mocked transport fixture checksum, retains the historical checksum for full-history scans and tests fail-closed behavior for changed content/path. Privacy guards, approved media/manifest/approval bytes and workflow gates are unchanged. [Observed execution and recovery](../docs/p5/integration-20261026/README.md), [failed attempt](../docs/p5/integration-20261026/ci-875461c-attempt3.json) and [bounded local checks](../docs/p5/integration-20261026/local-security-checks.json). Exact successor CI is recorded in PR #5. Current-source seven workflows / 31 runtime gates / both real M01 executions / artifact audits remain required.

Historical instruction before the later owner clarification: the connector could not restore visibility, so the old route required the private context. This is superseded by the approved final-WAV test-input scope above; the original archive remains unpublished. Earlier runner billing failure remains historical and private Actions availability is still unproven. Last full PASS remains 96cc960; 356 requirement rows and 175 PASS / 30 PARTIAL / 151 PENDING are unchanged. OD-004/006 and full objective/publication acceptance stay open. PC/VM migration is deferred; no new paid services. Owner audio/visual approvals remain effective, with no regeneration or repeat approval.

## Historical P5 transcript-support continuation — 2026-10-22

Authoritative parent `96cc9607c3a05481dddd9f8e6c763d8241db26eb` passed seven workflows / eleven jobs, 28 runtime gates and both independent artifact audits (90 references). All 420 approved WAVs + 30 SVGs passed real PostgreSQL/S3 replay, immutable versions, restart and authenticated HTTP delivery; 450 declared test uses passed. [Retained exact-source evidence](../docs/p5/integration-20261022/verified-ci-96cc960.json). Historical 742bbdc failure was corrected on 96cc960.

This batch fixes unaudited inline activity transcripts and accepts inline-only alternatives from the owned immutable run. Shared client logging preserves text availability during audit failures. New PostgreSQL/Chromium gates verify idempotency, ownership, before/after audit, six weighted EN/CS attempts and replay without changing the accepted 0.3 conservative transcript policy. Current HEAD must pass its own seven workflows, 31 runtime gates and both artifact audits; final exact results in PR #5 override historical summaries below.

The atomic audio-metadata storage clause N-CUR-P12-B04-C12 is proven by both 96cc960 runs: trace becomes 175 PASS / 30 PARTIAL / 151 PENDING. AUD-005 remains PARTIAL until actual authored-objective accessibility review. [Current scope, gates and idempotent recovery instructions](../docs/p5/integration-20261022/README.md).

P5 IN PROGRESS / NOT READY. Owner audio/visual decisions retained; no new ZIP, generation, media Git storage or repeat approval. OD-004 and OD-006 OPEN. Full reference publication/objective acceptance remains distinct from disposable fixtures. No merge or P6. The current batch also enforces exact normal/slow closure within each activity, using a ninth additive migration and repository/direct SQL negative tests. After exact-source verification, continue the remaining P5 clause/applicability evidence review.

The first transcript revision c2e0226 passed both real M01 steps but failed overall on noncanonical new fixture reference ordering. [Failure evidence](../docs/p5/integration-20261022/ci-c2e0226-failure.json). The fixture is corrected; the database guard remains enforced. This follow-up requires all seven workflows, 31 runtime gates and both independent artifact audits on its exact HEAD.

The b57ae9c follow-up exposed private-input discovery failure: an empty release listing created unused private draft [private identifier omitted], so the PR real M01 step was skipped; push input was exact but package installation timed out. [Observed state](../docs/p5/integration-20261022/ci-b57ae9c-input-defect.json). Current preparation directly reads existing release [private identifier omitted] and pins asset [private identifier omitted], rejects absent/replaced input and requires verified real input in trusted P5 acceptance. Eighteen local transport/relay checks passed; hosted real evidence is still required. The unused empty draft remains unpublished/untouched. No re-upload is needed.

## Historical implementation handoff — through 2026-10-21

Updated: 2026-10-21. **P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED; P6 NOT AUTHORIZED.**
Branch `implementation/p5-media-speech`; [PR #5](https://github.com/PV007PV007/Lingvessa/pull/5) OPEN DRAFT. Accepted main/P4: `5027f001237b6451237d87343ebeca58cd0af007`.

## Regression correction — 2026-10-21

`742bbdc235cfe677572d2244b23498dd3e1dd7ce` passed the real M01 PostgreSQL/S3 step in both runs and all nine media gates in the inspected PR job, including declared accessibility. Overall all seven workflows FAILED because P3 line 69 still expected seven migrations instead of eight. [Exact failure observation](../docs/p5/integration-20261021/ci-742bbdc-regression-failure.json). The remaining assertion is corrected without weakening the gate. Final exact-source CI and independently audited artifacts in PR #5 must prove this descendant. Last fully verified source remains d2ec78a; no acceptance-summary PASS is claimed for 742bbdc.

## Historical declared media accessibility and clause mapping — 2026-10-21

Parent `d2ec78a5a5e61c1359a8e282abd47888bdd3f74d` passed seven workflows / eleven jobs and both independent artifact audits (90 references). It verified all 450 real PostgreSQL/S3 imports, replay, immutable versions, restart/readbacks, publication pins and actual authenticated HTTP deliveries. [Retained evidence](../docs/p5/integration-20261021/verified-ci-d2ec78a.json).

This revision closes a concrete enforcement gap: declared semantic/decorative media use is now checked during content validation and repository publication, with a direct PostgreSQL publication guard. Negative integration cases cover substitution, a mixed same-role set, optional-role mismatch and rollback; positive cases cover correct decorative and absent optional use. The real M01 test additionally checks 450 separate declared test uses. It preserves the approved corpus and decisions, zero importer-created approvals and test-only publication scope. Its own exact-HEAD CI/artifacts in PR #5 determine execution, not the parent result.

[Current mapping and execution/recovery instructions](../docs/p5/integration-20261021/README.md) distinguish the five media/accessibility clauses from their later authored-course/objective acceptance. All five remain PARTIAL; total trace remains 174 PASS / 30 PARTIAL / 152 PENDING. No synthetic activity is relabelled as a real reference lesson. OD-004/006 remain open. No new archive, audio generation, repeated owner review, media Git storage, public release, merge or P6.

## Historical owner visual acceptance and actual HTTP delivery — 2026-10-20

The owner's “все добре. продовжуй” accepts the presented 30-item set in its immediate review context. [Decision](../docs/p5/visual-approval-20261020/owner-approval.json) binds the exact b9c34fa review manifest, HTML SHA-256, 30 immutable version-2 metadata records and SVG checksums. No per-item form or authenticated runtime reviewer is invented. Draft/pending source records remain historical; reports overlay this later set-level acceptance. Audio approval from 2026-10-14 is unchanged. This does not approve a production delivery profile, close OD-004/006 or authorize P6.

Parent b9c34fa passed all seven workflows / eleven jobs, 450 real PostgreSQL/S3 imports/readbacks/repository deliveries and both independent artifact audits (86 acceptance references). [Retained evidence](../docs/p5/integration-20261020/verified-ci-b9c34fa.json). This revision additionally requires authenticated HTTP delivery of all 450 assets, exact bytes and privacy/SVG headers, eight byte-range reads, eighteen access/range failures, two storage-outage 503s and two recovery reads through the running API. It retains two disposable test publications and 2,700 fixture permission rows; importer approval insertion remains zero. Parent results do not prove this new HTTP gate.

[Current execution/recovery instructions](../docs/p5/integration-20261020/README.md). Exact current-HEAD checks and independently verified artifacts in PR #5 determine success. Required activity-specific reference publication/accessibility, OD-004 production profile, OD-006 learner-error calibration/policy and applicable compound clauses remain open. No new ZIP, generation, WAV Git storage, public release, merge or P6.

## Historical publication bindings and visual review continuation — 2026-10-19

Previous HEAD `c55647e22d7ac1918db596ae2c4a398fee3b12bd` passed all seven workflows / eleven jobs and both independent artifact audits (78 references). [Retained evidence](../docs/p5/integration-20261019/verified-ci-c55647e.json). Its 426 successful delivery reads are historical; this revision requires a new exact-HEAD run for the expanded 450-delivery test.

All 450 required catalog identities now resolve to immutable media versions, including 210 normal/slow pairs and exact voice/character/avatar dependencies. The real PostgreSQL/S3 test expands delivery to all 420 approved WAVs + all 30 unchanged visual drafts, with 2,700 explicitly disposable fixture permissions, zero import-created approvals and retained authorization/closure failures. An offline, hash-bound 30-item visual worksheet supports semantic/accessibility/rights comments without automatic approval. [Current commands, evidence and boundaries](../docs/p5/integration-20261019/README.md).

The original private release archive remains verified and reusable. No generation, re-upload, WAV Git storage, repeated audio approval, merge or P6. Visual human/rights decisions, required reference publication, OD-004, OD-006 and applicable compound clauses remain open. Current-source results belong in PR #5 and its exact-source CI artifacts; do not claim this revision passed from parent evidence.

## Historical verified real M01 execution — 2026-10-18

Both P5 PR and push runs passed on `460aab052115f6fe168d180b4ac44369afaab09d`, together with all five P1–P4 runs. Both ordinary evidence archives were independently downloaded; their digests, CRC, 39 references each and source/code bindings matched. [Durable exact-source evidence](../docs/p5/integration-20261018/verified-ci-460aab0.json).

Executed: 450 immutable imports (420 approved WAVs + 30 visual drafts), exact replay, changed-byte/immutable-update/delete rejection, database-pool and S3 server/adapter recreation, all stored-byte readbacks, anonymous/foreign-owner/activity denial, two disposable publications and 426 delivery reads (420 audio + six avatars). Negative and positive same-language/avatar-version closure checks passed. Import inserts zero approvals; 2,556 permission rows exist only in the disposable test fixture. This is repository-level delivery in development/test, not production HTTP/CDN or pedagogical course publication.

The ZIP remains private draft release asset `[private identifier omitted]`, SHA-256 [digest retained in the original record]; no upload or audio generation is needed. Owner audio approval remains valid. The 402 acoustic single-turn files (202 EN + 200 CS) and 18 final dialogues (8 EN + 10 CS) account for all 420 checksum-verified WAVs.

The current report now separates the immutable historical preproduction registry from the later approved audio inventory. Historical placeholders do not reopen OD-005 or authorize regeneration. Its own exact-HEAD CI/acceptance artifacts in PR #5 determine this reporting revision's result; do not create a self-referential evidence-only descendant.

P5 stays IN PROGRESS / NOT READY; PR #5 OPEN DRAFT. OD-004 and OD-006 remain OPEN. [Remaining gates and next action](../docs/p5/integration-20261018/remaining-gates.md). The 30-SVG assistant render inspection is preparation for visual review, not human or rights approval. No merge or P6.

## Historical real-test correction — 2026-10-18

Private transfer and all 420 immutable WAV checks succeeded. Both real PostgreSQL/S3 runs on `35dced61` stopped at the disposable publication's missing avatar dependencies (`23514`), so no end-to-end PASS was claimed. The test now binds the existing three exact-version avatars per language, preserves a negative avatar-closure assertion, and checks actual-version authorization denials. Expected delivery is 420 audio + six avatars, with 2,556 clearly labelled disposable fixture permissions and zero import-created approvals. [Current evidence and restart boundary](../docs/p5/integration-20261018/README.md). Exact current-HEAD CI/acceptance artifacts in PR #5 decide success. No archive re-upload, regeneration, repeat owner approval, database-guard relaxation, merge or P6.

## Historical private input continuation — 2026-10-17

The approved archive is retained locally: SHA-256 [digest retained in the original record]. All 420 final WAVs (210 EN + 210 CS) match immutable records. The 402 acoustic single-turn results plus 18 dialogue files account for all final files. The 2026-10-14 quality, six-voice and audio-rights approval remains valid; no regeneration or repeat approval.

The owner requests transfer through the existing GitHub connection and does not have another ZIP. [Current autonomous transfer and restart instructions](../docs/p5/integration-20261017/README.md) replace the manual-upload request. The private serial bridge exposes only a short-lived single-object upload capability via a private one-day artifact, receives a text-only acknowledgement through the connector, verifies both envelope and original archive bytes, and attaches the approved archive to the existing private draft release. General GitHub/runtime tokens stay in the isolated runner. No media is added to Git; no new service, production profile or payment.

Parent `c0f10126db2da1506d377ce34476988f877fe2c8` passed all seven workflows and both P5 artifact checks (74 references total), with real M01 explicitly skipped for missing input. This descendant requires its own evidence. The exact current-HEAD checks, source-bound acceptance artifact and PR #5 determine actual transfer/import status. Preparation never counts as upload or real test execution.

Private transfer completed on `d1f3795`: release asset `[private identifier omitted]` has the exact approved checksum and size; the isolated input job independently downloaded and verified it. [Transfer receipt](../docs/p5/integration-20261017/transfer-receipt.json). Reruns reuse this asset; do not ask for or upload another ZIP. This proves private transfer, not real import.

Real integration must verify 420 approved WAVs + 30 SVG drafts, replay, immutable versions, restart and all 420 original audio deliveries through two disposable EN/CS test publications. Test fixture permission rows do not assert new human/visual/production approval. OD-004, OD-006, visual QA and remaining applicable compound requirements remain open; P5 stays NOT_READY, with no merge/P6.

## Recovery and ingestion checkpoint — 2026-10-15

Recovery baseline `b53ef44ef6a8389b9680586817c101008e186027` had seven successful checks and zero committed M01 WAVs. The interrupted operation left 41 historical blob receipts, no new commit. All 420 approved WAVs were reverified against immutable records; the acoustic pilot covers 402 single-turn files, with 18 verified dialogue files outside that pilot. See [recovery, byte evidence and exact next command](../docs/p5/integration-20261015/README.md).

P5 now has an explicit PostgreSQL/S3 importer/replay/restart test route and a checksum-bound external archive staging route. Synthetic CI results must never be reported as real M01 ingestion. Actual M01 PostgreSQL/S3 execution requires the approved external bytes in a permitted runtime: this editor's process/network controls prevented local execution, and hosted CI has no configured input established here. The exact current commit's check runs and acceptance artifact in PR #5 determine CI status; parent PASS is not substituted.

The 2026-10-14 quality, six-voice and audio-rights approval is retained. No regeneration or repeat approval. Large media stays external, with S3-compatible development/test scope only. OD-004 and OD-006 remain OPEN. Visual QA and applicable compound requirements remain open. PR #5 stays OPEN DRAFT; no merge and no P6.

## Current owner approval — 2026-10-14

The owner's **“Затверджено”** at 2026-10-14T13:12:30+03:00 accepts linguistic quality, the final six voices and audio rights for all 420 files in the delivered complete batch. [owner-approval.json](../docs/p5/m01-completion-20261014/owner-approval.json) binds source `e213a3f0a6c9f89fae955c8f48a8931ecb447e62`, dataset, exact ZIP/HTML hashes and saved versions. Do not ask for those decisions again or treat retained ASR flags as a fresh owner-approval blocker. Do not manufacture individual listening-form feedback from the direct statement.

All seven workflows/check runs passed on that approved source; both P5 archives and all 30 acceptance references per run were independently verified and recorded in PR #5. P5 technical exit conditions remain: integrate approved audio and remaining visuals into the publication registry/delivery path; settle OD-004; calibrate usable real-provider speech under OD-006; verify remaining applicable compound requirements. P6 is still not authorized. Historical PENDING/403/incomplete-audio statements below describe earlier states.

## Completed M01 generation — 2026-10-14

The pinned PyTorch URL is now HTTP 200; all 67 locked dependency/model files were downloaded or restored and SHA-256 verified. The exact 58-package environment was installed offline. The 97 Pocket turns have been reconstructed with the unchanged generator, text, cast, seed and processing plan, yielding all **204 previously missing Czech assets / 420 total final WAVs**. The original 216 final files remain byte-identical. The prior temporary 2026-10-13 full run was lost before retention; its reported results are not reused as evidence. The pre-generation infrastructure reconstruction plan documents this explicitly.

A durable checkpoint retains all 291 new raw/normal/slow WAVs and journals: [private review-file identity omitted], version 0, SHA-256 [digest retained in the original record]. Three stale STARTED journals were recovered by exact re-derivation of processed audio from retained raw bytes, with the original records kept and no repeated synthesis or invented completion time. A stale assembly marker is retained with a separate proof that every final PCM stream and cue matches its validated source.

Current completion evidence and commands are in [the completion record](../docs/p5/m01-completion-20261014/README.md). Automated ASR discrepancy flags are diagnostics, not human pronunciation approval. M01 audio quality, final cast and audio rights are now owner-approved. Delivery/publication integration, visual QA and OD-004/006 remain open. New exact-source CI belongs in PR metadata and immutable artifacts; the historical sections below describe predecessor states, including resolved dependency failures.

## Historical M01 continuation assembly — 2026-10-13

The [M01 continuation tool](../docs/p5/m01-continuation.md) validates the retained partial batch and selects exactly 97 unattempted Pocket turns / 204 absent Czech assets. After a separately completed original-generator run, it copies the 216 old final WAVs unchanged and assembles missing files, including mixed old/new dialogues, into a separate directory. It rejects changed inputs, retries, incomplete/extra attempts, path escapes and output overwrite. Existing hash-bound generator/export/verifier files remain unchanged. New audio still needs blind ASR and review; no synthesis occurred in this change.

The original saved ZIP was restored and its SHA-256 matched; all 532 WAVs passed the existing full-byte verifier. The new plan was run against those bytes. Eleven synthetic-tone stdlib tests passed locally. Hosted CI adds those tests and metadata planning, with 27 acceptance references; its result must be checked on this new source. The locked PyTorch wheel still returned HTTP 403 on 2026-10-13, so real new generation remains blocked. Human/rights/publication gates and trace statuses are unchanged.

Parent `69a0cf64a9ae4a22a6ebcb0084ca9a2c734c74af` completed the ingestion correction: all seven checks PASS, including P5 PR run 38269835842 and push run 38269828802. Final evidence for the continuation change belongs in PR metadata and immutable CI artifacts, without an evidence-only descendant commit.

## Completed media ingestion integrity correction — 2026-10-12

The [ingestion replay correction](../docs/p5/media-ingestion-integrity.md) rejects same-length changed bytes under an original manifest on every request, including succeeded-job replay. SHA-256 is checked before database/storage access. The existing real-PostgreSQL `P5-MEDIA-JOB-001` gate now verifies rejection, unchanged job/version/audit rows and stored bytes, then a successful exact replay. No schema, dependency, provider or approval change.

A bounded local harness using the actual repository class and explicit schema/DB/store stubs reproduced parent acceptance and fixed rejection; TypeScript syntax checks passed. Full type checking and real PostgreSQL validation require this source's hosted CI. Final results belong in PR metadata and immutable artifacts.

Completed predecessor `ec76bdaa8786c5e7625fcd572e0c5d37854edafe`, tree `c5a4ad440392f723283ca8ee0fe90bf409f7db12`: all seven workflows PASS, P5 PR run 38258943462 / push 38258938828. Both archive digests and all 25 acceptance references were independently verified, including ten feedback tests and five M01 browser tests. The delivered HTML and audio remain unchanged.

## Completed feedback intake follow-up — 2026-10-12

The [M01 feedback intake command](../docs/p5/m01-feedback-intake.md) validates the existing review form's JSON against the trusted 216-file audio bindings and creates a private follow-up report. It separates problem/uncertain/unreviewed/no-issue self-reports from the 204 missing files, ignores claimed completion and retains all approval gates. Ten stdlib tests use artificial notes; a fifth browser test connects a real fixture export to the command. No actual human feedback is received or invented. No HTML/audio regeneration, application dependency, provider, schema, publication or trace change.

Local stdlib tests PASS on a verified source subset; no local full-project/browser execution is claimed. This new source requires its own hosted checks and 25 acceptance hash references. Final exact-source results belong in PR metadata and immutable CI artifacts.

Completed predecessor `38ca31f0dcda7ac267893a4eb81b93a398624611`, tree `eae8f7d67d2fc2db4b26dd9716c5f0477583165b`: all seven workflows PASS, P5 PR run 38212383183 / push 38212379535. Both archive digests and all 22 acceptance references were independently verified. The saved HTML identity is [private review-file identity omitted] (version 0), SHA-256 [digest retained in the original record]. Its unchanged form remains compatible with intake; browser validation covered four audition fixtures, and separate local byte validation covered all 216 real M01 recordings.

## Completed M01 authoring/review predecessors

Historical follow-up: [offline M01 reviewer](../docs/p5/m01-listening-review.md) for 216 unchanged draft files in 108 normal/slow pairs, with 204 missing slots shown separately. Per-file notes/progress, language/type/search/ASR filters, measured dialogue cue seeking and guarded JSON export/import prepare human QA. No human feedback or approvals are fabricated. Local byte verification covers every embedded M01 WAV; hosted browser tests use four existing audition WAVs under explicit UI_TEST_FIXTURE scope, plus a real 420-slot metadata catalog. The attempted local browser download failed; no local browser playback claim. This source requires its own CI.

Completed predecessor `785fff956f7b7c5c017921d96103f7a0ae8f8d44`, tree `559f0fb33ffd00d18cfc3e836ba4f12d4a50b447`, passed all seven workflows. P5 PR run 38201972415 / push 38201967566; both archive digests and all 17 acceptance references verified. The saved audio ZIP has 216 final files and 532 retained WAVs. Same pinned PyTorch URL still returned 403 on 2026-10-12. Final results for this follow-up belong in PR metadata and CI artifacts, without an evidence-only descendant cycle.

The owner delegated working choices on 2026-10-11. Working cast: Maya A, Daniel B, Alex C; Klára C, Adam A, Oksana B. Original capitalization is retained. **104 unique Piper turns / 216 final draft files** are complete, with 216 blind ASR screens and 109 discrepancy flags; human review remains PENDING. The remaining 97 Pocket turns / 204 files are blocked by HTTP 403 for pinned PyTorch. Approved publication assets remain 0.

The saved audio ZIP and all 532 WAV hashes were locally verified. The authoring record includes the initial native telemetry auto-review rejection, kernel-enforced offline continuation, two infrastructure replacements and one processing-journal repair without further synthesis. Exact scope, files and limitations: `docs/p5/m01-audio-draft-20261011/README.md`. CI checks metadata only for this external audio package and cannot claim byte-level audio QA. No application provider, dependency, schema, registry publication or trace-status change.

Latest completed predecessor evidence is source `411493f095345bee3d018556c8c25f8b5698a4dc`, tree `7194729547f5fea81de1c39c6b2b73aeb1d49b3c`: all seven workflows PASS. P5 PR run 38129696671 / push 38129694015; both archive digests, all 16 acceptance references and all 18 worksheet playback clocks/hashes verified. This M01 follow-up requires its own hosted checks; final unchanged-source results belong in PR metadata and CI artifacts.

## Exact-source runtime evidence

Latest verified complete source: `6cdc635b55da0a8d38cd94a9b14d48f80640942e`, tree `39dbf682ae90ff162a13abf75d02feec3d4b3365`. All seven workflows passed. P5 PR run 38112197835 / job 114389895234; push run 38112195591 / job 114389887420. Both archive digests, all thirteen acceptance references and all original/Pocket/paired/held-out audio validators were independently verified. Both new batch validators report 20 raw turns, eight clips and fourteen ASR bindings per batch, a clean checkout and no inference during CI. Runtime PASS; milestone NOT_READY; human listening PENDING. Machine-readable record: `docs/p5/evidence/ci-case-20261011.json`.

Historical follow-up: an offline human-review worksheet with eight masked X/Y comparisons and two Czech A anchors. It embeds the same 18 unchanged WAVs, accepts timestamped notes/preferences, and exports/restores audio-bound feedback without approving voices. Three new browser checks exercise playback and the feedback workflow; the P5 acceptance summary binds their reports. See `docs/p5/listening-review.md`. This source needs its own hosted run; final current-source results belong in immutable CI artifacts and PR metadata.

Historical predecessor evidence follows.

Last inspected full runtime PASS: `c21a2a0aa65924c091a7c464094ff3de4aa2c2ee`, tree `bdd794e7b883e423eb625dfce3f6e1bd03bf6219`. All seven hosted workflows passed. P5 PR run 38049540964 / job 114205709344; push run 38049537327 / job 114205699606. Both final artifact archives were downloaded and verified against their SHA-256 digests; their acceptance summaries bind twelve runtime reports and the repository requirement-evidence hash to the exact tested source.

PR artifact 11669156689 SHA-256 [digest retained in the original record]; push artifact 11668981926 SHA-256 [digest retained in the original record]. Exact final results remain in PR metadata and immutable workflow artifacts.

Executed there: frozen install; baseline 76/76; 54 unit + 4 smoke; audit zero findings; reference/flag checks; signed-S3 restart/immutable bytes/outage; PostgreSQL 18.6 and six migrations with clean/replay/seed/reseed/recreation/isolation; 16 integration and 17 Chromium cases; four OCI build/start/health/DB-outage/recovery gates. No failed or skipped tests.

P5-DEP-002 is resolved at that source by sharp 0.35.5 and libvips 1.3.4 within Next 16.3.8's existing range. The failed parent audit is preserved in `docs/p5/evidence/ci-pocket-audit-failure.json`; local remediation evidence is in `sharp-patch-validation.json`. P5-DEP-001 was resolved at historical source `81e6ddac` by compatible proxy-addr 2.0.8 / source-map-js 1.2.2 patches; historical full runtime evidence is in `ci-batch-013.json`. No audit waiver or suppression.

**A parent PASS does not certify a later source.** Current PR checks and `artifacts/p5/acceptance-summary.json` bind runtime results to checked-out HEAD. Separate audition validators bind retained bytes/provenance to the same SHA. Final immutable CI artifacts and PR metadata record the result; do not create an endless evidence-only descendant cycle to record a commit's own SHA.

## Retained auditions and the new controlled comparison

OD-005 authorizes bounded local audition from project-authored text, with zero paid inference, no learner data, no uploaded person's voice reference, no production adoption and no cast/publication approval. The original eight Piper WAVs and 2026-10-09 Pocket batch remain unchanged. The earlier Pocket recovery boundary, including missing historical generation/ASR scripts, remains documented in `docs/p5/voice-audition/pocket-20261009/recovery.json`.

The 2026-10-10 paired case trial used the same pinned Pocket Czech weights, all 58 isolated dependency versions, existing synthetic Piper EN A/C references, paired seeds and authored M01 Czech text. It explicitly disabled automatic capitalization for the lowercase condition. Twenty initial turns, no retries: ASR edits per ten words improve B normal/slow 5→3 / 5→4 and C 4→1 / 3→2.

A separately predeclared twenty-turn check used five disjoint authored phrases. Every pair ties at 1/13 edits: the strict held-out improvement criterion is NOT MET. No more seeds or parameter tuning. Total: **40 raw turns, 16 normal/slow PCM16 clips, 28 fresh ASR bindings, zero generation failures or paid calls**. All planned conditions, final prepared text/token IDs, source/model/tooling provenance, actual scripts and execution logs are retained:
- `docs/p5/voice-audition/pocket-case-20261010/README.md`
- `docs/p5/voice-audition/pocket-case-holdout-20261010/README.md`

ASR is a fallible discrepancy screen, not a human pronunciation judgment. Initial controls have equal frame counts but are not bit-identical to historical synthesis (maximum PCM16 deltas B=4, C=55). Fresh ASR of unchanged historical C slow audio gives four edits; its archived screen had three. Historical bytes/reports are not overwritten.

Both candidates remain **HOLD_FOR_REVIEW**; human Czech listening/linguistic review is **PENDING**. The initial improvement does not establish a reliable normalization policy or approved cast. These are synthetic-reference Pocket voices, not reference-free MOSS-designed voices. The self-contained comparison document contains sixteen new clips and two unchanged Czech A anchors. All eighteen embedded WAVs and archive entries were verified. Chromium installation failed locally, so browser playback/rendering is not claimed.

## Recovery, authorization and upload boundary

The new archive [private review archive] was successfully saved for review. SHA-256 [digest retained in the original record]; all 98 entry hashes matched on restoration on 2026-10-11. All 77 new repository files, including the complete generation/ASR scripts and 56 WAVs, were restored byte-for-byte. Twenty shared base files also matched. No inference or ASR was repeated. Prior local commits and unsaved handoff/workflow edits did not survive; the CI step and current handoff are reconstructed explicitly. `docs/p5/evidence/case-recovery.json` records this boundary and the prior blob identities.

Automatic approval review stopped the earlier upload after 35 unreferenced blobs because the visible messages did not explicitly authorize this new payload/destination. No tree, remote commit or branch ref was created then. The concrete permission request named all 56 WAVs, accompanying changes, private `PV007PV007/Lingvessa`, `implementation/p5-media-speech`, PR #5 and exact-source CI. The owner responded **“продовжуй” on 2026-10-11**, authorizing completion of that request. Repository owner/private visibility/push permission and unchanged remote head `c21a2a0a` were reverified. Exact scope: `docs/p5/evidence/case-upload-authorization.json`.

That upload completed: all 56 WAV identities and the full 81-file change tree matched locally verified bytes; the branch advanced from the expected c21a2a0a head to 6cdc635b. P5 CI ran both new stdlib validators with bytecode writes disabled and all seven workflows passed. Inference never runs in CI. PR remains OPEN DRAFT; merge, cast acceptance, publication and P6 are not authorized.

## Scope and phase gates

IMP-P5-001/002/003 remain IN_PROGRESS. Trace is unchanged: 356 source rows, **174 PASS / 30 PARTIAL / 152 PENDING**. No requirement is promoted or waived by audition or green CI. No contract, schema, API, migration, direct application dependency or production provider change. Full phase inventory: `docs/p5/evidence/changed-files.json`.

Plan v1.4 §12 p7 requires all M01 required asset IDs to resolve. Prepared: 18 original SVG drafts, 12 flag drafts, 168 scripts / 420 audio slots and six voice profiles. **Approved publication assets = 0.** Complete approved cast/rights, full media generation and human linguistic/semantic/accessibility/publication QA remain open.

OD-004 delivery profile OPEN. Final audio tooling/cast/generation and audio rights were approved on 2026-10-14; older audition records below/above remain historical. OD-006 usable real-provider speech calibration OPEN; default stays neutral `speech_unavailable`. Paid inference=false; monthly paid budget=0. No P6/P7/P8 runtime starts. EXC-P1-001 remains: main lacks technical branch protection; implementation branch, PR, CI and owner review apply.

Next: apply the remaining-gate plan linked above. The real corpus run is complete on 460aab0; subsequent revisions reuse the private asset automatically for exact-source CI. Do not restart old missing-audio work.
