# P5 exit review and proposed transition scope — 2026-10-28

Current dependency follow-up (2026-10-28): [e9a8310 evidence](verified-ci-e9a8310.json) confirms seven workflows / eleven jobs, both real M01 runs and independent audits (46 references/report). The high/critical gate passed but reported one moderate qs advisory. [Bounded remediation](dependency-remediation.json) pins Express to the already present patched qs 6.16.1 and retains complete JSON audit evidence without lowering the gate. This successor requires its own full CI; final results belong in PR #5. Existing acceptance/production/P6 boundaries remain unchanged.

**P5 IN PROGRESS / NOT READY pending owner acceptance. PR #5 OPEN DRAFT; no merge; P6 not started.** The executed development/test criteria below support a concrete P5 acceptance review. This review does not approve production delivery, calibrated learner scoring, a published course, or an exception to a governing contract.

## Governing scope

The [Implementation Plan v1.4](../../../01_GOVERNING_DOCUMENTS/Lingvessa_Implementation_Plan.pdf) §12, p7 defines the P5 exit as resolved M01 asset identities and passing correct/mismatch/denial/low-confidence/provider-failure speech fixtures. Its blockers are live generation in a lesson, progress blocked by speech failure, and unintended raw-audio storage. The seven implementation bullets also require media jobs/versions/preflight, S3 integration, original media/provenance/alternatives, normal/slow playback, dialogue synchronization, microphone/reduced-motion UX and transient microphone bytes.

Plan §4.2, p4 makes production unnecessary for the reference implementation. §§13–14, p7 assign the complete English and Czech lessons/Recaps, objective/variant review and media binding to P6/P7. §15 assigns the full editorial publication workflow to P8. §24, p10 requires calibration before speech production rollout. ADR-D19 preserves this phase order. None of these statements makes unfinished full-course or production requirements PASS.

Earlier handoffs grouped production delivery, calibration and complete authored-course publication as unconditional P5 blockers. That grouping was broader than Plan §12. The corrected scope below retains the original trace assignments and open decisions. It does not reinterpret the 402 reference recordings as labelled learner-error calibration or waive an enabled feature's requirements.

## Executed evidence

[Verified source 9215dbb](verified-ci-9215dbb.json) passed all seven workflows / eleven jobs on attempt 1. Both P5 events independently passed real M01 import and artifact audits. This retained record proves that source only. The proposed revision must pass its own exact-HEAD workflows; final descendant evidence belongs in [PR #5](https://github.com/PV007PV007/Lingvessa/pull/5), without creating an untested evidence-only descendant.

| Plan §12 criterion | Executed evidence | Scope or limit |
| --- | --- | --- |
| Requirements, jobs, assets, immutable versions, bindings and preflight | Nine PostgreSQL media gates; exact replay, changed-byte/update/delete rejection, same-language/approval/version/accessibility guards | Disposable test publications; importer creates zero approvals |
| S3-compatible storage | Three SigV4 storage gates; real 450-version PostgreSQL/S3 import; server, adapter and DB-pool restart; every byte read back | Pinned disposable S3 test server; no chosen production provider/CDN |
| Prepared original images, avatars, vectors and audio with provenance/checksums/alternatives | 420 approved WAVs + 30 approved SVGs; exact records, scripts, six voices, six characters, transcripts and alt/decorative metadata | Audio owner approval 2026-10-14 and visual owner approval 2026-10-20 remain effective |
| Normal/slow and multi-speaker synchronization | 210 exact pairs; P5-AUDIO-DB-001/003 and P5-AUDIO-UI-001; media-clock/voice/avatar, pitch-preserving fallback, reload and failure text | Shared EN/CS fixtures; full lesson/objective review belongs to P6/P7 |
| Microphone permission, pulse and reduced motion | P5-SPEECH-008 real Chromium microphone/retry/Continue/reduced-motion paths in EN/CS | Controlled evaluator, not calibrated learner scoring |
| Correct, mismatch, denial, low confidence and provider failure; raw score hidden | P5-SPEECH-001 through 008 plus quota/lease/cancel/expiry gates; twelve speech gates total | Unavailable remains the default; no unapproved usable evidence |
| Transient raw microphone audio | Encrypted tmpfs, terminal deletion, 14-minute expiry, failed-cleanup/orphan/lease/cancel recovery; P5-SPEECH-005/009/010 and transient-store unit checks | No permanent audio/database/offline-queue retention or production rollout asserted |
| All M01 required asset IDs resolve | Exact catalog-to-library equality: 450 IDs/version/checksum pins, 210 pairs and same-language versioned voice/character/avatar closure | Asset readiness, not a claim that the four English/Czech lessons are already authored |
| No P5 blocker behavior | P5-MEDIA-BYTES-001 proves no generation in the lesson/publish path; speech failure/denial remains non-blocking; transient cleanup gates pass | Core fallback path remains available |
| en-GB/en-US/cs-CZ remain distinct | Exact-variety schema and negative scope checks; approved voice metadata; pinned transcript language and audio-policy checks | No silent variety mixing; meaningful authored-answer variants still require P6/P7 review |

Both events also passed authenticated HTTP delivery: 450 full reads, eight byte ranges, twenty negative responses including two outage 503s, and two recovery reads. Each passed 31 runtime gates and 28 browser cases in seven reports, without failures/skips/flakiness. All five P1–P4 regression workflows, dependency audit and four-container recovery checks passed.

The approved corpus is **210 EN + 210 CS = 420 WAVs**. The **402 single-turn acoustic results (202 EN / 200 CS) plus 18 dialogues (8 EN / 10 CS)** account for the complete final set. The 607 historical/intermediate WAVs in the original are excluded from transfer. Real WAV verification is distinct from controlled speech fixtures and synthetic importer tests.

## Clause review

The three atomic metadata rows N-REF-P24-T01-R03/R04/R09 now cite executed schema, immutable-record, actual-byte, PostgreSQL and playback evidence and become PASS. The change preserves every original source field and task/phase assignment.

N-REF-P24-T02-R03 becomes PARTIAL, with executed text/inline transcript, keyboard disclosure, audit-failure/retry, ownership/CSRF and immutable support-evidence subgates. Text is available before an answer in the current player; there is no first-attempt lock. A future hiding/accessibility-mode policy and each authored objective still require their own review. AUD-005 and the full publication/objective clauses remain PARTIAL. No new accessibility setting or policy is invented.

The trace is **178 PASS / 31 PARTIAL / 147 PENDING**, all 356 rows retained. Cross-milestone clauses retain their full-clause statuses: P6/P7 authored content and pedagogical accessibility, P8 editorial/Admin workflow, P9 optional AI, P10 settings/PWA/collections, P11 staging/restore/performance and P12/P13 calibration/rollout/production. Original P5 foundation assignments are unchanged; a phase boundary is not a blanket exemption or proof of those later behaviors.

## Concrete acceptance scope and remaining decisions

| Item | Current disposition | Before enabling it |
| --- | --- | --- |
| P5 milestone / transition | **Owner acceptance pending.** Proposed scope: accept the tested P5 media/speech foundation for development/reference work, retain the safe defaults below, and authorize the separate P6 English-reference task | Explicit phase acceptance/authorization; prior no-merge instruction remains active |
| OD-004 | **OPEN.** Existing owner permission covers development/test S3 ingestion and authenticated loopback HTTP delivery. The one-day final-WAV artifact is transport, not a CDN or durable production storage | Decide actual provider, region, origin/access policy, delivery/CDN, lifecycle/logging and budget before production integration/public service |
| OD-006 | **OPEN.** `SPEECH_EVALUATOR_MODE=unavailable` is the default. Local acoustic candidate and controlled policies remain evaluation/test scope | Approve labelled learner-error evaluation, language/variety/target thresholds and provider/model policy before usable learner scoring; later pilot refinement is not a substitute |
| Full reference lesson publication and objective accessibility | Not asserted complete. P6/P7 must bind the accepted assets and validate each actual objective/variant/text alternative | English/Czech vertical-slice acceptance, then P8 workflow/P11 reference freeze as ordered by the Plan |
| Historical cleanup | MINOR: 41 unreferenced Git-blob receipts and one unused unpublished draft remain untouched; binary retrievability is unproven | Optional deliberate cleanup only; neither is an ingestion or P6 dependency |

The requested transition is therefore concrete and reviewable without buying a service, uploading another ZIP, granting PC access, generating audio again, or selecting a production speech/storage policy. No user data or public registration/deployment is authorized by this review. The baseline open-decisions files and immutable approval records are not edited.

## Idempotent next action

Read branch `implementation/p5-media-speech` HEAD and its existing workflow attempts first. Verify the seven workflows, eleven jobs, both actual `verify-m01-s3-import.ts --real-m01` executions and downloaded artifacts on that exact source. Use the [existing recovery procedure](../public-test-input-20261026/README.md). Input receipts bind the attempt: an identified exit retry requires its same-attempt input job and dependent exit, never an old receipt or blind regeneration. Record final SHA/run/artifact digests in PR #5. After all checks pass, the remaining action is the owner's decision on the acceptance scope above; no merge or P6 implementation occurs automatically.
