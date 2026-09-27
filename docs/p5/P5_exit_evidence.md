# P5 exit evidence

Status: IN PROGRESS / NOT READY for owner acceptance.

Owner accepted P4 and explicitly authorized P5 on 2026-09-26. PR #4 merge: `5027f001237b6451237d87343ebeca58cd0af007`; source tree equals tested P4 `ee16aeea822d7cccb09f65e310d19fd5a1807747`.

Branch: `implementation/p5-media-speech`. Current batch: IMP-P5-001 media foundation. IMP-P5-002/003 remain pending. No P6 work.

Implemented media schemas/ports, immutable stores, media version/QA/publication SQL guards and preflight repository. Controlled synthetic tests do not certify real reference-module language/media quality. S3 signing unit tests do not prove an actual provider integration.

Required remaining evidence: actual PostgreSQL migration/replay/negative/immutability gates; hosted P1-P4 regression and OCI; actual S3-compatible endpoint; normal/slow/multispeaker playback; microphone/speech safe-state/callback/settlement/cleanup gates; required M01 media resolution and approved QA; exact final commit CI. None is assumed from prepared code.

Open decisions OD-004/005/006 retain documented defaults. No provider selected or approved silently; paid inference stays disabled and budget zero. No new architecture decision or specification change.

EXC-P1-001 remains: main is not technically branch protected. PR and green hosted CI plus owner milestone acceptance are process controls.

P5 PR must remain open; no merge or P6 authorization is implied by passing any intermediate batch.
