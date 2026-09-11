# ADR-D04 — Two-level mastery and canonical evidence

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Exactly six global skills: vocabulary, grammar, listening, speaking, writing, pronunciation. Knowledge-item facets are separate. Validate canonical facet codes AND allowed skill–facet pairs; no default all-facet credit. Reading is an assessment domain only. Selection-only repair/stress tasks never emit Speaking. Typed role-play may emit Writing and explicitly assessed Grammar, never Speaking/Pronunciation.

## Authority and consequences

Manifest §2.4; TD §17 p12, canonical annex p22; FS p26. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/activity-schemas/mastery-registry.json; packages/mastery-review`. These paths are planning references; product code is not created in P0.

Required evidence: Invalid code/pair publish rejection; per-operation evidence fixtures; recompute golden tests.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
