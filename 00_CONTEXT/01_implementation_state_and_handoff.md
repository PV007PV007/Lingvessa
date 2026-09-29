# Lingvessa implementation state and handoff

Timestamp: 2026-09-29T04:06:06.688822+00:00
Current phase: P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. P6 NOT AUTHORIZED.
Branch: `implementation/p5-media-speech`. PR [#5](https://github.com/PV007PV007/Lingvessa/pull/5): OPEN DRAFT.
Accepted main/P4 merge: `5027f001237b6451237d87343ebeca58cd0af007`.
Last exact hosted-tested source: `b3cac5d843b4a11b9b8e2d06b9e9495467cc1b6d`: PASS for media/audio + P1–P4 regression, not full P5. Run 36378454901/job 108788995230. Local synthetic Git checkpoint IDs are never reported as hosted source.

## Batch / scope

IMP-P5-001, IMP-P5-002, IMP-P5-003 in progress. All 356 planned requirement IDs and locations remain in `docs/p5/requirement-evidence.json`; no unexecuted requirement is marked PASS.

Implemented media/audio foundation has hosted PostgreSQL, S3, Chromium and OCI evidence in `docs/p5/evidence/ci-batch-003.json`. This batch adds canonical speech schemas, target evaluator boundary, DB jobs/policies/callback receipts, immutable terminal attempts/exact Pronunciation evidence, cancel/retry/Next, worker leases/recovery and encrypted transient tmpfs storage. Default evaluator/callback remains disabled; no approved provider or calibration is invented. Synthetic protocol fixtures are not linguistic QA.

Schema: new provisional migration `202609270001_p5_speech_contract`, four speech tables and nullable speech_job_id on attempts. Existing P3/P4 attempt/evidence guards extended for authorized P5 outcomes/neutral reset settlement. API: canonical speech endpoints, single-use binary upload, signed internal callback, normal LessonPlayer Next. P3 public manifest schema gains speech response/completion enums. No governing contract change. All four accepted migrations and locked PDFs/manifest unchanged.

Created/modified/deleted files: complete phase inventory `docs/p5/evidence/changed-files.json`; no deletions. Implementation notes and limits: `docs/p5/speech-contract.md`.

## Exact validation

Prior hosted exact SHA above: `pnpm install --frozen-lockfile`, `pnpm validate:baseline`, `pnpm check`, `pnpm validate:references`, `pnpm audit:dependencies`, actual S3 gate, `pnpm bootstrap:local`, `node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`, `pnpm test:containers`, P3/P4 summaries: PASS. 46 unit + 4 smoke + 15 integration, no skips; 8 Chromium tests. These results do not cover the new speech batch.

New batch local: `pnpm db:validate`: PASS; `pnpm lint`: PASS; `node node_modules/typescript/bin/tsc --noEmit`: PASS; `node --import tsx --test tests/unit/*.test.ts`: 49 PASS, zero failures/skips. P3 OpenAPI drift found by the regression test was corrected by `node --import tsx tools/p3/openapi.ts`. `node --import tsx tools/p5/openapi.ts` generates the speech transport contract. Required pnpm 11.19.0 comes from scratch toolchain; repository pins unchanged.

New speech DB/browser/OCI execution: PENDING hosted exact-head verification. Local environment has no Docker/PostgreSQL; no prepared code counted as runtime success.

BLOCKER: none established. IMPORTANT: speech runtime/browser acceptance and M01 asset registry/approved media QA remain pending. MINOR: inherited Node Actions/Argon2id warnings.
EXC-P1-001: main NOT technically protected; branch/PR/green CI/owner acceptance process retained.
Open owner decisions: OD-004 storage profile; OD-005 providers/licences/voices; OD-006 calibrated speech policy, all retain safe defaults. Paid inference false; monthly paid budget zero.
Exact next task: push this speech server batch to PR #5, fix concrete hosted failures, complete microphone/reduced-motion/Continue/Retry browser gates and reference media requirements. No P5 merge and no P6 work.
