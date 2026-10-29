# P6 — English reference module

Owner authorized P6 on 2026-10-29 with **“дозволяю”**, answering the explicit proposal to accept P5 for development/reference, merge PR #5 by merge commit and begin P6. [Acceptance record](evidence/p5-acceptance.json) pins tested source `8f353cf44945738cff1b2ea49bfd9ce730ebf022`, merge `da3a38c844d68bc6b4051f59d8c9265964347069` and unchanged tree `ff9e9f0b364db7d2989973e6197cb12133e5bcb0`. Seven workflows / eleven jobs passed; both real M01 artifact sets were independently audited. [Retained final proof](evidence/verified-p5-ci-8f353cf.json).

P0–P5 are accepted in their recorded scopes. **P6 IN PROGRESS / NOT READY; P7 not authorized.** Historical P5 authorization, task records and CI artifacts retain their pre-acceptance status. This later owner decision is the current phase authority; it does not rewrite those artifacts or promote incomplete requirements.

Implementation authority: Implementation Plan v1.4 §13 p7 / Appendix B p12; Reference Module Design v1.6 §§5–11 pp8–14. The task is IMP-P6-001: all four English lessons and Recap, approved media, en-GB default/en-US meaningful variants, facet-correct deterministic evaluation, results/remediation/Review, resume and nonblocking speech, then mobile/desktop vertical-slice QA.

## First implementation batch

- `content/english/m01/sequence.json` preserves all 58 source activity rows across the five existing lesson identities. It is an authoring outline, **not an executable lesson manifest**. Compound rows must be implemented fully, not reduced to one probe.
- `evaluation-probes.json` provides 20 bounded text-policy probes and 176 positive/negative cases across en-GB/en-US: be, sound-based a/an, objective-specific contractions, origin/UK article, short answers, repair phrases and spelling. They call the unchanged shared evaluator. They do not implement full lesson content, learner-profile variety selection, audio-variety switching, richer meaning/form feedback or multi-turn rubrics.
- `tools/p6/reference-preflight.ts` checks the exact governing source, row coverage, canonical facets, existing immutable English asset identities and actual SVG bytes. It reports 210 audio metadata pins, 15 visuals and three en-GB voices. **It does not claim new WAV byte verification, lesson import or browser execution.** P5 real-byte proof remains separately bound to its accepted source.
- All 97 P6 source clauses are preserved as PENDING. No complete requirement is marked PASS from a partial probe. [Observed defects and next gates](defects.json) prevent a preparation report being mistaken for vertical-slice acceptance.

## Execution and continuation

Use the pinned `.node-version` / pnpm toolchain. `pnpm validate:baseline`, `node --import tsx --test tests/unit/p6-reference.test.ts` and `node --import tsx tools/p6/reference-preflight.ts` validate this batch. Hosted P6 CI retains source-bound preflight evidence; P1–P5 workflows retain historical regression. A green preparation job is not the Plan §13 exit report.

Next, compile the 58 source rows into complete versioned lesson/activity/knowledge/outcome manifests, resolving the listed shared-contract and objective/media gaps. Then execute disposable PostgreSQL/S3 load/replay/publication and the actual English browser journeys. Use existing content/publication/lesson boundaries; do not hardcode English content in the renderer or create an English-only evaluator.

Any actual contract/invariant change follows `docs/governance/change-control.md`: document the exact conflict, prepare the ADR/spec change and secure the necessary owner decision before changing behavior. Ordinary implementation within the approved contracts continues autonomously. The defect list is not a request to reopen accepted P5 or regenerate media.

OD-004 stays OPEN before production delivery; OD-006 stays OPEN before usable learner scoring. Existing approved audio/visual sets remain unchanged, speech defaults to unavailable, large audio bytes stay outside Git, and no new paid service or PC access is needed. P7 and later milestones remain stopped until separately authorized.
