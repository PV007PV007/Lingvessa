# Lingvessa implementation state and handoff

Timestamp: 2026-09-29T14:55:17.005742+00:00
Current phase: P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. P6 NOT AUTHORIZED.
Branch: `implementation/p5-media-speech`. PR [#5](https://github.com/PV007PV007/Lingvessa/pull/5): OPEN DRAFT.
Accepted main/P4 merge: `5027f001237b6451237d87343ebeca58cd0af007`.
Last exact hosted-tested source: `9d8f3de9e0e957f768534c5b0a7fc89efe1354f5`: PASS for media/audio/speech server + P1–P4 regression, not full P5. Run 36521263627/job 109254424240; evidence/ci-batch-005.json. Local synthetic Git checkpoint IDs are never reported as hosted source.

## Batch / scope

IMP-P5-001, IMP-P5-002, IMP-P5-003 in progress. All 356 planned requirement IDs and locations remain in `docs/p5/requirement-evidence.json`; no unexecuted requirement is marked PASS.

Implemented media/audio foundation has hosted PostgreSQL, S3, Chromium and OCI evidence in `docs/p5/evidence/ci-batch-003.json`. This batch adds canonical speech schemas, target evaluator boundary, DB jobs/policies/callback receipts, immutable terminal attempts/exact Pronunciation evidence, cancel/retry/Next, worker leases/recovery and encrypted transient tmpfs storage. Default evaluator/callback remains disabled; no approved provider or calibration is invented. Synthetic protocol fixtures are not linguistic QA.

Schema: new provisional migration `202609270001_p5_speech_contract`, four speech tables and nullable speech_job_id on attempts. Existing P3/P4 attempt/evidence guards extended for authorized P5 outcomes/neutral reset settlement. API: canonical speech endpoints, single-use binary upload, signed internal callback, normal LessonPlayer Next. P3 public manifest schema gains speech response/completion enums. No governing contract change. All four accepted migrations and locked PDFs/manifest unchanged.

Created/modified/deleted files: complete phase inventory `docs/p5/evidence/changed-files.json`; no deletions. Implementation notes and limits: `docs/p5/speech-contract.md`.

## Exact validation

Prior hosted exact SHA above: `pnpm install --frozen-lockfile`, `pnpm validate:baseline`, `pnpm check`, `pnpm validate:references`, `pnpm audit:dependencies`, actual S3 gate, `pnpm bootstrap:local`, `node --env-file=.local/runtime.env --import tsx --test tests/integration/*.test.ts`, `pnpm test:containers`, P3/P4 summaries: PASS. 46 unit + 4 smoke + 15 integration, no skips; 8 Chromium tests. These results do not cover the new speech batch.

New batch local: `pnpm db:validate`: PASS; `pnpm lint`: PASS; `node node_modules/typescript/bin/tsc --noEmit`: PASS; `node --import tsx --test tests/unit/*.test.ts`: 49 PASS, zero failures/skips. P3 OpenAPI drift found by the regression test was corrected by `node --import tsx tools/p3/openapi.ts`. `node --import tsx tools/p5/openapi.ts` generates the speech transport contract. Required pnpm 11.19.0 comes from scratch toolchain; repository pins unchanged.

Speech migration failure at `88413869…` is corrected and verified on PostgreSQL 18.6 at exact SHA `9d8f3de9e0e957f768534c5b0a7fc89efe1354f5`: all 16 integration tests, seven speech DB/API gates, eight earlier Chromium tests, actual S3 and four OCI regression gates PASS. No speech browser was present in that commit. New batch adds the shared microphone UI, binary proxy/typed client, recovery using the same attempt/job, in-memory-only recording, reduced-motion pulse, all three outcome Retry/Continue/Auto-advance, and two actual Chromium journeys with a synthetic evaluator. Local typecheck/lint/49 unit tests PASS. New speech browser execution remains PENDING hosted CI.

BLOCKER: none established. IMPORTANT: speech runtime/browser acceptance and M01 asset registry/approved media QA remain pending. MINOR: inherited Node Actions/Argon2id warnings.
EXC-P1-001: main NOT technically protected; branch/PR/green CI/owner acceptance process retained.
Open owner decisions: OD-004 storage profile; OD-005 providers/licences/voices; OD-006 calibrated speech policy, all retain safe defaults. Paid inference false; monthly paid budget zero.
Exact next task: run microphone browser acceptance on PR #5, fix any concrete failures, complete reference media requirements and evaluate every P5 trace row against actual evidence. No P5 merge and no P6 work.
