# ADR-D20 — Pinned API and reviewed contract evolution

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

API description baseline is OpenAPI Specification 3.1.2; HTTP /api/v1 and canonical AI/speech names follow locked contracts. Product/domain/AI schema changes require versioned compatibility/migration/test evidence, not silent aliases or provider-specific identity.

## Authority and consequences

Manifest §§3.3,3.6; TS p29; TD §24 p15. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/api-client; apps/api; docs/adr`. These paths are planning references; product code is not created in P0.

Required evidence: Generated-client contract tests, schema compatibility and reviewed upgrade diff.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
