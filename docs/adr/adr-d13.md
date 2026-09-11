# ADR-D13 — DB-enforced language and ownership lineage

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

PostgreSQL composite uniqueness/FKs/checks (and approved DEFERRABLE trigger guards where needed) prove user + language_profile + language lineage. Include attempts, evidence, review, collections and learner AI. Facet requires knowledge_item_id. Service-only checks are insufficient.

## Authority and consequences

Manifest §2.1; TD canonical isolation p22 and Appendix E p24; TS p27. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `prisma; packages/application`. These paths are planning references; product code is not created in P0.

Required evidence: Direct SQL negative foreign-user and cross-language fixtures fail before projections; EN→CS→EN does not mutate other profile.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
