# ADR-D19 — Governance precedence and execution lock

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Manifest records approved architecture/context. Governing documents control their named domains; Plan v1.4 alone orders P0–P13. Historical phase labels do not authorize work. A real unsafe/unimplementable conflict stops work pending owner ADR/spec decision. P0 artifact PASS is not P1 authorization.

## Authority and consequences

Manifest §§3.6–3.7, §4; Plan §§7,23–24 pp5–6,10–11. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `docs/baseline; docs/governance`. These paths are planning references; product code is not created in P0.

Required evidence: Locked checksums, complete trace, change-control/DoR checks and explicit phase authorization.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
