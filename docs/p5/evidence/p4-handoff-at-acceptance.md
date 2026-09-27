# Lingvessa implementation state and handoff

Timestamp: 2026-09-25T06:09:52.686873+00:00
Current phase: P4 — PASS READY FOR OWNER ACCEPTANCE, subject to final exact-head checks. P0/P1/P2/P3 ACCEPTED. P5 NOT AUTHORIZED.
Branch: `implementation/p4-mastery-review`. PR [#4](https://github.com/PV007PV007/Lingvessa/pull/4): OPEN, not merged.
Accepted main/P3 merge: `07b6aae9b001dbb4d620df3d491473a95f674ad2`. P3 tested source: `9932a1bbf4b95353445422cb7bde7396d8f1fab5`; owner-delegated review and merge recorded in `docs/p4/evidence/p3-acceptance.json`.
Exact tested implementation checkpoint: `5873b6f9789b92d4aa0dee5044481745c1385ef4`.

Final containing commit must pass P1 push/PR, P2 PR, P3 PR and P4 push/PR on its exact head. artifacts/p4/acceptance-summary.json:tested_sha must equal checked-out HEAD and GITHUB_HEAD_SHA. Earlier green checkpoint is not acceptance of later code/metadata.
The containing closure commit requires its own full successful rerun. The final exact SHA is recorded by generated `artifacts/p4/acceptance-summary.json:tested_sha`, compared with `git rev-parse HEAD`, and included in the PR/final delivery.

## Completed batch

IMP-P4-001 -> IMP-P4-002 -> IMP-P4-003. All 148 P4 requirement IDs and their task/code/schema/test mappings are in `docs/p4/requirement-evidence.json`; future-phase portions are explicit. Main IDs include CUR-A1-007/008/009, MAST-001..007, REV-001..005, COLL-001..003, TD-MAST/TD-REV and TS-MAST/TS-REV. Complete added/modified/deleted file inventory: `docs/p4/evidence/changed-files.json`.

Implemented versioned facet/mastery projections, exactly six skill aggregates, scheduling, Review session ordering/dedup/expiry/skip, mistakes/remediation, curated hint, language-scoped collections, audited reset scopes, authenticated API and shared-player Review UI. Negative isolation, concurrent receipt/recompute, rollback, browser and container gates passed at the named checkpoint.

Schema: 12 P4 tables; additive migration `202609180001_p4_mastery_review`; Review/hint/reset fields and constraint guards extend P3. Historical migrations, attempts/evidence and owner-locked PDFs remain unchanged. Schema/API route list, migration checksum, identity/transaction/rollback contracts: `docs/p4/evidence/schema-api-diff.json`. No governing contract change. PostgreSQL remains source of truth; no AI/media/speech runtime was added.

## Validation and CI

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm validate:baseline`: PASS.
- `pnpm check`: PASS.
- `pnpm validate:references`: PASS.
- `pnpm audit:dependencies`: PASS.
- `pnpm exec playwright install --with-deps chromium`: PASS.
- `pnpm bootstrap:local`: PASS.
- `P3_BROWSER_TESTS=true P4_BROWSER_TESTS=true node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`: PASS.
- `pnpm test:containers`: PASS.
- `node --import tsx tools/p3/acceptance-summary.ts`: PASS.
- `node --import tsx tools/p4/acceptance-summary.ts`: PASS.

- [P1 foundation / pull_request / 36101078692](https://github.com/PV007PV007/Lingvessa/actions/runs/36101078692): SUCCESS.
- [P3 lesson engine / pull_request / 36101078680](https://github.com/PV007PV007/Lingvessa/actions/runs/36101078680): SUCCESS.
- [P2 data foundation / pull_request / 36101078687](https://github.com/PV007PV007/Lingvessa/actions/runs/36101078687): SUCCESS.
- [P4 mastery and Review / pull_request / 36101078697](https://github.com/PV007PV007/Lingvessa/actions/runs/36101078697): SUCCESS.
- [P4 mastery and Review / push / 36101075639](https://github.com/PV007PV007/Lingvessa/actions/runs/36101075639): SUCCESS.
- [P1 foundation / push / 36101075634](https://github.com/PV007PV007/Lingvessa/actions/runs/36101075634): SUCCESS.

P4 acceptance: real PostgreSQL clean/repeat/fresh migration+seed, projection recompute and two-level isolation, transaction fault/concurrency, active-publication channel isolation, Review stale/replay/skip/expiry, collections, reset, SQL/Prisma parity, two EN/CS Chromium journeys; P1–P3 regression and four OCI images/degraded/recovery passed. Raw gate summary/hashes and linked hosted artifacts: `docs/p4/evidence/verified-runtime-checkpoint.json`, `hosted-ci.json`, `validation-index.json`. Current exit record: `docs/p4/P4_exit_evidence.md`.

BLOCKER: 0. IMPORTANT: 0 once final-head CI passes. MINOR/technical debt: inherited Node Actions/Argon2id warnings; full-history projection load validation remains P11. This is P4 engine acceptance, not launch acceptance.
EXC-P1-001: main is NOT technically protected. No direct/force push, no deletion, PR and green hosted checks required; owner acceptance controls milestone transition.
Open owner decisions: none blocking P4. P5 storage/provider/licensing/calibration choices remain future decisions, not reopened architecture.
Exact next task: verify final closure HEAD checks, then owner review/acceptance of PR #4. Do not merge without authorization. Stop before P5; no P5 implementation exists.
