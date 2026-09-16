# Lingvessa implementation state and handoff

Timestamp: 2026-09-16T04:05:00Z

## Authority and milestone state

P0: ACCEPTED. P1: ACCEPTED. P2: PASS — READY FOR OWNER ACCEPTANCE. P3: NOT AUTHORIZED / NOT STARTED.

GitHub `PV007PV007/Lingvessa` `main` and history are the implementation source of truth. Accepted parent: `a37872bb87ff886a568e44aafcb9b0963e346651`; accepted tag: `p1-accepted-2026-09-15`; PR #1: MERGED. P2-SOURCE-001 is RESOLVED. The manifest remains architecture/context authority, the seven owner-locked PDFs remain unchanged, and Implementation Plan v1.4 is the sole P0–P13 execution-order authority.

## Repository state

- Branch: `implementation/p2-data-foundation`.
- Tested implementation SHA: `247574352ee5f89ca7ee2172d92a008137c11dd7`.
- PR #2: “P2: data, language isolation and publication foundation”, OPEN DRAFT into `main`; not merged.
- Final closure SHA rule: the evidence-only commit containing this handoff must itself receive green P2 and P1 push/pull_request workflows. GitHub `GITHUB_HEAD_SHA` and the final closure report resolve its exact SHA without pretending a Git commit can contain its own hash.
- Task packets: IMP-P2-001, IMP-P2-002, IMP-P2-003 from the accepted P0 trace/backlog.
- Requirement rows: 434 total; 432 MUST, 2 SHOULD; 434 traced, 0 untraced. P2-foundation verified 177, mixed/partial 170, future-runtime acceptance 87.

## Implemented P2 foundation

- Minimal users, credentials, opaque server sessions, roles, immutable consents/audit, language profiles and settings.
- Composite database ownership keys bind user + language_profile + language. English and Czech use the same schema; en-GB is default, en-US selectable, cs-CZ separate, uk-UA UI locale independent.
- UUID identities, immutable human-readable `stable_code`, immutable `version_code`; publication accepts resolved UUID/version references only.
- Shared course/level/module/lesson/activity/knowledge/outcome identifiers, typed/versioned knowledge edges, canonical six-skill/21-facet/33-pair registry, evidence-map modality guards.
- Versioned content payloads and resolved references, checksum/revision-bound validations and human approval records.
- Immutable publication snapshots, entry/translation/knowledge-edge manifests, atomic active pointer and rollback without historical rewrite.
- EN/CS P2 reference metadata fixtures and idempotent loader: 16 entities, four lesson identifiers plus recap per language, representative activity/knowledge metadata. Full executable M01 content remains P6/P7; media remains P5.
- Minimal API: login/logout, GET/PATCH current user/settings, language profile list/create, active-language switch and published catalog. OpenAPI 3.1.2.
- Controlled provisioning only. No public registration and no P3 Lesson Engine, P4 mastery/Review, P5 speech/media, P8/P9 AI or later product runtime.

Schema/migration: additive `prisma/migrations/202609150001_p2_foundation/migration.sql`; P1 migration retained. Migration SHA-256: `1070d4ed37133be1a1d166458aead61d446167a91d46921d829843cfa5ec68b6`. PostgreSQL 18.6 clean introspection has the same 36 models as `prisma/schema.prisma`; the documented difference is Prisma's incorrect one-to-one inference from the partial default-variant index plus formatting.

API changes: `infra/contracts/p2.openapi.json`; no provider-specific or later-phase endpoint.

Architecture decisions: no governing contract change. OD-002 is implemented within the locked Argon2id/server-session default in `docs/adr/adr-p2-identity-implementation.md` and becomes owner-accepted only with P2. EXC-P1-001 remains: `main` is NOT technically protected; implementation branch → PR → green hosted CI → owner review is mandatory.

Files added/modified/deleted: complete inventory in `docs/p2/changed-files.json`; no governing document, manifest or owner-lock checksum file modified; no implementation file deleted.

## Exact validation and results

Local:

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm validate:baseline`: PASS 29/29.
- `pnpm db:generate && pnpm db:validate`: PASS.
- `pnpm validate:references`: PASS EN/CS.
- `pnpm check`: PASS — lint/typecheck, boundaries 53 modules/69 dependencies, secret scan, unit 21/21, web/admin builds, smoke 4/4.
- `pnpm audit:dependencies`: PASS in hosted CI; no known production vulnerabilities.

Hosted at `247574352ee5f89ca7ee2172d92a008137c11dd7`:

- P2 push 34996815099 and P2 pull_request 34996819964: success.
- P1 regression push 34996815126 and pull_request 34996820041: success.
- `pnpm bootstrap:local`: PostgreSQL 18.6 migrated and seeded.
- `node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`: PASS; P1 integration plus 9/9 P2 groups.
- `pnpm test:containers`: PASS; four images built and started, all ready; DB loss caused API/worker readiness 503 while liveness stayed 200; DB restore returned readiness 200.
- Runtime artifact 10408137898; digest `sha256:9b2f5be649ead396a3337ea7507b4ce40362cf6f5bb619d09e57459d04912e36`.

PostgreSQL P2 groups all PASS:

1. clean migration/replay, seed/reseed and registry parity;
2. profile/owner/language/variety SQL isolation;
3. EN → CS → EN context-only switch, IDOR and optimistic concurrency;
4. UUID resolution, validation and approvals;
5. published version/manifest/entry/edge/translation/reference immutability;
6. new version, atomic pointer rollback, stale/concurrent and language rejection;
7. session/CSRF/expiry/role-revocation/API ownership;
8. later-phase table absence and no cascade-delete FK;
9. clean database teardown/recreation and repeated migration/seed.

Detailed evidence: `docs/p2/P2_exit_evidence.md`, `docs/p2/evidence/validation-index.json`, `docs/p2/evidence/hosted-ci.json`, `docs/p2/evidence/schema-introspection.json`, `docs/p2/evidence/contract-diff.md`, `docs/p2/task-status.json`, and `docs/p2/requirement-evidence.json`.

## Findings and handoff

BLOCKER: none.

IMPORTANT: none.

MINOR / technical debt:

- GitHub-maintained Actions emit the existing Node runtime deprecation warning; no check fails.
- Node 24.19 built-in Argon2id API is experimental, so the exact Node patch and policy string remain pinned and guarded by unit/integration/benchmark evidence.
- Production hosting, capacity, privacy lifecycle and later provider decisions retain their governing future deadlines.

Open owner decisions: none blocking P2. Owner acceptance of OD-002 implementation occurs with P2 review.

Exact next task: finish the evidence-only commit's four hosted checks, keep PR #2 open, then owner reviews and explicitly accepts or rejects P2. Do not merge PR #2 and do not start P3 without owner authorization: “P2 accepted. Proceed to P3.”
