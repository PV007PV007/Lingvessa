# Prepared P1 task packets — NOT STARTED

These packets are a P0 planning artifact. They are not permission to execute P1. Await the exact owner instruction **P0 accepted. Proceed to P1.** Implementation Plan v1.4 §8 p6 and Appendix B p12 govern all four tasks. Named future code paths do not exist in this P0 batch.

## IMP-P1-001

- Goal: Pin exact versions within the locked families after compatibility check; create private pnpm workspace and lockfile; wire lint/typecheck/unit/build and supply-chain checks.
- Governing requirements: `TS-TECH-001; TS-TECH-002; TS-TECH-004; TS-REPO-001; TECH-002`. Full reverse links are in `implementation-backlog.json`.
- Dependencies/decisions: P0 owner acceptance; OD-001 is resolved inside this task before its gate.
- Planned files/modules: `package.json, pnpm-workspace.yaml, pnpm-lock.yaml, .github/workflows, toolchain configuration`.
- Contract/schema: governed by TS/TD v1.7; task explicitly includes its foundation configuration/interface artifact.
- Acceptance and negative test: Fresh private checkout with pinned Node 24 LTS: install --frozen-lockfile, lint, typecheck, unit and build all succeed. Reject incompatible pins or lock drift; verify generated bundles/config contain no secret.
- Fixture/provider dependency: Synthetic config/package fixtures included; no provider account/key.
- Migration/compatibility/rollback: Lockfile/config only; no domain schema or feature behavior. Revert toolchain commit if compatibility gates fail.
- Observability: safe bootstrap/config/readiness diagnostics and CI artifact versions; no raw credentials or learner payloads.
- Owner/workstream: Platform foundation; implementation model under product-owner phase approval.
- Status: PLANNED_NOT_STARTED. Recheck Definition of Ready when authorized.


## IMP-P1-002

- Goal: Implement one typed configuration contract across environments and fail-safe feature/provider/budget defaults; provide safe examples without secret values.
- Governing requirements: `TS-ENV-001; TS-ENV-002; TS-ENV-004; TS-ENV-005; TD-ENV-001; TD-ENV-002; TD-ENV-004`. Full reverse links are in `implementation-backlog.json`.
- Dependencies/decisions: IMP-P1-001 merged; contract/config definition is included in this task.
- Planned files/modules: `apps/*/config, infra environment templates, CI secret scan`.
- Contract/schema: governed by TS/TD v1.7; task explicitly includes its foundation configuration/interface artifact.
- Acceptance and negative test: Missing/invalid required configuration fails fast. No secret in repository/client/logs. paid_inference_enabled=false and monthly_paid_budget=0 are defaults; flags cannot grant authorization. No AI runtime dispatch is implemented.
- Fixture/provider dependency: Synthetic local/preview/staging/production configuration samples; negative missing-value/secret tests included.
- Migration/compatibility/rollback: No domain API/schema change. Roll back config/build artifacts; do not place credentials in versioned files.
- Observability: safe bootstrap/config/readiness diagnostics and CI artifact versions; no raw credentials or learner payloads.
- Owner/workstream: Platform foundation; implementation model under product-owner phase approval.
- Status: PLANNED_NOT_STARTED. Recheck Definition of Ready when authorized.


## IMP-P1-003

- Goal: Provide local PostgreSQL bootstrap, Prisma tooling/initial foundation migration and deterministic synthetic bilingual bootstrap data as required by P1.
- Governing requirements: `TS-TECH-003; TS-REPO-001; TS-ENV-001; TD-ENV-001; TS-DATA-001`. Full reverse links are in `implementation-backlog.json`.
- Dependencies/decisions: IMP-P1-001 and IMP-P1-002 merged. P2 remains authority for full domain/isolation/publication schema.
- Planned files/modules: `prisma bootstrap/initial migration, infra/local, tests/fixtures`.
- Contract/schema: governed by TS/TD v1.7; task explicitly includes its foundation configuration/interface artifact.
- Acceptance and negative test: A fresh isolated local database migrates reproducibly, seeds synthetic EN/CS bootstrap data, and can be reset/recreated without production access. No title/file/index is used as durable identity.
- Fixture/provider dependency: Synthetic fixture generation is included. No real-user data, external provider or media runtime.
- Migration/compatibility/rollback: Only P1 bootstrap migration boundary; full domain schema/DB guards wait for P2. Document checksum, compatibility and local reset procedure.
- Observability: safe bootstrap/config/readiness diagnostics and CI artifact versions; no raw credentials or learner payloads.
- Owner/workstream: Platform foundation; implementation model under product-owner phase approval.
- Status: PLANNED_NOT_STARTED. Recheck Definition of Ready when authorized.


## IMP-P1-004

- Goal: Materialize canonical apps/packages and dependency rules; add OCI build, health/readiness and portable development deployment templates.
- Governing requirements: `TS-ARCH-001; TS-MOD-001; TS-MOD-002; TD-MOD-001; TD-MOD-002; TS-ENV-003; TS-TECH-005`. Full reverse links are in `implementation-backlog.json`.
- Dependencies/decisions: IMP-P1-001, 002, 003 merged; no unresolved decision affecting local build. Remote development deployment is optional.
- Planned files/modules: `apps/web, apps/admin, apps/api, apps/worker; canonical packages; infra/containers; architecture checks`.
- Contract/schema: governed by TS/TD v1.7; task explicitly includes its foundation configuration/interface artifact.
- Acceptance and negative test: Forbidden framework/Prisma/provider SDK import into domain fails. One provider-adapters tree with ai/speech/tts/image/email/storage; api-client and ui retained. Container builds; liveness responds and readiness fails safely when DB is unavailable; clean bootstrap pipeline passes.
- Fixture/provider dependency: Minimal synthetic health/DB readiness and import-boundary fixtures included, no Lesson Engine implementation.
- Migration/compatibility/rollback: No learning/AI contract change. Container/config rollback; hosting vendor remains replaceable.
- Observability: safe bootstrap/config/readiness diagnostics and CI artifact versions; no raw credentials or learner payloads.
- Owner/workstream: Platform foundation; implementation model under product-owner phase approval.
- Status: PLANNED_NOT_STARTED. Recheck Definition of Ready when authorized.
