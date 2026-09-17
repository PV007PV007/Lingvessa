# Lingvessa implementation state and handoff

Timestamp: 2026-09-17T09:51:09.772837+00:00

P0/P1/P2: OWNER ACCEPTED. P3: AUTHORIZED, IN PROGRESS / NOT READY. P4: NOT AUTHORIZED / NOT STARTED.

## Authority and accepted source

GitHub PV007PV007/Lingvessa main/history is the implementation source of truth. P2 PR #2 merge: `df07f9a15838c99da1ea8c876a8b6262057b0354`; accepted tag: `p2-accepted-2026-09-16`. Manifest and seven owner-locked governing PDFs are unchanged; Implementation Plan v1.4 remains the sole execution-order authority.

Branch: `implementation/p3-lesson-engine`. PR [#3](https://github.com/PV007PV007/Lingvessa/pull/3): OPEN DRAFT, not merged. Latest tested hosted checkpoint: `92ff200fb50aad65c899cc52b1060df4a86f5f56`. This handoff accompanies the next corrective commit; it does not claim that checkpoint tested these new changes. The final acceptance artifact must match the exact final branch HEAD.

## Current implementation batch

Tasks: IMP-P3-001 → IMP-P3-002 → IMP-P3-003 → IMP-P3-004. All 165 assigned trace rows retained (162 MUST, 3 SHOULD). Requirement evidence explicitly separates 93 implemented P3 rows, 48 partial foundations with later acceptance, and 24 later-runtime rows; none is claimed globally complete merely by phase assignment.

Changes in this batch: `apps/web/src/app/api/v1/[...segments]/route.ts` compares Origin to the actual Host; `apps/web/src/app/lesson/error.tsx` adds safe rendering recovery; `apps/web/src/lesson/player.tsx` distinguishes failed queue persistence from a saved pending answer; browser tests assert trusted/foreign Origin behavior and emit safe diagnostics; integration tests add direct database cross-owner/cross-language rejection cases; `tools/p3/acceptance-summary.ts` verifies exact tested SHA and every runtime artifact; P3 workflow invokes that summary; task/requirement/exit records updated. No deletions. Complete milestone inventory will be generated at closure.

P3 schema: additive `202609160001_p3_lesson_engine` creates lesson_runs, lesson_run_items, activity_attempts, evidence_events, attempt_receipts, outbox_events, outbox_deliveries. Composite language/ownership/publication FKs, immutable raw records and pins remain mandatory. API: start/list/resume run, submit attempt, remediation exit, session CSRF refresh. No contract change. No P4 mastery/Review, P5 speech/media jobs or P8/P9 AI runtime.

## Exact validation and results

- `pnpm install --frozen-lockfile`; `pnpm validate:baseline`; `pnpm check`; `pnpm validate:references`; `pnpm audit:dependencies`: hosted PASS at 92ff200 (35 unit, 4 smoke; 39 P3 baseline checks).
- `pnpm bootstrap:local`; `node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`; `pnpm test:containers`: hosted PASS in P1/P2 regression at 92ff200. PostgreSQL migration/seed/recreation and server P3 integration executed; four OCI services built and passed ready → DB unavailable/degraded → DB restored/recovery.
- P1 PR run 35175662789 / job 105056690928: SUCCESS. P2 PR run 35175662796 / job 105056691145: SUCCESS.
- P3 PR run 35175662938 / job 105056691787: FAILED in four browser journeys before login. Browser Origin 127.0.0.1 was compared to Next.js normalized localhost. Subsequent P3 recreation/OCI steps were not passed in that failed workflow.
- Corrective local diagnostic `LINGVESSA_ENV=local node ../debug-proxy.mjs`: same-origin request now reaches upstream 401; foreign localhost Origin receives 403. This stub diagnostic is not PostgreSQL/browser acceptance evidence.
- Corrective local `pnpm build:web`, `pnpm lint`, `pnpm typecheck`: PASS. New browser/DB assertions require the next hosted run.

## Risks and next task

BLOCKER: none requiring an owner decision. P3 is NOT READY until complete final hosted gates pass.
IMPORTANT: complete browser gate and final-SHA runtime rerun pending.
MINOR: inherited GitHub Actions Node warning; pinned Node Argon2id remains experimental. No dependency churn for warnings alone.

EXC-P1-001 retained: main is NOT technically protected; implementation branches → PR → green hosted CI → owner review. No direct push/force-push/delete of main. Open owner decisions: none blocking P3.

Exact next task: push this corrective batch, inspect real DB/browser/container results, fix concrete failures, then update closure evidence and run every required gate on the final branch commit. Keep PR #3 open. Do not merge or start P4.
