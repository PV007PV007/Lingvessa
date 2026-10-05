# P5 exit evidence

Status: **IN PROGRESS / NOT READY**. PR #5 OPEN DRAFT. P6 not authorized.

## Verified runtime source

`b88ba697c375237101e4f73b5fe05ddd17fa54cc` passed P5 pull_request run **37205262216** / job **111445024433** and push run **37205259219** / job **111445065989**, plus separate P1–P4 PR regression. `evidence/ci-batch-011.json` records actual logs, step conclusions, artifact metadata and exact commands. PR artifact **11303949327**, SHA-256 `45f96e04697ebe14de9351771d9ca92db06674f26ef4a3e0ab760ee78e3da602`; archive and all 12 referenced runtime report hashes independently verified after download.

Each later revision must pass its own workflow. `artifacts/p5/acceptance-summary.json` binds the current run to checked-out HEAD and includes all report hashes; a prior recorded PASS is not a PASS for an untested descendant. Runtime PASS does not authorize a merge, milestone acceptance or P6.

| Gate | Executed result |
| --- | --- |
| Frozen install / baseline / full check | PASS; baseline 76/76, 54 unit, 4 smoke |
| Dependency audit | PASS; zero known findings |
| Reference media/flags | PASS structural and source-geometry checks; no publication approval |
| PostgreSQL | 18.6; six migrations, clean DB, replay, bilingual seed/reseed, recreation and isolation negatives PASS |
| P5 contracts | 3 S3 + 8 media + 4 audio + 12 speech gates PASS |
| Integration | 16 tests, zero failures/skips |
| Chromium | 17 cases: P3 4, P4 2, P5 audio/flags 9, speech 2; zero failures/skips |
| OCI | Four images build/start/ready; DB outage => API/worker 503, liveness 200; recovery => ready 200 |
| Historical regression | P1–P4 hosted PR workflows all PASS |

The S3 startup race from source 506a6a28 is **RESOLVED**. Actual signed-S3 readiness now runs at initial startup and restart, while wrong credentials/other HTTP errors and real outage failures are not masked. The earlier quota final-item test error is also resolved without a domain contract change. Historical failed reports are retained.

## Open exit conditions

Plan v1.4 §12 p7: **all M01 required asset IDs resolve**. Drafts: 18 original SVGs, 12 flags, 168 scripts / 420 audio slots, six voice profiles. Actual reference speech bytes, measured timing/loudness, approved voice/provenance records and human linguistic/semantic/accessibility/publication QA remain incomplete; approved assets = 0. Synthetic tones and evaluators are not reference content or production calibration.

OD-004/005 integration decisions remain open; concrete candidate inputs are in `owner-decision-inputs.md`. OD-006 governs usable real-provider evidence; default unapproved scoring remains neutral/unavailable. No paid inference, AI runtime or production provider is activated by this batch.

Trace: **174 PASS / 30 PARTIAL / 152 PENDING** of 356 unchanged source rows. Whole/compound source clauses with future dependencies are not waived or implemented early. No code/schema/API/migration change in this evidence reconciliation.

BLOCKER: none established in verified runtime/contracts. IMPORTANT: M01 media/QA and remaining requirement closure. MINOR: inherited Actions Node and Argon2id warnings. EXC-P1-001: operational branch controls only; no technical branch protection. Keep PR #5 open; no P6.
