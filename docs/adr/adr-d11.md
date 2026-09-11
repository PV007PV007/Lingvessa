# ADR-D11 — Reference modules before A1 scale

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

English E-A1-M01 + recap at P6; Czech C-A1-M01 + recap at P7 on the same engine. P11 freezes the validated reference release. Bulk M02–M12 rollout/pilot/optional Level Test belongs to P12.

## Authority and consequences

Manifest §4 P6–P13 and §4.1; Plan §§13–20 pp7–9. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `content/english; content/czech; tests/e2e`. These paths are planning references; product code is not created in P0.

Required evidence: REF T01–T32 + TAC/TDA and reference RC report before P12.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
