# Lingvessa implementation state and handoff

Timestamp: 2026-09-15T15:23:08Z

## Current authority and accepted state

P0: ACCEPTED. P1: ACCEPTED. P2: AUTHORIZED / IN PROGRESS. P3: NOT AUTHORIZED / NOT STARTED.
GitHub `PV007PV007/Lingvessa` main and repository history are the implementation source of truth. Accepted main is `a37872bb87ff886a568e44aafcb9b0963e346651`; accepted tag is `p1-accepted-2026-09-15`; PR #1 is MERGED. P1 closure `b9657db255136cd86d6a46f5b2e9ce92de5beb4e` is in merged history with green push and PR CI before merge.
P2-SOURCE-001 is RESOLVED by direct GitHub branch/tag/commit/PR/Actions inspection; see `docs/p2/source-verification.json`. Old ZIPs/bundles are not the implementation authority.
The manifest remains architecture/context authority; all seven owner-locked governing PDFs are unchanged; Implementation Plan v1.4 is the sole P0–P13 execution-order authority.

## Repository state

Branch: `implementation/p2-data-foundation`.
Last pushed P2 commit: `2708578221ae9807db330f92d6c682990f19470f`.
PR: #2, “P2: data, language isolation and publication foundation”, OPEN DRAFT into main; do not merge automatically.
Current local work after that SHA contains the next corrective batch and is not yet accepted or runtime-tested.
Task IDs: IMP-P2-001, IMP-P2-002, IMP-P2-003. Requirement overlay indexes exactly 434 P2 planning rows: 432 MUST and 2 SHOULD, with future-phase portions explicitly retained rather than claimed by P2.

## Implemented P2 foundation

- UUID user/session/profile ownership and composite user + language_profile + language database keys.
- English en-GB default/en-US selectable and Czech cs-CZ separate; uk-UA remains the separate UI locale; IANA timezone validation.
- Shared curriculum/content/knowledge IDs, typed/versioned knowledge edges, canonical 6-skill/21-facet/33-pair registry, and evidence-map modality guards.
- Draft content versions, resolved UUID references, PostgreSQL JSONB checksums, checksum/revision-bound validations and human approvals.
- Immutable publication entries, translations, typed-edge closure and manifests; atomic active pointer/rollback with concurrency revision.
- EN/CS reference metadata fixtures with four lesson IDs plus recap per language, shared validator and idempotent loader. Full lessons/media remain P6/P7/P5.
- Controlled identity provisioning, pinned Node 24.19 async Argon2id, opaque revocable hashed server sessions, CSRF, throttling, role/status/credential revocation, and server-derived ownership APIs.
- API subset: login/logout, GET/PATCH me, profile list/create, active-language switch, and stable published catalog. Public registration, P3 Lesson Engine, P4 mastery/Review, P5 media/speech and P8/P9 AI do not exist.

Schema/migration: additive `prisma/migrations/202609150001_p2_foundation/migration.sql`; P1 migration remains byte-for-byte retained. Prisma schema was derived from the real PostgreSQL introspection and normalized for Prisma composite/partial-index relation metadata; another clean introspection gate is pending.
API contract: `infra/contracts/p2.openapi.json` (OpenAPI 3.1.2).
Architecture decision: no governing contract change. OD-002 is implemented within its locked Argon2id/server-session default in `docs/adr/adr-p2-identity-implementation.md` and becomes accepted with owner acceptance of P2.
Files: `docs/p2/changed-files.json` is the inventory; no governing PDF, manifest or owner-lock checksum file was modified.

## Commands, tests and evidence

Local executed successfully: `pnpm install --frozen-lockfile`; `pnpm validate:baseline` (29/29); `pnpm db:generate`; `pnpm db:validate`; `pnpm lint`; `pnpm typecheck`; `pnpm check:boundaries` (53 modules, 69 dependencies); `pnpm test` (21/21); `pnpm validate:references`; `pnpm benchmark:passwords`.
A deliberately parallel local test/boundary invocation briefly observed the boundary test's temporary negative fixture; sequential execution passes and hosted CI always executes sequentially.

Hosted PostgreSQL 18.6 evidence on `f5a7ed0…` and `2708578…`: migrations, replay, P1 seed/reseed, fixture loading, clean recreation, EN→CS→EN state switch, publication validations/immutability/rollback, auth/session/API, and no-later-table groups ran. Eight of nine P2 groups passed. The remaining group failed only because an earlier DB guard returned a different rejection code than the fixture expected (first ownership trigger, then uniqueness). Logs were inspected. The fixture now uses a non-duplicate Czech profile/course row so the composite ownership FK is tested directly.
Runs reviewed: 34962269866, 34962269905, 34962229543, 34962229449, 34986657680, 34986657771, 34986652473, 34986652411. Because integration failed, container steps were skipped; no OCI pass is claimed. Full hosted rerun and final-SHA evidence remain mandatory.
Detailed current status: `docs/p2/evidence/validation-index.json`.

## Findings, decisions and exact next task

BLOCKER: none from governing contracts. P2 acceptance remains NOT READY until final PostgreSQL and OCI/container runs are fully green on one final SHA.
IMPORTANT: push the current corrective/schema batch, inspect the actual hosted logs, synchronize the final introspection view/evidence, then run the complete P2 and P1 regression workflows again.
MINOR: GitHub-maintained Actions continue to emit their Node deprecation warning; it is not a failed gate. Node's Argon2 API is experimental, therefore the exact Node 24.19 pin and security regression tests are part of ADR-P2-IDENTITY.
Open owner decisions: none newly blocking. Owner review of OD-002 implementation occurs with the P2 milestone PR. Production hosting/privacy/provider choices retain their governing future deadlines.
EXC-P1-001 remains accepted: main is NOT technically protected. Process controls remain implementation/* branch → PR → green hosted CI → owner review; no direct/force push to main, no main deletion, no automatic merge.

Exact next task: commit/push the current P2 corrective batch to PR #2, execute complete hosted PostgreSQL, P1 regression and OCI gates, fix concrete failures, update all evidence on the final tested SHA, keep PR open, and HARD STOP before P3.
