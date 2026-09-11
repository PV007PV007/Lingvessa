# ADR-D14 — Immutable publication and exact Approval target

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Published content/assets are immutable snapshots; edits make new versions. Active runs pin exact publication/content; rollback changes active pointer, preserving historical attempts/evidence. Runtime Approval is bound to target_content_version_id + target_checksum + gate_type + reviewer_id + decision + decided_at + notes; content change invalidates prior approvals. Baseline owner approval is a separate record.

## Authority and consequences

Manifest §3.4; TD §§8–11 pp8–10; TS §10 pp9–10. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/content-tools; apps/api; apps/admin; prisma`. These paths are planning references; product code is not created in P0.

Required evidence: Checksum-sensitive approval denial, stale approval rejection, old-run replay and pointer rollback drill.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
