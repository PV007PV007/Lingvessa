# Lingvessa implementation state and handoff

Timestamp: 2026-09-30T10:39:03.080510+00:00
Current phase: **P5 IN PROGRESS / NOT READY**. P0–P4 ACCEPTED. P6 NOT AUTHORIZED.
Branch: `implementation/p5-media-speech`. PR [#5](https://github.com/PV007PV007/Lingvessa/pull/5): OPEN DRAFT.
Accepted main/P4 merge: `5027f001237b6451237d87343ebeca58cd0af007`.
Latest exact hosted-tested source: `76aa3aedc12f31eada6e6320ec526a3fcda36cf9`. P5 run 36586379882, job 109467720069 PASS; artifact/checksum in `docs/p5/evidence/ci-batch-006.json`. The additions described below await their own remote commit/CI. Local Git history is synthetic; local checkpoint IDs are never represented as GitHub-tested source.

## Batch and implementation

Tasks IMP-P5-001 / 002 / 003 remain IN_PROGRESS. All 356 requirement IDs and source locators are retained in `docs/p5/requirement-evidence.json`. Verified rows now cite concrete gates/remote SHA; incomplete reference content and unexecuted changes stay PARTIAL/PENDING.

Hosted microphone acceptance is now proven: real Chromium English correct/retry mismatch/Continue/Auto-advance/reduced-motion/lost-response replay and Czech denied/absent/low-confidence/provider failure/cancellation. Raw audio uses ephemeral encrypted storage, correct/incorrect evidence targets the exact Pronunciation facet, unavailable is neutral. Controlled test adapter is not production linguistic calibration.

New batch: (1) exact versioned character/avatar media pin and shared audio-clock UI; (2) atomic complete-file publication of encrypted raw audio to avoid a concurrent TTL sweep race; (3) deferred settlement, expired job, failed cleanup recovery, expired lease, cancelled in-flight and stale/late callback tests; (4) 18 original reference vector drafts, 168 scripts/420 audio slots and 6 voice profiles, all preproduction and unapproved. No P6/P7 lesson content implementation/publication.

Schema/migrations: only provisional P5 media migration gains avatar binding and publication closure guards. No new table or accepted migration rewrite in this batch. API: existing media projection gains avatar character UUID/version; speech endpoint names/behavior unchanged. Architecture: **No contract change**. Fixed modular monolith/PostgreSQL/shared EN-CS/provider-neutral/free-only decisions retained.

Files added/modified/deleted: `docs/p5/evidence/changed-files.json` is the complete phase inventory. New assets/specs/p5 catalog, generated static SVGs, tools/p5/reference-media.ts; media schema/persistence/migration/UI/fixtures/tests; speech transient storage/tests; workflow and governance evidence updated. No deletions.

## Commands and results

Verified hosted source above: `pnpm install --frozen-lockfile`, `pnpm validate:baseline`, `pnpm check`, `pnpm validate:references`, `pnpm audit:dependencies`, `MINIO_BINARY=... node --import tsx tools/p5/storage-gate.ts`, `pnpm bootstrap:local`, `node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`, `pnpm test:containers`, P3/P4 acceptance summaries: PASS. 49 unit + 4 smoke + 16 integration, zero failures/skips; 10 Chromium tests; PostgreSQL 18.6 and four OCI services. Runtime artifact 11042820875, digest in ci-batch-006.

New batch local: pinned pnpm 11.19.0 `pnpm check`: PASS (50 unit, 4 smoke, type/lint/boundaries/secrets/Prisma/server and web/admin builds); `pnpm validate:baseline`: 74/74 PASS; `node --import tsx tools/p5/reference-media.ts --write`: structural PASS, publication_ready false. `node --import tsx --test tests/unit/p5-media.test.ts`: 3/3 PASS after avatar schema negatives. Scratch PGlite applies all six SQL files as diagnosis only; real PostgreSQL and OCI are hosted gates, pending for this batch.

## Acceptance and remaining work

P5 **NOT READY**. Technical batch success is not a complete reference media library or human QA. M01 audio bytes, flag geometry/rights, approved voices and semantic/accessibility/linguistic media review remain; every trace row still needs final evaluation and full exact-source CI at closure.

BLOCKER: none established. IMPORTANT: incomplete reference media/QA, new-batch hosted checks and trace closure. MINOR: inherited Actions Node/Argon2id warnings.
EXC-P1-001: main is NOT technically branch-protected; branch/PR/green CI/owner review process retained.
Open owner decisions: OD-004 storage delivery profile; OD-005 provider/licence/voices; OD-006 calibrated usable speech. Defaults: no unapproved production calls; paid inference false; monthly paid budget zero; unapproved scoring -> speech_unavailable, no evidence.
Exact next task: push this P5 batch, inspect actual CI logs, fix concrete failures, complete reference media preparation/trace and prepare concrete owner decision inputs. Keep PR #5 open; do not merge or start P6.
