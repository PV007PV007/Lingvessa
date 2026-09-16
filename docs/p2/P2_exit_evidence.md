# P2 exit evidence

Status: **PASS — READY FOR OWNER ACCEPTANCE**

Accepted parent: `a37872bb87ff886a568e44aafcb9b0963e346651`

Branch: `implementation/p2-data-foundation`

Tested implementation SHA: `247574352ee5f89ca7ee2172d92a008137c11dd7`

PR: #2, OPEN DRAFT into `main`; not merged.

The final evidence-only commit is the commit containing this file. It is not accepted until P2 and P1 workflows pass for both push and pull_request on that exact head. This avoids claiming an untested metadata revision; GitHub `GITHUB_HEAD_SHA` and the final report are the canonical exact closure SHA.

## Exit gates

- Owner-locked baseline and P2 authorization: PASS 29/29.
- Frozen install, Prisma generate/validate, lint, typecheck, package boundaries, secret scan, 21 unit tests, web/admin production builds and 4 smoke tests: PASS.
- Dependency audit: PASS, no known production vulnerabilities.
- PostgreSQL 18.6: PASS 9/9 P2 groups plus P1 integration regression.
- Clean migration deploy and replay, seed/reseed, clean teardown/recreation: PASS.
- EN/CS profile, owner, variety, curriculum, content/reference and knowledge-edge negative isolation: PASS.
- UUID/stable_code/version_code resolution; checksum/revision-bound validation and human approvals: PASS.
- Published versions, manifests, entries, edge snapshots, translations, references and audit history immutable; rollback by optimistic active pointer: PASS.
- EN and CS reference metadata fixtures: PASS, 16 entities and four lessons + recap per language; idempotent reload and changed-fixture refusal.
- OCI: PASS four images (api, worker, web, admin), clean four-service readiness, DB-down API/worker 503 with liveness 200, DB-restored readiness 200.
- Prisma runtime introspection: PASS 36/36 models; documented partial-index normalization only.
- P3 tables/runtime absent: PASS.

## Hosted evidence

At `247574352ee5f89ca7ee2172d92a008137c11dd7`:

- P2 push run 34996815099: success.
- P2 PR run 34996819964: success; artifact 10408137898, digest `sha256:9b2f5be649ead396a3337ea7507b4ce40362cf6f5bb619d09e57459d04912e36`.
- P1 push run 34996815126: success.
- P1 PR run 34996820041: success.

See `evidence/hosted-ci.json`, `evidence/validation-index.json`, `evidence/schema-introspection.json`, `evidence/contract-diff.md`, `requirement-evidence.json` and `task-status.json`.

## Trace and findings

P2 planning rows: 434; MUST: 432; SHOULD: 2; traced: 434; untraced: 0. Statuses intentionally distinguish 177 verified P2-foundation rows, 170 mixed rows whose P2 foundation is partial, and 87 future-runtime acceptance rows. No P3/P4/P5/P8/P9/P10/P13 runtime is falsely claimed.

BLOCKER: none. IMPORTANT: none. MINOR: GitHub-maintained Actions emit the existing Node runtime deprecation warning; Node 24.19 built-in Argon2 remains experimental and therefore patch-pinned with policy/version tests.

Open owner decisions: none blocking P2. EXC-P1-001 remains accepted; `main` is not technically protected and process controls remain mandatory.

Exact next owner action: review PR #2 and P2 evidence. Do not merge or authorize P3 unless the owner explicitly accepts P2.
