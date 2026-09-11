# ADR-D16 — Learner opt-in and privacy precedence

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Learner AI OFF until explicit opt-in/consent. Effective order: global → capability → approved provider/model/data policy → learner setting/required consent → quota/budget. Every failed check gives deterministic fallback; no send to an ineligible provider merely because it is free.

## Authority and consequences

Manifest §2.3 Learner AI enablement order; AI p25; TD p23. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/ai-core; apps/api; apps/web`. These paths are planning references; product code is not created in P0.

Required evidence: Precedence truth-table, consent-revocation/no-network, sensitive-route denial, no paid fallback.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
