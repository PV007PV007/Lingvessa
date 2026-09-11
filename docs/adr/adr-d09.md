# ADR-D09 — Zero paid AI budget

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

free/local-first; free_only=true; paid_inference_enabled=false; monthly_paid_budget=0. Block billable routes BEFORE network dispatch. Exhaustion cannot silently enable paid fallback. Changing this requires explicit owner approval and ADR/spec/config/test revision.

## Authority and consequences

Manifest §2.3 Initial cost policy; AI §6 p8; TD §2 p4. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/ai-core; apps/api/config`. These paths are planning references; product code is not created in P0.

Required evidence: Configured paid provider + disabled flag + exhausted free quota all produce zero paid dispatch/cost.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
