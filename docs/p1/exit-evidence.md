# P1: PASS — READY FOR OWNER ACCEPTANCE

Updated UTC: 2026-09-14T20:14:59.557532+00:00. **Single final hosted-CI-tested SHA: `3b0a45e2c143fb538edb7a626f8c84356cdcc34f`**.
Branch: `implementation/p1-foundation`. Owner acceptance: **PENDING**. P2: **NOT AUTHORIZED / NOT STARTED**.

## Evidence provenance

The product owner explicitly verified GitHub Actions `P1 foundation` / `p1-exit` success for **push** and **pull_request** associated with this SHA. All seven required steps ran successfully and were not skipped; a P1 runtime evidence artifact was produced. This closure accepts that owner-supplied evidence and maps it to the exact Git source restored from the prior bundle.

No GitHub connector/log download is available to this session. Run URLs/IDs, timestamps, raw logs, artifact contents and image digests were not supplied and are not invented. `closure/owner-verification.json` is an owner attestation, **not raw CI output**. The push run establishes the tested source SHA; the PR check does not independently establish a synthetic PR checkout SHA.

The old local run on `49e27d071dbf6fe134cb5b4d9fc45ffad1bba426` remains unchanged in `evidence/validation.json`. Its Docker failure is historical. Current phase status is `closure/current-validation.json`; earlier NOT_READY statements in preserved historical records do not override it.

## Hosted commands and results

| Committed workflow command | Hosted result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — owner verified; executed, not skipped |
| `pnpm validate:baseline` | PASS — owner verified; executed, not skipped |
| `pnpm check` | PASS — owner verified; executed, not skipped |
| `pnpm audit:dependencies` | PASS — owner verified; executed, not skipped |
| `pnpm bootstrap:local` | PASS — owner verified; executed, not skipped |
| `node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts` | PASS — owner verified; executed, not skipped |
| `pnpm test:containers` | PASS — owner verified; executed, not skipped |

The owner quoted `tests/integration/**/*.test.ts`; the committed workflow has `tests/integration/*.test.ts`. The exact source has one integration test file, `tests/integration/bootstrap.test.ts`; this report attributes coverage to its assertions. No additional test suite is inferred.

`pnpm check` expands to Prisma generation and validation, peers, lint, TypeScript, dependency-boundary and credential-pattern checks, unit tests, four application builds and smoke tests. At this SHA it contains 14 unit tests and 4 smoke tests; the real PostgreSQL suite adds one integration test. Their hosted success is owner-verified. Exact hosted TAP output and fresh vulnerability counts are not available; only the successful audit gate is claimed.

## PostgreSQL / OCI acceptance map

Every conclusion below uses successful execution confirmed by the owner plus the corresponding assertion in the tested source. Full structured mapping: `closure/acceptance-map.json`.

| Gate | Exact acceptance scope | Test / implementation anchor |
| --- | --- | --- |
| P1-DB-START | Docker Compose starts local PostgreSQL, generates Prisma client, deploys migration and seeds. | `tools/p1/bootstrap-local.ts:29` |
| P1-DB-VERSION | Connected server_version_num is exactly 180006 (PostgreSQL 18.6). | `tests/integration/bootstrap.test.ts:21` |
| P1-DB-FRESH | A new isolated UTF-8 database is created from template0 and migrated; migration deploy is replayed; exactly one completed migration remains. | `tests/integration/bootstrap.test.ts:22` |
| P1-DB-RESEED | Two migration+seed iterations succeed without duplicate fixtures; final row count is two. | `tests/integration/bootstrap.test.ts:24` |
| P1-DB-FIXTURES | EN/CS synthetic fixture UUID, stable_code, version_code, locale and Unicode text round-trip match the files; locale and malformed UUID mutations are rejected. | `tests/integration/bootstrap.test.ts:36` |
| P1-DB-CONFLICT | Changing persisted Czech text then reseeding is rejected instead of overwriting content. | `tests/integration/bootstrap.test.ts:45` |
| P1-DB-RECREATE | Each integration invocation creates a fresh named isolated DB and finally drops it. Both owner-verified runs execute the test, proving independent clean-state recreation. | `tests/integration/bootstrap.test.ts:48` |
| P1-OCI-BUILD | All four Docker targets api, worker, web, admin build; image IDs and the runtime Git SHA are written to container-build.json. | `tools/p1/containers.ts:11` |
| P1-OCI-START | Compose starts the four compiled/standalone images from runtime config; all services become ready against the migrated local DB. | `tools/p1/containers.ts:40` |
| P1-OCI-DEGRADED | Stopping PostgreSQL causes API and worker readiness 503 while liveness stays 200. | `tools/p1/containers.ts:43` |
| P1-OCI-RECOVERY | Starting PostgreSQL again restores both backend readiness endpoints to 200; finally restores the DB and stops the app stack. | `tools/p1/containers.ts:48` |
| P1-OCI-PORTABILITY | Built images run production JavaScript/Next standalone; Compose injects config without source/node_modules bind mounts. P1 local synthetic environment is intentional. | `infra/containers/Dockerfile:18` |
| P1-CI | Owner confirms p1-exit success for push and pull_request; required steps executed and runtime artifact produced. | `.github/workflows/p1.yml:12` |

Clean-state recreation means each real integration run creates a fresh UTF-8 template0 database, migrates/seeds it and drops it in cleanup; both verified runs execute that sequence. A same-name destructive recreation loop or backup restore is not claimed. Recovery means PostgreSQL stop/start with readiness transitions; a separate application restart drill is not claimed. Docker images use production JavaScript/standalone entrypoints without host source/development-server mounts. Local synthetic configuration is the intended P1 context; no production deployment is accepted.

## Repository / PR / operational exception

The private GitHub repository is connected, with branches `main`, `implementation/p1-foundation` and tag `p0-accepted-2026-09-11`, per owner verification.
**PR #1 — P1: engineering foundation — OPEN**, base `main`, head `implementation/p1-foundation`. Owner milestone review and acceptance are pending. This agent did not merge, push or change repository settings.

**Main is NOT technically protected.** `EXC-P1-001` records the owner's operational exception for the current solo-development phase. Technical protection clauses are Plan v1.4 §4.1 p4 and Technical Specification v1.7 §7 p8 (unnumbered; related TS-REPO-001). Plan §8 p6 / Appendix B p12 have no non-waivable technical-protection exit condition; Plan's approval record p13 includes accepted exceptions. The owner-locked PDFs remain unchanged. Process controls do not count as technical enforcement.

Required process: implementation/* branches; PRs into main; green hosted CI before merge; no direct push, force-push or deletion of main; owner review of milestone PRs. See `closure/operational-exception.md` and `.json` for scope and residual risk. No paid GitHub upgrade is required by this closure decision.

## P1 exit checklist

- PASS: exact locked baseline and checksum integrity retained.
- PASS: private monorepo, exact tooling, hosted clean install/quality/audit.
- PASS: typed config, secret scan and dependency boundaries.
- PASS: real PostgreSQL bootstrap, migration replay, seed/reseed, EN/CS integrity and negative constraints.
- PASS: four OCI builds/start/readiness/degraded/recovery gates.
- PASS WITH `EXC-P1-001`: repository governance; technical main protection remains absent.
- PASS: hosted final source SHA is exactly `3b0a45e2c143fb538edb7a626f8c84356cdcc34f`; no new implementation commit created.
- PASS: no P2 domain schema or engine implementation introduced.
- PENDING OWNER: review/acceptance of open PR #1. No automatic merge or P2 authorization.

## Reconciliation and trace

P1-ENV-001: **CLOSED** by hosted runtime evidence. P1-REMOTE-001: **CLOSED WITH EXC-P1-001**. Previous final/tested SHA ambiguity: **CLOSED**; `3b0a45e2c143fb538edb7a626f8c84356cdcc34f` is now the single hosted-tested source baseline.

P0 trace retained: 2453 MUST rows / 2453 traced / 0 untraced / 0 duplicate IDs, plus 22 SHOULD. Current P1 overlay: 105 IDs; 41 P1_FOUNDATION_PARTIAL, 42 P1_FOUNDATION_VERIFIED, 22 FUTURE_RUNTIME_ACCEPTANCE. Partial/future rows describe later product acceptance, not missing P1 gates. Production release provenance remains future scope.

**BLOCKER: 0. IMPORTANT: 0.**
**MINOR:** P1-ACTIONS-001 — non-failing Node.js action deprecation warning; P1-DEPS-001 — review three narrow patched dependency overrides when upstream resolves them. No action/dependency upgrade was made solely for the warning.

No new architecture decision. Thirteen future owner choices OD-002–OD-014 remain; none blocks P1 acceptance. OD-002 is due before P2 identity acceptance, not authorization to start P2 now.

## Delivery and exact next action

The Git bundle remains at `3b0a45e2c143fb538edb7a626f8c84356cdcc34f`. Updated handoff/trace/exception/evidence files are delivered as an explicit **closure metadata overlay**, separate from the immutable tested Git snapshot. They do not create another allegedly tested commit. The archive contains the complete current repository-ready tree, tested Git history, overlay patch and checksum manifest. All non-document source bytes match `3b0a45e2c143fb538edb7a626f8c84356cdcc34f`.

Local reconciliation commands and results are recorded in `closure/local-reconciliation-validation.json`; they validate document consistency, source hashes and package boundaries, not new DB/OCI executions.

**Owner:** review PR #1 and this closure record; accept P1 if satisfied. Keep the tested SHA unchanged for that acceptance. If the closure overlay is committed into the branch, that new commit must receive the required hosted checks before it is treated as a new tested head. Do not merge automatically. **STOP before P2; await separate explicit owner authorization.**
