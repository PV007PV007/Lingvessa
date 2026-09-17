# P3 scope and acceptance ownership

Execution authority: Implementation Plan v1.4 §10, p. 6, and task packets IMP-P3-001…IMP-P3-004. The accepted P0 trace remains an immutable planning snapshot; this phase overlay joins it by requirement_id and preserves every assigned row.

P3 implements the shared deterministic Lesson Engine, pinned run/resume, activity registry, synthetic EN/CS core-family renderers, server-authoritative attempt transaction, immutable raw evidence/receipts, transactional outbox, correct/reveal/remediation and the non-sensitive unsent queue. Browser fixtures contain 12 activity instances per language across two executable lessons. They establish engine contracts, not complete pedagogical M01 content.

| Acceptance owner | Obligation retained after P3 |
| --- | --- |
| P4 / Plan §11 | Two-level mastery projections/recompute, Review scheduling, mistakes and collections. P3 writes versioned raw evidence, with explicit unprojected/unscheduled markers. |
| P5 / Plan §12 | Versioned actual audio/media delivery, microphone UX, speech jobs/settlement and pronunciation evidence. P3 listening fixtures exercise the approved text/transcript fallback; speech registry entries cannot start a P3 run. |
| P6/P7 / Plan §§13–14 | Full English/Czech M01 curriculum, four-lesson coverage and pedagogical/media acceptance. Synthetic fixtures are not marketed as those modules. |
| P8/P9 / Plan §§15–16 | Shared AI foundation/Admin Assist followed by learner AI, opt-in/routing/budget/permissions. P3 makes no AI call; provider policy is unchanged. |
| P10 and later | Complete product settings/navigation, operational/release validation on their scheduled milestone boundaries. |

`requirement-evidence.json` has 165 unique rows (162 MUST, 3 SHOULD). Each row records its implemented P3 slice, actual source/test files and the later phase(s) for any residual obligation. `P3_FOUNDATION_PARTIAL` and `FUTURE_RUNTIME_ACCEPTANCE` do not mean the full governing requirement has been accepted. P3 may pass its own exit gate only after all four P3 task packets and the real bilingual E2E/duplicate-evidence gates pass. No owner-approved architecture decision is reopened.

Exact-commit evidence: workflow checkout selects the actual PR head (also on pull_request), `GITHUB_HEAD_SHA` must equal `git rev-parse HEAD`, and generated `artifacts/p3/acceptance-summary.json` records that full SHA plus hashes of the executed runtime reports. A versioned handoff can record a previously verified checkpoint and reference this generated final-HEAD attestation without embedding its own not-yet-created Git hash. Closure is not valid merely because the preceding code checkpoint was green; all final-head checks must also succeed.
