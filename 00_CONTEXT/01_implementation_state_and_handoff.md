# Lingvessa — Implementation State and Handoff

This operational file is the synchronization contract with the coordination chat.
It records the current source and acceptance evidence without changing architecture.

## Current phase and authorization

- Updated UTC: **2026-09-14T07:44:30.912293+00:00**.
- Phase: **P1 — engineering foundation; NOT READY for exit acceptance**.
- P0: **PASS and accepted** by the owner's instruction: “P0 accepted. Proceed to P1.”
- P1 implementation source prepared in order: **IMP-P1-001 → IMP-P1-002 → IMP-P1-003 → IMP-P1-004**.
- IMP-P1-003 real DB and downstream IMP-P1-004 OCI gates are still blocked; source preparation is not gate acceptance.
- P2: **not authorized; not started**.
- Git branch: **implementation/p1-foundation**.
- Tested implementation commit SHA: **49e27d071dbf6fe134cb5b4d9fc45ffad1bba426**.
- Accepted P0 tag: **p0-accepted-2026-09-11**.
- Remote / PR: **none**. Repository is local and non-public; no hosted checks or branch protections have been applied.
- The later documentation-only commit is Git HEAD in the supplied bundle and is recorded in external `DELIVERY.json`; this file names the tested source commit to avoid a self-referential hash.

## Authority and locked baseline

Architecture/context authority is `00_CONTEXT/00_project_manifest_and_constraints.md`.
Formal **v1.7** governs product behavior; Technical Specification **v1.7** governs
normative technical requirements; Technical Design **v1.7** governs concrete
schema/state/API/DDL; Curriculum A1 **v1.6** governs pedagogy; Reference Module
Design **v1.6** governs executable bilingual reference fixtures; AI Integration
Specification **v1.4** governs AI contracts. **Implementation Plan v1.4 is the sole
P0–P13 execution-order authority.**

Owner lock: **2026-09-10**. All seven PDFs, manifest and original checksum manifest
are unchanged. The original locked handoff bytes remain in
`docs/baseline/owner-lock/01_implementation_state_and_handoff.initial.md`.
Exact hashes and precedence: `docs/baseline/baseline.yml`.

## Tasks, requirements and actual evidence

Current per-task status and direct governing IDs: `docs/p1/task-status.json`.
Current per-requirement code/schema/test/status links:
`docs/p1/requirement-evidence.json` (105 IDs).

| Task | Current status | Direct governing requirements |
| --- | --- | --- |
| IMP-P1-001 | LOCAL_VERIFIED_REMOTE_REVIEW_PENDING | TS-TECH-001, TS-TECH-002, TS-TECH-004, TS-REPO-001, TECH-002 |
| IMP-P1-002 | LOCAL_VERIFIED | TS-ENV-001, TS-ENV-002, TS-ENV-004, TS-ENV-005, TD-ENV-001, TD-ENV-002, TD-ENV-004 |
| IMP-P1-003 | PREPARED_RUNTIME_GATE_BLOCKED | TS-TECH-003, TS-REPO-001, TS-ENV-001, TD-ENV-001, TS-DATA-001 |
| IMP-P1-004 | PREPARED_LOCAL_VERIFIED_OCI_GATE_BLOCKED | TS-ARCH-001, TS-MOD-001, TS-MOD-002, TD-MOD-001, TD-MOD-002, TS-ENV-003, TS-TECH-005 |

The complete P0 planning trace remains 2453 MUST / 2453 traced / 0 untraced /
0 duplicate IDs, plus 22 SHOULD. Join the P1 overlay by requirement_id for current
evidence. Future requirements retain planned status; no future runtime is accepted
by a green foundation test. Original P0 task packets/validator describe the tagged
P0 snapshot, not the current phase; use the P1 validator and current overlays here.

## Created / modified / deleted files

The exhaustive relative-path list and counts, compared with the accepted P0 tag,
are `docs/p1/changed-files.md` and `docs/p1/changed-files.json`. They include this
handoff and evidence metadata. No owner-locked governing source was modified.
The archive also contains the Git bundle and external `DELIVERY.json`.

Implemented artifacts:

- Private pnpm workspace; exact Node/TypeScript/framework/tooling pins and frozen lockfile; local Git history; CI workflow, review rule definition and dependency remediation record.
- Shared typed server configuration, safe environment example, P1 AI phase guard and credential-pattern scanning of current source/reachable history.
- Prisma client/schema configuration, isolated initial bootstrap migration, two deterministic synthetic EN/CS fixtures, repeatable seed and guarded local DB/bootstrap tools.
- `apps/web` and `apps/admin` standalone frontend shells; Nest API and worker operational shells; liveness/readiness probes and an operational OpenAPI contract.
- Canonical package boundaries and provider-adapter directories, with no product engine implementation; dependency-boundary checks and negative fixtures.
- Pinned OCI recipes, local development Compose setup and build/start/degrade/recover gate; these runtime gates are prepared but unexecuted here.
- 14 unit and 4 smoke tests, fresh-clone validator, requirement evidence and P1 exit checklist.

## Architecture decisions

**No approved architecture change and no accepted exception.** The locked shared
English/Czech engine, DB-level isolation, mastery/evidence/speech/publication/UUID
contracts and P0–P13 boundaries remain fixed. Domain/learning/AI implementation
waits for its authorized phase. P1 does not replace DB-level isolation with an
application-only check.

OD-001 exact initial toolchain pins are recorded in `docs/p1/toolchain.json` and
`resolved-decisions.json`. Real DB/OCI compatibility remains an acceptance gate.
AI is optional/provider-agnostic; all P1 AI activation is disabled, learner opt-in
defaults false, paid_inference_enabled=false and monthly_paid_budget=0. No provider
account/key, AI dispatch, P8/P9 handoff runtime or payment behavior was introduced.

## Schema / API / migrations

**No governing or domain contract change.** P1 adds only:

- Migration `prisma/migrations/202609130001_p1_bootstrap/migration.sql`: isolated
  `p1_bootstrap.fixtures` with UUID identity, stable_code, version_code, language/locale
  check and synthetic text. No user/profile/mastery/attempt/publication domain table.
- Seed fixtures P1.EN.SMOKE / P1.CS.SMOKE v1.0.0; deterministic UUIDs, Unicode and
  refusal to overwrite conflicting fixture content. Real DB execution is pending.
- GET `/api/v1/health/live` and `/api/v1/health/ready` for API/worker; frontend
  `/health/live` and `/health/ready`. Ready returns 503 on unavailable DB for backend
  processes; frontend readiness checks its own server. No learner/admin product API.

Bootstrap guard permits local synthetic databases only. Rollback/recreation and
local runtime commands are documented in `infra/development/README.md` and the
bootstrap tools; production data and remote migrations are excluded.

## Exact validation commands and results

Fresh clone source SHA is above. From the clean repository root:

```sh
node tools/p1/run-validation.mjs
```

**Exit 1 / NOT_READY**. The exact subprocess commands, exit codes, durations and
logs are in `docs/p1/evidence/validation.json` and `evidence/index.json`.
The full command table and `pnpm check` expansion are in `docs/p1/exit-evidence.md`.

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm validate:baseline`: PASS, 26/26 checks.
- `pnpm check`: PASS, Prisma generation/validation, peers, lint, types, dependency
  boundaries, secret-pattern scan, 14 unit tests, four app builds and 4 smoke tests.
- `pnpm audit:dependencies`: PASS; no known vulnerabilities at execution time.
- `pnpm bootstrap:local`: FAIL because Docker/Compose is unavailable.
- `node --env-file=.local/runtime.env --import tsx --test tests/integration/bootstrap.test.ts`:
  NOT_RUN_DEPENDENCY_FAILED in this clean run; no false skip/pass substitute.
- `pnpm test:containers`: FAIL because Docker is unavailable; no image build/recovery proof.

Documentation-only final integrity/secret/diff checks are recorded separately in
`docs/p1/evidence/final-metadata-validation.json` after this handoff is generated.

## P1 exit evidence and limitations

`docs/p1/exit-evidence.md` is the acceptance checklist. `task-status.json`, the
requirement overlay, raw evidence and full diff are the review packet.
Fresh-clone install/test/build passes, but **fresh-clone migration and OCI runtime
gates do not pass**. **P1 is NOT READY and must not be presented as complete.**

## BLOCKER / IMPORTANT / MINOR

- **BLOCKER P1-ENV-001:** no Docker/Compose/PostgreSQL on this host; required real
  migrate/seed/reseed and OCI build/recovery acceptance is blocked. Run the existing
  gates on an appropriate local/CI host. This is missing runtime evidence, not a
  contradiction with the locked architecture.
- **IMPORTANT P1-REMOTE-001:** private GitHub remote, hosted CI/PR and main protection
  are not connected/applied. Source, history and proposed rules are supplied.
- **MINOR P1-DEPS-001:** retain/review three narrow patched dependency overrides
  until upstream dependencies incorporate the remediation. No advisory suppressed.
- Unresolved architecture contradictions affecting P1: **0 found**. No broad redesign audit performed.

## Unresolved owner decisions

No P1 architecture decision is waiting for owner approval. Operational needs are
a Docker-capable execution host and an owner-controlled private repository destination.
Thirteen genuine future choices OD-002–OD-014 remain in `docs/baseline/open-decisions.*`;
OD-002 authentication details are due before P2 identity acceptance. Other fixed
manifest decisions have not been reopened. P1 acceptance is not yet requested.

## Exact next task and hard stop

Continue **IMP-P1-003**: run local PostgreSQL 18.6 bootstrap, migration, seed/reseed
and the real DB integration test. Then complete **IMP-P1-004** OCI build/start,
healthy/degraded/recovered readiness and full fresh-clone validation. Connect
private remote/review/CI and record evidence. Update this file and seek P1 acceptance.

**STOP before P2.** IMP-P2-001 — profiles, ownership and DB isolation — can start
only after separate explicit owner approval; no P2 work is included in this package.
