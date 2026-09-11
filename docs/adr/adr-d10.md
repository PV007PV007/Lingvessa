# ADR-D10 — AI permissions and human publication authority

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Manual always exists; Assist creates reviewable proposals/diffs. Auto is OFF by default and limited to server allowlisted low-risk draft actions. AI cannot publish/rollback, approve editorial gates, delete users, change mastery/roles/security/billing/budgets/provider privileges. Human Approval gates remain authoritative.

## Authority and consequences

Manifest §2.3; TD §§21–22 pp13–14; AI §§10–11 pp11–12. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/ai-core; apps/admin; apps/api`. These paths are planning references; product code is not created in P0.

Required evidence: Injection and forbidden tool-action denial; proposal review/audit; zero privilege escalation.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
