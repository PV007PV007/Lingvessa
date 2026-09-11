# ADR-D07 — Pre-generated and versioned media

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Required media is generated/prepared and QA-approved before publication, owned by platform assets with UUID/version/checksum/provenance/accessibility. No learner sourcing and no live-generation dependency for ordinary attempts. Normal/slow audio and voice/variety bindings follow activity policy.

## Authority and consequences

Manifest §§1.2, 4.1; TD §20 p13; REF §20 pp23–24. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `assets/specs; packages/content-tools; packages/provider-adapters`. These paths are planning references; product code is not created in P0.

Required evidence: Missing/unapproved asset blocks publication; provider-offline playback and rollback bindings.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
