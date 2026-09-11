# ADR-D06 — Async speech and evidence settlement

Status: ACCEPTED — materialized from owner-locked baseline (2026-09-10).

This record transcribes an approved decision. It is not a new architecture proposal. ADR-D01–D11 retain the Technical Design IDs; ADR-D12–D20 are repository indexes for additional already-approved manifest contracts.

## Decision

Use created → uploaded → queued → processing → succeeded|unavailable|failed|cancelled|expired jobs. Canonical learner outcomes: speech_correct, speech_incorrect, speech_unavailable. Correct/incorrect evidence requires usable learner speech and targets the exact Pronunciation facet in evidence_map: pronunciation_target OR intelligibility. Incorrect is non-blocking, never success; unavailable has no mastery/scheduler/mistake effect. /cancel settles once as speech_unavailable(reason=user_cancelled). Continue only advances; transport retries reuse IDs/job, terminal learner Retry creates new IDs/job. Signed late callbacks are ignored/audited after settlement. Audio is encrypted/transient and cleaned at terminal settlement/cancel or TTL ≤15 minutes.

## Authority and consequences

Manifest §2.2; TD canonical speech p23; TS pp27–28; REF §19 pp22–23 and p29. Source documents live in `01_GOVERNING_DOCUMENTS/`; manifest is `00_CONTEXT/00_project_manifest_and_constraints.md`.

Planned implementation boundaries: `packages/provider-adapters/speech; apps/api; apps/worker; packages/lesson-engine`. These paths are planning references; product code is not created in P0.

Required evidence: Every job terminal branch; simultaneous cancel/callback; duplicate create/submit/cancel; late callback; cleanup; both exact Pronunciation facets; reduced-motion/non-mic UX.

## Change control

Behavior changes require source/ADR review and owner decision first, then linked implementation, migration/compatibility and test updates. No exception is currently accepted. See `docs/governance/change-control.md`.
