# ADR-D17 — PWA before native and bounded offline scope

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Responsive Web/PWA first. Native apps and full offline course are separate acceptance scopes requiring evidence/approval. Current non-sensitive unsent attempt queue is allowed; raw microphone bytes never enter IndexedDB.

## Authority and consequences

Manifest §4.1; TS §§16,26 pp12,16; TD §25 pp15–16. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `apps/web; packages/lesson-engine`. These paths are planning references; product code is not created in P0.

Required evidence: Responsive keyboard/touch parity; reload/reconnect idempotency; no audio/secret local persistence.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
