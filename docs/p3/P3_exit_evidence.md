# P3 exit evidence

Status: **PASS — READY FOR OWNER ACCEPTANCE**, subject to the final-head verification rule below.

Accepted parent: `df07f9a15838c99da1ea8c876a8b6262057b0354`; tag `p2-accepted-2026-09-16`.
Branch: `implementation/p3-lesson-engine`. PR [#3](https://github.com/PV007PV007/Lingvessa/pull/3) OPEN, not merged. Owner acceptance pending.
Tested implementation checkpoint: `721341d8d8a2fddb93abe105398889da5f9faa22`.

The final closure commit is the commit containing this file. It is valid only after P1 push/PR, P2 PR and P3 push/PR all succeed on that exact head. P3 checkout and the generated acceptance summary assert `git rev-parse HEAD == GITHUB_HEAD_SHA`; the artifact contains the full final SHA and hashes of every runtime report. No code/evidence commit after that tested final head is accepted automatically.

## P3 task and exit gates

IMP-P3-001 → 002 → 003 → 004: P3 scope verified. Shared versioned registry, immutable pinned lesson manifests, deterministic server evaluation, atomic attempts/raw evidence/receipts/outbox, single scored state machine, retry/reveal/remediation, login/reload resume and a bounded non-sensitive unsent queue are implemented. No governing contract change.

- Baseline: 39/39 checks; seven PDFs, manifest and P0 trace preserved.
- Unit: 35/35; smoke: 4/4; integration: 12/12 including nine P2 subtests and P1/P3 runtime tests.
- PostgreSQL 18.6: 15 P3 gate groups passed including real browser group; three migrations from clean state, replay, repeated seed, teardown/recreation.
- Direct SQL ownership/profile/language/content lineage rejects cross-user and EN/CS mismatches. Published pins, attempts, evidence and receipts resist rewriting; an injected transaction failure leaves no partial effects.
- Same UUID/semantic payload replays one immutable receipt; concurrent duplicates produce one effect set. Different payload, sequence, content pin and client score tampering reject.
- Incorrect/retry, reveal zero-weight assistance, sticky assistance, retry cap, explicit unresolved remediation exit and natural completion passed.
- Outbox retry/backoff, stale lease fencing, terminal/exhausted retry and consumer isolation passed; a sink failure does not undo a committed attempt.
- Four synthetic EN/CS fixture files, 24 activity instances: valid and idempotently loaded/published. Full reference M01 curriculum remains P6/P7.
- Chromium: 4/4 E2E, zero skipped/flaky. EN/CS real login, keyboard input, reload, response lost after server commit/replay, reveal/remediation and core rendering; mobile/desktop overflow assertions. Origin guard accepts the real Host and rejects foreign Origin.
- Attempt latency: 20 loopback API + real DB samples, p95 14.282 ms ≤700 ms. This is not production-load certification.
- OCI: api/worker/web/admin images built at the tested SHA, four services ready; DB outage yields backend readiness 503 while liveness stays 200; restored DB returns readiness 200.
- Prisma introspection: 43 runtime/committed model names; seven P3 models have equal scalar field names/types/nullability. SQL and real DB tests govern relation/trigger behavior.
- P4 mastery/Review projections, P5 speech/media jobs and P8/P9 AI runtime remain absent. No AI call is required or made by P3.

## Executed commands

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

`pnpm check` expands to Prisma generate/validate, peer checks, lint, typecheck, package boundaries, secret scanning, unit tests, server/web/admin production builds and smoke tests. P2 regression additionally executes `pnpm benchmark:passwords` and emits real DB introspection.

## Hosted checkpoint evidence

- [P2 data foundation / pull_request / 35208895544](https://github.com/PV007PV007/Lingvessa/actions/runs/35208895544): SUCCESS.
- [P1 foundation / pull_request / 35208895492](https://github.com/PV007PV007/Lingvessa/actions/runs/35208895492): SUCCESS.
- [P3 lesson engine / pull_request / 35208895558](https://github.com/PV007PV007/Lingvessa/actions/runs/35208895558): SUCCESS.
- [P1 foundation / push / 35208891443](https://github.com/PV007PV007/Lingvessa/actions/runs/35208891443): SUCCESS.
- [P3 lesson engine / push / 35208891439](https://github.com/PV007PV007/Lingvessa/actions/runs/35208891439): SUCCESS.

Sources: `evidence/hosted-ci.json`, `evidence/verified-runtime-checkpoint.json`, `evidence/validation-index.json`, `evidence/schema-introspection.json`, `evidence/schema-api-diff.json` and the artifacts linked from the runs above. Earlier failed runs are history, not passed exit evidence: browser Origin handling, missing test client header and the JSON reporter path were corrected and rerun.

## Trace, findings and owner action

165 trace rows: 162 MUST, 3 SHOULD; 165 traced, zero untraced/duplicate IDs. 93 P3 rows verified, 48 mixed requirements with their P3 foundations verified and future acceptance retained, 24 future-runtime rows explicitly deferred by execution authority. See `phase-scope.md`; none of the latter is falsely claimed globally complete.

BLOCKER: none. IMPORTANT: none after final-head checks succeed. MINOR: inherited GitHub-maintained Actions Node deprecation warnings and experimental patch-pinned Node Argon2id.

EXC-P1-001 retained: main is NOT technically protected; implementation branch → PR → green CI → owner review. Open owner decisions: none blocking P3. Owner milestone acceptance remains pending.

Exact next owner action: review PR #3 and its final green checks/evidence, then explicitly accept or request changes. This delivery does not merge PR #3 or authorize P4.
