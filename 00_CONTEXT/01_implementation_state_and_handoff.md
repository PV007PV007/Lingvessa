# Lingvessa implementation state and handoff

Timestamp: 2026-09-16T11:31:00Z

P0/P1/P2: OWNER ACCEPTED. P3: AUTHORIZED, IN PROGRESS / NOT READY. P4: NOT AUTHORIZED / NOT STARTED.

## Authority and accepted source

GitHub PV007PV007/Lingvessa main/history is the implementation source of truth. P2 PR #2 was merged with merge commit `df07f9a15838c99da1ea8c876a8b6262057b0354`. Tag `p2-accepted-2026-09-16` and published P2 accepted prerelease point to that merge. The architecture manifest and seven owner-locked governing PDFs are unchanged; Implementation Plan v1.4 is the sole execution-order authority.

Branch: `implementation/p3-lesson-engine`, created from accepted P2. Remote checkpoint: `a43734ca8570c0b47f304c4e168efe5e27ca44e0`; PR #3 OPEN DRAFT. Local mirror baseline is not claimed as a hosted tested commit. Final tested SHA will be taken from the required hosted checks of the final branch head.

## Current implementation batch

Task IDs: IMP-P3-001, IMP-P3-002, IMP-P3-003, IMP-P3-004. All 165 assigned trace rows are retained in docs/p3/requirement-evidence.json (162 MUST, 3 SHOULD); runtime verification is pending.

Added: P3 activity schemas/registry/evaluators/state reducer, API/client, additive PostgreSQL migration and run/attempt/raw-evidence/outbox repositories, synthetic EN/CS fixtures, unit/integration tests, workflow and docs/p3 evidence records. Modified: P2 schema exports, API/worker wiring, Prisma schema, validation scripts/package script. Full changed-file inventory will be regenerated at closure. No governing document or accepted migration changed.

Schema: migration `202609160001_p3_lesson_engine` creates lesson_runs, lesson_run_items, activity_attempts, immutable raw evidence_events, attempt_receipts, outbox_events and outbox_deliveries. P4 mastery/Review projections remain absent. API: /api/v1/lesson-runs, resume, attempts and explicit remediation exit. No contract change; implementation follows approved pinned publications and server-authoritative scoring.

## Validation executed and remaining

- pnpm install --frozen-lockfile: PASS.
- pnpm db:generate; pnpm db:validate; pnpm lint; pnpm typecheck: PASS before current corrective batch, rerun pending.
- pnpm test: 29/29 PASS before corrective batch; new negative cases added, rerun pending.
- pnpm validate:baseline: 39/39 PASS before current batch.
- pnpm validate:references: EN/CS synthetic P2 and P3 PASS.
- pnpm check at first checkpoint: PASS (29 unit, 4 smoke); negative dependency fixture cleanup corrected. Current batch adds browser UI, public response schemas, full core-family fixtures and tests; final rerun pending.
- pnpm bootstrap:local: could not execute; local host lacks Docker/PostgreSQL. No local PostgreSQL runtime PASS claimed. Real migrations/integration/container tests will run in hosted CI.
- Hosted checkpoint a43734c: install/baseline/check/reference/audit/bootstrap PASS; integration FAILED (old P1 migration-count assertion and P3 test-database name refused by the local-only allowlist). Both causes corrected in the current batch; hosted rerun pending. OCI was SKIPPED at this checkpoint, not passed.

BLOCKER: no architectural contradiction identified. P3 acceptance remains NOT READY until actual runtime and full local/hosted gates pass.
IMPORTANT: LessonPlayer UI and complete core-family fixture coverage still in progress; current tests do not establish full P3 acceptance.
MINOR: existing GitHub Actions Node warning and experimental pinned Argon2id remain inherited technical debt.

Operational exception EXC-P1-001 remains: main is not technically protected; implementation branches → PR → green CI → owner review. Open owner decisions: none blocking current P3 work.

Exact next task: finish IMP-P3-001/003 renderer and state implementation, verify P3 lineage/transaction/replay tests, push P3 branch and inspect actual hosted logs. Keep P3 PR open; do not merge or start P4.
