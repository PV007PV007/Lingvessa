# P5 exit evidence

Status: **IN PROGRESS / NOT READY**. PR #5 OPEN DRAFT. P6 not authorized.

## Verified runtime source

`23257497db6cf29497f51d6e5b2476f97e3c7c43` passed P5 pull_request run **37329468148** / job **111828570951**, push run **37329449848** / job **111828507205**, and separate P1–P4 regression. `evidence/ci-batch-012.json` records actual logs, steps, artifact metadata and commands. PR artifact **11354426744** SHA-256 `f26bfbf6c63edb73dc29c058b2e263dee9c4517747b382f1d68b444b0eb50844`: downloaded archive, all 12 runtime report hashes and repository requirement-evidence hash verified.

Each later revision must pass its own workflow. `artifacts/p5/acceptance-summary.json` binds the current run to checked-out HEAD and report hashes; prior PASS never certifies an untested descendant. Runtime PASS does not authorize merge, milestone acceptance or P6. The audition batch additionally requires the hosted voice-audition validation step and artifact.

| Gate | Executed result on the recorded hosted source |
| --- | --- |
| Frozen install / baseline / full check | PASS; baseline 76/76, 54 unit, 4 smoke |
| Dependency audit | PASS; zero findings |
| Reference media/flags | PASS structural/source-geometry checks; no publication approval |
| PostgreSQL | 18.6; six migrations, clean DB/replay/seed/reseed/recreation/isolation PASS |
| P5 contracts | 3 S3 + 8 media + 4 audio + 12 speech gates PASS |
| Integration | 16 tests; zero failures/skips |
| Chromium | 17 cases: P3 4, P4 2, P5 audio/flags 9, speech 2; zero failures/skips |
| OCI | Four images build/start/ready; DB outage => API/worker 503, liveness 200; recovery => ready 200 |
| Historical regression | All P1–P4 hosted PR workflows PASS |

Historical S3 startup race and quota final-item expectation are resolved; original reports retained. No domain contract change.

## Authorized local audition — actual output

OD-005 bounded experiment explicitly authorized 2026-10-05. `voice-audition/authorization.json`, `results.json`, model/tooling locks and eight PCM WAVs provide actual local CPU synthesis evidence. Three English preset candidates and one Czech candidate have normal/slow pairs. Pinned authored M01 scripts/UUIDs, model/speaker identity, checksums, duration, loudness and no-clipping metrics are retained. `python3 tools/p5/voice-audition.py --verify-only`: PASS, 8 samples / 4 pairs. Exact local commands/results: `voice-audition/local-validation.json`. Human listening review PENDING; complete cast NOT approved; two Czech voices missing. MOSS standard local path was resource-assessed, not executed. No paid/learner data/provider activation/publication.

## Hosted dependency-audit correction

Audition source `b1bebd29019872408cb6af4af382266ab0c76829` passed the new 8-WAV validator and full static/unit/build/smoke gates, then failed the required dependency audit in all seven workflows. Later PostgreSQL/browser/OCI gates were skipped and are not claimed. `evidence/ci-audition-audit-failure.json` retains the actual failure: GHSA-jqcg-44mw-7w3h and GHSA-68fv-2mgg-jv7q. Only existing transitive lock entries change: proxy-addr 2.0.7→2.0.8, source-map-js 1.2.1→1.2.2. No audit waiver/threshold change, new direct dependency or contract change. Local validation: `evidence/dependency-patch-validation.json`; the fixed revision requires its own green hosted checks. Its acceptance-summary.json is the exact final runtime evidence.

## Open exit conditions

Plan v1.4 §12 p7: **all M01 required asset IDs resolve**. Drafts: 18 original SVGs, 12 flags, 168 scripts / 420 audio slots, six voice profiles. Audition clips are review inputs outside the publication registry; they are not the required full M01 media set. Approved assets = 0. Full reference speech bytes, approved complete cast/rights/provenance and human linguistic/semantic/accessibility/publication QA remain open. Synthetic tones/evaluators are not reference content or calibration.

OD-004 delivery OPEN. OD-005 audition approved/executed, final cast/full generation OPEN. OD-006 usable real-provider calibration OPEN; default scoring neutral/unavailable. No paid inference, later AI foundation or P6 runtime is activated.

Trace unchanged: **174 PASS / 30 PARTIAL / 152 PENDING**, 356 source rows. Ten PARTIAL rows gain bounded audition evidence only; no whole clause is promoted or waived. No schema/API/migration change. The follow-up security remediation changes only the two existing transitive patch versions; no TTS dependency enters the application runtime.

BLOCKER: no governing contradiction; hosted audit remediation must pass on the new exact source before runtime PASS is claimed. IMPORTANT: actual M01 media/QA and remaining requirement closure. MINOR: inherited Actions Node, Argon2id and pg concurrent-client-query deprecations; no current failed check. EXC-P1-001: operational controls only, no technical main protection. Keep PR #5 OPEN DRAFT; no merge; no P6.
