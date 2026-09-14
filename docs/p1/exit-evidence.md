# P1 exit evidence — NOT READY

Recorded UTC: 2026-09-14T07:44:30.912293+00:00. Tested implementation commit: `49e27d071dbf6fe134cb5b4d9fc45ffad1bba426`.
Branch: `implementation/p1-foundation`. P0 accepted by the owner; P1 authorized.
P2 is not authorized and was not started. Implementation Plan v1.4 §8 p6 is the sole P1 exit authority.

## Reproduction and observed commands

The source was committed and cloned without copying node_modules or generated builds:

```sh
git clone --no-local --branch implementation/p1-foundation /workspace/scratch/3a694649f683/lingvessa_p1 /workspace/scratch/3a694649f683/tmp/lingvessa_p1_final_clean_20260914
cd /workspace/scratch/3a694649f683/tmp/lingvessa_p1_final_clean_20260914
node tools/p1/run-validation.mjs
```

The runner exited **1 / NOT_READY**, with the exact child commands below.

| Command | Observed status | Exit code |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | 0 |
| `pnpm validate:baseline` | PASS | 0 |
| `pnpm check` | PASS | 0 |
| `pnpm audit:dependencies` | PASS | 0 |
| `pnpm bootstrap:local` | FAIL | 1 |
| `node --env-file=.local/runtime.env --import tsx --test tests/integration/bootstrap.test.ts` | NOT_RUN_DEPENDENCY_FAILED | not run |
| `pnpm test:containers` | FAIL | 1 |

Raw evidence: `evidence/validation.json`, `evidence/baseline-validation.json` and
the complete command output copies listed in `evidence/index.json`. The report
records durations and tested SHA; failed runtime commands are not converted to
skipped or passed tests. The database integration command was not run in this
fresh clone because its prerequisite failed.

`pnpm check` expands to the following required sequence:

```sh
pnpm db:generate
pnpm db:validate
pnpm peers check
pnpm lint
pnpm typecheck
pnpm check:boundaries
pnpm check:secrets
pnpm test
pnpm build
pnpm test:smoke
```

## What the passing checks prove

- Frozen install uses exact Node 24.19.0 and pnpm 11.19.0 with the committed lockfile.
- 26/26 governance-integrity checks pass, including the seven exact governing
  versions, nine original owner-lock checksums and the checksum-manifest hash.
- TypeScript, lint, peer and dependency-boundary checks pass. A negative test
  proves framework and infrastructure imports/re-exports into domain are rejected.
- 14 unit tests and 4 smoke tests pass. Tests cover configuration failure/redaction,
  AI-off/budget defaults, local DB target restrictions, dependency boundaries,
  operational probes, four compiled app processes and frontend HTML/CSS.
- Actual API/worker processes return liveness 200 and readiness 503 when PostgreSQL
  is unavailable, then shut down normally. Unit probes cover a healthy DB query;
  real healthy/recovered PostgreSQL and container behavior remain unverified.
- Prisma generates the client and validates the bootstrap schema. These checks
  do not execute a migration or prove seed repeatability on PostgreSQL.
- The production dependency audit reports no known vulnerabilities at execution
  time. Exact narrow patched transitive overrides remain recorded and unsuppressed.
- Source and reachable Git history pass the implemented credential-pattern scan;
  frontend smoke checks inspect public bundles for server-only configuration.
  This is bounded automated evidence, not a guarantee against every possible secret.

## P1 exit checklist

| Required evidence | State | Record / outstanding work |
| --- | --- | --- |
| Exact locked baseline and approved P1 | PASS | baseline.yml, authorization.json, integrity report |
| Private monorepo, exact toolchain and clean install | PASS locally | Local Git repository and fresh-clone log; private remote pending |
| CI/review and supply-chain gate definitions | PREPARED | Workflow and repository rules exist; no hosted run or applied remote protection |
| Typed configuration and safe examples | PASS locally | Config/secret/unit checks |
| Canonical apps/packages and dependency boundaries | PASS locally | Build, negative boundary test and HTTP smoke suite |
| Initial migration and synthetic EN/CS seed on real DB | BLOCKED | Docker/Compose/PostgreSQL unavailable; execute IMP-P1-003 gate |
| OCI builds and healthy/degraded/recovered stack | BLOCKED | No Docker daemon; execute IMP-P1-004 gate after 003 |
| Complete fresh clone → install → migrate → test → build | NOT PASSED | Real migration and OCI evidence missing |
| Handoff, requirement evidence and complete diff | DELIVERED | Current handoff, task-status.json, requirement-evidence.json, changed-files.* |
| P2 hard stop | ENFORCED | No P2 domain features or authorization |

## Trace evidence

The accepted P0 plan is retained: **2453 MUST rows, 2453 traced, 0 untraced,
0 duplicate IDs; 22 SHOULD rows separately**. No governing requirement is removed.
The P1 status overlay has **105 distinct requirement IDs** with code/test paths:
40 P1_FOUNDATION_PARTIAL, 36 P1_FOUNDATION_VERIFIED, 22 FUTURE_RUNTIME_ACCEPTANCE, 7 P1_GATE_PENDING.
`task-status.json` also lists the direct governing IDs and all reverse links for
each P1 task. A foundation status never accepts later learning, authorization,
publication, speech, AI or release behavior.

## Remaining issues and decisions

**BLOCKER P1-ENV-001:** This execution host has no Docker/Compose/PostgreSQL.
Real migration/seed/reseed and OCI build/recovery gates cannot pass here.
This is an execution-evidence blocker, not an architecture contradiction.
Run the unchanged gates on a Docker-capable local/CI host with PostgreSQL 18.6.

**IMPORTANT P1-REMOTE-001:** No owner private GitHub repository/remote was supplied
or connected. Branch history and CI/protection artifacts are delivered, but no PR,
hosted CI result or applied protection is claimed. Connect an owner-controlled
private remote and apply the proposed rules before shared development/review.

**MINOR P1-DEPS-001:** Three narrow patched transitive overrides require review
when their upstream dependencies update; remove them only with fresh compatibility
and advisory evidence. No current advisory is suppressed.

No new architecture decision or spec exception is required for P1. OD-001 initial
pins are resolved. Thirteen source-backed future owner decisions (OD-002–OD-014)
remain in `docs/baseline/open-decisions.*`; none is silently decided or moved ahead.
OD-002 authentication details are due before P2 identity acceptance.

## Exact next task and phase stop

Continue **IMP-P1-003** on the required runtime host: run `pnpm bootstrap:local`,
then `node --env-file=.local/runtime.env --import tsx --test tests/integration/bootstrap.test.ts`.
After it passes, complete **IMP-P1-004** using `pnpm test:containers` and capture
the full fresh-clone runner result. Connect the private remote/review gate.
Update this evidence and the handoff; obtain owner P1 acceptance.
**Do not start IMP-P2-001 or any P2 work without separate owner approval.**
