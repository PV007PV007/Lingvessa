# ADR-D01 — Modular monolith and workers

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Modular monolith API with separate workers. Microservices require measured need and approved change; no implicit architecture fork.

## Authority and consequences

Manifest §§1.2, 4.1; TD §2 p4. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `apps/api; apps/worker`. These paths are planning references; product code is not created in P0.

Required evidence: Architecture boundary tests; outbox/job failure tests.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
