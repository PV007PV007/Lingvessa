# ADR-D18 — PostgreSQL relational knowledge graph

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Typed relational knowledge items/edges in PostgreSQL are the baseline. A graph database is not required. RAG/vector search is optional only after measured need; it does not change curriculum authority or language isolation.

## Authority and consequences

Manifest §4.1; TD §§6–7 p7; AI §22.2 pp19–20. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `prisma; packages/domain`. These paths are planning references; product code is not created in P0.

Required evidence: Typed edge/reference validation, language lineage, outcome/knowledge coverage.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
