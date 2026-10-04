# P5 exit evidence

Status: **IN PROGRESS / NOT READY**. PR #5 OPEN DRAFT. P6 not authorized.

## Exact verified source

`79c3b4235327eb6ce289288bfcc7e051a20fb5d0` passed both P5 pull_request run **37190822511** (job **111402428729**) and push run **37190818959**. Independent P1–P4 regression runs also succeeded. `evidence/ci-batch-009.json` records directly inspected logs/steps, artifact metadata and exact commands. PR artifact **11299371096**, SHA-256 `53bdc7ac05a053f174e2c6d258ffb8bae1b0b5fecadb4820350b7eaa086b0194`.

The revision adding this reconciliation must pass its own workflow. `tools/p5/acceptance-summary.ts` binds all P5 reports, regression summaries and container evidence to that revision's exact GitHub head; the produced `artifacts/p5/acceptance-summary.json` is the final current-source result. The historical SHA above is not reused as proof of an untested descendant. Runtime PASS does not imply milestone PASS or P6 authorization.

## Executed gates

| Gate | Observed result at exact source above |
| --- | --- |
| Frozen install, baseline, full check | PASS; baseline 74/74, 50 unit, 4 smoke |
| Dependency audit | PASS; zero known findings |
| Reference manifests and flags | PASS structural/reproducibility; no publication approval |
| PostgreSQL | 18.6; all six migrations, clean DB, migration replay, bilingual seed/reseed, recreation, isolation negatives PASS |
| P5 runtime contracts | 3 S3 + 8 media + 4 audio + 12 speech gates PASS |
| Integration | 16 tests, zero failures/skips |
| Real Chromium | 17 cases: P3 4; P4 2; audio/flags 9; microphone speech 2; zero failures/skips |
| OCI | API/worker/web/admin build/start ready; DB outage => API/worker 503, liveness 200; recovery => ready 200 |
| P1–P4 regression | All separate hosted PR workflows PASS |

The quota final-item expectation is fixed and P5-SPEECH-011 now passes with no domain contract change. Cancellation/poll/cleanup stay available under transport quota; replay consumes no new processing slot or evidence. Exact turn UUID identity and all seven normalized flag geometries passed.

## Remaining exit conditions

Plan v1.4 §12 p7: **all M01 required asset IDs resolve**. Available drafts: 18 original SVGs + 12 flags, 168 scripts / 420 audio slots, six unapproved voice profiles. Actual reference audio bytes, measured duration/loudness/turn alignment, approved cast/licences and human linguistic/semantic/accessibility/publication QA remain incomplete. Approved assets = 0. Test tones and synthetic evaluation are not a substitute.

Existing OD-004 storage profile and OD-005 media-provider/licence/voice decisions need completion before media integration/production. OD-006 controls calibrated real speech before usable provider evidence; default unavailable remains neutral. Reviewable inputs are in `owner-decision-inputs.md`. No architecture or paid-budget change is proposed.

Trace: **174 PASS / 30 PARTIAL / 152 PENDING** out of 356 unchanged source rows. Actual-code/gate/exact-source linkage is validated; remaining whole/compound clauses are not waived. Later AI/Admin/PWA/bulk behavior is not implemented early.

BLOCKER: none established in inspected runtime/contracts. IMPORTANT: M01 media/QA and remaining clause closure; latest reconciliation needs its own exact-source CI. MINOR: inherited Actions Node and Argon2id warnings. EXC-P1-001 retained: main has operational controls, no technical branch protection. No merge; no P6.
