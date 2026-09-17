# P3 exit evidence

Status: **NOT READY — final browser and exact-commit hosted acceptance pending**

Accepted parent: `df07f9a15838c99da1ea8c876a8b6262057b0354`; tag `p2-accepted-2026-09-16`.
Branch: `implementation/p3-lesson-engine`. PR #3 OPEN DRAFT.
Latest tested checkpoint: `92ff200fb50aad65c899cc52b1060df4a86f5f56`.

P1 PR CI 35175662789 and P2 PR CI 35175662796: SUCCESS. Real PostgreSQL migration/seed/recreation, P3 server integration and four-image OCI build/ready/degraded/recovery executed in regression workflows. Local/hosted check: 35 unit and 4 smoke PASS.

P3 PR CI 35175662938: FAILED before browser login due to proxy Origin/Host mismatch. Later steps in this failed workflow were not passed. The corrective batch fixes the verified cause, adds regression assertions, additional DB negatives and exact-SHA artifact validation. Runtime rerun pending.

All 165 P3 planning rows are traced. Later-phase obligations are explicitly retained in scoped requirement evidence; no claim of P4/P5/P8/P9 completion. No governing contract or accepted migration changed.

BLOCKER: none requiring owner decision. IMPORTANT: complete browser/final-SHA hosted gates pending. MINOR: inherited Actions Node warning and experimental pinned Argon2id.

EXC-P1-001: main is NOT technically protected; owner-approved PR/green-CI process remains. P4 is not authorized or implemented. Next action: execute corrective CI, prepare final evidence, retain PR open for owner review.

Corrective checkpoint `2cefaed9f07aea6f2cd5004e895962fdb73f9c19`, run 35207465061: real DB negative tests and server core gates PASS. Browser test setup omitted mandatory custom header; test corrected, full rerun pending.

Checkpoint `5ac7f53053c42945dc54c8583a17d1333fabd6b2`: all P3 runtime gates passed in run 35208020418 (35 unit / 4 smoke / 12 integration / 4 Chromium journeys / 15 P3 DB groups / four OCI images and recovery). Final artifact attestation failed only on browser-results.json path. Reporter path corrected in this batch; full workflow remains pending until the attestation executes successfully.
