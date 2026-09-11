# ADR-D03 — Shared content-driven engine

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

English and Czech use one content schema, activity registry and reusable engines. Language strategies/configuration may differ; language-specific engine workarounds cannot override shared contracts.

## Authority and consequences

Manifest §§1.1–1.2, 4.1; TD §2 p4; REF §§1–3 pp4–6. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/lesson-engine; packages/activity-schemas`. These paths are planning references; product code is not created in P0.

Required evidence: Same-path EN/CS reference fixtures; architecture dependency checks.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
