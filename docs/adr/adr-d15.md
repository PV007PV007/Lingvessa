# ADR-D15 — P8 shared foundation then P9 learner AI

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

P8 delivers Gateway/Policy Engine/Router/adapter(s)/Prompt Registry/Output Validator/Usage Meter/Audit for Admin AI Assist. P9 reuses it for learner grounding/context/sessions and optional low-risk Auto. No duplicate AI stack; no learner exposure or Auto activation in P8.

## Authority and consequences

Manifest §2.3 AI implementation dependency, §4 P8/P9; Plan §§15–16 p8. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/ai-core; packages/provider-adapters/ai; apps/admin`. These paths are planning references; product code is not created in P0.

Required evidence: P8 Admin Assist cannot bypass gates; P9 learner opt-in, grounding, quota/privacy and Auto allowlist tests.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
