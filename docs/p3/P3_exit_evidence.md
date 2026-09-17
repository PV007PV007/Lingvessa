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
