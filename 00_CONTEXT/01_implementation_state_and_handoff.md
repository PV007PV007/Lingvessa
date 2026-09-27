# Lingvessa implementation state and handoff

Timestamp: 2026-09-27T19:05:53.814236+00:00
Current phase: P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. P6 NOT AUTHORIZED.
Branch: `implementation/p5-media-speech`. PR [#5](https://github.com/PV007PV007/Lingvessa/pull/5): OPEN DRAFT.
Accepted main/P4 merge: `5027f001237b6451237d87343ebeca58cd0af007` (merge tree equals tested P4 `ee16aeea822d7cccb09f65e310d19fd5a1807747`).
Last exact hosted P5 source: `789f0d400144012ae663635c343f38940167a822`, failed integration, not accepted. Current audio/SQL follow-up needs its own exact-head hosted result. Local synthetic checkpoint IDs are not remote tested SHAs.

## Batch / tasks / requirements

IMP-P5-001 and IMP-P5-002 in progress. IMP-P5-003 pending. Requirement IDs and source locations: all 356 rows in `docs/p5/requirement-evidence.json`; no unexecuted requirement marked PASS.

Media versions and publication preflight are implemented. Added authenticated run/item-scoped media API, Range delivery, explicit normal/slow playback, speaker labels/timing, transcript fallback and CSRF-protected idempotent transcript-use audit. Raw provider configuration stays server-side. Synthetic tone/geometry fixtures are explicitly not linguistic QA or real M01 media.

Schema/migrations: provisional `202609260001_p5_media_foundation`; voices, characters, media_requirements, media_jobs, assets, asset_versions, asset_approvals, content_media_bindings, publication_assets. Fixed the confirmed SQL alias collision; added exact normal-source linkage for slow audio and publication closure. All four accepted migrations and seven governing PDFs unchanged. API: GET media metadata/bytes under owned lesson run and POST transcript support; no AI API or speech endpoint yet. No contract change.

Files added/modified/deleted: `docs/p5/evidence/changed-files.json` is the complete inventory; no deletions. Audio schemas/controller/player, media configuration/repository, synthetic fixtures/API/browser tests and P5 workflow changed in this batch.

## Validation and evidence

`node node_modules/typescript/bin/tsc --noEmit`: PASS.
`node --import tsx --test tests/unit/p5-*.test.ts`: PASS 5/5, zero skipped.
Required pnpm 11.19.0 from scratch toolchain. `pnpm lint`: PASS. `pnpm typecheck && pnpm check:boundaries && pnpm check:secrets && pnpm test && pnpm build && pnpm test:smoke`: PASS (46 unit, 4 smoke, zero skipped; server/web/admin build). `python3 tools/governance/validate_p5_baseline.py`: PASS 74/74. Aggregate local `pnpm check` remains unconfirmed after peers check; hosted exact-head full sequence is mandatory. No repository pin changed.
Hosted previous source 789f0d4: install, baseline, full check, references, audit, actual S3 protocol/restart and PostgreSQL bootstrap PASS. Integration FAIL: PL/pgSQL `av` variable conflicts with SQL `av` alias in P5 publication guard. OCI and acceptance summaries SKIPPED after failure. Exact run/job and corrective action: `docs/p5/evidence/ci-batch-002.json`. No failed/skipped step is claimed passed. Audio API/browser checks are prepared, not yet runtime proof.

BLOCKER: none established. IMPORTANT: P5 exit gates and speech implementation remain pending. MINOR: inherited Node Actions/Argon2id warnings; no dependency churn.
EXC-P1-001 remains: main NOT technically branch protected. Branch/PR/green CI/owner acceptance process applies.
Open owner decisions OD-004 storage profile, OD-005 providers/licences/voices, OD-006 calibrated speech policy retain safe defaults (synthetic adapters only; unapproved speech unavailable). No unapproved learner-data route or paid inference.
Exact next task: commit this audio/SQL batch to PR #5, inspect and fix its actual hosted tests; then implement IMP-P5-003 under the canonical speech contract. No P5 merge or P6 work.
