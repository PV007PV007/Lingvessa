# P5 schema and API implementation diff

Compared with accepted P4 `5027f001237b6451237d87343ebeca58cd0af007`. Owner-locked documents and first four accepted migrations are unchanged (validated SHA-256 set).

- Provisional `202609260001_p5_media_foundation`: voices, characters, media_requirements, media_jobs, assets, asset_versions, asset_approvals, content_media_bindings, publication_assets. Language/variety/identity/immutable pin and publication completeness guards. Avatar metadata binds exact character UUID/version. Role-bound audio requires unique UUID turn IDs; slow pins retain normal voice/character/turn identity with timing-only differences.
- Provisional `202609270001_p5_speech_contract`: versioned speech_policies, speech_jobs, speech_callback_receipts, speech_next_receipts; attempts gains nullable speech_job_id. Exact owner/profile/language/content/evidence and deferred exactly-once settlement constraints; three outcomes with neutral unavailable; no raw audio columns. `quota_exhausted` is a neutral unavailable reason.
- Cost windows reuse existing auth_rate_windows with distinct hashed namespaces; no P8 AI/quota runtime or new authority is introduced.
- API: versioned media projection/bytes for pinned lesson assets; `/speech/jobs` create/get/latest, single-use audio upload, submit/cancel, internal authenticated callback, current-job Next. Authentication/CSRF/strict payloads/UUIDs and provider-neutral responses. Exact OpenAPI is `infra/contracts/p5-speech.openapi.json`; transport 429 is documented. Paid defaults remain disabled/zero.
- No P6/P7 reference lesson implementation, P8 AI foundation or later-phase table/API is added.

Unaccepted P5 migrations may be rebuilt from a clean test database during this PR. Accepted history is never rewritten. Runtime DDL evidence is hosted PostgreSQL; local structural/WASM diagnostics are not represented as runtime acceptance.
