# Lingvessa implementation state and handoff

Timestamp: 2026-09-17T15:19:42.836888+00:00

P0/P1/P2: OWNER ACCEPTED. P3: technical exit PASS — READY FOR OWNER ACCEPTANCE under the exact final-head gate below. P4: NOT AUTHORIZED / NOT STARTED.

## Source, branch and exact commit evidence

GitHub PV007PV007/Lingvessa main/history is authoritative. Accepted P2 merge `df07f9a15838c99da1ea8c876a8b6262057b0354`, tag `p2-accepted-2026-09-16`, PR #2 merged. Main remains that accepted merge.

Branch: `implementation/p3-lesson-engine`. PR [#3](https://github.com/PV007PV007/Lingvessa/pull/3): OPEN, not merged. Tested implementation checkpoint: `721341d8d8a2fddb93abe105398889da5f9faa22`. Its five hosted runs are green (links below). This closure metadata commit must pass the same five checks on its own exact SHA before delivery. The final full SHA is machine-recorded by `artifacts/p3/acceptance-summary.json:tested_sha`, asserted against checked-out HEAD, and reported in the PR/final delivery. The earlier checkpoint is not a substitute for final-head testing.

The architecture manifest, seven locked governing PDFs and Implementation Plan v1.4 execution authority are unchanged. No contract change.

## Tasks, requirements and files

IMP-P3-001 → IMP-P3-002 → IMP-P3-003 → IMP-P3-004 completed within P3 scope. Requirement IDs and source/page/task/code/gate mappings: `docs/p3/requirement-evidence.json`; 165 rows (162 MUST, 3 SHOULD), zero missing/duplicate IDs. 93 P3 requirements verified; 48 foundation slices verified with later residual acceptance; 24 future-runtime rows are deferred under the plan. The immutable P0 trace remains intact.

Full added/modified/deleted inventory: `docs/p3/evidence/changed-files.json`. Added activity command/public schemas, versioned registry/evaluators/state/presentation, lesson API/client and LessonPlayer, immutable persistence/outbox, synthetic fixtures and real DB/browser tests, workflow and P3 evidence. Modified shared P2 foundation wiring/schema, migration-count regression assertions, queue/auth support, worker, compose, package scripts/lock and validation. Deleted: none. No accepted migration was edited.

## Database, API and implementation

Migration: `202609160001_p3_lesson_engine`, additive and transactional. Tables: lesson_runs, lesson_run_items, activity_attempts, evidence_events, attempt_receipts, outbox_events, outbox_deliveries. Composite ownership/language/publication/version/item integrity, immutable pins/history, exact attempt replay and per-consumer delivery leases. No P4 projections or speech/AI tables.

API: POST/GET `/api/v1/lesson-runs`; GET `/api/v1/lesson-runs/{id}`; POST `/attempts` and `/exit` under that run; POST `/api/v1/auth/csrf`. Strict server-derived ownership/evaluation, CSRF, safe errors, separate learning quota, generated OpenAPI 3.1.2/typed clients. Full details: `docs/p3/evidence/schema-api-diff.json`.

EN/CS use one renderer/evaluator and immutable published fixture contracts. Reveal/assisted attempts never become independent success; server transaction writes attempt/evidence/receipt/run/outbox atomically. Reload and response-loss recovery replay the original attempt UUID; user-visible conflicts require recovery. The IndexedDB queue is owner-scoped, capped and time-bounded, with no credentials/audio. Outbox has bounded retry, terminal failure and stale-worker fencing.

## Exact commands and verified results

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm validate:baseline`: PASS.
- `pnpm check`: PASS.
- `pnpm validate:references`: PASS.
- `pnpm audit:dependencies`: PASS.
- `pnpm exec playwright install --with-deps chromium`: PASS.
- `pnpm bootstrap:local`: PASS.
- `P3_BROWSER_TESTS=true node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`: PASS.
- `pnpm test:containers`: PASS.
- `node --import tsx tools/p3/acceptance-summary.ts`: PASS.

Results: 39 baseline checks, 35 unit, 4 smoke, 12 integration tests; 15 P3 runtime groups, 4/4 Chromium journeys, 4 OCI images. DB schema introspection: 43 model names and exact scalar parity on seven new models. p95 deterministic attempt 14.282 ms / 20 real loopback DB samples; production load is outside this gate.

- [P2 data foundation / pull_request / 35208895544](https://github.com/PV007PV007/Lingvessa/actions/runs/35208895544): SUCCESS.
- [P1 foundation / pull_request / 35208895492](https://github.com/PV007PV007/Lingvessa/actions/runs/35208895492): SUCCESS.
- [P3 lesson engine / pull_request / 35208895558](https://github.com/PV007PV007/Lingvessa/actions/runs/35208895558): SUCCESS.
- [P1 foundation / push / 35208891443](https://github.com/PV007PV007/Lingvessa/actions/runs/35208891443): SUCCESS.
- [P3 lesson engine / push / 35208891439](https://github.com/PV007PV007/Lingvessa/actions/runs/35208891439): SUCCESS.

Validation/evidence locations: `docs/p3/P3_exit_evidence.md`, `docs/p3/evidence/hosted-ci.json`, `validation-index.json`, `verified-runtime-checkpoint.json`, `schema-introspection.json`, plus generated final-head CI artifacts. Local host lacks Docker/PostgreSQL/Chromium; hosted runtime was actually executed, not inferred from local preparation.

## Findings, operational limitation and hard stop

BLOCKER: none. IMPORTANT: none once the required final-head checks are green. MINOR: existing Actions Node deprecation notices and experimental patch-pinned Argon2id. Earlier browser/proxy/test-report path failures were corrected; only successful reruns count as evidence.

EXC-P1-001 remains accepted: main is NOT technically protected. No direct push, force-push or deletion of main; changes enter through PR after green hosted CI and owner review. No new architecture decision or exception. Open owner decisions: none blocking this phase; owner acceptance of P3 is still pending.

Exact next task: owner reviews PR #3, final exact-head CI and exit evidence. Do not merge unless explicitly authorized. Do not start P4 without a separate owner instruction accepting P3 and authorizing P4.
