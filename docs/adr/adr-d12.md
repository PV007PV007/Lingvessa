# ADR-D12 — UUID, semantic codes and version labels

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

All *_id values are opaque UUIDs. stable_code is immutable semantic authoring identity; version_code labels immutable revisions. Resolve authoring codes/ranges/wildcards to UUID + concrete versions before publication. Provider external IDs stay in adapters/config.

## Authority and consequences

Manifest §§3.1–3.4; TD p22; TS p27; REF §4 p6. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/activity-schemas; packages/content-tools; prisma`. These paths are planning references; product code is not created in P0.

Required evidence: Rename/reorder independence; UUID validation; unresolved code/range/wildcard rejection.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
