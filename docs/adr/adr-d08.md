# ADR-D08 — Optional provider-agnostic AI and adapters

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

AI is optional; all core learning remains usable with every provider disabled. Shared ports route to approved local/free providers; provider types/URLs stay in adapters. One packages/provider-adapters tree contains ai/speech/tts/image/email/storage. OpenAI is not a mandatory provider.

## Authority and consequences

Manifest §2.3; TD §2 p4, canonical map p23; AI §§2–5 pp4–7. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/ai-core; packages/provider-adapters`. These paths are planning references; product code is not created in P0.

Required evidence: AI-off EN/CS E2E; provider replacement and import-boundary tests.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
