# ADR-D05 — Server-authoritative immutable attempts

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Server evaluates answers and commits attempt/evidence/position/mistakes/projection commands/outbox atomically. Exactly-once credit under at-least-once transport. No client or AI can set authoritative score, mastery or due time. Attempts/evidence stay immutable.

## Authority and consequences

Manifest §§1.2, 3.4; TD §16 p11; TS §13 p11. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/application; packages/mastery-review; prisma`. These paths are planning references; product code is not created in P0.

Required evidence: Concurrent duplicate/conflicting-payload and crash-injection tests; immutable replay.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
