# P5 exit evidence

Status: **IN PROGRESS / NOT READY** for owner acceptance. PR #5 OPEN DRAFT; no P6 work.

Latest verified remote source: `76aa3aedc12f31eada6e6320ec526a3fcda36cf9`. P5 run 36586379882 / job 109467720069 passed all required steps. `evidence/ci-batch-006.json` pins the artifact digest and exact source. 49 unit + 4 smoke + 16 integration tests, zero failures/skips; 10 actual Chromium tests including shared English/Czech microphone journeys. PostgreSQL 18.6, all six migrations, seed/recreation regression, actual S3 protocol/recovery and four OCI build/start/health/degraded/recovery gates passed. This is batch evidence, not complete M01 media or milestone acceptance.

The new batch adds exact avatar/character/version closure at publication, media-clock avatar UI and negative binding checks; atomic encrypted tmpfs writes; two additional speech gates for expiry/cleanup failure and lease/cancellation races; original reference SVG/script/voice specifications with reproducible metadata/checksums. Hosted execution for these new changes is pending. Local `pnpm check` (50 unit + 4 smoke), 74/74 baseline checks and draft media structural validation passed. No Docker/native PostgreSQL result is inferred from local WASM DDL diagnostics. See `evidence/local-batch-007.json`.

Reference media preparation: 18 original static vector drafts, 168 authored audio scripts, 420 normal/slow/full-dialogue/turn slots and 6 voice profiles have concrete UUIDs. Actual audio files and 12 flag slots remain unresolved; approved assets = 0. Source catalog and deterministic generator do not count as a published/approved M01 library. No production provider is enabled.

Remaining exit gates (Plan v1.4 §12 p7): every M01 required asset resolves; approved provenance/voices and semantic/linguistic/accessibility QA; every P5 trace row evaluated against its actual gate; final exact-source full hosted acceptance. OD-004 storage profile, OD-005 provider/licence/voice cast and OD-006 calibrated usable speech remain open with safe defaults.

BLOCKER: no new governing contradiction established. IMPORTANT: remaining media/owner decision/trace gates above prevent P5 acceptance. MINOR: inherited Actions Node warning and Node Argon2id experimental warning. EXC-P1-001 remains accepted: main is not technically protected.

No governing specification change; first four accepted migrations/locked sources unchanged. Paid inference false, monthly paid budget 0. No automatic PR merge or P6 advancement. Failed historical batch `88413869…` is retained in ci-batch-004; correction and later passes are explicit in ci-batch-005/006.
